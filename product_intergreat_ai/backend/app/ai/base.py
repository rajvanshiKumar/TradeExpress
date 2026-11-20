from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, Field


class ProviderError(Exception):
    def __init__(self, message: str, retryable: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable


@dataclass
class ImageInput:
    data: bytes
    mime_type: str
    image_id: str


@dataclass
class Usage:
    provider: str
    model: str
    prompt_version: str
    input_tokens: int
    output_tokens: int
    cost_usd: float | None
    latency_ms: int
    stage: str = ""


T = TypeVar("T", bound=BaseModel)


@dataclass
class ProviderResult(Generic[T]):
    data: T
    usage: Usage


class ImageAnalysis(BaseModel):
    product_type: str
    visible_colors: list[str] = []
    brand: str | None = None
    model: str | None = None
    pattern: str | None = None
    shape: str | None = None
    texture: str | None = None
    visible_materials: list[str] = []
    packaging: str | None = None
    logos: list[str] = []
    accessories: list[str] = []
    item_count: int | None = None
    notes: str = ""
    uncertain: list[str] = Field(default=[], description="Inferences not directly visible")


class OCRItem(BaseModel):
    text: str
    kind: Literal["brand", "model", "specification", "barcode", "qr", "size", "ingredient",
                  "serial", "label", "other"]
    confidence: float
    image_index: int = 0


class OCRResult(BaseModel):
    items: list[OCRItem] = []
    full_text: str = ""


class CategoryCandidate(BaseModel):
    slug: str
    confidence: float
    reason: str = ""


class Classification(BaseModel):
    candidates: list[CategoryCandidate]


class AttributeItem(BaseModel):
    key: str
    value_json: str | None = Field(description="JSON-encoded value, or null when not evidenced")
    confidence: float
    source: Literal["image", "ocr"]
    evidence: str = ""
    image_index: int | None = None


class Extraction(BaseModel):
    attributes: list[AttributeItem]


class TitleResult(BaseModel):
    title: str
    short_title: str


class DescriptionResult(BaseModel):
    short_description: str
    long_description: str
    highlights: list[str]
    key_features: list[str]
    specifications_summary: str
    benefits: list[str]


class SeoResult(BaseModel):
    seo_title: str
    meta_description: str
    keywords: list[str]
    tags: list[str]
    search_terms: list[str]


class FullContentResult(BaseModel):
    title: str
    short_title: str
    short_description: str
    long_description: str
    highlights: list[str]
    key_features: list[str]
    specifications_summary: str
    benefits: list[str]
    seo_title: str
    meta_description: str
    keywords: list[str]
    tags: list[str]
    search_terms: list[str]
    # TradeExpress Main Marketplace Prisma Schema Fields
    sku: str = Field(default="", description="Generated SKU code, e.g. EKD-NB-BLU-001")
    slug: str = Field(default="", description="URL slug, e.g. ekd-blue-wireless-neckband-earphones")
    subcategory: str = Field(default="", description="Product subcategory, e.g. Neckband Earphones")
    hsn_code: str = Field(default="8518", description="Harmonized System of Nomenclature code for India GST")
    gst_rate: float = Field(default=18.00, description="Indian GST rate percentage, e.g. 18.00, 12.00, 5.00")
    weight_kg: float = Field(default=0.25, description="Estimated product weight in kilograms")
    unit: str = Field(default="piece", description="Unit of measurement: piece, pair, set, etc.")
    suggested_price_inr: float = Field(default=899.00, description="Suggested retail price in INR")
    packaging_summary: str = Field(default="", description="Box contents and packaging info")


class TranslatedField(BaseModel):
    field: str
    value: str


class Translation(BaseModel):
    fields: list[TranslatedField]


@dataclass
class CategoryChoice:
    slug: str
    path_label: str


class AIProvider(ABC):
    name: str

    @abstractmethod
    async def analyze_images(
        self, images: list[ImageInput], untrusted_hints: str
    ) -> ProviderResult[ImageAnalysis]: ...

    @abstractmethod
    async def ocr_images(self, images: list[ImageInput]) -> ProviderResult[OCRResult]: ...

    @abstractmethod
    async def classify_product(
        self, analysis: ImageAnalysis, ocr_text: str, choices: list[CategoryChoice],
        untrusted_hints: str,
    ) -> ProviderResult[Classification]: ...

    @abstractmethod
    async def extract_attributes(
        self, images: list[ImageInput], specs: list[dict[str, Any]], analysis: ImageAnalysis,
        ocr_text: str,
    ) -> ProviderResult[Extraction]: ...

    @abstractmethod
    async def generate_title(self, facts: dict[str, Any]) -> ProviderResult[TitleResult]: ...

    @abstractmethod
    async def generate_description(
        self, facts: dict[str, Any]
    ) -> ProviderResult[DescriptionResult]: ...

    @abstractmethod
    async def generate_seo(self, facts: dict[str, Any]) -> ProviderResult[SeoResult]: ...

    async def generate_all_content(
        self, facts: dict[str, Any]
    ) -> ProviderResult[FullContentResult]:
        """Default fallback: gathers title, description, and SEO concurrently."""
        import asyncio
        t_res, d_res, s_res = await asyncio.gather(
            self.generate_title(facts),
            self.generate_description(facts),
            self.generate_seo(facts),
        )
        data = FullContentResult(
            title=t_res.data.title,
            short_title=t_res.data.short_title,
            short_description=d_res.data.short_description,
            long_description=d_res.data.long_description,
            highlights=d_res.data.highlights,
            key_features=d_res.data.key_features,
            specifications_summary=d_res.data.specifications_summary,
            benefits=d_res.data.benefits,
            seo_title=s_res.data.seo_title,
            meta_description=s_res.data.meta_description,
            keywords=s_res.data.keywords,
            tags=s_res.data.tags,
            search_terms=s_res.data.search_terms,
        )
        total_in = t_res.usage.input_tokens + d_res.usage.input_tokens + s_res.usage.input_tokens
        total_out = t_res.usage.output_tokens + d_res.usage.output_tokens + s_res.usage.output_tokens
        cost = ((t_res.usage.cost_usd or 0) + (d_res.usage.cost_usd or 0) + (s_res.usage.cost_usd or 0)) or None
        usage = Usage(
            provider=t_res.usage.provider,
            model=t_res.usage.model,
            prompt_version=t_res.usage.prompt_version,
            input_tokens=total_in,
            output_tokens=total_out,
            cost_usd=cost,
            latency_ms=max(t_res.usage.latency_ms, d_res.usage.latency_ms, s_res.usage.latency_ms),
            stage="content",
        )
        return ProviderResult(data, usage)

    @abstractmethod
    async def translate_content(
        self, fields: dict[str, str], target_language: str
    ) -> ProviderResult[Translation]: ...
