from typing import Any

from fastapi import APIRouter, Depends, Request

from app.ai.base import AIProvider
from app.core.auth import require_api_key
from app.core.errors import ForbiddenError, ProviderUnavailable
from app.modules.transport_driver import fake as _fake  # noqa: F401  (registers the offline handler)
from app.modules.transport_driver import service
from app.modules.transport_driver.schemas import DriverAssistIn, DriverAssistOut

router = APIRouter(prefix="/v1/transport-driver", tags=["transport-driver"],
                   dependencies=[Depends(require_api_key)])


@router.get("/fields")
async def fields() -> dict[str, Any]:
    """Which fields the AI may fill, and which it never touches (with the reason)."""
    return service.CONFIG  # type: ignore[no-any-return]


@router.post("/assist", response_model=DriverAssistOut)
async def assist(body: DriverAssistIn, request: Request) -> DriverAssistOut:
    if not request.app.state.settings.enable_driver_documents:
        raise ForbiddenError("Driver document assist is disabled (ASSIST_ENABLE_DRIVER_DOCUMENTS=false)")
    provider: AIProvider | None = request.app.state.ai_provider
    if provider is None:
        raise ProviderUnavailable("No AI provider is configured (check ASSIST_AI_PROVIDER and its API key)")
    return await service.assist(provider, body)
