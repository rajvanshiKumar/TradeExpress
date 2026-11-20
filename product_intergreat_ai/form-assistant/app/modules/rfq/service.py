"""RFQ assist: ask the model, then validate every value deterministically before returning it.
Nothing here writes to a database; the caller (your form) decides whether to apply."""
import json
import re
from datetime import date
from pathlib import Path

from app.ai.base import AIProvider
from app.ai.safety import SYSTEM_GUARD, find_unsupported_claims
from app.core.assist import call_provider, evaluate, extraction_guesses, log_done, usage_out
from app.modules.rfq import prompts
from app.modules.rfq.schemas import FILLABLE_FIELDS, RfqAssistIn, RfqAssistOut, RfqExtraction
from app.validators.common import (
    ALLOWED_UNITS,
    clean_text,
    normalize_country,
    normalize_unit,
    parse_future_date,
    parse_quantity,
    valid_pincode,
)

CONFIG = json.loads((Path(__file__).parent / "config.json").read_text(encoding="utf-8"))
PREFILL = float(CONFIG["thresholds"]["prefill"])
CONFIRM = float(CONFIG["thresholds"]["confirm"])

# AI schema attribute -> form field name
FIELD_MAP = {
    "title": "title", "specifications": "specifications", "category_slug": "categorySlug",
    "quantity": "quantity", "unit": "unit", "delivery_pincode": "deliveryPincode",
    "destination_country": "destinationCountry", "required_by_date": "requiredByDate",
}
assert set(FIELD_MAP.values()) == set(FILLABLE_FIELDS)


async def assist(provider: AIProvider, body: RfqAssistIn, today: date | None = None) -> RfqAssistOut:
    today = body.today or today or date.today()
    cats = {c.slug.lower(): c.slug for c in body.categories}
    context = prompts.build_context(today.isoformat(), [(c.slug, c.name or c.slug) for c in body.categories],
                                    ALLOWED_UNITS)
    result = await call_provider(
        provider, stage="rfq_assist", schema=RfqExtraction, system=SYSTEM_GUARD, instruction=prompts.INSTRUCTION,
        context=context, text=body.text, prompt_version=prompts.PROMPT_VERSION)

    suggestions, skipped = evaluate(
        extraction_guesses(result.data, FIELD_MAP), lambda f, raw: _validate(f, raw, body, cats, today),
        current_values=body.current_values, skip_filled=body.skip_filled, prefill=PREFILL, confirm=CONFIRM)

    warnings: list[str] = []
    spec = suggestions.get("specifications")
    if spec:
        claims = find_unsupported_claims(str(spec.value), body.text)
        if claims:
            spec.routing, spec.reason = "confirm", f"Contains details not in your text: {', '.join(claims)}"
            warnings.append(f"specifications: unverified claim(s) {', '.join(claims)}; please check")

    log_done("rfq_assist", result, len(suggestions))
    return RfqAssistOut(suggestions=suggestions, skipped=skipped, warnings=warnings, usage=usage_out(result))


def _validate(field: str, raw: str, body: RfqAssistIn, cats: dict[str, str],
              today: date) -> tuple[str | int | None, str | None]:
    """Returns (clean value, note). A None value means: reject, note is the reason."""
    if field == "title":
        v = clean_text(raw, 150)
        return (v, None) if v and len(v) >= 2 else (None, "title too short")
    if field == "specifications":
        v = clean_text(raw, 4000)
        return (v, None) if v and len(v) >= 5 else (None, "specifications too short")
    if field == "categorySlug":
        if not cats:
            return None, "no category list was sent in the request"
        slug = cats.get(raw.strip().lower())
        return (slug, None) if slug else (None, "category is not in the allowed list")
    if field == "quantity":
        q = parse_quantity(raw)
        return (q, None) if q else (None, "quantity is not a positive whole number")
    if field == "unit":
        u = normalize_unit(raw)
        return (u, None) if u else (None, "unit is not in the allowed list")
    if field == "deliveryPincode":
        p = valid_pincode(raw)
        if not p:
            return None, "not a valid 6-digit Indian pincode"
        if not re.search(rf"(?<!\d){p}(?!\d)", re.sub(r"(?<=\d) (?=\d)", "", body.text)):
            return None, "pincode is not written in your text"
        return p, None
    if field == "destinationCountry":
        c = normalize_country(raw)
        return (c, None) if c else (None, "invalid country")
    if field == "requiredByDate":
        d, why = parse_future_date(raw, today)
        return (d.isoformat(), None) if d else (None, why)
    return None, "unknown field"
