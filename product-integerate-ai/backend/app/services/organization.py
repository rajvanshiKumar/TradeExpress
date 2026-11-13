import re
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import set_tenant_context
from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.models import Organization, OrganizationMember, Role, SellerProfile, User
from app.schemas.org import MemberIn, OrgCreate, SellerIn
from app.services import audit

PRIVILEGED_ORG_TYPES = {"platform_owner", "internal_seller"}


def _slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "org"
    return f"{base[:60]}-{uuid.uuid4().hex[:6]}"


async def get_role(session: AsyncSession, name: str) -> Role:
    role = await session.scalar(select(Role).where(Role.name == name))
    if not role:
        raise NotFoundError(f"Unknown role {name}")
    return role


async def create_organization(
    session: AsyncSession, user: User, data: OrgCreate
) -> Organization:
    if data.org_type in PRIVILEGED_ORG_TYPES and not user.is_platform_admin:
        raise ForbiddenError("Only platform administrators can create this organization type")
    org_id = uuid.uuid4()
    # Server-verified tenant context so RLS lets us insert and read back the new org.
    await set_tenant_context(session, user_id=user.id, org_id=org_id)
    org = Organization(id=org_id, name=data.name, slug=_slugify(data.name),
                       org_type=data.org_type, created_by=user.id)
    session.add(org)
    await session.flush()
    owner = await get_role(session, "owner")
    session.add(OrganizationMember(organization_id=org_id, user_id=user.id, role_id=owner.id))
    await session.flush()
    await audit.record(session, action="organization.create", entity_type="organization",
                       entity_id=org_id, actor_user_id=user.id, organization_id=org_id,
                       data={"org_type": data.org_type})
    await session.refresh(org)
    return org


async def add_member(
    session: AsyncSession, org_id: uuid.UUID, actor: User, data: MemberIn, actor_role: str
) -> OrganizationMember:
    if data.role == "owner" and actor_role != "owner" and not actor.is_platform_admin:
        raise ForbiddenError("Only owners can grant the owner role")
    target = await session.scalar(select(User).where(User.email == data.email.lower()))
    if not target:
        raise NotFoundError("No registered user with that email")
    dup = await session.scalar(
        select(func.count()).select_from(OrganizationMember).where(
            OrganizationMember.organization_id == org_id, OrganizationMember.user_id == target.id)
    )
    if dup:
        raise ConflictError("User is already a member")
    role = await get_role(session, data.role)
    member = OrganizationMember(organization_id=org_id, user_id=target.id, role_id=role.id)
    session.add(member)
    await session.flush()
    await audit.record(session, action="organization.member_add", entity_type="organization",
                       entity_id=org_id, actor_user_id=actor.id, organization_id=org_id,
                       data={"user_id": str(target.id), "role": data.role})
    return member


async def register_seller(
    session: AsyncSession, org_id: uuid.UUID, actor: User, data: SellerIn
) -> SellerProfile:
    exists = await session.scalar(
        select(SellerProfile.id).where(SellerProfile.organization_id == org_id))
    if exists:
        raise ConflictError("Seller profile already exists for this organization")
    # organization_id always comes from the verified context, never from the request body.
    profile = SellerProfile(organization_id=org_id, display_name=data.display_name,
                            business_model=data.business_model, country=data.country)
    session.add(profile)
    await session.flush()
    await audit.record(session, action="seller.register", entity_type="seller_profile",
                       entity_id=profile.id, actor_user_id=actor.id, organization_id=org_id)
    return profile
