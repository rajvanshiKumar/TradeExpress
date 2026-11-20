from typing import Any

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.commerce import ComplianceRule

DEFAULT_COMPLIANCE_RULES = [
    {
        "market_code": "EU",
        "category_slug": "electronics",
        "rule_name": "CE Marking & RoHS Directive (2011/65/EU)",
        "description": "Electronic products sold within the EU must carry CE marking and comply with maximum allowable concentrations of hazardous substances (lead, mercury, cadmium).",
        "is_hard_restriction": False,
        "required_attributes": ["voltage", "power"],
        "required_documents": ["EU Declaration of Conformity", "RoHS Test Report"],
        "restricted_keywords": ["unshielded high voltage", "lead-soldered"],
    },
    {
        "market_code": "US",
        "category_slug": "electronics",
        "rule_name": "FCC Part 15 Radio Frequency Equipment Authorization",
        "description": "Wireless or digital electronics emitting RF energy must be certified under FCC Part 15 and display an FCC ID.",
        "is_hard_restriction": False,
        "required_attributes": ["connectivity"],
        "required_documents": ["FCC ID Certificate", "Grantee Code Verification"],
        "restricted_keywords": ["jammer", "radar detector"],
    },
    {
        "market_code": "GCC",
        "category_slug": None,
        "rule_name": "GSO Technical Regulation on Packaging and Bilingual Labeling",
        "description": "Imported consumer goods into GCC countries (Saudi Arabia, UAE) must feature Arabic and English language instructions and country of origin.",
        "is_hard_restriction": False,
        "required_attributes": ["country_of_origin"],
        "required_documents": ["Certificate of Conformity (SASO / MoIAT)"],
        "restricted_keywords": [],
    },
    {
        "market_code": "IN",
        "category_slug": "electronics",
        "rule_name": "BIS Compulsory Registration Scheme (CRS)",
        "description": "IT and electronic items must be registered with the Bureau of Indian Standards and carry the standard BIS ISI mark.",
        "is_hard_restriction": False,
        "required_attributes": ["voltage"],
        "required_documents": ["BIS Registration Certificate"],
        "restricted_keywords": [],
    },
    {
        "market_code": "EU",
        "category_slug": "clothing",
        "rule_name": "EU Textile Regulation (1007/2011) & GPSR",
        "description": "Textile products sold in the EU must display fiber composition in the official language of the member state, care instructions, and manufacturer identification.",
        "is_hard_restriction": False,
        "required_attributes": ["fabric"],
        "required_documents": ["Fiber Composition Declaration", "REACH SVHC Test Report"],
        "restricted_keywords": ["azo dyes", "toxic finishes"],
    },
    {
        "market_code": "US",
        "category_slug": "clothing",
        "rule_name": "FTC Textile and Wool Acts (16 CFR Part 303)",
        "description": "Apparel sold in the US must carry permanent labels stating fiber content, country of origin, and care instructions (RN or company name).",
        "is_hard_restriction": False,
        "required_attributes": ["fabric", "country_of_origin"],
        "required_documents": ["Care Labeling Compliance Certificate"],
        "restricted_keywords": [],
    },
]


class ComplianceEvaluation(BaseModel):
    market_code: str
    is_compliant: bool
    advisories: list[dict[str, Any]]
    violations: list[dict[str, Any]]


def evaluate_product_compliance(
    market_code: str,
    category_slug: str | None,
    attributes: dict[str, Any],
    text_content: str,
    rules: list[dict[str, Any]],
) -> ComplianceEvaluation:
    advisories: list[dict[str, Any]] = []
    violations: list[dict[str, Any]] = []

    text_lower = text_content.lower()

    for rule in rules:
        # Check if rule applies to this market
        if rule["market_code"].upper() != market_code.upper():
            continue

        # Check if rule applies to this category (None means all categories)
        rule_cat = rule.get("category_slug")
        if rule_cat and category_slug and rule_cat not in category_slug:
            continue

        rule_name = rule["rule_name"]
        description = rule["description"]
        is_hard = rule.get("is_hard_restriction", False)

        # 1. Check restricted keywords
        for kw in rule.get("restricted_keywords", []):
            if kw.lower() in text_lower:
                issue = {
                    "rule": rule_name,
                    "reason": f"Restricted keyword '{kw}' detected in product information.",
                    "action_required": f"Remove or verify compliance regarding '{kw}'.",
                }
                if is_hard:
                    violations.append(issue)
                else:
                    advisories.append(issue)

        # 2. Check required attributes
        missing_attrs = [
            attr for attr in rule.get("required_attributes", [])
            if attr not in attributes or attributes[attr] is None
        ]
        if missing_attrs:
            advisories.append({
                "rule": rule_name,
                "reason": f"Destination market recommends providing: {', '.join(missing_attrs)}.",
                "action_required": "Provide recommended technical attributes for smooth customs clearance.",
            })

        # 3. Required documentation advisories
        docs = rule.get("required_documents", [])
        if docs:
            advisories.append({
                "rule": rule_name,
                "reason": f"Import compliance guideline: {description}",
                "action_required": f"Keep the following documentation available: {', '.join(docs)}.",
            })

    is_compliant = len(violations) == 0
    return ComplianceEvaluation(
        market_code=market_code,
        is_compliant=is_compliant,
        advisories=advisories,
        violations=violations,
    )

