"""AI listing pipeline: ingestion -> vision -> OCR -> classification -> attributes -> content ->
quality. Every stage commits its output so a provider failure never loses earlier results."""
import asyncio
import json
import logging
import re
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.ai.base import (
    AIProvider,
    CategoryChoice,
    ImageInput,
    ProviderError,
    ProviderResult,
    Usage,
)
from app.ai.policy import Routing, find_unsupported_claims, route_prediction
from app.core.db import set_tenant_context
from app.core.errors import ConflictError, NotFoundError, ValidationFailed
from app.models import (
    AIAttributePrediction,
    AIFeedback,
    AIGeneratedContent,
    AIImageAnalysis,
    AIJobEvent,
    AIListingJob,
    AIUsageLog,
    Category,
    CategoryAttribute,
    ProductImage,
)
from app.services import audit
from app.services import category as cat_svc
from app.services.attribute_validation import validate_value
from app.services.images import LocalImageStore

CONTENT_GROUPS: dict[str, tuple[str, ...]] = {
    "title": ("title", "short_title", "sku", "slug"),
    "description": ("short_description", "long_description", "highlights", "key_features",
                    "specifications_summary", "benefits", "subcategory", "packaging_summary"),
    "seo": ("seo_title", "meta_description", "keywords", "tags", "search_terms"),
    "commerce": ("hsn_code", "gst_rate", "weight_kg", "unit", "suggested_price_inr"),
}
FIELD_GROUP = {f: g for g, fs in CONTENT_GROUPS.items() for f in fs}
LIST_FIELDS = {"highlights", "key_features", "benefits", "keywords", "tags", "search_terms"}
MIN_CATEGORY_CONFIDENCE = 0.5
log = logging.getLogger("app.listing")
READY = ("awaiting_review",)


# ---------------------------------------------------------------- helpers

@asynccontextmanager
async def scoped(sm: async_sessionmaker[AsyncSession], user_id: uuid.UUID | None,
                 org_id: uuid.UUID) -> AsyncIterator[AsyncSession]:
    async with sm() as s:
        await set_tenant_context(s, user_id=user_id, org_id=org_id)
        yield s
        await s.commit()


async def get_job(session: AsyncSession, job_id: uuid.UUID) -> AIListingJob:
    job = await session.get(AIListingJob, job_id)
    if not job:  # also hit for other tenants' jobs (RLS) - indistinguishable on purpose
        raise NotFoundError("Listing job not found")
    return job


async def _event(s: AsyncSession, job: AIListingJob, stage: str, status: str, msg: str = "") -> None:
    s.add(AIJobEvent(organization_id=job.organization_id, job_id=job.id, stage=stage,
                     status=status, message=msg[:500]))


async def _progress(s: AsyncSession, job: AIListingJob, stage: str, progress: int) -> None:
    job.stage, job.progress = stage, progress
    await _event(s, job, stage, "done")
    await s.flush()


async def _log_usage(s: AsyncSession, job: AIListingJob, usage: Usage, ok: bool = True,
                     error: str | None = None) -> None:
    job.provider, job.model, job.prompt_version = usage.provider, usage.model, usage.prompt_version
    s.add(AIUsageLog(
        organization_id=job.organization_id, job_id=job.id, stage=usage.stage,
        provider=usage.provider, model=usage.model, prompt_version=usage.prompt_version,
        input_tokens=usage.input_tokens, output_tokens=usage.output_tokens,
        cost_usd=Decimal(str(usage.cost_usd)) if usage.cost_usd is not None else None,
        latency_ms=usage.latency_ms, success=ok, error=error))


def _text_of(value: Any) -> str:
    return " ".join(value) if isinstance(value, list) else str(value)


async def category_choices(s: AsyncSession) -> tuple[list[CategoryChoice], dict[str, Category]]:
    rows = (await s.scalars(select(Category).where(Category.is_active.is_(True)))).all()
    by_id = {c.id: c for c in rows}

    def label(c: Category) -> str:
        names, node = [c.name], c
        while node.parent_id and node.parent_id in by_id:
            node = by_id[node.parent_id]
            names.append(node.name)
        return " > ".join(reversed(names))

    return ([CategoryChoice(c.slug, label(c)) for c in rows], {c.slug: c for c in rows})


