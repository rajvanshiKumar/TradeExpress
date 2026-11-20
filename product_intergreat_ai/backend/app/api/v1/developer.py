import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, OrgContext, get_current_user, get_session, require_permission
from app.services import api_keys as key_svc
from app.services import webhooks as hook_svc

router = APIRouter(prefix="/developer", tags=["developer"])


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    scopes: list[str] = Field(default_factory=lambda: ["product:read", "product:write", "product:publish", "ai:run"])


class ApiKeyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    prefix: str
    scopes: list[str]
    is_active: bool
    last_used_at: datetime | None
    created_at: datetime


class ApiKeyCreatedResponse(BaseModel):
    key: ApiKeyOut
    raw_key: str
    warning: str = "Store this secret key now. It will not be shown again."


class WebhookCreate(BaseModel):
    url: str = Field(min_length=8, max_length=500)
    events: list[str] = Field(default_factory=lambda: ["listing.approved", "product.published"])


class WebhookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    secret: str
    events: list[str]
    is_active: bool
    created_at: datetime


class WebhookDeliveryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    endpoint_id: uuid.UUID
    event_type: str
    payload: dict[str, Any]
    status_code: int | None
    success: bool
    response_text: str | None
    created_at: datetime


# --- API Keys ---
@router.get("/keys", response_model=list[ApiKeyOut])
async def list_keys(
    ctx: OrgContext = Depends(require_permission("organization:manage")),
    session: AsyncSession = Depends(get_session),
) -> list[ApiKeyOut]:
    keys = await key_svc.list_api_keys(session, ctx.org_id)
    return [ApiKeyOut.model_validate(k) for k in keys]


@router.post("/keys", response_model=ApiKeyCreatedResponse, status_code=201)
async def create_key(
    body: ApiKeyCreate,
    ctx: OrgContext = Depends(require_permission("organization:manage")),
    session: AsyncSession = Depends(get_session),
) -> ApiKeyCreatedResponse:
    key_rec, raw_key = await key_svc.create_api_key(session, ctx.org_id, body.name, body.scopes)
    return ApiKeyCreatedResponse(
        key=ApiKeyOut.model_validate(key_rec),
        raw_key=raw_key,
    )


@router.delete("/keys/{id}", status_code=204)
async def delete_key(
    id: uuid.UUID,
    ctx: OrgContext = Depends(require_permission("organization:manage")),
    session: AsyncSession = Depends(get_session),
) -> None:
    await key_svc.revoke_api_key(session, id, ctx.org_id)


# --- Webhooks ---
@router.get("/webhooks", response_model=list[WebhookOut])
async def list_webhooks(
    ctx: OrgContext = Depends(require_permission("organization:manage")),
    session: AsyncSession = Depends(get_session),
) -> list[WebhookOut]:
    hooks = await hook_svc.list_webhooks(session, ctx.org_id)
    return [WebhookOut.model_validate(h) for h in hooks]


@router.post("/webhooks", response_model=WebhookOut, status_code=201)
async def create_webhook(
    body: WebhookCreate,
    ctx: OrgContext = Depends(require_permission("organization:manage")),
    session: AsyncSession = Depends(get_session),
) -> WebhookOut:
    hook = await hook_svc.register_webhook(session, ctx.org_id, body.url, body.events)
    return WebhookOut.model_validate(hook)


@router.delete("/webhooks/{id}", status_code=204)
async def delete_webhook(
    id: uuid.UUID,
    ctx: OrgContext = Depends(require_permission("organization:manage")),
    session: AsyncSession = Depends(get_session),
) -> None:
    await hook_svc.delete_webhook(session, id, ctx.org_id)


@router.get("/webhooks/{id}/deliveries", response_model=list[WebhookDeliveryOut])
async def list_webhook_deliveries(
    id: uuid.UUID,
    ctx: OrgContext = Depends(require_permission("organization:manage")),
    session: AsyncSession = Depends(get_session),
) -> list[WebhookDeliveryOut]:
    deliveries = await hook_svc.list_deliveries(session, ctx.org_id, endpoint_id=id)
    return [WebhookDeliveryOut.model_validate(d) for d in deliveries]


@router.post("/webhooks/{id}/test", response_model=WebhookDeliveryOut)
async def test_webhook(
    id: uuid.UUID,
    ctx: OrgContext = Depends(require_permission("organization:manage")),
    session: AsyncSession = Depends(get_session),
) -> WebhookDeliveryOut:
    payload = {
        "event": "ping",
        "timestamp": int(datetime.utcnow().timestamp()),
        "organization_id": str(ctx.org_id),
        "message": "TradeExpress Webhook Test Ping",
    }
    delivery = await hook_svc.record_delivery(
        session,
        ctx.org_id,
        id,
        event_type="ping",
        payload=payload,
        status_code=200,
        success=True,
        response_text="Test delivery successfully registered",
    )
    return WebhookDeliveryOut.model_validate(delivery)

