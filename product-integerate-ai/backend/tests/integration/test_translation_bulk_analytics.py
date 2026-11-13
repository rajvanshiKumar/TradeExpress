import io
import zipfile

import pytest

from app.ai.testing import FakeProvider
from tests.integration.test_images_api import png_bytes, upload
from tests.integration.test_listing_flow import result, run

pytestmark = pytest.mark.integration
API = "/api/v1"


@pytest.fixture
def fake(app):
    p = FakeProvider()
    app.state.ai_provider = p
    return p


async def ready_job(client, app, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    img = (await upload(client, a, org)).json()
    job_id = await run(client, app, a, org, [img["id"]])
    return a, org, job_id


# ------------------------------------------------------------ translation

async def test_languages_endpoint(client, make_account):
    a = await make_account()
    langs = (await client.get(f"{API}/languages", headers=a.h())).json()
    codes = {x["code"]: x for x in langs}
    assert codes["ar"]["rtl"] is True and "hi" in codes and len(codes) >= 10


async def test_translate_stores_separate_record_and_keeps_original(client, app, fake, make_account, make_org):
    a, org, job_id = await ready_job(client, app, make_account, make_org)
    before = await result(client, a, org, job_id)
    r = await client.post(f"{API}/ai/translate", headers=a.h(org), json={"job_id": job_id, "locale": "fr"})
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["locale"] == "fr" and t["source_locale"] == "en" and t["status"] == "draft"
    assert t["fields"]["title"].startswith("[French]") and isinstance(t["fields"]["highlights"], list)
    assert t["provider"] == "fake" and t["version"] == 1
    after = await result(client, a, org, job_id)
    assert after["content"] == before["content"]  # master content untouched
    lst = (await client.get(f"{API}/ai/listings/{job_id}/translations", headers=a.h(org))).json()
    assert [x["locale"] for x in lst] == ["fr"]


async def test_retranslate_bumps_version_and_resets_approval(client, app, fake, make_account, make_org):
    a, org, job_id = await ready_job(client, app, make_account, make_org)
    h = a.h(org)
    await client.post(f"{API}/ai/translate", headers=h, json={"job_id": job_id, "locale": "de"})
    ap = await client.post(f"{API}/ai/listings/{job_id}/translations/de/approve", headers=h, json={})
    assert ap.status_code == 200 and ap.json()["status"] == "approved"
    t2 = (await client.post(f"{API}/ai/translate", headers=h, json={"job_id": job_id, "locale": "de"})).json()
    assert t2["version"] == 2 and t2["status"] == "draft"


async def test_translation_approval_with_seller_edit(client, app, fake, make_account, make_org):
    a, org, job_id = await ready_job(client, app, make_account, make_org)
    h = a.h(org)
    await client.post(f"{API}/ai/translate", headers=h, json={"job_id": job_id, "locale": "es"})
    ap = await client.post(f"{API}/ai/listings/{job_id}/translations/es/approve", headers=h,
                           json={"fields": {"title": "Auriculares ACME"}})
    assert ap.json()["fields"]["title"] == "Auriculares ACME"


async def test_translate_validation_and_isolation(client, app, fake, make_account, make_org):
    a, org, job_id = await ready_job(client, app, make_account, make_org)
    assert (await client.post(f"{API}/ai/translate", headers=a.h(org),
                              json={"job_id": job_id, "locale": "xx"})).status_code == 422
    b = await make_account("b")
    org_b = await make_org(b)
    assert (await client.post(f"{API}/ai/translate", headers=b.h(org_b),
                              json={"job_id": job_id, "locale": "fr"})).status_code == 404
    assert (await client.get(f"{API}/ai/listings/{job_id}/translations", headers=b.h(org_b))).status_code == 404


async def test_cannot_translate_unfinished_job(client, app, fake, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    img = (await upload(client, a, org)).json()
    fake.block = True
    r = await client.post(f"{API}/ai/listings/generate", headers=a.h(org), json={"image_ids": [img["id"]]})
    res = await client.post(f"{API}/ai/translate", headers=a.h(org),
                            json={"job_id": r.json()["job_id"], "locale": "fr"})
    assert res.status_code == 409
    fake.block = False
    await app.state.job_runner.wait_all()


# ------------------------------------------------------------ bulk

def make_zip(n=3, extra=None) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for i in range(n):
            z.writestr(f"item{i}.png", png_bytes())
        for name, data in (extra or {}).items():
            z.writestr(name, data)
    return buf.getvalue()


async def bulk(client, a, org, files):
    return await client.post(f"{API}/ai/bulk-upload", headers=a.h(org), files=files)


async def test_bulk_multiple_images_creates_independent_jobs(client, app, fake, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    files = [("files", (f"p{i}.png", png_bytes(), "image/png")) for i in range(3)]
    r = await bulk(client, a, org, files)
    assert r.status_code == 202, r.text
    bid = r.json()["bulk_id"]
    await app.state.job_runner.wait_all()
    st = (await client.get(f"{API}/ai/bulk-upload/{bid}", headers=a.h(org))).json()
    assert st["total"] == 3 and st["status"] == "completed"
    assert st["counts"]["awaiting_review"] == 3
    assert all(i["job_id"] and i["status"] == "awaiting_review" for i in st["items"])


async def test_bulk_zip_with_bad_entries_reports_per_item_failures(client, app, fake, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    z = make_zip(2, {"broken.png": b"not an image", "notes.txt": b"hello", "../evil.png": png_bytes()})
    r = await bulk(client, a, org, [("files", ("batch.zip", z, "application/zip"))])
    assert r.status_code == 202, r.text
    await app.state.job_runner.wait_all()
    st = (await client.get(f"{API}/ai/bulk-upload/{r.json()['bulk_id']}", headers=a.h(org))).json()
    by_name = {i["filename"]: i for i in st["items"]}
    assert by_name["item0.png"]["status"] == "awaiting_review"
    assert by_name["broken.png"]["status"] == "upload_failed" and by_name["broken.png"]["error"]
    assert "notes.txt" not in by_name  # non-image entries are ignored
    assert "evil.png" in by_name  # path components are stripped, never used for storage


async def test_bulk_limits(client, app, fake, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    app.state.settings.max_bulk_items = 2
    try:
        r = await bulk(client, a, org, [("files", (f"p{i}.png", png_bytes(), "image/png")) for i in range(3)])
        assert r.status_code == 422
    finally:
        app.state.settings.max_bulk_items = 50
    assert (await bulk(client, a, org, [])).status_code == 422


async def test_bulk_retry_failed_items(client, app, make_account, make_org):
    app.state.ai_provider = FakeProvider(fail_stage="generate_seo")
    a = await make_account()
    org = await make_org(a)
    r = await bulk(client, a, org, [("files", ("a.png", png_bytes(), "image/png"))])
    bid = r.json()["bulk_id"]
    await app.state.job_runner.wait_all()
    st = (await client.get(f"{API}/ai/bulk-upload/{bid}", headers=a.h(org))).json()
    assert st["counts"]["failed"] == 1
    app.state.ai_provider = FakeProvider()
    rr = await client.post(f"{API}/ai/bulk-upload/{bid}/retry", headers=a.h(org))
    assert rr.status_code == 202 and rr.json()["retried"] == 1
    await app.state.job_runner.wait_all()
    st = (await client.get(f"{API}/ai/bulk-upload/{bid}", headers=a.h(org))).json()
    assert st["counts"]["awaiting_review"] == 1 and st["counts"].get("failed", 0) == 0


async def test_bulk_export_csv_and_bulk_approve(client, app, fake, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    r = await bulk(client, a, org, [("files", (f"p{i}.png", png_bytes(), "image/png")) for i in range(2)])
    bid = r.json()["bulk_id"]
    await app.state.job_runner.wait_all()
    ap = await client.post(f"{API}/ai/bulk-upload/{bid}/approve", headers=a.h(org))
    assert ap.status_code == 200
    assert ap.json()["approved"] == 2 and ap.json()["skipped"] == []
    csv_resp = await client.get(f"{API}/ai/bulk-upload/{bid}/export", headers=a.h(org))
    assert csv_resp.headers["content-type"].startswith("text/csv")
    lines = csv_resp.text.strip().splitlines()
    assert lines[0].startswith("filename,status") and len(lines) == 3 and "approved" in lines[1]


async def test_bulk_approve_skips_items_with_missing_required(client, app, make_account, make_org):
    app.state.ai_provider = FakeProvider(category_slugs=["mens-tshirts"])
    a = await make_account()
    org = await make_org(a)
    r = await bulk(client, a, org, [("files", ("a.png", png_bytes(), "image/png"))])
    bid = r.json()["bulk_id"]
    await app.state.job_runner.wait_all()
    ap = (await client.post(f"{API}/ai/bulk-upload/{bid}/approve", headers=a.h(org))).json()
    assert ap["approved"] == 0 and len(ap["skipped"]) == 1 and "size" in str(ap["skipped"][0]["errors"])


async def test_bulk_isolation(client, app, fake, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    r = await bulk(client, a, org, [("files", ("a.png", png_bytes(), "image/png"))])
    await app.state.job_runner.wait_all()
    b = await make_account("b")
    org_b = await make_org(b)
    bid = r.json()["bulk_id"]
    for path in ("", "/export"):
        assert (await client.get(f"{API}/ai/bulk-upload/{bid}{path}", headers=b.h(org_b))).status_code == 404
    assert (await client.post(f"{API}/ai/bulk-upload/{bid}/retry", headers=b.h(org_b))).status_code == 404


# ------------------------------------------------------------ analytics / admin

async def test_org_usage_summary(client, app, fake, make_account, make_org):
    a, org, job_id = await ready_job(client, app, make_account, make_org)
    await client.post(f"{API}/ai/listings/{job_id}/approve", headers=a.h(org),
                      json={"attributes": {"color": "navy"}})
    u = (await client.get(f"{API}/ai/usage", headers=a.h(org))).json()
    assert u["jobs"]["total"] == 1 and u["jobs"]["approved"] == 1
    assert u["calls"] >= 7 and u["input_tokens"] > 0
    assert u["approval_rate"] == 1.0
    assert u["attribute_correction_rate"] > 0  # color was corrected by the seller


async def test_admin_endpoints_require_admin_and_hide_secrets(client, app, fake, admin_account, make_account, make_org):
    a, org, job_id = await ready_job(client, app, make_account, make_org)
    for path in ("analytics", "ai-usage", "failed-jobs", "ai-providers"):
        assert (await client.get(f"{API}/admin/{path}", headers=a.h())).status_code == 403
    h = admin_account.h()
    an = (await client.get(f"{API}/admin/analytics", headers=h)).json()
    assert an["jobs_total"] >= 1 and an["organizations"] >= 1
    usage = (await client.get(f"{API}/admin/ai-usage", headers=h)).json()
    assert usage["items"] and {"model", "calls", "input_tokens"} <= set(usage["items"][0])
    prov = (await client.get(f"{API}/admin/ai-providers", headers=h)).text
    assert "gemini" in prov and "AQ." not in prov
    app.state.ai_provider = FakeProvider(fail_stage="generate_title")
    img = (await upload(client, a, org)).json()
    await run(client, app, a, org, [img["id"]])
    failed = (await client.get(f"{API}/admin/failed-jobs", headers=h)).json()
    assert failed["total"] >= 1 and failed["items"][0]["error"]


async def test_job_list_has_title_category_thumbnail_for_catalog(client, app, fake, make_account, make_org):
    a, org, job_id = await ready_job(client, app, make_account, make_org)
    await client.post(f"{API}/ai/listings/{job_id}/approve", headers=a.h(org), json={})
    r = await client.get(f"{API}/ai/listings", headers=a.h(org), params={"status": "approved"})
    item = r.json()["items"][0]
    assert item["title"].startswith("ACME X200") and item["category_slug"] == "headphones"
    assert "/images/" in item["thumbnail_url"] and (await client.get(item["thumbnail_url"])).status_code == 200