def _spec_for_ai(a: CategoryAttribute) -> dict[str, Any]:
    allowed = [o.value for o in a.options]
    return {"key": a.key, "label": a.label, "data_type": a.data_type, "unit": a.unit,
            "allowed_values": allowed or None, "printed_on_product": a.ocr_extractable}


def _current_facts(cat: Category | None, label: str, preds: list[AIAttributePrediction],
                   analysis: dict[str, Any], ocr_text: str) -> dict[str, Any]:
    attrs: dict[str, Any] = {}
    for p in preds:
        value = p.final_value if p.seller_provided else p.ai_value
        if value is not None:
            attrs[p.attribute_key] = value
    return {"category": label, "attributes": attrs, "visual_analysis": analysis,
            "printed_text": ocr_text}


# ---------------------------------------------------------------- job creation

async def create_job(
    s: AsyncSession, *, org_id: uuid.UUID, user_id: uuid.UUID, image_ids: list[uuid.UUID],
    category_id: uuid.UUID | None, hints: str, mode: str,
) -> AIListingJob:
    unique_ids = list(dict.fromkeys(image_ids))
    found = (await s.scalars(select(ProductImage.id).where(ProductImage.id.in_(unique_ids)))).all()
    if len(found) != len(unique_ids):
        raise NotFoundError("One or more images were not found")
    if category_id:
        await cat_svc.get_category(s, category_id)
    job = AIListingJob(organization_id=org_id, created_by=user_id, image_ids=unique_ids,
                       category_id=category_id, category_source="seller" if category_id else None,
                       seller_hints=hints, mode=mode, status="queued")
    s.add(job)
    await s.flush()
    await _event(s, job, "queued", "done")
    await audit.record(s, action="ai.job_create", entity_type="ai_listing_job", entity_id=job.id,
                       actor_user_id=user_id, organization_id=org_id, data={"mode": mode})
    return job


# ---------------------------------------------------------------- pipeline

async def run_job(sm: async_sessionmaker[AsyncSession], provider: AIProvider,
                  store: LocalImageStore, job_id: uuid.UUID, org_id: uuid.UUID,
                  user_id: uuid.UUID) -> None:
    try:
        await _run(sm, provider, store, job_id, org_id, user_id)
    except Exception as exc:
        log.exception("listing job %s failed", job_id)
        msg = str(exc) if isinstance(exc, ProviderError) else f"Internal error ({type(exc).__name__})"
        async with scoped(sm, user_id, org_id) as s:
            job = await get_job(s, job_id)
            job.status, job.error = "failed", msg[:500]
            await _event(s, job, job.stage, "failed", msg)


