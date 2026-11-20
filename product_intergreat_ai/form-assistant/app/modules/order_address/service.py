"""Order address assist: split pasted text into delivery-address parts and buyer contact fields,
then verify every value in code (formats, GSTIN checksum, evidence in the text)."""
import json
import re
from pathlib import Path

from app.ai.base import AIProvider
from app.ai.safety import SYSTEM_GUARD
from app.core.assist import call_provider, evaluate, extraction_guesses, log_done, usage_out
from app.modules.order_address import prompts
from app.modules.order_address.schemas import AddressAssistIn, AddressAssistOut, AddressExtraction
from app.validators.common import clean_text, normalize_country, valid_pincode
from app.validators.india import (
    GST_STATES,
    normalize_phone,
    normalize_state,
    redact_government_ids,
    valid_email,
    valid_gstin,
)

CONFIG = json.loads((Path(__file__).parent / "config.json").read_text(encoding="utf-8"))
PREFILL = float(CONFIG["thresholds"]["prefill"])
CONFIRM = float(CONFIG["thresholds"]["confirm"])

FIELD_MAP = {
    "line1": "deliveryAddress.line1", "line2": "deliveryAddress.line2",
    "landmark": "deliveryAddress.landmark", "city": "deliveryAddress.city",
    "state": "deliveryAddress.state", "pincode": "deliveryAddress.pincode",
    "country": "deliveryAddress.country", "buyer_name": "buyerName", "buyer_phone": "buyerPhone",
    "buyer_email": "buyerEmail", "buyer_company": "buyerCompany", "buyer_gstin": "buyerGstin",
}


def _digits(s: str) -> str:
    return re.sub(r"\D", "", s)


async def assist(provider: AIProvider, body: AddressAssistIn) -> AddressAssistOut:
    text = redact_government_ids(body.text)
    warnings: list[str] = []
    if text != body.text:
        warnings.append("An Aadhaar-like number in your text was removed and not sent to the AI.")
    result = await call_provider(
        provider, stage="order_address_assist", schema=AddressExtraction, system=SYSTEM_GUARD,
        instruction=prompts.INSTRUCTION, context="", text=text, prompt_version=prompts.PROMPT_VERSION)

    suggestions, skipped = evaluate(
        extraction_guesses(result.data, FIELD_MAP), lambda f, raw: _validate(f, raw, text),
        current_values=body.current_values, skip_filled=body.skip_filled, prefill=PREFILL, confirm=CONFIRM)

    gstin, state = suggestions.get("buyerGstin"), suggestions.get("deliveryAddress.state")
    if gstin and state:
        gst_state = GST_STATES.get(str(gstin.value)[:2])
        if gst_state and gst_state != state.value:
            warnings.append(f"GSTIN belongs to {gst_state} but the delivery state is {state.value}. "
                            "This is normal if billing and shipping states differ; please check.")

    log_done("order_address_assist", result, len(suggestions))
    return AddressAssistOut(suggestions=suggestions, skipped=skipped, warnings=warnings, usage=usage_out(result))


def _validate(field: str, raw: str, text: str) -> tuple[str | None, str | None]:
    if field == "deliveryAddress.line1":
        v = clean_text(raw, 200)
        return (v, None) if v and len(v) >= 3 else (None, "address line is too short")
    if field in ("deliveryAddress.line2", "deliveryAddress.landmark"):
        v = clean_text(raw, 200 if field.endswith("line2") else 100)
        return (v, None) if v else (None, "empty")
    if field == "deliveryAddress.city":
        v = clean_text(raw, 80)
        return (v, None) if v and re.search(r"[A-Za-z]", v) else (None, "invalid city")
    if field == "deliveryAddress.state":
        v = normalize_state(raw)
        return (v, None) if v else (None, "not a recognised Indian state or union territory")
    if field == "deliveryAddress.pincode":
        p = valid_pincode(raw)
        if not p:
            return None, "not a valid 6-digit Indian pincode"
        if not re.search(rf"(?<!\d){p}(?!\d)", re.sub(r"(?<=\d) (?=\d)", "", text)):
            return None, "pincode is not written in your text"
        return p, None
    if field == "deliveryAddress.country":
        c = normalize_country(raw)
        return (c, None) if c else (None, "invalid country")
    if field in ("buyerName", "buyerCompany"):
        v = clean_text(raw, 100 if field == "buyerName" else 150)
        return (v, None) if v and re.search(r"[A-Za-z]", v) else (None, "invalid text")
    if field == "buyerPhone":
        p = normalize_phone(raw)
        if not p:
            return None, "not a valid 10-digit Indian mobile number"
        return (p, None) if p in _digits(text) else (None, "phone number is not written in your text")
    if field == "buyerEmail":
        e = valid_email(raw)
        if not e:
            return None, "not a valid email address"
        return (e, None) if e in text.lower() else (None, "email is not written in your text")
    if field == "buyerGstin":
        g = valid_gstin(raw)
        if not g:
            return None, "not a valid GSTIN (format or checksum)"
        return (g, None) if g in re.sub(r"\s", "", text).upper() else (None, "GSTIN is not written in your text")
    return None, "unknown field"
