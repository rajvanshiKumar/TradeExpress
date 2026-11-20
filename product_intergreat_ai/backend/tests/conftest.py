import os
import subprocess
import sys
import tempfile
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import asyncpg
import httpx
import pytest
import pytest_asyncio

BACKEND = Path(__file__).resolve().parent.parent
os.environ.setdefault("TX_JWT_SECRET", "test-secret-" + "k" * 40)
os.environ["TX_ENVIRONMENT"] = "test"


def _alembic(url: str, *args: str) -> None:
    env = {**os.environ, "TX_DATABASE_URL": url}
    subprocess.run(  # noqa: S603
        [sys.executable, "-m", "alembic", *args], cwd=BACKEND, env=env, check=True
    )


@pytest.fixture(scope="session")
def pg_server():
    """Real PostgreSQL. Uses TX_TEST_PG_URL if provided (e.g. docker), else embedded pgserver."""
    external = os.environ.get("TX_TEST_PG_URL")
    if external:
        yield external
        return
    import pgserver

    tmp = tempfile.mkdtemp(prefix="txpg_")
    server = pgserver.get_server(tmp)
    yield server.get_uri()
    server.cleanup()


def _to_async(uri: str) -> str:
    return uri.replace("postgresql://", "postgresql+asyncpg://", 1)


@pytest_asyncio.fixture(scope="session")
async def db_url(pg_server: str) -> str:
    admin = await asyncpg.connect(pg_server)
    await admin.execute("DROP DATABASE IF EXISTS tx_test")
    await admin.execute("CREATE DATABASE tx_test")
    await admin.close()
    url = _to_async(pg_server.rsplit("/", 1)[0] + "/tx_test")
    _alembic(url, "upgrade", "head")
    return url


@pytest_asyncio.fixture(scope="session")
async def app(db_url: str):
    os.environ["TX_DATABASE_URL"] = db_url
    os.environ["TX_STORAGE_DIR"] = tempfile.mkdtemp(prefix="txstore_")
    from app.core.config import Settings
    from app.main import create_app
    from app.seed.loader import seed_categories

    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    application = create_app(settings)
    await seed_categories(application.state.engine)
    return application


@pytest_asyncio.fixture
async def client(app) -> AsyncIterator[httpx.AsyncClient]:
    app.state.rate_limiter.reset()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


@pytest_asyncio.fixture(scope="session")
async def superuser(db_url: str) -> AsyncIterator[asyncpg.Connection]:
    """Superuser connection (bypasses RLS) for test arrangement only."""
    conn = await asyncpg.connect(db_url.replace("+asyncpg", ""))
    yield conn
    await conn.close()


PASSWORD = "Sup3r-Secret-pass"


class Account:
    def __init__(self, email: str, token: str, refresh: str, user_id: str) -> None:
        self.email, self.token, self.refresh, self.user_id = email, token, refresh, user_id

    def h(self, org_id: str | None = None) -> dict[str, str]:
        h = {"Authorization": f"Bearer {self.token}"}
        if org_id:
            h["X-Organization-Id"] = org_id
        return h


@pytest_asyncio.fixture
async def make_account(client: httpx.AsyncClient):
    async def _make(prefix: str = "user") -> Account:
        email = f"{prefix}-{uuid.uuid4().hex[:10]}@example.com"
        r = await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": PASSWORD, "full_name": "Test User"},
        )
        assert r.status_code == 201, r.text
        r = await client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
        assert r.status_code == 200, r.text
        body = r.json()
        me = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
        )
        return Account(email, body["access_token"], body["refresh_token"], me.json()["id"])

    return _make


@pytest_asyncio.fixture
async def make_org(client: httpx.AsyncClient):
    async def _make(acct: Account, org_type: str = "external_seller") -> str:
        r = await client.post(
            "/api/v1/organizations",
            json={"name": f"Org {uuid.uuid4().hex[:6]}", "org_type": org_type},
            headers=acct.h(),
        )
        assert r.status_code == 201, r.text
        return str(r.json()["id"])

    return _make


@pytest_asyncio.fixture
async def admin_account(make_account, superuser):
    acct = await make_account("admin")
    await superuser.execute(
        "UPDATE users SET is_platform_admin = true WHERE id = $1", uuid.UUID(acct.user_id)
    )
    return acct