async def _run(sm: async_sessionmaker[AsyncSession], provider: AIProvider, store: LocalImageStore,
               job_id: uuid.UUID, org_id: uuid.UUID, user_id: uuid.UUID) -> None:
    # 1. ingestion
    async with scoped(sm, user_id, org_id) as s:
        job = await get_job(s, job_id)
        job.status = "running"
        rows = {i.id: i for i in (await s.scalars(
            select(ProductImage).where(ProductImage.id.in_(job.image_ids)))).all()}
        images = [ImageInput(store.get(rows[i].optimized_key), "image/jpeg", str(i))
                  for i in job.image_ids]
        hints, preset_cat, mode = job.seller_hints, job.category_id, job.mode
        image_ids = list(job.image_ids)
        await _progress(s, job, "ingestion", 5)

    # 2 & 3. Image understanding and OCR run concurrently in parallel
    vision, ocr = await asyncio.gather(
        provider.analyze_images(images, hints),
        provider.ocr_images(images),
    )
    async with scoped(sm, user_id, org_id) as s:
        job = await get_job(s, job_id)
        s.add(AIImageAnalysis(
            organization_id=org_id,
            job_id=job_id,
            analysis=vision.data.model_dump(),
            ocr=ocr.data.model_dump(),
            ocr_engine=f"{ocr.usage.provider}:{ocr.usage.model}",
        ))
        await _log_usage(s, job, vision.usage)
        await _log_usage(s, job, ocr.usage)
        await _progress(s, job, "ocr", 40)
    ocr_text = ocr.data.full_text

    # 4. classification (candidates are mapped onto real DB categories only)
    async with scoped(sm, user_id, org_id) as s:
        choices, by_slug = await category_choices(s)
    category_id, classification = preset_cat, {}
    if not preset_cat:
        cls = await provider.classify_product(vision.data, ocr_text, choices, hints)
        cands, chosen = [], None
        for cand in sorted(cls.data.candidates, key=lambda c: -c.confidence):
            cat = by_slug.get(cand.slug)
            cands.append({"slug": cand.slug, "confidence": cand.confidence, "reason": cand.reason,
                          "category_id": str(cat.id) if cat else None, "valid": cat is not None})
            if chosen is None and cat and cand.confidence >= MIN_CATEGORY_CONFIDENCE:
                chosen = (cat, cand.confidence)
        classification = {"candidates": cands, "confidence": chosen[1] if chosen else None}
        category_id = chosen[0].id if chosen else None
        async with scoped(sm, user_id, org_id) as s:
            job = await get_job(s, job_id)
            job.category_id = category_id
            job.category_source = "ai" if category_id else None
            job.classification = classification
            await _log_usage(s, job, cls.usage)
            await _progress(s, job, "classification", 55)
    else:
        async with scoped(sm, user_id, org_id) as s:
            job = await get_job(s, job_id)
            job.classification = {"candidates": [], "confidence": 1.0}
            await _progress(s, job, "classification", 55)

    # 5. attribute extraction
    cat_label = ""
    attr_defs: dict[str, CategoryAttribute] = {}
    if category_id:
        async with scoped(sm, user_id, org_id) as s:
            cat = await cat_svc.get_category(s, category_id)
            cat_label = next((c.path_label for c in choices if c.slug == cat.slug), cat.name)
            attr_defs = {a.key: a for a in await cat_svc.effective_attributes(s, cat)
                         if a.ai_extractable}
            specs = [_spec_for_ai(a) for a in attr_defs.values()]
            spec_objs = {k: cat_svc.to_spec(a) for k, a in attr_defs.items()}
            thresholds = {k: float(a.confidence_threshold) for k, a in attr_defs.items()}
            types = {k: a.data_type for k, a in attr_defs.items()}
        ext = await provider.extract_attributes(images, specs, vision.data, ocr_text)
        async with scoped(sm, user_id, org_id) as s:
            job = await get_job(s, job_id)
            seen: set[str] = set()
            for item in ext.data.attributes:
                if item.key not in attr_defs or item.key in seen:
                    continue  # never accept attributes outside the category schema
                seen.add(item.key)
                value = _parse_json(item.value_json)
                reason_override = None
                if value is not None:
                    errs = validate_value(spec_objs[item.key], value)
                    if errs:
                        value, reason_override = None, f"failed schema validation: {errs[0]}"
                routed = route_prediction(item.key, value, item.confidence, item.source,
                                          thresholds[item.key])
                img_id = (image_ids[item.image_index]
                          if item.image_index is not None and 0 <= item.image_index < len(image_ids)
                          else None)
                s.add(AIAttributePrediction(
                    organization_id=org_id, job_id=job_id, attribute_key=item.key,
                    data_type=types[item.key], ai_value=routed.value,
                    final_value=routed.value if routed.routing == Routing.PREFILL else None,
                    confidence=Decimal(str(round(routed.confidence, 3))), source=item.source,
                    evidence=item.evidence[:500], image_id=img_id, routing=routed.routing.value,
                    reason=reason_override or routed.reason, requires_review=routed.requires_review))
            await _log_usage(s, job, ext.usage)
            await _progress(s, job, "attributes", 70)

    if mode == "analyze":
        async with scoped(sm, user_id, org_id) as s:
            job = await get_job(s, job_id)
            job.quality = await _quality(s, job, {}, {})
            job.status = "analyzed"
            await _progress(s, job, "complete", 100)
        return

    # 6. content generation (unified high-accuracy single call)
    async with scoped(sm, user_id, org_id) as s:
        preds = list((await s.scalars(select(AIAttributePrediction).where(
            AIAttributePrediction.job_id == job_id))).all())
        facts = _current_facts(None, cat_label, preds, vision.data.model_dump(), ocr_text)
    content_r = await provider.generate_all_content(facts)
    content: dict[str, Any] = {}
    async with scoped(sm, user_id, org_id) as s:
        job = await get_job(s, job_id)
        await _log_usage(s, job, content_r.usage)
        for field, value in content_r.data.model_dump().items():
            content[field] = value
            s.add(AIGeneratedContent(
                organization_id=org_id, job_id=job_id, field=field, version=1, value=value,
                origin="ai", prompt_version=content_r.usage.prompt_version, model=content_r.usage.model))
        await _progress(s, job, "content", 90)

    # 7. quality validation
    async with scoped(sm, user_id, org_id) as s:
        job = await get_job(s, job_id)
        job.quality = await _quality(s, job, content, facts)
        job.status = "awaiting_review"
        await _progress(s, job, "complete", 100)


