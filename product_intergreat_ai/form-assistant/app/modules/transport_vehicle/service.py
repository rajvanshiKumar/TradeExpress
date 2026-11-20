"""Vehicle document assist: extract fields from document photos/text, verify every value in code.
The AI never decides verification or status."""
import json
import re
from datetime import date
from pathlib import Path

from app.ai.base import AIProvider
from app.ai.safety import SYSTEM_GUARD
from app.core.assist import call_provider, evaluate, extraction_guesses, log_done, usage_out
from app.core.schemas import FieldSuggestion
from app.modules.transport_vehicle import prompts
from app.modules.transport_vehicle.schemas import VehicleAssistIn, VehicleAssistOut, VehicleExtraction
from app.validators.common import clean_text
from app.validators.images import decode_images
from app.validators.india import (
    clean_identifier,
    normalize_vehicle_number,
    parse_document_date,
    similar_names,
    valid_imei,
)

CONFIG = json.loads((Path(__file__).parent / "config.json").read_text(encoding="utf-8"))
PREFILL = float(CONFIG["thresholds"]["prefill"])
CONFIRM = float(CONFIG["thresholds"]["confirm"])
ENUMS = CONFIG["enums"]
ALWAYS_CONFIRM = set(CONFIG["always_confirm"])
DATE_FIELDS = {"rcExpiryDate", "insuranceExpiryDate", "fitnessExpiryDate", "permitExpiryDate", "pucExpiryDate"}

FIELD_MAP = {
    "vehicle_number": "vehicleNumber", "make": "make", "model": "model",
    "year_of_manufacture": "yearOfManufacture", "owner_name": "ownerName", "rc_number": "rcNumber",
    "rc_expiry_date": "rcExpiryDate", "insurance_number": "insuranceNumber",
    "insurance_expiry_date": "insuranceExpiryDate", "fitness_expiry_date": "fitnessExpiryDate",
    "permit_number": "permitNumber", "permit_type": "permitType", "permit_expiry_date": "permitExpiryDate",
    "puc_expiry_date": "pucExpiryDate", "vehicle_type": "vehicleType", "body_type": "bodyType",
    "capacity_tons": "capacityTons", "gps_provider": "gpsProvider", "gps_imei": "gpsImei",
}


async def assist(provider: AIProvider, body: VehicleAssistIn) -> VehicleAssistOut:
    today = body.today or date.today()
    images = decode_images(body.images)
    context = prompts.build_context(today.isoformat(), ENUMS["vehicleType"], ENUMS["bodyType"])
    result = await call_provider(
        provider, stage="transport_vehicle_assist", schema=VehicleExtraction, system=SYSTEM_GUARD,
        instruction=prompts.INSTRUCTION, context=context, text=body.text, prompt_version=prompts.PROMPT_VERSION,
        images=images)

    suggestions, skipped = evaluate(
        extraction_guesses(result.data, FIELD_MAP), lambda f, raw: _validate(f, raw, today),
        current_values=body.current_values, skip_filled=body.skip_filled, prefill=PREFILL, confirm=CONFIRM,
        force_confirm=ALWAYS_CONFIRM)

    warnings = [f"{f}: the document appears to be expired" for f in sorted(DATE_FIELDS) if f in suggestions
                and suggestions[f].reason.startswith("Expired")]

    # ownershipType is computed in code: only OWNED, only when the owner matches the company.
    owner = suggestions.get("ownerName")
    if body.company_name and owner and "ownershipType" not in body.current_values:
        if similar_names(str(owner.value), body.company_name):
            suggestions["ownershipType"] = FieldSuggestion(
                value="OWNED", confidence=0.7, routing="confirm",
                reason="Owner name on the document matches your company name")
    elif body.company_name is None:
        skipped.setdefault("ownershipType", "send company_name to get a suggestion")

    log_done("transport_vehicle_assist", result, len(suggestions))
    return VehicleAssistOut(suggestions=suggestions, skipped=skipped, warnings=warnings, usage=usage_out(result))


def _match(raw: str, options: list[str]) -> str | None:
    key = re.sub(r"[^a-z0-9]", "", raw.lower())
    return next((o for o in options if re.sub(r"[^a-z0-9]", "", o.lower()) == key), None)


def _validate(field: str, raw: str, today: date) -> tuple[str | int | float | None, str | None]:
    if field == "vehicleNumber":
        v = normalize_vehicle_number(raw)
        return (v, None) if v else (None, "not a valid Indian vehicle registration number")
    if field in ("make", "model"):
        v = clean_text(raw, 80 if field == "make" else 100)
        return (v, None) if v else (None, "empty")
    if field == "yearOfManufacture":
        if re.fullmatch(r"(19[89]\d|20\d{2})", raw.strip()) and int(raw) <= today.year + 1:
            return int(raw), None
        return None, "not a realistic year"
    if field == "ownerName":
        v = clean_text(raw, 100)
        return (v, None) if v and re.search(r"[A-Za-z]", v) else (None, "invalid name")
    if field in ("rcNumber", "insuranceNumber", "permitNumber"):
        v = clean_identifier(raw)
        return (v, None) if v else (None, "not a valid document number")
    if field in DATE_FIELDS:
        d, why = parse_document_date(raw, today)
        if not d:
            return None, why
        return d.isoformat(), ("Expired on this date: check the document" if d < today else None)
    if field == "permitType":
        v = _match(raw, ENUMS["permitType"])
        return (v, None) if v else (None, "permit type must be NATIONAL or STATE")
    if field == "vehicleType":
        v = _match(raw, ENUMS["vehicleType"])
        return (v, None) if v else (None, "vehicle type is not in the allowed list")
    if field == "bodyType":
        v = _match(raw, ENUMS["bodyType"])
        return (v, None) if v else (None, "body type is not in the allowed list")
    if field == "capacityTons":
        m = re.fullmatch(r"\s*(\d{1,3}(?:\.\d{1,2})?)\s*", raw)
        if m and 0.1 <= float(m.group(1)) <= 100:
            return float(m.group(1)), "Check capacity on the document: it is not the gross vehicle weight"
        return None, "capacity is not a realistic number of tons"
    if field == "gpsProvider":
        v = clean_text(raw, 60)
        return (v, None) if v else (None, "empty")
    if field == "gpsImei":
        v = valid_imei(raw)
        return (v, None) if v else (None, "not a valid 15-digit IMEI")
    return None, "unknown field"
