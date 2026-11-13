from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORM, Slug

DataType = Literal[
    "string", "integer", "decimal", "boolean", "enum", "multi_select", "date", "measurement",
    "dimension", "weight", "currency", "url", "object", "array",
]


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: Slug
    parent_id: UUID | None = None
    name_i18n: dict[str, str] = {}


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    name_i18n: dict[str, str] | None = None
    is_active: bool | None = None


class CategoryOut(ORM):
    id: UUID
    parent_id: UUID | None
    slug: str
    name: str
    level: int
    path: str
    name_i18n: dict[str, Any]
    is_active: bool
    schema_version: int


class CategoryNode(BaseModel):
    id: UUID
    slug: str
    name: str
    level: int
    children: list["CategoryNode"] = []


class OptionIn(BaseModel):
    value: str = Field(min_length=1, max_length=200)
    label: str = Field(min_length=1, max_length=200)


class OptionOut(ORM):
    value: str
    label: str


class AttributeCreate(BaseModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]{0,79}$")
    label: str = Field(min_length=1, max_length=200)
    data_type: DataType
    required: bool = False
    unit: str | None = Field(default=None, max_length=20)
    validation_rules: dict[str, Any] = {}
    seller_editable: bool = True
    ai_extractable: bool = True
    ocr_extractable: bool = False
    confidence_threshold: Decimal = Field(default=Decimal("0.80"), ge=0, le=1)
    market_requirements: dict[str, Any] = {}
    sort_order: int = 0
    options: list[OptionIn] = []


class AttributeUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=200)
    required: bool | None = None
    unit: str | None = None
    validation_rules: dict[str, Any] | None = None
    seller_editable: bool | None = None
    ai_extractable: bool | None = None
    ocr_extractable: bool | None = None
    confidence_threshold: Decimal | None = Field(default=None, ge=0, le=1)
    market_requirements: dict[str, Any] | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class AttributeOut(ORM):
    id: UUID
    category_id: UUID
    key: str
    label: str
    data_type: str
    required: bool
    unit: str | None
    validation_rules: dict[str, Any]
    seller_editable: bool
    ai_extractable: bool
    ocr_extractable: bool
    confidence_threshold: Decimal
    market_requirements: dict[str, Any]
    sort_order: int
    is_active: bool
    options: list[OptionOut]


class VersionOut(ORM):
    version: int
    snapshot: list[dict[str, Any]]


class ValidateIn(BaseModel):
    values: dict[str, Any]


class ValidateOut(BaseModel):
    valid: bool
    errors: dict[str, list[str]]
