import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider, ProviderError
from app.api.deps import CurrentUser, OrgContext, get_current_user, get_session, require_permission
from app.api.v1.images import to_out
from app.core.errors import AppError
from app.models import AIGeneratedContent, AIListingJob, Category, ProductImage
from app.schemas.ai import (
    ApproveIn,
    DecisionOut,
    FeedbackIn,
    GenerateIn,
    JobAccepted,
    JobListItem,
    JobStatus,
    RegenerateIn,
    RejectIn,
)
from app.schemas.common import Page
from app.services import listing as svc

router = APIRouter(prefix="/ai/listings", tags=["ai"])


class ProviderUnavailable(AppError):
    status_code = 503
    code = "ai_provider_unavailable"


def _provider(request: Request) -> AIProvider:
    provider: AIProvider | None = request.app.state.ai_provider
    if provider is None:
        raise ProviderUnavailable("No AI provider is configured (set TX_GEMINI_API_KEY)")
    return provider


def _status(job: AIListingJob) -> JobStatus:
    return JobStatus(job_id=job.id, status=job.status, stage=job.stage, progress=job.progress,
                     error=job.error, mode=job.mode, created_at=job.created_at)


async def _start(request: Request, body: GenerateIn, mode: str, current: CurrentUser,
                 ctx: OrgContext, session: AsyncSession) -> JobAccepted:
    provider = _provider(request)
    settings = request.app.state.settings
    if len(body.image_ids) > settings.max_images_per_job:
        raise AppError(f"At most {settings.max_images_per_job} images per listing")
    job = await svc.create_job(session, org_id=ctx.org_id, user_id=current.id,
                               image_ids=body.image_ids, category_id=body.category_id,
                               hints=body.seller_hints, mode=mode)
    out = JobAccepted(job_id=job.id, status=job.status)
    await session.commit()
    request.app.state.job_runner.submit(svc.run_job(
        request.app.state.sessionmaker, provider, request.app.state.image_store, job.id,
        ctx.org_id, current.id))
    return out


@router.post("/analyze", status_code=202, response_model=JobAccepted)
async def analyze(
    body: GenerateIn, request: Request, current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("ai:run")),
    session: AsyncSession = Depends(get_session),
) -> JobAccepted:
    return await _start(request, body, "analyze", current, ctx, session)


@router.post("/generate", status_code=202, response_model=JobAccepted)
async def generate(
    body: GenerateIn, request: Request, current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("ai:run")),
    session: AsyncSession = Depends(get_session),
) -> JobAccepted:
    return await _start(request, body, "generate", current, ctx, session)


@router.get("", response_model=Page[JobListItem])
async def list_jobs(
    request: Request,
    limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0),
    status: str | None = None,
    ctx: OrgContext = Depends(require_permission("product:read")),
    session: AsyncSession = Depends(get_session),
) -> Page[JobListItem]:
    stmt = select(AIListingJob).where(AIListingJob.organization_id == ctx.org_id)
    if status:
        stmt = stmt.where(AIListingJob.status == status)
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (await session.scalars(
        stmt.order_by(AIListingJob.created_at.desc()).limit(limit).offset(offset))).all()
    items = []
    for r in rows:
        title = await session.scalar(select(AIGeneratedContent.value).where(
            AIGeneratedContent.job_id == r.id, AIGeneratedContent.field == "title",
            AIGeneratedContent.is_current.is_(True)))
        cat = await session.get(Category, r.category_id) if r.category_id else None
        img = await session.get(ProductImage, r.image_ids[0]) if r.image_ids else None
        thumb = to_out(img, request.app.state.settings).thumbnail_url if img else None
        items.append(JobListItem(**_status(r).model_dump(), title=title,
                                 category_slug=cat.slug if cat else None,
                                 category_name=cat.name if cat else None, thumbnail_url=thumb))
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/{job_id}/status", response_model=JobStatus)
async def status(
    job_id: uuid.UUID, ctx: OrgContext = Depends(require_permission("product:read")),
    session: AsyncSession = Depends(get_session),
) -> JobStatus:
    return _status(await svc.get_job(session, job_id))


@router.get("/{job_id}/result")
async def result(
    job_id: uuid.UUID, ctx: OrgContext = Depends(require_permission("product:read")),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    return await svc.build_result(session, await svc.get_job(session, job_id))


@router.get("/{job_id}/ecommerce-export")
async def ecommerce_export(
    job_id: uuid.UUID, ctx: OrgContext = Depends(require_permission("product:read")),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    res = await svc.build_result(session, await svc.get_job(session, job_id))
    return res.get("ecommerce_product") or {}


@router.post("/{job_id}/approve", response_model=DecisionOut)
async def approve(
    job_id: uuid.UUID, body: ApproveIn, current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("product:write")),
    session: AsyncSession = Depends(get_session),
) -> DecisionOut:
    job = await svc.get_job(session, job_id)
    await svc.approve(session, job, current.id, body.content, body.attributes)
    out = DecisionOut(job_id=job.id, status=job.status)
    await session.commit()
    return out


@router.post("/{job_id}/reject", response_model=DecisionOut)
async def reject(
    job_id: uuid.UUID, body: RejectIn, current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("product:write")),
    session: AsyncSession = Depends(get_session),
) -> DecisionOut:
    job = await svc.get_job(session, job_id)
    await svc.reject(session, job, current.id, body.reason)
    out = DecisionOut(job_id=job.id, status=job.status)
    await session.commit()
    return out


@router.post("/{job_id}/regenerate", response_model=DecisionOut)
async def regenerate(
    job_id: uuid.UUID, body: RegenerateIn, request: Request,
    current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("ai:run")),
    session: AsyncSession = Depends(get_session),
) -> DecisionOut:
    provider = _provider(request)
    job = await svc.get_job(session, job_id)
    try:
        await svc.regenerate_field(session, provider, job, body.field, current.id)
    except ProviderError as exc:
        raise ProviderUnavailable(str(exc)) from exc
    out = DecisionOut(job_id=job.id, status=job.status)
    await session.commit()
    return out


@router.post("/{job_id}/feedback", status_code=201)
async def feedback(
    job_id: uuid.UUID, body: FeedbackIn, current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("ai:run")),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    job = await svc.get_job(session, job_id)
    await svc.add_feedback(session, job, current.id, body.rating, body.field, body.comment)
    await session.commit()
    return {"status": "recorded"}
