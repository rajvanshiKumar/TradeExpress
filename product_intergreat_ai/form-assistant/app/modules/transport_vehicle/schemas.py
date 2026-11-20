from datetime import date
from typing import Any, Self

from pydantic import BaseModel, Field, model_validator

from app.core.schemas import AssistOut, Guess
from app.validators.images import ImageIn

VehicleAssistOut = AssistOut


class VehicleAssistIn(BaseModel):
    images: list[ImageIn] = Field(default_factory=list, max_length=4,
                                  description="Photos of RC / insurance / fitness / permit / PUC (base64)")
    text: str = Field(default="", max_length=4000, description="Optional pasted text or notes")
    company_name: str | None = Field(default=None, max_length=200,
                                     description="Transport company name; only used in code to suggest ownershipType")
    current_values: dict[str, Any] = Field(default_factory=dict)
    skip_filled: bool = True
    today: date | None = None

    @model_validator(mode="after")
    def _need_input(self) -> Self:
        if not self.images and len(self.text.strip()) < 3:
            raise ValueError("send at least one image or some text")
        return self


class VehicleExtraction(BaseModel):
    vehicle_number: Guess = Guess()
    make: Guess = Guess()
    model: Guess = Guess()
    year_of_manufacture: Guess = Guess()
    owner_name: Guess = Guess()
    rc_number: Guess = Guess()
    rc_expiry_date: Guess = Guess()
    insurance_number: Guess = Guess()
    insurance_expiry_date: Guess = Guess()
    fitness_expiry_date: Guess = Guess()
    permit_number: Guess = Guess()
    permit_type: Guess = Guess()
    permit_expiry_date: Guess = Guess()
    puc_expiry_date: Guess = Guess()
    vehicle_type: Guess = Guess()
    body_type: Guess = Guess()
    capacity_tons: Guess = Guess()
    gps_provider: Guess = Guess()
    gps_imei: Guess = Guess()
