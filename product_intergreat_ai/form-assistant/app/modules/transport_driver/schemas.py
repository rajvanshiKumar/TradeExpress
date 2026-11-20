from datetime import date
from typing import Any, Self

from pydantic import BaseModel, Field, model_validator

from app.core.schemas import AssistOut, Guess
from app.validators.images import ImageIn

DriverAssistOut = AssistOut


class DriverAssistIn(BaseModel):
    images: list[ImageIn] = Field(default_factory=list, max_length=2,
                                  description="Photo(s) of the driving licence (front/back), base64")
    text: str = Field(default="", max_length=3000, description="Optional pasted contact text")
    current_values: dict[str, Any] = Field(default_factory=dict)
    skip_filled: bool = True
    today: date | None = None

    @model_validator(mode="after")
    def _need_input(self) -> Self:
        if not self.images and len(self.text.strip()) < 3:
            raise ValueError("send at least one image or some text")
        return self


class DriverExtraction(BaseModel):
    name: Guess = Guess()
    licence_number: Guess = Guess()
    licence_type: Guess = Guess()
    licence_expiry_date: Guess = Guess()
    phone: Guess = Guess()
    alternate_phone: Guess = Guess()
    emergency_contact_name: Guess = Guess()
    emergency_contact_phone: Guess = Guess()
