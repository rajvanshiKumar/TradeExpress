from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.translation import LANGUAGES

router = APIRouter(tags=["international"])

INITIAL_MARKETS = [
    {"code": "US", "name": "United States", "default_currency": "USD", "languages": ["en"], "is_active": True},
    {"code": "EU", "name": "European Union", "default_currency": "EUR", "languages": ["en", "fr", "de", "es", "it"], "is_active": True},
    {"code": "GCC", "name": "Gulf Cooperation Council", "default_currency": "AED", "languages": ["ar", "en"], "is_active": True},
    {"code": "IN", "name": "India", "default_currency": "INR", "languages": ["en", "hi"], "is_active": True},
    {"code": "UK", "name": "United Kingdom", "default_currency": "GBP", "languages": ["en"], "is_active": True},
    {"code": "JP", "name": "Japan", "default_currency": "JPY", "languages": ["ja"], "is_active": True},
]

INITIAL_CURRENCIES = [
    {"code": "USD", "name": "US Dollar", "symbol": "$", "exchange_rate_to_usd": 1.0},
    {"code": "EUR", "name": "Euro", "symbol": "€", "exchange_rate_to_usd": 1.08},
    {"code": "GBP", "name": "British Pound", "symbol": "£", "exchange_rate_to_usd": 1.29},
    {"code": "AED", "name": "UAE Dirham", "symbol": "AED", "exchange_rate_to_usd": 0.272},
    {"code": "INR", "name": "Indian Rupee", "symbol": "₹", "exchange_rate_to_usd": 0.0118},
    {"code": "JPY", "name": "Japanese Yen", "symbol": "¥", "exchange_rate_to_usd": 0.0066},
]


class MarketOut(BaseModel):
    code: str
    name: str
    default_currency: str
    languages: list[str]
    is_active: bool


class CurrencyOut(BaseModel):
    code: str
    name: str
    symbol: str
    exchange_rate_to_usd: float


@router.get("/markets", response_model=list[MarketOut])
async def get_markets() -> list[dict[str, Any]]:
    return INITIAL_MARKETS


@router.get("/currencies", response_model=list[CurrencyOut])
async def get_currencies() -> list[dict[str, Any]]:
    return INITIAL_CURRENCIES


@router.get("/languages")
async def get_languages() -> dict[str, dict[str, Any]]:
    return LANGUAGES

