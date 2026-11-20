import asyncpg
import pytest

from tests.conftest import _alembic, _to_async

pytestmark = pytest.mark.integration


async def test_migrations_clean_up_and_down_and_up(pg_server):
    admin = await asyncpg.connect(pg_server)
    await admin.execute("DROP DATABASE IF EXISTS tx_mig")
    await admin.execute("CREATE DATABASE tx_mig")
    await admin.close()
    url = _to_async(pg_server.rsplit("/", 1)[0] + "/tx_mig")
    _alembic(url, "upgrade", "head")
    _alembic(url, "downgrade", "base")
    _alembic(url, "upgrade", "head")
    conn = await asyncpg.connect(url.replace("+asyncpg", ""))
    try:
        assert await conn.fetchval("SELECT count(*) FROM roles") == 4
        assert await conn.fetchval("SELECT relrowsecurity FROM pg_class WHERE relname='organization_members'")
    finally:
        await conn.close()


async def test_health_endpoints(client):
    assert (await client.get("/health/live")).status_code == 200
    r = await client.get("/health/ready")
    assert r.status_code == 200 and r.json()["database"] == "ok"
    assert (await client.get("/health")).status_code == 200


async def test_openapi_documents_versioned_api(client):
    spec = (await client.get("/openapi.json")).json()
    assert any(p.startswith("/api/v1/auth/login") for p in spec["paths"])


async def test_standard_error_envelope(client):
    r = await client.get("/api/v1/auth/me")
    body = r.json()
    assert set(body["error"]) >= {"code", "message"}


async def test_request_size_limit(client):
    r = await client.post(
        "/api/v1/auth/login", content=b"x" * (16 * 1024 * 1024), headers={"content-type": "application/json"}
    )
    assert r.status_code == 413
