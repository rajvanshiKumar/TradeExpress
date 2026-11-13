from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORM

OrgType = Literal["platform_owner", "internal_seller", "external_seller", "b2b_supplier", "b2c_seller"]
RoleName = Literal["owner", "admin", "editor", "viewer"]


class OrgCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    org_type: OrgType = "external_seller"


class OrgUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)


class OrgOut(ORM):
    id: UUID
    name: str
    slug: str
    org_type: str
    status: str


class MemberIn(BaseModel):
    email: EmailStr
    role: RoleName


class MemberOut(BaseModel):
    user_id: UUID
    organization_id: UUID
    role: str


class SellerIn(BaseModel):
    display_name: str = Field(min_length=1, max_length=200)
    business_model: Literal["b2b", "b2c", "both"] = "both"
    country: str | None = Field(default=None, pattern=r"^[A-Z]{2}$")


class SellerUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    business_model: Literal["b2b", "b2c", "both"] | None = None
    country: str | None = Field(default=None, pattern=r"^[A-Z]{2}$")


class SellerOut(ORM):
    id: UUID
    organization_id: UUID
    display_name: str
    business_model: str
    country: str | None
    verification_status: str
