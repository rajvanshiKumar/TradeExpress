import uuid

import pytest

from tests.conftest import PASSWORD

pytestmark = pytest.mark.integration
API = "/api/v1"


async def test_register_login_me(client, make_account):
    acct = await make_account()
    r = await client.get(f"{API}/auth/me", headers=acct.h())
    assert r.status_code == 200
    assert r.json()["email"] == acct.email
    assert "password" not in r.text and "password_hash" not in r.text


async def test_duplicate_email_conflict(client, make_account):
    acct = await make_account()
    r = await client.post(
        f"{API}/auth/register",
        json={"email": acct.email.upper(), "password": PASSWORD, "full_name": "x"},
    )
    assert r.status_code == 409


async def test_weak_password_rejected(client):
    r = await client.post(
        f"{API}/auth/register",
        json={"email": f"{uuid.uuid4().hex}@example.com", "password": "weak", "full_name": "x"},
    )
    assert r.status_code == 422


async def test_wrong_password_401(client, make_account):
    acct = await make_account()
    r = await client.post(f"{API}/auth/login", json={"email": acct.email, "password": "Nope-nope-123"})
    assert r.status_code == 401


async def test_me_requires_token(client):
    assert (await client.get(f"{API}/auth/me")).status_code == 401
    r = await client.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401


async def test_refresh_rotation_and_reuse_detection(client, make_account):
    acct = await make_account()
    r1 = await client.post(f"{API}/auth/refresh", json={"refresh_token": acct.refresh})
    assert r1.status_code == 200
    new_refresh = r1.json()["refresh_token"]
    assert new_refresh != acct.refresh
    # Replaying the old refresh token is theft: the whole session is revoked.
    r2 = await client.post(f"{API}/auth/refresh", json={"refresh_token": acct.refresh})
    assert r2.status_code == 401
    r3 = await client.post(f"{API}/auth/refresh", json={"refresh_token": new_refresh})
    assert r3.status_code == 401


async def test_logout_revokes_session(client, make_account):
    acct = await make_account()
    r = await client.post(f"{API}/auth/logout", json={"refresh_token": acct.refresh})
    assert r.status_code == 204
    r = await client.post(f"{API}/auth/refresh", json={"refresh_token": acct.refresh})
    assert r.status_code == 401


async def test_access_token_cannot_refresh(client, make_account):
    acct = await make_account()
    r = await client.post(f"{API}/auth/refresh", json={"refresh_token": acct.token})
    assert r.status_code == 401


async def test_login_rate_limited(client, make_account):
    acct = await make_account()
    codes = []
    for _ in range(12):
        r = await client.post(f"{API}/auth/login", json={"email": acct.email, "password": "Bad-pass-1234"})
        codes.append(r.status_code)
    assert 429 in codes


async def test_security_headers_present(client):
    r = await client.get("/health/live")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
