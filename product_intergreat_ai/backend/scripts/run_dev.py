"""Development runner: Starts an embedded PostgreSQL, runs Alembic migrations,
seeds category taxonomies, sets up the direct-access demo tenant, and launches
the FastAPI backend on port 8000.
"""
import asyncio
import os
import pathlib
import sys
import tempfile
import uuid

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import asyncpg
import pgserver
import uvicorn
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

try:
    from dotenv import load_dotenv
    load_dotenv(BACKEND_DIR / ".env")
    load_dotenv(BACKEND_DIR.parent / ".env")
except ImportError:
    pass

DEMO_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
DEMO_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")


async def prepare_db(pg_uri: str) -> str:
    admin_conn = await asyncpg.connect(pg_uri)
    exists = await admin_conn.fetchval("SELECT 1 FROM pg_database WHERE datname = 'tx_dev'")
    if not exists:
        await admin_conn.execute("CREATE DATABASE tx_dev")
    await admin_conn.close()

    base = pg_uri.rsplit("/", 1)[0]
    dev_uri = f"{base}/tx_dev"
    async_uri = dev_uri.replace("postgresql://", "postgresql+asyncpg://", 1)
    return async_uri


def run_alembic(async_uri: str) -> None:
    import subprocess
    env = {**os.environ, "TX_DATABASE_URL": async_uri}
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(BACKEND_DIR),
        env=env,
        check=True,
    )
    print("[dev_server] Alembic migrations applied successfully.")


async def seed_data(engine) -> None:
    from app.core import security
    from app.core.db import set_tenant_context
    from app.models import Organization, OrganizationMember, Role, User
    from app.seed.loader import seed_categories

    await seed_categories(engine)
    print("[dev_server] Category taxonomy and attribute schemas seeded.")

    async with AsyncSession(engine, expire_on_commit=False) as s:
        await set_tenant_context(s, user_id=DEMO_USER_ID, is_admin=True)

        # Ensure demo user
        user = await s.get(User, DEMO_USER_ID)
        if not user:
            user = User(
                id=DEMO_USER_ID,
                email="seller@tradeexpress.com",
                full_name="TradeExpress Demo Seller",
                password_hash=security.hash_password("DemoPassword123!"),
                is_platform_admin=True,
                is_active=True,
            )
            s.add(user)
            await s.flush()

        # Ensure demo organization
        org = await s.get(Organization, DEMO_ORG_ID)
        if not org:
            org = Organization(
                id=DEMO_ORG_ID,
                name="TradeExpress Global Store (Demo)",
                slug="tradeexpress-demo",
                org_type="platform_owner",
                status="active",
                created_by=user.id,
            )
            s.add(org)
            await s.flush()

        # Ensure owner membership
        owner_role = await s.scalar(select(Role).where(Role.name == "owner"))
        if owner_role:
            member = await s.scalar(
                select(OrganizationMember).where(
                    OrganizationMember.organization_id == DEMO_ORG_ID,
                    OrganizationMember.user_id == DEMO_USER_ID,
                )
            )
            if not member:
                s.add(
                    OrganizationMember(
                        organization_id=DEMO_ORG_ID,
                        user_id=DEMO_USER_ID,
                        role_id=owner_role.id,
                    )
                )
        await s.commit()
    print("[dev_server] Demo user & organization configured.")


def main() -> None:
    data_dir = tempfile.mkdtemp(prefix="txpg_dev_")
    print(f"[dev_server] Initializing embedded PostgreSQL in {data_dir}...")
    server = pgserver.get_server(data_dir, cleanup_mode="delete")
    pg_uri = server.get_uri()
    print(f"[dev_server] PostgreSQL active at {pg_uri}")

    async_uri = asyncio.run(prepare_db(pg_uri))
    os.environ["TX_DATABASE_URL"] = async_uri
    os.environ["TX_JWT_SECRET"] = "tradeexpress-development-jwt-secret-key-32chars"
    os.environ["TX_ENVIRONMENT"] = "development"
    os.environ["TX_STORAGE_DIR"] = str(BACKEND_DIR / "storage")
    os.makedirs(os.environ["TX_STORAGE_DIR"], exist_ok=True)

    run_alembic(async_uri)

    from app.core.config import get_settings
    from app.core.db import create_engine
    from app.main import create_app

    settings = get_settings()
    print(f"[dev_server] Gemini AI configured: {settings.gemini_api_key is not None} (model: {settings.gemini_model})")
    engine = create_engine(settings)
    asyncio.run(seed_data(engine))

    app = create_app(settings)
    print("[dev_server] Starting TradeExpress Product Listing AI on http://0.0.0.0:8000 ...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")


if __name__ == "__main__":
    main()
