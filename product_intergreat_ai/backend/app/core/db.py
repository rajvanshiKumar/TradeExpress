import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import Settings


def create_engine(settings: Settings) -> AsyncEngine:
    connect_args: dict[str, object] = {}
    if settings.db_app_role:
        # Every pooled connection runs as the non-superuser role so RLS is always enforced.
        connect_args["server_settings"] = {"role": settings.db_app_role}
    return create_async_engine(
        settings.database_url, pool_pre_ping=True, pool_size=10, max_overflow=10,
        connect_args=connect_args,
    )


def create_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


async def set_tenant_context(
    session: AsyncSession,
    *,
    user_id: uuid.UUID | None = None,
    org_id: uuid.UUID | None = None,
    is_admin: bool | None = None,
) -> None:
    """Transaction-local settings read by the RLS policies. Only server code, after verifying
    identity and membership, may call this."""
    for name, value in (
        ("app.current_user_id", user_id),
        ("app.current_org_id", org_id),
        ("app.is_platform_admin", None if is_admin is None else str(is_admin).lower()),
    ):
        if value is not None:
            await session.execute(
                text("SELECT set_config(:n, :v, true)"), {"n": name, "v": str(value)}
            )