def _parse_json(raw: str | None) -> Any:
    """Models occasionally return a bare word instead of a JSON string; keep it as a string
    (schema validation still rejects it for non-string attribute types)."""
    if raw is None or not raw.strip():
        return None
    try:
        return json.loads(raw)
    except ValueError:
        return raw.strip()


async def _quality(s: AsyncSession, job: AIListingJob, content: dict[str, Any],
                   facts: dict[str, Any]) -> dict[str, Any]:
    warnings: list[dict[str, str]] = []
    missing: list[str] = []
    if job.category_id is None:
        warnings.append({"code": "category_unknown",
                         "message": "The product category could not be determined; please select one."})
    else:
        cat = await cat_svc.get_category(s, job.category_id)
        preds = {p.attribute_key: p for p in (await s.scalars(select(AIAttributePrediction).where(
            AIAttributePrediction.job_id == job.id))).all()}
        for a in await cat_svc.effective_attributes(s, cat):
            p = preds.get(a.key)
            have = p is not None and (p.final_value if p.seller_provided else p.ai_value) is not None
            if a.required and not have:
                missing.append(a.key)
        confirm = [k for k, p in preds.items() if p.routing == Routing.CONFIRM.value]
        if confirm:
            warnings.append({"code": "attributes_need_confirmation",
                             "message": f"Please confirm: {', '.join(sorted(confirm))}"})
        conf = (job.classification or {}).get("confidence")
        if conf is not None and conf < 0.7 and job.category_source == "ai":
            warnings.append({"code": "category_low_confidence",
                             "message": "Category confidence is moderate; please verify."})
    evidence = json.dumps(facts, default=str) if facts else ""
    unsupported: dict[str, list[str]] = {}
    for field, value in content.items():
        claims = find_unsupported_claims(_text_of(value), evidence)
        if claims:
            unsupported[field] = claims
    if unsupported:
        warnings.append({"code": "unsupported_claims",
                         "message": "Generated text contains claims without supporting evidence."})
    title = content.get("title")
    if title and len(title) > 150:
        warnings.append({"code": "title_too_long", "message": "Title exceeds 150 characters."})
    return {"missing_required": missing, "unsupported_claims": unsupported, "warnings": warnings}


# ---------------------------------------------------------------- results

