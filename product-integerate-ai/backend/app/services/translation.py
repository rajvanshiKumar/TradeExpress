import re
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.core.errors import ConflictError, NotFoundError, ValidationFailed
from app.models import AIGeneratedContent, AIListingJob, AITranslation
from app.services import audit
from app.services.listing import FIELD_GROUP, LIST_FIELDS, _log_usage

LANGUAGES: dict[str, dict[str, Any]] = {
    "en": {"name": "English", "rtl": False},
    "hi": {"name": "Hindi", "rtl": False},
    "fr": {"name": "French", "rtl": False},
    "de": {"name": "German", "rtl": False},
    "es": {"name": "Spanish", "rtl": False},
    "ar": {"name": "Arabic", "rtl": True},
    "pt": {"name": "Portuguese", "rtl": False},
    "it": {"name": "Italian", "rtl": False},
    "ja": {"name": "Japanese", "rtl": False},
    "zh": {"name": "Chinese", "rtl": False},
}
SOURCE_LOCALE = "en"
_LIST_KEY = re.compile(r"^(?P<base>.+)\.(?P<idx>\d+)$")

TRANSLATABLE_FIELDS: set[str] = {
    "title", "short_title", "short_description", "long_description",
    "highlights", "key_features", "specifications_summary", "benefits",
    "seo_title", "meta_description", "keywords", "tags", "search_terms",
    "subcategory", "packaging_summary",
}


def flatten_fields(content: dict[str, Any]) -> dict[str, str]:
    flat: dict[str, str] = {}
    for key, value in content.items():
        if isinstance(value, list):
            flat.update({f"{key}.{i}": str(v) for i, v in enumerate(value)})
        elif value not in (None, ""):
            flat[key] = str(value)
    return flat


def unflatten_fields(flat: dict[str, str], allowed: set[str] | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {}
    lists: dict[str, dict[int, str]] = {}
    for key, value in flat.items():
        m = _LIST_KEY.match(key)
        base = m.group("base") if m else key
        if allowed is not None and base not in allowed:
            continue
        if m:
            lists.setdefault(base, {})[int(m.group("idx"))] = value
        else:
            out[key] = value
    for base, items in lists.items():
        out[base] = [items[i] for i in sorted(items)]
    return out


async def _job_content(s: AsyncSession, job: AIListingJob) -> dict[str, Any]:
    rows = (await s.scalars(select(AIGeneratedContent).where(
        AIGeneratedContent.job_id == job.id, AIGeneratedContent.is_current.is_(True)))).all()
    return {r.field: r.value for r in rows}


async def translate(s: AsyncSession, provider: AIProvider, job: AIListingJob, locale: str,
                    user_id: uuid.UUID) -> AITranslation:
    if locale not in LANGUAGES or locale == SOURCE_LOCALE:
        raise ValidationFailed(f"Unsupported target language '{locale}'")
    if job.status not in ("awaiting_review", "approved"):
        raise ConflictError("Listing content is not ready to translate")
    content = await _job_content(s, job)
    if not content:
        raise ConflictError("Listing has no generated content to translate")
    translatable = {k: v for k, v in content.items() if k in TRANSLATABLE_FIELDS}
    if not translatable:
        raise ConflictError("Listing has no translatable text content")
    result = await provider.translate_content(flatten_fields(translatable), LANGUAGES[locale]["name"])
    await _log_usage(s, job, result.usage)
    fields = unflatten_fields({f.field: f.value for f in result.data.fields},
                              allowed=set(translatable))
    row = await s.scalar(select(AITranslation).where(
        AITranslation.job_id == job.id, AITranslation.locale == locale))
    if row:
        row.fields, row.version, row.status = fields, row.version + 1, "draft"
        row.approved_by, row.provider, row.model = None, result.usage.provider, result.usage.model
    else:
        row = AITranslation(organization_id=job.organization_id, job_id=job.id, locale=locale,
                            source_locale=SOURCE_LOCALE, fields=fields, provider=result.usage.provider,
                            model=result.usage.model)
        s.add(row)
    await s.flush()
    await audit.record(s, action="ai.translate", entity_type="ai_listing_job", entity_id=job.id,
                       actor_user_id=user_id, organization_id=job.organization_id,
                       data={"locale": locale})
    await s.refresh(row)
    return row


async def list_translations(s: AsyncSession, job_id: uuid.UUID) -> list[AITranslation]:
    return list((await s.scalars(select(AITranslation).where(
        AITranslation.job_id == job_id).order_by(AITranslation.locale))).all())


async def approve_translation(s: AsyncSession, job: AIListingJob, locale: str,
                              edits: dict[str, Any], user_id: uuid.UUID) -> AITranslation:
    row = await s.scalar(select(AITranslation).where(
        AITranslation.job_id == job.id, AITranslation.locale == locale))
    if not row:
        raise NotFoundError("Translation not found")
    fields = dict(row.fields)
    for key, value in edits.items():
        if key not in FIELD_GROUP:
            raise ValidationFailed(f"Unknown content field '{key}'")
        if key in LIST_FIELDS:
            ok = isinstance(value, list) and all(isinstance(v, str) for v in value)
        else:
            ok = isinstance(value, str)
        if not ok:
            raise ValidationFailed(f"Invalid value for '{key}'")
        fields[key] = value
    row.fields, row.status, row.approved_by = fields, "approved", user_id
    await s.flush()
    await audit.record(s, action="ai.translation_approve", entity_type="ai_listing_job",
                       entity_id=job.id, actor_user_id=user_id, organization_id=job.organization_id,
                       data={"locale": locale})
    await s.refresh(row)
    return row
