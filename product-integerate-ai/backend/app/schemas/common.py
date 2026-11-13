import re
from typing import Annotated, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

from app.core.security import validate_password_strength

T = TypeVar("T")
Slug = Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=160)]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


class UserOut(ORM):
    id: UUID
    email: str
    full_name: str
    is_platform_admin: bool


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    full_name: str = Field(min_length=1, max_length=200)

    @field_validator("password")
    @classmethod
    def _strong(cls, v: str) -> str:
        validate_password_strength(v)
        return v

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.lower()


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=256)


class RefreshIn(BaseModel):
    refresh_token: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


ORG_TYPE_PATTERN = re.compile(
    r"^(platform_owner|internal_seller|external_seller|b2b_supplier|b2c_seller)$"
)
