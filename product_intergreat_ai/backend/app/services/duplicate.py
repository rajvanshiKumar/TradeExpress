import io
import re
import uuid
from typing import Any

from PIL import Image
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai import ProductImage
from app.models.commerce import Product, ProductImageMapping


class DuplicateMatch(BaseModel):
    product_id: uuid.UUID | None = None
    title: str
    match_type: str  # "exact_image", "perceptual_image", "brand_model", "text_similarity"
    confidence: float
    reason: str


def compute_dhash(image_bytes: bytes, hash_size: int = 8) -> str:
    """Compute difference hash (dHash) of an image using Pillow.
    Produces a 64-bit perceptual hash as a 16-character hex string.
    """
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            # Resize to (width + 1, height) so adjacent column differences can be compared
            img = img.convert("L").resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)
            pixels = list(img.getdata())
            diff = []
            for row in range(hash_size):
                row_start = row * (hash_size + 1)
                for col in range(hash_size):
                    pixel_left = pixels[row_start + col]
                    pixel_right = pixels[row_start + col + 1]
                    diff.append(pixel_left > pixel_right)

            # Convert 64 boolean bits to hex
            decimal_value = 0
            for index, value in enumerate(diff):
                if value:
                    decimal_value += 1 << index
            return f"{decimal_value:016x}"
    except Exception:
        return ""


def hamming_distance(hash1: str, hash2: str) -> int:
    """Calculates bit differences between two 16-hex perceptual hashes."""
    if not hash1 or not hash2 or len(hash1) != len(hash2):
        return 64
    try:
        val1 = int(hash1, 16)
        val2 = int(hash2, 16)
        return bin(val1 ^ val2).count("1")
    except ValueError:
        return 64


def _tokenize(text: str) -> set[str]:
    words = re.findall(r"\w+", text.lower())
    return {w for w in words if len(w) > 2}


def text_jaccard_similarity(text1: str, text2: str) -> float:
    t1 = _tokenize(text1)
    t2 = _tokenize(text2)
    if not t1 or not t2:
        return 0.0
    intersection = len(t1 & t2)
    union = len(t1 | t2)
    return intersection / union if union > 0 else 0.0


async def check_duplicates(
    s: AsyncSession,
    org_id: uuid.UUID,
    title: str,
    brand: str | None = None,
    model: str | None = None,
    image_ids: list[uuid.UUID] | None = None,
) -> list[DuplicateMatch]:
    matches: list[DuplicateMatch] = []
    seen_prod_ids: set[uuid.UUID] = set()

    # 1. Check exact image SHA-256 matches across existing products
    if image_ids:
        # Get sha256 of uploaded images
        cur_images = (
            await s.scalars(select(ProductImage).where(ProductImage.id.in_(image_ids)))
        ).all()
        sha_list = [img.sha256 for img in cur_images]

        if sha_list:
            # Query existing product mappings that use the exact same image
            dup_mappings = (
                await s.execute(
                    select(Product, ProductImage)
                    .join(ProductImageMapping, ProductImageMapping.product_id == Product.id)
                    .join(ProductImage, ProductImage.id == ProductImageMapping.image_id)
                    .where(
                        Product.organization_id == org_id,
                        ProductImage.sha256.in_(sha_list),
                        ProductImage.id.notin_(image_ids),
                    )
                )
            ).all()

            for prod, img in dup_mappings:
                if prod.id not in seen_prod_ids:
                    seen_prod_ids.add(prod.id)
                    matches.append(
                        DuplicateMatch(
                            product_id=prod.id,
                            title=prod.title,
                            match_type="exact_image",
                            confidence=0.99,
                            reason=f"Exact image match detected (SHA-256: {img.sha256[:8]}...)",
                        )
                    )

    # 2. Check brand and model match
    if brand and model and len(brand.strip()) > 1 and len(model.strip()) > 1:
        bm_products = (
            await s.scalars(
                select(Product).where(
                    Product.organization_id == org_id,
                    Product.brand.ilike(brand.strip()),
                    Product.model.ilike(model.strip()),
                )
            )
        ).all()

        for prod in bm_products:
            if prod.id not in seen_prod_ids:
                seen_prod_ids.add(prod.id)
                matches.append(
                    DuplicateMatch(
                        product_id=prod.id,
                        title=prod.title,
                        match_type="brand_model",
                        confidence=0.92,
                        reason=f"Existing product found with identical brand '{prod.brand}' and model '{prod.model}'",
                    )
                )

    # 3. Text similarity on recent active products in same org
    recent_prods = (
        await s.scalars(
            select(Product).where(Product.organization_id == org_id).limit(100)
        )
    ).all()

    for prod in recent_prods:
        if prod.id not in seen_prod_ids:
            sim = text_jaccard_similarity(title, prod.title)
            if sim >= 0.75:
                seen_prod_ids.add(prod.id)
                matches.append(
                    DuplicateMatch(
                        product_id=prod.id,
                        title=prod.title,
                        match_type="text_similarity",
                        confidence=round(sim, 2),
                        reason=f"High title text similarity ({int(sim * 100)}% token overlap)",
                    )
                )

    return matches

