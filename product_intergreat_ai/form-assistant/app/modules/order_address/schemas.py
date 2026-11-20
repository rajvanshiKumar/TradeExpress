from typing import Any

from pydantic import BaseModel, Field

from app.core.schemas import AssistOut, Guess

AddressAssistOut = AssistOut


class AddressAssistIn(BaseModel):
    text: str = Field(min_length=3, max_length=3000, description="Pasted address / contact text")
    current_values: dict[str, Any] = Field(default_factory=dict,
                                           description="Existing form values (keys = field names, e.g. 'buyerName')")
    skip_filled: bool = True


class AddressExtraction(BaseModel):
    line1: Guess = Guess()
    line2: Guess = Guess()
    landmark: Guess = Guess()
    city: Guess = Guess()
    state: Guess = Guess()
    pincode: Guess = Guess()
    country: Guess = Guess()
    buyer_name: Guess = Guess()
    buyer_phone: Guess = Guess()
    buyer_email: Guess = Guess()
    buyer_company: Guess = Guess()
    buyer_gstin: Guess = Guess()
