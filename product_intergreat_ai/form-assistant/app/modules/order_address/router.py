from typing import Any

from fastapi import APIRouter, Depends, Request

from app.ai.base import AIProvider
from app.core.auth import require_api_key
from app.core.errors import ProviderUnavailable
from app.modules.order_address import fake as _fake  # noqa: F401  (registers the offline handler)
from app.modules.order_address import service
from app.modules.order_address.schemas import AddressAssistIn, AddressAssistOut

router = APIRouter(prefix="/v1/order-address", tags=["order-address"], dependencies=[Depends(require_api_key)])


@router.get("/fields")
async def fields() -> dict[str, Any]:
    """Which fields the AI may fill, and which it never touches (with the reason)."""
    return service.CONFIG  # type: ignore[no-any-return]


@router.post("/assist", response_model=AddressAssistOut)
async def assist(body: AddressAssistIn, request: Request) -> AddressAssistOut:
    provider: AIProvider | None = request.app.state.ai_provider
    if provider is None:
        raise ProviderUnavailable("No AI provider is configured (check ASSIST_AI_PROVIDER and its API key)")
    return await service.assist(provider, body)
