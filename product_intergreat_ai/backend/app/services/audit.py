import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog

_SENSITIVE = {"password", "password_hash", "token", "refresh_token", "access_token", "api_key"}


def _scrub(data: dict[str, Any]) -> dict[str, Any]:
    return {k: ("[redacted]" if k in _SENSITIVE else v) for k, v in data.items()}


async def record(
    session: AsyncSession,
    *,
    action: str,
    entity_type: str,
    entity_id: object | None = None,
    actor_user_id: uuid.UUID | None = None,
    organization_id: uuid.UUID | None = None,
    data: dict[str, Any] | None = None,
) -> None:
    session.add(
        AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            actor_user_id=actor_user_id,
            organization_id=organization_id,
            data=_scrub(data or {}),
        )
    )
    await session.flush()
