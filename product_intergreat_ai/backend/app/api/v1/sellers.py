from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    CurrentUser,
    OrgContext,
    get_current_user,
    get_org_context,
    get_session,
    require_permission,
)
from app.core.errors import NotFoundError
from app.models import SellerProfile
from app.schemas.org import SellerIn, SellerOut, SellerUpdate
from app.services import organization as svc

router = APIRouter(prefix="/sellers", tags=["sellers"])


async def _profile(session: AsyncSession, ctx: OrgContext) -> SellerProfile:
    profile = await session.scalar(
        select(SellerProfile).where(SellerProfile.organization_id == ctx.org_id))
    if not profile:
        raise NotFoundError("Seller profile not found for this organization")
    return profile


@router.post("/register", status_code=201, response_model=SellerOut)
async def register_seller(
    body: SellerIn,
    current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("organization:manage")),
    session: AsyncSession = Depends(get_session),
) -> SellerOut:
    profile = await svc.register_seller(session, ctx.org_id, current.user, body)
    out = SellerOut.model_validate(profile)
    await session.commit()
    return out


@router.get("/profile", response_model=SellerOut)
async def get_profile(
    ctx: OrgContext = Depends(get_org_context), session: AsyncSession = Depends(get_session)
) -> SellerOut:
    return SellerOut.model_validate(await _profile(session, ctx))


@router.patch("/profile", response_model=SellerOut)
async def update_profile(
    body: SellerUpdate,
    ctx: OrgContext = Depends(require_permission("organization:manage")),
    session: AsyncSession = Depends(get_session),
) -> SellerOut:
    profile = await _profile(session, ctx)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(profile, field, value)
    await session.flush()
    await session.refresh(profile)
    out = SellerOut.model_validate(profile)
    await session.commit()
    return out


@router.get("/verification")
async def verification(
    ctx: OrgContext = Depends(get_org_context), session: AsyncSession = Depends(get_session)
) -> dict[str, str]:
    profile = await _profile(session, ctx)
    return {"verification_status": profile.verification_status}
