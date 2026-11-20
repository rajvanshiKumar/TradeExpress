from datetime import date
from typing import Any

from pydantic import BaseModel, Field

from app.core.schemas import AssistOut, FieldSuggestion, Guess, UsageOut  # noqa: F401  (re-exported)

FILLABLE_FIELDS = (
    "title", "specifications", "categorySlug", "quantity", "unit",
    "deliveryPincode", "destinationCountry", "requiredByDate",
)

RfqAssistOut = AssistOut


class CategoryOption(BaseModel):
    slug: str = Field(min_length=1, max_length=100)
    name: str = Field(default="", max_length=150)


class RfqAssistIn(BaseModel):
    text: str = Field(min_length=3, max_length=4000, description="Buyer's requirement in plain words")
    categories: list[CategoryOption] = Field(default_factory=list, max_length=500,
                                             description="Real category slugs of your marketplace")
    current_values: dict[str, Any] = Field(default_factory=dict,
                                           description="What the form already contains (keys = RFQ field names)")
    skip_filled: bool = Field(default=True, description="Do not suggest fields that already have a value")
    today: date | None = Field(default=None, description="Override 'today' (used to resolve relative dates)")


# --- what the AI provider returns (internal) -------------------------------------------------

class RfqExtraction(BaseModel):
    title: Guess = Guess()
    specifications: Guess = Guess()
    category_slug: Guess = Guess()
    quantity: Guess = Guess()
    unit: Guess = Guess()
    delivery_pincode: Guess = Guess()
    destination_country: Guess = Guess()
    required_by_date: Guess = Guess()
