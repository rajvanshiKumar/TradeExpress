import io
import time
import uuid

import pytest
from PIL import Image

pytestmark = pytest.mark.integration
API = "/api/v1"


def png_bytes(w=300, h=300, color=(10, 120, 200)) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (w, h), color)
    token = uuid.uuid4().bytes  # 128 bits of entropy -> unique hash per call
    for i in range(0, 15, 3):
        img.putpixel((i, 1), (token[i], token[i + 1], token[i + 2]))
    img.save(buf, "PNG")
    return buf.getvalue()


async def upload(client, acct, org, data=None, name="p.png", ctype="image/png"):
    return await client.post(f"{API}/images/upload", headers=acct.h(org),
                             files={"file": (name, data if data is not None else png_bytes(), ctype)})


async def test_upload_extracts_metadata_and_serves_via_signed_url(client, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    data = png_bytes(320, 240)
    r = await upload(client, a, org, data)
    assert r.status_code == 201, r.text
    body = r.json()
    assert (body["width"], body["height"], body["mime_type"]) == (320, 240, "image/png")
    assert len(body["sha256"]) == 64 and body["duplicate"] is False
    assert "storage_key" not in body  # internal path is never exposed
    got = await client.get(body["url"])  # signed URL, no Authorization header
    assert got.status_code == 200 and got.headers["content-type"].startswith("image/")
    thumb = await client.get(body["thumbnail_url"])
    assert thumb.status_code == 200


async def test_signed_url_tamper_and_expiry_rejected(client, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    body = (await upload(client, a, org)).json()
    bad = body["url"].replace("sig=", "sig=00")
    assert (await client.get(bad)).status_code == 403
    expired = body["url"].split("exp=")[0] + "exp=1&sig=" + body["url"].split("sig=")[1]
    assert (await client.get(expired)).status_code == 403


async def test_duplicate_upload_returns_existing(client, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    data = png_bytes()
    first = (await upload(client, a, org, data)).json()
    r = await upload(client, a, org, data)
    assert r.status_code == 200
    assert r.json()["id"] == first["id"] and r.json()["duplicate"] is True


async def test_same_bytes_in_other_org_is_separate_and_isolated(client, make_account, make_org):
    a, b = await make_account("a"), await make_account("b")
    org_a, org_b = await make_org(a), await make_org(b)
    data = png_bytes()
    ia = (await upload(client, a, org_a, data)).json()
    ib = (await upload(client, b, org_b, data)).json()
    assert ia["id"] != ib["id"]
    assert (await client.get(f"{API}/images/{ia['id']}", headers=b.h(org_b))).status_code == 404
    assert (await client.delete(f"{API}/images/{ia['id']}", headers=b.h(org_b))).status_code == 404
    assert (await client.get(f"{API}/images/{ia['id']}", headers=a.h(org_a))).status_code == 200


async def test_invalid_files_rejected(client, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    assert (await upload(client, a, org, b"<?php evil ?>" * 100, "x.png")).status_code == 422
    assert (await upload(client, a, org, png_bytes(), "x.jpg")).status_code == 422
    assert (await upload(client, a, org, png_bytes(40, 40))).status_code == 422


async def test_viewer_cannot_upload_and_auth_required(client, make_account, make_org):
    owner, viewer = await make_account("o"), await make_account("v")
    org = await make_org(owner)
    await client.post(f"{API}/organizations/{org}/members",
                      json={"email": viewer.email, "role": "viewer"}, headers=owner.h())
    assert (await upload(client, viewer, org)).status_code == 403
    r = await client.post(f"{API}/images/upload", headers={"X-Organization-Id": org},
                          files={"file": ("p.png", png_bytes(), "image/png")})
    assert r.status_code == 401


async def test_delete_image(client, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    body = (await upload(client, a, org)).json()
    assert (await client.delete(f"{API}/images/{body['id']}", headers=a.h(org))).status_code == 204
    assert (await client.get(f"{API}/images/{body['id']}", headers=a.h(org))).status_code == 404
    assert (await client.get(body["url"])).status_code == 404
    time.sleep(0)


async def test_concurrent_identical_uploads_are_deduplicated_not_500(client, make_account, make_org):
    import asyncio

    a = await make_account()
    org = await make_org(a)
    data = png_bytes()
    rs = await asyncio.gather(*[upload(client, a, org, data) for _ in range(8)])
    assert {r.status_code for r in rs} <= {200, 201}
    assert len({r.json()["id"] for r in rs}) == 1
