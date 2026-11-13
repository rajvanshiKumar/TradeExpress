from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_session, require_admin
from app.models import AIListingJob, AuditLog
from app.schemas.common import ORM, Page
from app.services import analytics

router = APIRouter(prefix="/admin", tags=["admin"])


class AuditOut(ORM):
    id: UUID
    organization_id: UUID | None
    actor_user_id: UUID | None
    action: str
    entity_type: str
    entity_id: str | None
    data: dict[str, Any]


@router.get("/audit-logs", response_model=Page[AuditOut])
async def audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    action: str | None = None,
    _: CurrentUser = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> Page[AuditOut]:
    stmt = select(AuditLog)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (await session.scalars(
        stmt.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset))).all()
    return Page(items=[AuditOut.model_validate(r) for r in rows], total=total, limit=limit,
                offset=offset)


@router.get("/analytics")
async def platform_analytics(
    _: CurrentUser = Depends(require_admin), session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    return await analytics.platform_analytics(session)


@router.get("/ai-usage")
async def ai_usage(
    _: CurrentUser = Depends(require_admin), session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    return {"items": await analytics.usage_by_model(session)}


@router.get("/failed-jobs")
async def failed_jobs(
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
    _: CurrentUser = Depends(require_admin), session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    stmt = select(AIListingJob).where(AIListingJob.status == "failed")
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (await session.scalars(
        stmt.order_by(AIListingJob.updated_at.desc()).limit(limit).offset(offset))).all()
    return {"total": total, "limit": limit, "offset": offset, "items": [
        {"job_id": str(r.id), "organization_id": str(r.organization_id), "stage": r.stage,
         "error": r.error, "provider": r.provider, "model": r.model,
         "updated_at": r.updated_at.isoformat()} for r in rows]}


@router.get("/ai-providers")
async def ai_providers(
    request: Request, _: CurrentUser = Depends(require_admin)
) -> dict[str, Any]:
    cfg = request.app.state.settings
    active = request.app.state.ai_provider
    return {"items": [
        {"provider": "gemini", "model": cfg.gemini_model,
         "configured": cfg.gemini_api_key is not None,
         "active": active is not None and active.name == "gemini",
         "timeout_seconds": cfg.gemini_timeout_seconds,
         "pricing_configured": cfg.gemini_price_in_per_m is not None},
        {"provider": "openai", "model": None, "configured": False, "active": False,
         "timeout_seconds": None, "pricing_configured": False},
    ]}
