import csv
import io
import uuid
import zipfile
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError, NotFoundError, ValidationFailed
from app.models import (
    AIBulkItem,
    AIBulkJob,
    AIGeneratedContent,
    AIListingJob,
    Category,
)
from app.services import image_ops
from app.services import listing as listing_svc
from app.services.images import LocalImageStore

IMAGE_EXT = {"png", "jpg", "jpeg", "webp"}
ACTIVE = ("queued", "running")


@dataclass
class Entry:
    filename: str
    data: bytes | None
    error: str | None = None


def extract_zip(data: bytes, max_entries: int, max_uncompressed: int, max_file: int) -> list[Entry]:
    """Pulls image entries out of a ZIP defensively (zip-bomb limits, basenames only)."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise ValidationFailed("Not a valid ZIP archive") from exc
    infos = [i for i in zf.infolist() if not i.is_dir()
             and i.filename.rsplit(".", 1)[-1].lower() in IMAGE_EXT]
    if len(infos) > max_entries:
        raise ValidationFailed(f"Archive has more than {max_entries} images")
    if sum(i.file_size for i in infos) > max_uncompressed:
        raise ValidationFailed("Archive is too large when uncompressed")
    out: list[Entry] = []
    for info in infos:
        name = PurePosixPath(info.filename.replace("\\", "/")).name
        if info.file_size > max_file:
            out.append(Entry(name, None, "Image exceeds the maximum allowed size"))
            continue
        out.append(Entry(name, zf.read(info)))
    return out


def csv_safe(value: Any) -> str:
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


async def create_bulk(
    s: AsyncSession, store: LocalImageStore, settings: Settings, *, org_id: uuid.UUID,
    user_id: uuid.UUID, uploads: list[tuple[str, bytes]],
) -> tuple[AIBulkJob, list[uuid.UUID]]:
    if not uploads:
        raise ValidationFailed("No files uploaded")
    entries: list[Entry] = []
    source = "images"
    for name, data in uploads:
        if name.lower().endswith(".zip"):
            source = "zip"
            entries += extract_zip(data, settings.max_bulk_items, settings.max_zip_uncompressed_bytes,
                                   settings.max_image_bytes)
        else:
            entries.append(Entry(PurePosixPath(name.replace("\\", "/")).name, data))
    if not entries:
        raise ValidationFailed("No images found in the upload")
    if len(entries) > settings.max_bulk_items:
        raise ValidationFailed(f"At most {settings.max_bulk_items} images per batch")
    bulk = AIBulkJob(organization_id=org_id, created_by=user_id, source=source, total=len(entries))
    s.add(bulk)
    await s.flush()
    job_ids: list[uuid.UUID] = []
    for e in entries:
        item = AIBulkItem(organization_id=org_id, bulk_id=bulk.id, filename=e.filename[:255])
        s.add(item)
        if e.data is None:
            item.upload_error = e.error
            continue
        try:
            async with s.begin_nested():
                img, _ = await image_ops.save_image(
                    s, store, settings, org_id=org_id, user_id=user_id, filename=e.filename,
                    data=e.data)
                item.image_id = img.id
        except AppError as exc:
            item.upload_error = exc.message
            continue
        job = await listing_svc.create_job(s, org_id=org_id, user_id=user_id,
                                           image_ids=[img.id], category_id=None, hints="",
                                           mode="generate")
        item.job_id = job.id
        job_ids.append(job.id)
    await s.flush()
    return bulk, job_ids


async def create_bulk_from_csv(
    s: AsyncSession,
    settings: Settings,
    *,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    csv_content: str,
) -> tuple[AIBulkJob, list[uuid.UUID]]:
    reader = csv.DictReader(io.StringIO(csv_content))
    rows = list(reader)
    if not rows:
        raise ValidationFailed("CSV contains no data rows")
    if len(rows) > settings.max_bulk_items:
        raise ValidationFailed(f"At most {settings.max_bulk_items} items per batch")

    bulk = AIBulkJob(organization_id=org_id, created_by=user_id, source="csv", total=len(rows))
    s.add(bulk)
    await s.flush()

    job_ids: list[uuid.UUID] = []
    for idx, row in enumerate(rows):
        img_id_str = row.get("image_id") or ""
        cat_slug = row.get("category_slug") or None
        hints = row.get("hints") or row.get("notes") or ""
        name = row.get("title") or f"Row-{idx + 1}"

        item = AIBulkItem(organization_id=org_id, bulk_id=bulk.id, filename=name[:255])
        s.add(item)
        if not img_id_str:
            item.upload_error = "Missing image_id column"
            continue
        try:
            img_id = uuid.UUID(img_id_str.strip())
            item.image_id = img_id
        except ValueError:
            item.upload_error = f"Invalid image_id UUID: {img_id_str}"
            continue

        cat = None
        if cat_slug:
            cat = await s.scalar(select(Category).where(Category.slug == cat_slug.strip()))

        job = await listing_svc.create_job(
            s,
            org_id=org_id,
            user_id=user_id,
            image_ids=[img_id],
            category_id=cat.id if cat else None,
            hints=hints,
            mode="generate",
        )
        item.job_id = job.id
        job_ids.append(job.id)

    await s.flush()
    return bulk, job_ids


async def get_bulk(s: AsyncSession, bulk_id: uuid.UUID) -> AIBulkJob:
    bulk = await s.get(AIBulkJob, bulk_id)
    if not bulk:
        raise NotFoundError("Bulk upload not found")
    return bulk


async def bulk_items(s: AsyncSession, bulk_id: uuid.UUID
                     ) -> list[tuple[AIBulkItem, AIListingJob | None]]:
    items = (await s.scalars(select(AIBulkItem).where(AIBulkItem.bulk_id == bulk_id)
                             .order_by(AIBulkItem.created_at, AIBulkItem.filename))).all()
    jobs = {j.id: j for j in (await s.scalars(select(AIListingJob).where(
        AIListingJob.id.in_([i.job_id for i in items if i.job_id])))).all()}
    return [(i, jobs.get(i.job_id) if i.job_id else None) for i in items]


def item_status(item: AIBulkItem, job: AIListingJob | None) -> str:
    return job.status if job else "upload_failed"


async def summary(s: AsyncSession, bulk: AIBulkJob) -> dict[str, Any]:
    pairs = await bulk_items(s, bulk.id)
    counts: dict[str, int] = {}
    items = []
    for item, job in pairs:
        st = item_status(item, job)
        counts[st] = counts.get(st, 0) + 1
        items.append({"filename": item.filename, "status": st,
                      "job_id": str(job.id) if job else None,
                      "progress": job.progress if job else 0,
                      "error": (job.error if job else item.upload_error)})
    processing = any(st in ACTIVE for st in counts)
    return {"bulk_id": str(bulk.id), "total": bulk.total, "source": bulk.source,
            "status": "processing" if processing else "completed", "counts": counts,
            "items": items}


async def retry_failed(s: AsyncSession, bulk: AIBulkJob, user_id: uuid.UUID
                       ) -> list[uuid.UUID]:
    new_ids: list[uuid.UUID] = []
    for item, job in await bulk_items(s, bulk.id):
        if job is not None and job.status == "failed" and item.image_id:
            new = await listing_svc.create_job(
                s, org_id=bulk.organization_id, user_id=user_id, image_ids=[item.image_id],
                category_id=None, hints="", mode="generate")
            item.job_id = new.id
            new_ids.append(new.id)
    await s.flush()
    return new_ids


async def approve_ready(s: AsyncSession, bulk: AIBulkJob, user_id: uuid.UUID) -> dict[str, Any]:
    approved, skipped = 0, []
    for item, job in await bulk_items(s, bulk.id):
        if job is None or job.status != "awaiting_review":
            continue
        try:
            async with s.begin_nested():
                await listing_svc.approve(s, job, user_id, {}, {})
            approved += 1
        except AppError as exc:
            skipped.append({"job_id": str(job.id), "filename": item.filename,
                            "reason": exc.message, "errors": exc.details})
    return {"approved": approved, "skipped": skipped}


async def export_csv(s: AsyncSession, bulk: AIBulkJob) -> str:
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["filename", "status", "category", "title", "error", "job_id"])
    for item, job in await bulk_items(s, bulk.id):
        cat = title = ""
        if job:
            if job.category_id:
                c = await s.get(Category, job.category_id)
                cat = c.slug if c else ""
            t = await s.scalar(select(AIGeneratedContent).where(
                AIGeneratedContent.job_id == job.id, AIGeneratedContent.field == "title",
                AIGeneratedContent.is_current.is_(True)))
            title = t.value if t else ""
        w.writerow([csv_safe(item.filename), item_status(item, job), cat, csv_safe(title),
                    csv_safe(job.error if job else item.upload_error), job.id if job else ""])
    return out.getvalue()
