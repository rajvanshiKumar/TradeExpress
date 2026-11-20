import uuid
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import OrgContext, get_session, require_permission
from app.services.compliance import (
    DEFAULT_COMPLIANCE_RULES,
    ComplianceEvaluation,
    evaluate_product_compliance,
)
from app.services.duplicate import DuplicateMatch, check_duplicates

router = APIRouter(tags=["compliance_and_duplicates"])


class ComplianceCheckIn(BaseModel):
    market_code: str = Field(min_length=2, max_length=10)
    category_slug: str | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)
    text_content: str = ""


class DuplicateCheckIn(BaseModel):
    title: str = Field(min_length=2)
    brand: str | None = None
    model: str | None = None
    image_ids: list[uuid.UUID] = Field(default_factory=list)


@router.post("/compliance/check", response_model=ComplianceEvaluation)
async def check_compliance(
    body: ComplianceCheckIn,
    ctx: OrgContext = Depends(require_permission("product:read")),
) -> ComplianceEvaluation:
    return evaluate_product_compliance(
        market_code=body.market_code,
        category_slug=body.category_slug,
        attributes=body.attributes,
        text_content=body.text_content,
        rules=DEFAULT_COMPLIANCE_RULES,
    )


@router.get("/compliance/rules")
async def list_compliance_rules(
    market: str | None = None,
    ctx: OrgContext = Depends(require_permission("product:read")),
) -> list[dict[str, Any]]:
    if market:
        return [r for r in DEFAULT_COMPLIANCE_RULES if r["market_code"].upper() == market.upper()]
    return DEFAULT_COMPLIANCE_RULES


@router.post("/ai/duplicates/check", response_model=list[DuplicateMatch])
async def duplicate_check(
    body: DuplicateCheckIn,
    ctx: OrgContext = Depends(require_permission("product:read")),
    session: AsyncSession = Depends(get_session),
) -> list[DuplicateMatch]:
    return await check_duplicates(
        session,
        ctx.org_id,
        title=body.title,
        brand=body.brand,
        model=body.model,
        image_ids=body.image_ids,
    )

