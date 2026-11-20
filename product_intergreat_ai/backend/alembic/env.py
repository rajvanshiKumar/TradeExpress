import asyncio
import os

from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context
from app.models import Base

config = context.config
target_metadata = Base.metadata


def _url() -> str:
    # Migrations run with the owner/superuser URL, never the RLS-restricted app role.
    url = os.environ.get("TX_MIGRATION_DATABASE_URL") or os.environ.get("TX_DATABASE_URL")
    if not url:
        raise RuntimeError("Set TX_DATABASE_URL (or TX_MIGRATION_DATABASE_URL) to run migrations")
    return url


def _run(connection) -> None:  # type: ignore[no-untyped-def]
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def _run_async() -> None:
    engine = create_async_engine(_url())
    async with engine.connect() as conn:
        await conn.run_sync(_run)
    await engine.dispose()


if context.is_offline_mode():
    context.configure(url=_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    asyncio.run(_run_async())
