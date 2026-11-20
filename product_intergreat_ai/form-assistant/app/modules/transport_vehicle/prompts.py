"""Versioned prompts. Bump PROMPT_VERSION on any wording change."""
PROMPT_VERSION = "transport-vehicle-2026-11-13.1"

INSTRUCTION = (
    "Read the attached vehicle document photos (Indian Registration Certificate, insurance policy, "
    "fitness certificate, permit, PUC certificate) and any pasted text. Extract ONLY what is printed:\n"
    "- vehicle_number: registration number exactly as printed (e.g. MH12AB1234).\n"
    "- make, model: manufacturer and model as printed. year_of_manufacture: 4-digit year.\n"
    "- owner_name: registered owner as printed.\n"
    "- rc_number: the RC / registration certificate number as printed. rc_expiry_date: the RC "
    "'valid upto' date.\n"
    "- insurance_number: policy number. insurance_expiry_date: policy end date.\n"
    "- fitness_expiry_date, puc_expiry_date, permit_expiry_date: the 'valid upto' dates.\n"
    "- permit_number and permit_type (NATIONAL or STATE, only if printed).\n"
    "- vehicle_type: one of the allowed vehicle types, only if the document or text states the "
    "vehicle class/body clearly; else null. body_type: one of the allowed body types, same rule.\n"
    "- capacity_tons: only if a payload / carrying capacity is printed, as a number of tons. Do NOT "
    "convert gross vehicle weight or unladen weight into capacity.\n"
    "- gps_provider and gps_imei: only if printed on a GPS device label or in the text.\n"
    "IMPORTANT: Indian documents write dates day-first (DD/MM/YYYY). Output every date as "
    "YYYY-MM-DD. If a value is not printed or not readable, return null with confidence 0; never "
    "guess digits. Never output Aadhaar, PAN, phone numbers, addresses or any other personal id."
)


def build_context(today: str, vehicle_types: list[str], body_types: list[str]) -> str:
    return (
        f"Today's date: {today}\n"
        f"Allowed vehicle types: {', '.join(vehicle_types)}\n"
        f"Allowed body types: {', '.join(body_types)}"
    )
