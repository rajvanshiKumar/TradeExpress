"""Versioned prompts. Bump PROMPT_VERSION on any wording change."""
PROMPT_VERSION = "rfq-2026-11-13.1"

INSTRUCTION = (
    "A buyer wrote a short requirement for a Request For Quotation (RFQ). Extract values for the "
    "RFQ form fields from the user text. The text may be English, Hindi or Hinglish.\n"
    "- title: a clear RFQ title, max 150 chars, e.g. '500 pcs Steel Hex Bolts M12'.\n"
    "- specifications: the buyer's requirement rewritten as clean, structured plain text "
    "(material, size, grade, packaging, delivery notes) using ONLY facts from the text. "
    "Do not add specs, standards or certifications that are not written.\n"
    "- category_slug: choose exactly one slug from the allowed categories, or null if none fits.\n"
    "- quantity: integer only (digits), no unit.\n"
    "- unit: one of the allowed units, or null.\n"
    "- delivery_pincode: 6-digit Indian PIN only if it is written in the text, else null.\n"
    "- destination_country: only if stated or clearly implied by an Indian PIN code (then 'India').\n"
    "- required_by_date: YYYY-MM-DD. Resolve relative phrases ('in 2 weeks', '15 din mein') from "
    "today's date. Null if no timing is given.\n"
    "Never output a price or budget. For every field give confidence 0-1."
)


def build_context(today: str, categories: list[tuple[str, str]], units: list[str]) -> str:
    cats = "\n".join(f"- {slug}: {name}" for slug, name in categories) or "(none provided)"
    return (
        f"Today's date: {today}\n"
        f"Allowed units: {', '.join(units)}\n"
        f"Allowed categories (use the slug exactly):\n{cats}"
    )
