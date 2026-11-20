"""Translation, bulk upload and usage endpoints."""
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import ProviderError
from app.api.deps import CurrentUser, OrgContext, get_current_user, get_session, require_permission
from app.api.v1.ai import ProviderUnavailable, _provider
from app.models import AITranslation
from app.schemas.common import ORM
from app.services import analytics
from app.services import bulk as bulk_svc
from app.services import listing as listing_svc
from app.services import translation as tr_svc

router = APIRouter(tags=["ai"])


class TranslateIn(BaseModel):
    job_id: uuid.UUID
    locale: str


class TranslationApproveIn(BaseModel):
    fields: dict[str, Any] = {}


class TranslationOut(ORM):
    locale: str
    source_locale: str
    fields: dict[str, Any]
    status: str
    version: int
    provider: str
    model: str


@router.get("/languages")
async def languages(_: CurrentUser = Depends(get_current_user)) -> list[dict[str, Any]]:
    return [{"code": c, **meta} for c, meta in tr_svc.LANGUAGES.items()]


@router.post("/ai/translate", response_model=TranslationOut)
async def translate(
    body: TranslateIn, request: Request, current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("ai:run")),
    session: AsyncSession = Depends(get_session),
) -> TranslationOut:
    provider = _provider(request)
    job = await listing_svc.get_job(session, body.job_id)
    try:
        row = await tr_svc.translate(session, provider, job, body.locale, current.id)
    except ProviderError as exc:
        raise ProviderUnavailable(str(exc)) from exc
    out = TranslationOut.model_validate(row)
    await session.commit()
    return out


@router.get("/ai/listings/{job_id}/translations", response_model=list[TranslationOut])
async def list_translations(
    job_id: uuid.UUID, ctx: OrgContext = Depends(require_permission("product:read")),
    session: AsyncSession = Depends(get_session),
) -> list[AITranslation]:
    await listing_svc.get_job(session, job_id)
    return await tr_svc.list_translations(session, job_id)


@router.post("/ai/listings/{job_id}/translations/{locale}/approve", response_model=TranslationOut)
async def approve_translation(
    job_id: uuid.UUID, locale: str, body: TranslationApproveIn,
    current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("product:write")),
    session: AsyncSession = Depends(get_session),
) -> TranslationOut:
    job = await listing_svc.get_job(session, job_id)
    row = await tr_svc.approve_translation(session, job, locale, body.fields, current.id)
    out = TranslationOut.model_validate(row)
    await session.commit()
    return out


# ------------------------------------------------------------------ bulk

@router.post("/ai/bulk-upload", status_code=202)
async def bulk_upload(
    request: Request, files: list[UploadFile] = File(default=[]),
    current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("ai:run")),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    provider = _provider(request)
    settings = request.app.state.settings
    limit = settings.max_zip_uncompressed_bytes
    uploads = [(f.filename or "upload", await f.read(limit + 1)) for f in files]
    bulk, job_ids = await bulk_svc.create_bulk(
        session, request.app.state.image_store, settings, org_id=ctx.org_id, user_id=current.id,
        uploads=uploads)
    out = {"bulk_id": str(bulk.id), "total": bulk.total, "queued": len(job_ids)}
    await session.commit()
    for jid in job_ids:
        request.app.state.job_runner.submit(listing_svc.run_job(
            request.app.state.sessionmaker, provider, request.app.state.image_store, jid,
            ctx.org_id, current.id))
    return out


@router.post("/ai/bulk-upload/csv", status_code=202)
async def bulk_upload_csv(
    request: Request,
    file: UploadFile = File(...),
    current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("ai:run")),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    provider = _provider(request)
    settings = request.app.state.settings
    content_bytes = await file.read(settings.max_request_bytes)
    csv_text = content_bytes.decode("utf-8", errors="replace")

    bulk, job_ids = await bulk_svc.create_bulk_from_csv(
        session, settings, org_id=ctx.org_id, user_id=current.id, csv_content=csv_text
    )
    out = {"bulk_id": str(bulk.id), "total": bulk.total, "queued": len(job_ids)}
    await session.commit()
    for jid in job_ids:
        request.app.state.job_runner.submit(
            listing_svc.run_job(
                request.app.state.sessionmaker,
                provider,
                request.app.state.image_store,
                jid,
                ctx.org_id,
                current.id,
            )
        )
    return out


@router.get("/ai/bulk-upload/{bulk_id}")
async def bulk_status(
    bulk_id: uuid.UUID, ctx: OrgContext = Depends(require_permission("product:read")),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    return await bulk_svc.summary(session, await bulk_svc.get_bulk(session, bulk_id))


@router.post("/ai/bulk-upload/{bulk_id}/retry", status_code=202)
async def bulk_retry(
    bulk_id: uuid.UUID, request: Request, current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("ai:run")),
    session: AsyncSession = Depends(get_session),
) -> dict[str, int]:
    provider = _provider(request)
    bulk = await bulk_svc.get_bulk(session, bulk_id)
    ids = await bulk_svc.retry_failed(session, bulk, current.id)
    await session.commit()
    for jid in ids:
        request.app.state.job_runner.submit(listing_svc.run_job(
            request.app.state.sessionmaker, provider, request.app.state.image_store, jid,
            ctx.org_id, current.id))
    return {"retried": len(ids)}


@router.post("/ai/bulk-upload/{bulk_id}/approve")
async def bulk_approve(
    bulk_id: uuid.UUID, current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("product:write")),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    bulk = await bulk_svc.get_bulk(session, bulk_id)
    out = await bulk_svc.approve_ready(session, bulk, current.id)
    await session.commit()
    return out


@router.get("/ai/bulk-upload/{bulk_id}/export")
async def bulk_export(
    bulk_id: uuid.UUID, ctx: OrgContext = Depends(require_permission("product:read")),
    session: AsyncSession = Depends(get_session),
) -> Response:
    text = await bulk_svc.export_csv(session, await bulk_svc.get_bulk(session, bulk_id))
    return Response(text, media_type="text/csv; charset=utf-8", headers={
        "Content-Disposition": f'attachment; filename="bulk-{bulk_id}.csv"'})


@router.get("/ai/usage")
async def org_usage(
    ctx: OrgContext = Depends(require_permission("product:read")),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    return await analytics.usage_summary(session, ctx.org_id)
