import hashlib
import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import set_tenant_context
from app.core.errors import NotFoundError, ValidationFailed
from app.models.integration import ApiKey


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


async def create_api_key(
    s: AsyncSession,
    org_id: uuid.UUID,
    name: str,
    scopes: list[str] | None = None,
) -> tuple[ApiKey, str]:
    if not name or len(name.strip()) < 2:
        raise ValidationFailed("API key name must be at least 2 characters")

    prefix = "tx_live_"
    random_part = secrets.token_urlsafe(32)
    raw_key = f"{prefix}{random_part}"
    key_hash = _hash_key(raw_key)
    short_prefix = raw_key[:14]

    valid_scopes = scopes or ["product:read", "product:write", "product:publish", "ai:run"]

    key_record = ApiKey(
        organization_id=org_id,
        name=name.strip(),
        key_hash=key_hash,
        prefix=short_prefix,
        scopes=valid_scopes,
        is_active=True,
    )
    s.add(key_record)
    await s.commit()
    await set_tenant_context(s, org_id=org_id)
    return key_record, raw_key


async def verify_api_key(s: AsyncSession, raw_key: str) -> ApiKey | None:
    if not raw_key or not raw_key.startswith("tx_live_"):
        return None
    key_hash = _hash_key(raw_key)
    record = await s.scalar(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active.is_(True))
    )
    if not record:
        return None
    now = datetime.now(timezone.utc)
    if record.expires_at and record.expires_at < now:
        return None

    # Set tenant context before updating record to satisfy RLS modify policy
    await set_tenant_context(s, org_id=record.organization_id)
    record.last_used_at = now
    await s.commit()
    return record


async def list_api_keys(s: AsyncSession, org_id: uuid.UUID) -> list[ApiKey]:
    return list(
        (
            await s.scalars(
                select(ApiKey)
                .where(ApiKey.organization_id == org_id)
                .order_by(ApiKey.created_at.desc())
            )
        ).all()
    )


async def revoke_api_key(s: AsyncSession, key_id: uuid.UUID, org_id: uuid.UUID) -> None:
    record = await s.scalar(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.organization_id == org_id)
    )
    if not record:
        raise NotFoundError("API key not found")
    record.is_active = False
    await s.commit()
