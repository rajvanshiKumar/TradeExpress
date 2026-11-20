"""Chatbot configuration: store policies, AI settings, and persona defaults."""
import os
from pathlib import Path
from pydantic import BaseModel
import dotenv

# Load .env from backend or root directory
root_dir = Path(__file__).resolve().parent.parent.parent
dotenv.load_dotenv(root_dir / "backend" / ".env")
dotenv.load_dotenv(root_dir / ".env")
dotenv.load_dotenv()


class StorePolicies(BaseModel):
    store_name: str = "TradeExpress"
    currency: str = "INR"
    currency_symbol: str = "₹"
    return_window_days: int = 7
    return_policy: str = (
        "We offer a 7-day hassle-free replacement or return policy for damaged, defective, "
        "or incorrectly received items. Products must be in original condition with tags and packaging intact."
    )
    shipping_timeline: str = (
        "Standard delivery takes 3 to 7 business days across India. Express shipping (1-3 days) is "
        "available for select metro pin codes."
    )
    shipping_fee_rule: str = "Free shipping on orders above ₹999. For orders below ₹999, a flat shipping fee of ₹49 applies."
    payment_methods: str = "We accept UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, NetBanking via Razorpay, and Cash on Delivery (COD)."
    b2b_wholesale: str = (
        "For bulk orders (11+ units), automated tiered wholesale discounts (10% to 20% off) apply. "
        "Sample orders are available for verification before large commitments."
    )
    support_email: str = "support@tradeexpress.in"
    support_phone: str = "+91 98765 43210 (Mon-Sat, 9 AM - 7 PM)"


class ChatbotSettings(BaseModel):
    api_key: str = os.getenv("TX_GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY", "")
    model: str = os.getenv("TX_GEMINI_MODEL") or os.getenv("CHATBOT_GEMINI_MODEL") or "gemini-3.5-flash-lite"
    fallback_model: str = "gpt-4o-mini"
    max_history_turns: int = 10
    temperature: float = 0.3
    policies: StorePolicies = StorePolicies()


chatbot_settings = ChatbotSettings()
