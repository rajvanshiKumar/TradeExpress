import base64
import json
import uuid

import pytest

from app.ai.testing import FakeProvider
from tests.integration.test_images_api import png_bytes, upload

pytestmark = pytest.mark.integration
API = "/api/v1"


def b64(d: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()


async def test_alg_none_token_rejected(client, make_account):
    a = await make_account()
    forged = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64({'sub': a.user_id, 'type': 'access', 'exp': 9999999999})}."
    r = await client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 401


async def test_tampered_token_rejected(client, make_account):
    a = await make_account()
    head, payload, sig = a.token.split(".")
    other = b64({"sub": str(uuid.uuid4()), "type": "access", "exp": 9999999999})
    r = await client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {head}.{other}.{sig}"})
    assert r.status_code == 401


async def test_refresh_token_cannot_be_used_as_access_token(client, make_account):
    a = await make_account()
    r = await client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {a.refresh}"})
    assert r.status_code == 401


async def test_deactivated_user_loses_access(client, make_account, superuser):
    a = await make_account()
    await superuser.execute("UPDATE users SET is_active = false WHERE id = $1", uuid.UUID(a.user_id))
    assert (await client.get(f"{API}/auth/me", headers=a.h())).status_code == 401
    r = await client.post(f"{API}/auth/refresh", json={"refresh_token": a.refresh})
    assert r.status_code == 401


async def test_sql_injection_in_search_is_inert(client, make_account):
    a = await make_account()
    for payload in ("'; DROP TABLE categories; --", "' OR '1'='1", "%' UNION SELECT password_hash FROM users --"):
        r = await client.get(f"{API}/categories", headers=a.h(), params={"q": payload})
        assert r.status_code == 200 and r.json()["total"] == 0
    assert (await client.get(f"{API}/categories", headers=a.h())).json()["total"] > 20


async def test_cors_allows_only_configured_origins(client):
    ok = await client.options(f"{API}/auth/login", headers={
        "Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:3000"
    bad = await client.options(f"{API}/auth/login", headers={
        "Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in bad.headers


async def test_signature_for_one_image_does_not_open_another(client, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    one = (await upload(client, a, org)).json()
    two = (await upload(client, a, org)).json()
    sig = one["url"].split("sig=")[1]
    exp = one["url"].split("exp=")[1].split("&")[0]
    r = await client.get(f"{API}/images/{two['id']}/file?variant=original&exp={exp}&sig={sig}")
    assert r.status_code == 403


async def test_thumbnail_signature_does_not_grant_original(client, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    img = (await upload(client, a, org)).json()
    thumb_sig = img["thumbnail_url"].split("sig=")[1]
    exp = img["thumbnail_url"].split("exp=")[1].split("&")[0]
    r = await client.get(f"{API}/images/{img['id']}/file?variant=original&exp={exp}&sig={thumb_sig}")
    assert r.status_code == 403


async def test_path_traversal_filename_is_not_used_for_storage(client, make_account, make_org, app):
    a = await make_account()
    org = await make_org(a)
    r = await client.post(f"{API}/images/upload", headers=a.h(org),
                          files={"file": ("../../../etc/evil.png", png_bytes(), "image/png")})
    assert r.status_code == 201
    assert ".." not in r.json()["url"]


async def test_audit_log_never_stores_secrets(client, make_account, superuser):
    a = await make_account()
    rows = await superuser.fetch("SELECT data::text FROM audit_logs")
    blob = " ".join(r[0] for r in rows).lower()
    assert "password" not in blob.replace("redacted", "") or "[redacted]" in blob
    assert a.token not in blob and a.refresh not in blob


async def test_error_responses_do_not_leak_internals(client, make_account):
    a = await make_account()
    r = await client.get(f"{API}/ai/listings/not-a-uuid/status", headers=a.h())
    assert "Traceback" not in r.text and "sqlalchemy" not in r.text.lower()


async def test_viewer_cannot_run_ai_or_approve(client, app, make_account, make_org):
    app.state.ai_provider = FakeProvider()
    owner, viewer = await make_account("o"), await make_account("v")
    org = await make_org(owner)
    img = (await upload(client, owner, org)).json()
    await client.post(f"{API}/organizations/{org}/members",
                      json={"email": viewer.email, "role": "viewer"}, headers=owner.h())
    r = await client.post(f"{API}/ai/listings/generate", headers=viewer.h(org), json={"image_ids": [img["id"]]})
    assert r.status_code == 403
    job = (await client.post(f"{API}/ai/listings/generate", headers=owner.h(org), json={"image_ids": [img["id"]]})).json()
    await app.state.job_runner.wait_all()
    assert (await client.post(f"{API}/ai/listings/{job['job_id']}/approve", headers=viewer.h(org), json={})).status_code == 403
    assert (await client.get(f"{API}/ai/listings/{job['job_id']}/result", headers=viewer.h(org))).status_code == 200


async def test_ai_unavailable_returns_503_not_fake_output(client, app, make_account, make_org):
    app.state.ai_provider = None
    a = await make_account()
    org = await make_org(a)
    img = (await upload(client, a, org)).json()
    r = await client.post(f"{API}/ai/listings/generate", headers=a.h(org), json={"image_ids": [img["id"]]})
    assert r.status_code == 503 and r.json()["error"]["code"] == "ai_provider_unavailable"
    app.state.ai_provider = FakeProvider()


def test_fake_provider_cannot_be_enabled_outside_test_environment():
    from pydantic import ValidationError

    from app.core.config import Settings

    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_url="postgresql+asyncpg://u:p@h/d", jwt_secret="k" * 40,
                 environment="production", ai_provider="fake", cors_origins=["https://x.example"])


def test_api_key_never_serialised_in_settings_repr():
    from app.core.config import Settings

    s = Settings(_env_file=None, database_url="postgresql+asyncpg://u:p@h/d", jwt_secret="k" * 40,
                 gemini_api_key="AQ.super-secret-value")
    assert "super-secret-value" not in repr(s) and "super-secret-value" not in str(s.model_dump())