async def build_result(s: AsyncSession, job: AIListingJob) -> dict[str, Any]:
    analysis = await s.scalar(select(AIImageAnalysis).where(AIImageAnalysis.job_id == job.id))
    preds = (await s.scalars(select(AIAttributePrediction).where(
        AIAttributePrediction.job_id == job.id).order_by(AIAttributePrediction.attribute_key))).all()
    contents = (await s.scalars(select(AIGeneratedContent).where(
        AIGeneratedContent.job_id == job.id).order_by(AIGeneratedContent.version))).all()
    usage = (await s.scalars(select(AIUsageLog).where(AIUsageLog.job_id == job.id))).all()
    category = None
    if job.category_id:
        c = await cat_svc.get_category(s, job.category_id)
        category = {"id": str(c.id), "slug": c.slug, "name": c.name,
                    "confidence": (job.classification or {}).get("confidence"),
                    "source": job.category_source,
                    "candidates": (job.classification or {}).get("candidates", [])}
    content: dict[str, Any] = {}
    for row in contents:
        entry = content.setdefault(row.field, {"history": []})
        entry["history"].append({"version": row.version, "origin": row.origin, "value": row.value})
        if row.is_current:
            entry.update(value=row.value, origin=row.origin, version=row.version)
    costs = [u.cost_usd for u in usage if u.cost_usd is not None]

    def _val(k: str, d: Any = None) -> Any:
        e = content.get(k)
        if isinstance(e, dict):
            return e.get("value", d)
        return d

    p_title = str(_val("title") or "Untitled Product")
    p_slug = str(_val("slug") or re.sub(r"[^a-z0-9]+", "-", p_title.lower()).strip("-"))
    p_sku = str(_val("sku") or f"SKU-{str(job.id)[:8].upper()}")
    p_summary = str(_val("short_description") or _val("summary") or p_title)
    p_desc = str(_val("long_description") or _val("description") or p_summary)

    specs: dict[str, Any] = {}
    for p in preds:
        val = p.final_value if p.final_value is not None else p.ai_value
        if val is not None:
            specs[p.attribute_key.replace("_", " ").title()] = val

    # Ensure Material is accurately populated from material, fabric, or visual analysis
    if not specs.get("Material"):
        if specs.get("Fabric Composition"):
            specs["Material"] = specs["Fabric Composition"]
        elif specs.get("Fabric"):
            specs["Material"] = specs["Fabric"]
        elif analysis and analysis.analysis and analysis.analysis.get("visible_materials"):
            specs["Material"] = ", ".join(analysis.analysis["visible_materials"])

    box_items = [p_title]
    pkg_note = _val("packaging_summary")
    if pkg_note:
        box_items.append(str(pkg_note))
    packaging = {
        "packageType": "Retail Box",
        "boxContents": box_items,
        "isFragile": False,
    }

    color_val = specs.get("Color") or "Standard"
    variants = [
        {"type": "Color", "options": [color_val]},
    ]
    for opt_key in ("Size", "Shoe Size", "Storage Capacity", "RAM"):
        if opt_key in specs and specs[opt_key]:
            variants.append({"type": opt_key, "options": [str(specs[opt_key])]})

    p_price = float(_val("suggested_price_inr") or 899.00)
    p_hsn = str(_val("hsn_code") or "8518")
    p_gst = float(_val("gst_rate") or 18.00)
    p_weight = float(_val("weight_kg") or 0.25)
    p_unit = str(_val("unit") or "piece")

    price_tiers = [
        {"minQuantity": 1, "maxQuantity": 10, "unitPrice": round(p_price, 2), "currency": "INR"},
        {"minQuantity": 11, "maxQuantity": 50, "unitPrice": round(p_price * 0.9, 2), "currency": "INR"},
        {"minQuantity": 51, "maxQuantity": None, "unitPrice": round(p_price * 0.8, 2), "currency": "INR"},
    ]

    primary_photo = f"/api/v1/images/{job.image_ids[0]}/file?variant=original" if job.image_ids else None
    photo_urls = [f"/api/v1/images/{img_id}/file?variant=original" for img_id in job.image_ids]

    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()

    ecommerce_product = {
        "id": str(uuid.uuid4()),
        "sku": p_sku,
        "name": p_title,
        "slug": p_slug,
        "companyId": None,
        "supplierId": None,
        "categorySlug": category["slug"] if category else "electronics",
        "subcategory": str(_val("subcategory") or (category["name"] if category else "General")),
        "summary": p_summary,
        "description": p_desc,
        "photo": primary_photo,
        "photos": photo_urls,
        "videoUrl": None,
        "currency": "INR",
        "price": p_price,
        "unit": p_unit,
        "moq": 1,
        "stock": 100,
        "reservedStock": 0,
        "committedStock": 0,
        "lowStockThreshold": 10,
        "warehouseLocation": None,
        "leadTimeDays": 7,
        "status": "Active",
        "featured": False,
        "trending": False,
        "readyToShip": True,
        "isNew": True,
        "deal": False,
        "hsnCode": p_hsn,
        "gstRate": p_gst,
        "sampleAvailable": True,
        "samplePrice": p_price,
        "moderationStatus": "APPROVED",
        "rejectionReason": None,
        "weightKg": p_weight,
        "variants": variants,
        "specifications": specs,
        "packaging": packaging,
        "priceTiers": price_tiers,
        "seo": {
            "seoTitle": str(_val("seo_title") or p_title),
            "metaDescription": str(_val("meta_description") or p_summary),
            "keywords": _val("keywords") if isinstance(_val("keywords"), list) else [],
            "tags": _val("tags") if isinstance(_val("tags"), list) else [],
            "searchTerms": _val("search_terms") if isinstance(_val("search_terms"), list) else [],
        },
        "createdAt": now_iso,
        "updatedAt": now_iso,
    }

    quality_out = {
        "missing_required": [],
        "unsupported_claims": {},
        "warnings": [],
        **(job.quality or {}),
    }
    if quality_out.get("missing_required"):
        have_keys = {
            p.attribute_key
            for p in preds
            if (p.final_value is not None or p.seller_value is not None or p.ai_value is not None)
        }
        quality_out["missing_required"] = [
            k for k in quality_out["missing_required"] if k not in have_keys
        ]

    return {
        "job": {"id": str(job.id), "status": job.status, "stage": job.stage,
                "progress": job.progress, "error": job.error, "provider": job.provider,
                "model": job.model, "prompt_version": job.prompt_version},
        "images": [str(i) for i in job.image_ids],
        "category": category,
        "analysis": analysis.analysis if analysis else None,
        "ocr": ({**analysis.ocr, "engine": analysis.ocr_engine} if analysis and analysis.ocr else None),
        "attributes": [{
            "attribute_key": p.attribute_key, "data_type": p.data_type, "ai_value": p.ai_value,
            "seller_value": p.seller_value, "final_value": p.final_value,
            "confidence": float(p.confidence), "source": p.source, "evidence": p.evidence,
            "image_id": str(p.image_id) if p.image_id else None, "routing": p.routing,
            "reason": p.reason, "requires_review": p.requires_review, "verified": p.verified,
        } for p in preds],
        "content": content,
        "quality": quality_out,
        "usage": {"calls": len(usage), "input_tokens": sum(u.input_tokens for u in usage),
                  "output_tokens": sum(u.output_tokens for u in usage),
                  "cost_usd": float(sum(costs)) if costs else None},
        "ecommerce_product": ecommerce_product,
    }


