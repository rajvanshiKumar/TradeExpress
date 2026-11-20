"""Versioned prompts. Bump PROMPT_VERSION on any wording change."""
PROMPT_VERSION = "transport-driver-2026-11-13.1"

INSTRUCTION = (
    "Read the attached Indian driving licence photo(s) and any pasted contact text. Extract ONLY:\n"
    "- name: the licence holder's name as printed.\n"
    "- licence_number: the DL number exactly as printed.\n"
    "- licence_type: one of LMV, COMMERCIAL_HEAVY, HAZARDOUS, ODC. Map the printed class: "
    "LMV / MCWG / LMV-NT -> LMV; HMV / HGMV / HPMV / HTV / TRANS / MGV / LMV-TR -> COMMERCIAL_HEAVY; "
    "a hazardous-goods endorsement -> HAZARDOUS; an over-dimensional-cargo endorsement -> ODC. "
    "If unclear return null.\n"
    "- licence_expiry_date: the validity end date as YYYY-MM-DD. Indian licences print dates "
    "day-first (DD-MM-YYYY). If both NT and TR validity exist, use the TR (transport) date for "
    "commercial classes, else the NT date.\n"
    "- phone, alternate_phone, emergency_contact_name, emergency_contact_phone: ONLY from the "
    "pasted text, copied exactly; a licence photo never contains them. Otherwise null.\n"
    "Ignore and never output: Aadhaar number, PAN, date of birth, blood group, address, father's "
    "name, photo. If a value is not printed or not readable, return null with confidence 0; never "
    "guess digits."
)

CONTEXT = "Allowed licence types: LMV, COMMERCIAL_HEAVY, HAZARDOUS, ODC"
