import uuid

from fastapi import APIRouter, Depends, File, Query, Request, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    CurrentUser,
    OrgContext,
    get_current_user,
    get_session,
    get_settings_dep,
    require_permission,
)
from app.core.config import Settings
from app.core.db import set_tenant_context
from app.core.errors import ForbiddenError, NotFoundError, ValidationFailed
from app.models import ProductImage
from app.schemas.ai import ImageOut
from app.services import image_ops
from app.services.images import sign_url_params, verify_signature

router = APIRouter(prefix="/images", tags=["images"])


def _key(settings: Settings) -> str:
    return f"{settings.jwt_secret}:image-url"


def to_out(img: ProductImage, settings: Settings, duplicate: bool = False) -> ImageOut:
    def url(variant: str) -> str:
        exp, sig = sign_url_params(str(img.id), _key(settings) + variant,
                                   settings.signed_url_ttl_seconds)
        return f"/api/v1/images/{img.id}/file?variant={variant}&exp={exp}&sig={sig}"

    out = ImageOut.model_validate(img)
    out.duplicate, out.url, out.thumbnail_url = duplicate, url("original"), url("thumb")
    return out


@router.post("/upload", status_code=201, response_model=ImageOut)
async def upload(
    request: Request,
    response: Response,
    file: UploadFile = File(...),
    current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("product:write")),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings_dep),
) -> ImageOut:
    data = await file.read(settings.max_image_bytes + 1)
    if len(data) > settings.max_image_bytes:
        raise ValidationFailed("Image exceeds the maximum allowed size")
    img, duplicate = await image_ops.save_image(
        session, request.app.state.image_store, settings, org_id=ctx.org_id, user_id=current.id,
        filename=file.filename or "upload", data=data)
    out = to_out(img, settings, duplicate)
    await session.commit()
    if duplicate:
        response.status_code = 200
    return out


@router.get("/{image_id}/file")
async def serve_file(
    image_id: uuid.UUID,
    request: Request,
    variant: str = Query("original", pattern="^(original|thumb)$"),
    exp: int = Query(...),
    sig: str = Query(...),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings_dep),
) -> Response:
    if not verify_signature(str(image_id), exp, sig, _key(settings) + variant):
        raise ForbiddenError("Invalid or expired image link")
    # The HMAC is the credential here (no user session); only after it verifies do we read
    # the row, bypassing tenant RLS for this single lookup.
    await set_tenant_context(session, is_admin=True)
    img = await session.get(ProductImage, image_id)
    if not img:
        raise NotFoundError("Image not found")
    store = request.app.state.image_store
    try:
        if variant == "thumb":
            return Response(store.get(img.thumb_key), media_type="image/jpeg")
        return Response(store.get(img.storage_key), media_type=img.mime_type)
    except FileNotFoundError as exc:
        raise NotFoundError("Image file missing") from exc


@router.get("/{image_id}", response_model=ImageOut)
async def get_image(
    image_id: uuid.UUID,
    ctx: OrgContext = Depends(require_permission("product:read")),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings_dep),
) -> ImageOut:
    img = await session.get(ProductImage, image_id)
    if not img:
        raise NotFoundError("Image not found")
    return to_out(img, settings)


@router.delete("/{image_id}", status_code=204)
async def delete_image(
    image_id: uuid.UUID,
    request: Request,
    ctx: OrgContext = Depends(require_permission("product:write")),
    session: AsyncSession = Depends(get_session),
) -> Response:
    img = await session.get(ProductImage, image_id)
    if not img:
        raise NotFoundError("Image not found")
    image_ops.delete_files(request.app.state.image_store, img)
    await session.delete(img)
    await session.commit()
    return Response(status_code=204)
