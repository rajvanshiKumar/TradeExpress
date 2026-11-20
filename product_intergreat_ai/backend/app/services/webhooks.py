import hashlib
import hmac
import json
import secrets
import time
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationFailed
from app.models.integration import WebhookDelivery, WebhookEndpoint


def generate_signature(secret: str, payload_bytes: bytes, timestamp: int) -> str:
    message = f"{timestamp}.".encode() + payload_bytes
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


async def register_webhook(
    s: AsyncSession,
    org_id: uuid.UUID,
    url: str,
    events: list[str],
) -> WebhookEndpoint:
    if not url.startswith("http://") and not url.startswith("https://"):
        raise ValidationFailed("Webhook URL must start with http:// or https://")
    if not events:
        events = ["listing.approved", "product.published"]

    secret = f"whsec_{secrets.token_hex(24)}"
    endpoint = WebhookEndpoint(
        organization_id=org_id,
        url=url,
        secret=secret,
        events=events,
        is_active=True,
    )
    s.add(endpoint)
    await s.commit()
    return endpoint


async def list_webhooks(s: AsyncSession, org_id: uuid.UUID) -> list[WebhookEndpoint]:
    return list(
        (
            await s.scalars(
                select(WebhookEndpoint)
                .where(WebhookEndpoint.organization_id == org_id)
                .order_by(WebhookEndpoint.created_at.desc())
            )
        ).all()
    )


async def delete_webhook(s: AsyncSession, endpoint_id: uuid.UUID, org_id: uuid.UUID) -> None:
    endpoint = await s.scalar(
        select(WebhookEndpoint).where(
            WebhookEndpoint.id == endpoint_id, WebhookEndpoint.organization_id == org_id
        )
    )
    if not endpoint:
        raise NotFoundError("Webhook endpoint not found")
    await s.delete(endpoint)
    await s.commit()


async def record_delivery(
    s: AsyncSession,
    org_id: uuid.UUID,
    endpoint_id: uuid.UUID,
    event_type: str,
    payload: dict[str, Any],
    status_code: int = 200,
    success: bool = True,
    response_text: str = "OK",
) -> WebhookDelivery:
    delivery = WebhookDelivery(
        organization_id=org_id,
        endpoint_id=endpoint_id,
        event_type=event_type,
        payload=payload,
        status_code=status_code,
        success=success,
        response_text=response_text,
        attempts=1,
    )
    s.add(delivery)
    await s.commit()
    return delivery


async def list_deliveries(
    s: AsyncSession,
    org_id: uuid.UUID,
    endpoint_id: uuid.UUID | None = None,
    limit: int = 50,
) -> list[WebhookDelivery]:
    query = select(WebhookDelivery).where(WebhookDelivery.organization_id == org_id)
    if endpoint_id:
        query = query.where(WebhookDelivery.endpoint_id == endpoint_id)
    return list(
        (
            await s.scalars(
                query.order_by(WebhookDelivery.created_at.desc()).limit(limit)
            )
        ).all()
    )