# ---------------------------------------------------------------- seller actions

async def _current(s: AsyncSession, job_id: uuid.UUID, field: str) -> AIGeneratedContent | None:
    return await s.scalar(select(AIGeneratedContent).where(
        AIGeneratedContent.job_id == job_id, AIGeneratedContent.field == field,
        AIGeneratedContent.is_current.is_(True)))


async def _add_version(s: AsyncSession, job: AIListingJob, field: str, value: Any, origin: str,
                       prompt_version: str | None, model: str | None) -> None:
    prev = await _current(s, job.id, field)
    version = 1
    if prev:
        prev.is_current = False
        version = prev.version + 1
        await s.flush()
    s.add(AIGeneratedContent(organization_id=job.organization_id, job_id=job.id, field=field,
                             version=version, value=value, origin=origin,
                             prompt_version=prompt_version, model=model))
    await s.flush()


def _check_content_value(field: str, value: Any) -> None:
    if field not in FIELD_GROUP:
        raise ValidationFailed(f"Unknown content field '{field}'")
    if field in LIST_FIELDS:
        if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
            raise ValidationFailed(f"'{field}' must be a list of strings")
    elif field in ("gst_rate", "weight_kg", "suggested_price_inr"):
        if not isinstance(value, (int, float, Decimal)):
            try:
                float(str(value))
            except (ValueError, TypeError):
                raise ValidationFailed(f"'{field}' must be numeric")
    elif not isinstance(value, str):
        raise ValidationFailed(f"'{field}' must be a string")


