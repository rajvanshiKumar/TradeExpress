"""Driver document assist. Privacy first: Aadhaar-like numbers are redacted from text before it
reaches the AI provider, and any Aadhaar-like value in the output is dropped."""
import json
import re
from datetime import date
from pathlib import Path

from app.ai.base import AIProvider
from app.ai.safety import SYSTEM_GUARD
from app.core.assist import call_provider, evaluate, extraction_guesses, log_done, usage_out
from app.modules.transport_driver import prompts
from app.modules.transport_driver.schemas import DriverAssistIn, DriverAssistOut, DriverExtraction
from app.validators.common import clean_text
from app.validators.images import decode_images
from app.validators.india import (
    looks_like_aadhaar,
    normalize_licence_number,
    normalize_phone,
    parse_document_date,
    redact_government_ids,
)

CONFIG = json.loads((Path(__file__).parent / "config.json").read_text(encoding="utf-8"))
PREFILL = float(CONFIG["thresholds"]["prefill"])
CONFIRM = float(CONFIG["thresholds"]["confirm"])
LICENCE_TYPES = CONFIG["enums"]["licenseType"]
ALWAYS_CONFIRM = set(CONFIG["always_confirm"])

FIELD_MAP = {
    "name": "name", "licence_number": "licenseNumber", "licence_type": "licenseType",
    "licence_expiry_date": "licenseExpiryDate", "phone": "phone", "alternate_phone": "alternatePhone",
    "emergency_contact_name": "emergencyContactName", "emergency_contact_phone": "emergencyContactPhone",
}
PHONE_FIELDS = {"phone", "alternatePhone", "emergencyContactPhone"}


async def assist(provider: AIProvider, body: DriverAssistIn) -> DriverAssistOut:
    today = body.today or date.today()
    images = decode_images(body.images)
    text = redact_government_ids(body.text)
    warnings: list[str] = []
    if text != body.text:
        warnings.append("An Aadhaar-like number in your text was removed and not sent to the AI.")

    result = await call_provider(
        provider, stage="transport_driver_assist", schema=DriverExtraction, system=SYSTEM_GUARD,
        instruction=prompts.INSTRUCTION, context=prompts.CONTEXT, text=text,
        prompt_version=prompts.PROMPT_VERSION, images=images)

    guesses = extraction_guesses(result.data, FIELD_MAP)
    for field, guess in guesses.items():  # never let an Aadhaar-like value through
        if guess.value and looks_like_aadhaar(guess.value):
            guess.value = None
            warnings.append(f"{field}: the AI returned an Aadhaar-like number; it was dropped")

    suggestions, skipped = evaluate(
        guesses, lambda f, raw: _validate(f, raw, text, today), current_values=body.current_values,
        skip_filled=body.skip_filled, prefill=PREFILL, confirm=CONFIRM, force_confirm=ALWAYS_CONFIRM)

    lic = suggestions.get("licenseExpiryDate")
    if lic and lic.reason.startswith("Expired"):
        warnings.append("licenseExpiryDate: the licence appears to be expired")

    log_done("transport_driver_assist", result, len(suggestions))
    return DriverAssistOut(suggestions=suggestions, skipped=skipped, warnings=warnings, usage=usage_out(result))


def _validate(field: str, raw: str, text: str, today: date) -> tuple[str | None, str | None]:
    if field == "name":
        v = clean_text(raw, 100)
        return (v, None) if v and re.fullmatch(r"[A-Za-z .'-]{2,100}", v) else (None, "invalid name")
    if field == "licenseNumber":
        v = normalize_licence_number(raw)
        return (v, None) if v else (None, "not a valid driving licence number")
    if field == "licenseType":
        v = raw.strip().upper().replace(" ", "_")
        return (v, None) if v in LICENCE_TYPES else (None, "licence type is not in the allowed list")
    if field == "licenseExpiryDate":
        d, why = parse_document_date(raw, today)
        if not d:
            return None, why
        return d.isoformat(), ("Expired on this date: check the licence" if d < today else None)
    if field in PHONE_FIELDS:
        p = normalize_phone(raw)
        if not p:
            return None, "not a valid 10-digit Indian mobile number"
        return (p, None) if p in re.sub(r"\D", "", text) else (None, "phone number is not written in your text")
    if field == "emergencyContactName":
        v = clean_text(raw, 100)
        if not v or not re.fullmatch(r"[A-Za-z .'-]{2,100}", v):
            return None, "invalid name"
        low = text.lower()
        return (v, None) if all(t in low for t in v.lower().split()) else (None, "name is not written in your text")
    return None, "unknown field"
