import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models import ProductImage
from app.services import audit
from app.services.images import ImageRules, LocalImageStore, validate_and_process

EXT = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}


def rules_from(settings: Settings) -> ImageRules:
    return ImageRules(max_bytes=settings.max_image_bytes, min_width=settings.min_image_px,
                      min_height=settings.min_image_px)


async def save_image(
    session: AsyncSession, store: LocalImageStore, settings: Settings, *, org_id: uuid.UUID,
    user_id: uuid.UUID, filename: str, data: bytes,
) -> tuple[ProductImage, bool]:
    info = validate_and_process(data, filename, rules_from(settings))
    existing = await session.scalar(select(ProductImage).where(
        ProductImage.organization_id == org_id, ProductImage.sha256 == info.sha256))
    if existing:
        return existing, True
    image_id = uuid.uuid4()
    base = f"{org_id}/{image_id}"
    keys = (f"{base}/original.{EXT[info.mime_type]}", f"{base}/thumb.jpg", f"{base}/optimized.jpg")
    store.put(keys[0], data)
    store.put(keys[1], info.thumbnail)
    store.put(keys[2], info.optimized)
    row = ProductImage(
        id=image_id, organization_id=org_id, uploaded_by=user_id, sha256=info.sha256,
        original_filename=filename[:255], mime_type=info.mime_type, width=info.width,
        height=info.height, size_bytes=info.size_bytes, storage_key=keys[0], thumb_key=keys[1],
        optimized_key=keys[2])
    try:
        async with session.begin_nested():
            session.add(row)
            await session.flush()
    except IntegrityError:
        # A concurrent upload of identical bytes won the race: reuse its record.
        for k in keys:
            store.delete(k)
        winner = await session.scalar(select(ProductImage).where(
            ProductImage.organization_id == org_id, ProductImage.sha256 == info.sha256))
        if winner is None:
            raise
        return winner, True
    except Exception:
        for k in keys:
            store.delete(k)
        raise
    await audit.record(session, action="image.upload", entity_type="product_image",
                       entity_id=image_id, actor_user_id=user_id, organization_id=org_id)
    return row, False


def delete_files(store: LocalImageStore, image: ProductImage) -> None:
    for key in (image.storage_key, image.thumb_key, image.optimized_key):
        store.delete(key)
