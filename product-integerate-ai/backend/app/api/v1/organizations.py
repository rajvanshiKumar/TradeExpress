import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user, get_session, membership_for
from app.core.db import set_tenant_context
from app.core.errors import ForbiddenError, NotFoundError
from app.models import Organization
from app.schemas.common import Page
from app.schemas.org import MemberIn, MemberOut, OrgCreate, OrgOut, OrgUpdate
from app.services import audit
from app.services import organization as svc

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.post("", status_code=201, response_model=OrgOut)
async def create_org(
    body: OrgCreate,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> OrgOut:
    org = await svc.create_organization(session, current.user, body)
    out = OrgOut.model_validate(org)
    await session.commit()
    return out


@router.get("", response_model=Page[OrgOut])
async def list_orgs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Page[OrgOut]:
    # RLS limits rows to organizations the user belongs to (all of them for platform admins).
    total = await session.scalar(select(func.count()).select_from(Organization)) or 0
    rows = (await session.scalars(
        select(Organization).order_by(Organization.created_at.desc()).limit(limit).offset(offset)
    )).all()
    return Page(items=[OrgOut.model_validate(r) for r in rows], total=total, limit=limit,
                offset=offset)


async def _visible_org(session: AsyncSession, org_id: uuid.UUID) -> Organization:
    org = await session.get(Organization, org_id)
    if not org:  # not found OR not visible under RLS: indistinguishable on purpose
        raise NotFoundError("Organization not found")
    return org


@router.get("/{org_id}", response_model=OrgOut)
async def get_org(
    org_id: uuid.UUID,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> OrgOut:
    return OrgOut.model_validate(await _visible_org(session, org_id))


@router.patch("/{org_id}", response_model=OrgOut)
async def update_org(
    org_id: uuid.UUID,
    body: OrgUpdate,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> OrgOut:
    org = await _visible_org(session, org_id)
    ctx = await membership_for(session, current, org_id)
    if ctx is None and current.is_admin:
        await set_tenant_context(session, org_id=org_id)
    elif ctx is None or "organization:manage" not in ctx.permissions:
        raise ForbiddenError("Missing permission: organization:manage")
    if body.name:
        org.name = body.name
    await session.flush()
    await audit.record(session, action="organization.update", entity_type="organization",
                       entity_id=org_id, actor_user_id=current.id, organization_id=org_id)
    await session.refresh(org)
    out = OrgOut.model_validate(org)
    await session.commit()
    return out


@router.post("/{org_id}/members", status_code=201, response_model=MemberOut)
async def add_member(
    org_id: uuid.UUID,
    body: MemberIn,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MemberOut:
    await _visible_org(session, org_id)
    ctx = await membership_for(session, current, org_id)
    if ctx is None or "member:manage" not in ctx.permissions:
        raise ForbiddenError("Missing permission: member:manage")
    member = await svc.add_member(session, org_id, current.user, body, ctx.role)
    out = MemberOut(user_id=member.user_id, organization_id=org_id, role=body.role)
    await session.commit()
    return out