async def approve(s: AsyncSession, job: AIListingJob, user_id: uuid.UUID,
                  content_edits: dict[str, Any], attr_edits: dict[str, Any]) -> None:
    if job.status not in READY:
        raise ConflictError(f"Listing is '{job.status}' and cannot be approved")
    if job.category_id is None:
        raise ValidationFailed("Select a category before approving")
    for f, v in content_edits.items():
        _check_content_value(f, v)
    cat = await cat_svc.get_category(s, job.category_id)
    schema = {a.key: a for a in await cat_svc.effective_attributes(s, cat)}
    unknown = [k for k in attr_edits if k not in schema]
    if unknown:
        raise ValidationFailed("Unknown attributes for this category", {"unknown": unknown})
    preds = {p.attribute_key: p for p in (await s.scalars(select(AIAttributePrediction).where(
        AIAttributePrediction.job_id == job.id))).all()}
    finals: dict[str, Any] = {}
    for key in schema:
        p = preds.get(key)
        if key in attr_edits:
            finals[key] = attr_edits[key]
        elif p is not None:
            finals[key] = p.ai_value
    errors = {}
    for key, attr in schema.items():
        errs = validate_value(cat_svc.to_spec(attr), finals.get(key))
        if errs:
            errors[key] = errs
    title_after = content_edits.get("title") or ((await _current(s, job.id, "title")) or
                                                 AIGeneratedContent(value="")).value
    if not title_after:
        errors["title"] = ["title is required"]
    if errors:
        raise ValidationFailed("Listing is incomplete or invalid", errors)
    for key, value in finals.items():
        p = preds.get(key)
        if key in attr_edits:
            if p is None:
                p = AIAttributePrediction(
                    organization_id=job.organization_id, job_id=job.id, attribute_key=key,
                    data_type=schema[key].data_type, confidence=Decimal("1"), source="seller",
                    routing=Routing.PREFILL.value, requires_review=False)
                s.add(p)
            p.seller_value, p.seller_provided, p.verified = value, True, value is not None
            p.final_value, p.requires_review = value, False
        elif p is not None and value is not None:
            p.final_value = value
            p.verified = True
            p.requires_review = False
    for f, v in content_edits.items():
        await _add_version(s, job, f, v, "seller", None, None)
    job.status, job.stage = "approved", "approved"
    await _event(s, job, "approved", "done")
    await audit.record(s, action="ai.listing_approve", entity_type="ai_listing_job",
                       entity_id=job.id, actor_user_id=user_id, organization_id=job.organization_id)


async def reject(s: AsyncSession, job: AIListingJob, user_id: uuid.UUID, reason: str) -> None:
    if job.status not in ("awaiting_review", "analyzed", "failed"):
        raise ConflictError(f"Listing is '{job.status}' and cannot be rejected")
    job.status, job.stage, job.decision_reason = "rejected", "rejected", reason
    await _event(s, job, "rejected", "done", reason)
    await audit.record(s, action="ai.listing_reject", entity_type="ai_listing_job",
                       entity_id=job.id, actor_user_id=user_id, organization_id=job.organization_id)


async def regenerate_field(s: AsyncSession, provider: AIProvider, job: AIListingJob, field: str,
                           user_id: uuid.UUID) -> None:
    if field not in FIELD_GROUP:
        raise ValidationFailed(f"Unknown content field '{field}'")
    if job.status != "awaiting_review":
        raise ConflictError(f"Listing is '{job.status}'; fields cannot be regenerated")
    analysis = await s.scalar(select(AIImageAnalysis).where(AIImageAnalysis.job_id == job.id))
    preds = list((await s.scalars(select(AIAttributePrediction).where(
        AIAttributePrediction.job_id == job.id))).all())
    label = ""
    if job.category_id:
        choices, _ = await category_choices(s)
        cat = await cat_svc.get_category(s, job.category_id)
        label = next((c.path_label for c in choices if c.slug == cat.slug), cat.name)
    facts = _current_facts(None, label, preds, analysis.analysis if analysis else {},
                           (analysis.ocr or {}).get("full_text", "") if analysis else "")
    group = FIELD_GROUP[field]
    methods: dict[str, Callable[[dict[str, Any]], Awaitable[ProviderResult[Any]]]] = {
        "title": provider.generate_title, "description": provider.generate_description,
              "seo": provider.generate_seo}
    result = await methods[group](facts)
    await _log_usage(s, job, result.usage)
    new_value = result.data.model_dump()[field]
    await _add_version(s, job, field, new_value, "ai", result.usage.prompt_version,
                       result.usage.model)
    quality = dict(job.quality or {})
    unsupported = dict(quality.get("unsupported_claims", {}))
    claims = find_unsupported_claims(_text_of(new_value), json.dumps(facts, default=str))
    if claims:
        unsupported[field] = claims
    else:
        unsupported.pop(field, None)
    quality["unsupported_claims"] = unsupported
    job.quality = quality
    await audit.record(s, action="ai.field_regenerate", entity_type="ai_listing_job",
                       entity_id=job.id, actor_user_id=user_id, organization_id=job.organization_id,
                       data={"field": field})


async def add_feedback(s: AsyncSession, job: AIListingJob, user_id: uuid.UUID, rating: int,
                       field: str | None, comment: str) -> None:
    s.add(AIFeedback(organization_id=job.organization_id, job_id=job.id, user_id=user_id,
                     rating=rating, field=field, comment=comment))
    await s.flush()
