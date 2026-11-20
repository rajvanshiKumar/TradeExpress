"""Chatbot AI agent with Gemini 2.5 Flash Lite function calling and fallback engine."""
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx
from chatbot.backend.config import chatbot_settings
from chatbot.backend.models import (
    ChatResponse,
    OrderTrackingResult,
    ProductCardItem,
)
from chatbot.backend.prompts import CHATBOT_SYSTEM_PROMPT
from chatbot.backend.tools import (
    GEMINI_CHAT_TOOLS,
    execute_get_order_status,
    execute_get_store_policy,
    execute_search_products,
)

log = logging.getLogger("chatbot")


class ChatbotAgent:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key if api_key is not None else chatbot_settings.api_key
        self.model = chatbot_settings.model
        # Ultra-low latency HTTP client with Keep-Alive connection pooling
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(4.5, connect=1.5, read=4.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=40, keepalive_expiry=60.0),
            http2=False
        )

    async def chat(
        self,
        user_message: str,
        session_id: str,
        history: Optional[List[Dict[str, str]]] = None,
        db_session: Any = None
    ) -> ChatResponse:
        """Process incoming user message through Gemini tool-calling or rule-based intelligent fallback."""
        msg_lower = user_message.lower().strip()
        matched_products: List[ProductCardItem] = []
        matched_order: Optional[OrderTrackingResult] = None
        quick_suggestions: List[str] = []
        offline_mode = os.getenv("TX_OFFLINE", "0") == "1"

        # Language Detection: English vs Hindi/Hinglish
        hindi_markers = [
            "kya", "hai", "hain", "kahan", "kaise", "dikhao", "batao", "chahiye", "kitne",
            "andar", "tak", "rupaye", "mera", "meri", "mere", "aayega", "milega", "hoga",
            "nahi", "kuch", "badhiya", "namaste", "pranam", "shukriya", "bhai", "yaar",
            "wala", "wali", "wale", "bhejo", "paas", "dost", "dikhaye", "sasta", "mehenga"
        ]
        is_hindi = any(re.search(rf"\b{re.escape(w)}\b", msg_lower) for w in hindi_markers)
        is_english = not is_hindi

        # 1. Order tracking detection (exact ID like ORD-10294 or numeric 5-12 digits)
        order_match = re.search(r"\b(ORD[-_][A-Za-z0-9-_]+|\b\d{5,12}\b)\b", user_message, re.IGNORECASE)
        is_order_tracking_query = bool(
            order_match or any(k in msg_lower for k in [
                "track my order", "track order", "track an order", "kahan pahuncha", 
                "order status", "mera order", "status of my order", "tracking status"
            ])
        )

        # 2. Specific Quick Chip queries: Delivery Timelines, Size Guide, Colors
        is_delivery_time_query = any(k in msg_lower for k in [
            "check delivery time", "delivery time", "shipping time", "kab tak aayega", 
            "kab tak deliver", "kitne din me aayega", "delivery kitne din", "shipping speed"
        ])

        is_size_query = any(k in msg_lower for k in [
            "view size guide", "size guide", "size chart", "sizing", "measurement", "fitting", "which size"
        ])

        is_color_query = any(k in msg_lower for k in [
            "available colors", "color options", "aur color", "different colors", "shades", "colours"
        ])

        # 3. Policy detection (e.g. 'return', 'refund', 'policy', 'payment', 'cod', 'shipping', 'exchange', 'fit')
        is_policy_query = not is_delivery_time_query and any(k in msg_lower for k in [
            "return", "refund", "replace", "exchange", "charge", "payment", "cod", "upi", "policy",
            "fit na ho", "fitting na", "size change", "badal", "size exchange"
        ])

        # 4. Product search detection (MUST NOT conflict with policy/delivery/size/color)
        is_product_query = not is_policy_query and not is_delivery_time_query and not is_size_query and not is_color_query and any(k in msg_lower for k in [
            "shirt", "tshirt", "t-shirt", "cotton", "black", "blue", "navy", "white",
            "price", "dikhao", "buy", "product", "dress", "kurta", "jeans", "formal", "casual",
            "sasta", "mehenga", "collection", "catalog", "under", "party", "wear", "festive", "outfit", "kapde"
        ])

        # 5. Out of scope / domain deflection (e.g. coding, recipe, movies, general trivia)
        is_out_of_scope = any(k in msg_lower for k in [
            "python", "code", "coding", "maggie", "maggi", "recipe", "cook", "kaise banate", 
            "weather", "kaise bna skta hu", "movie", "song", "gk", "capital of", "who is", 
            "formula", "algebra", "politics", "cricket", "match score", "batao na yaar"
        ])

        is_greeting = msg_lower in [
            "hi", "hii", "hello", "hey", "namaste", "pranam", "good morning", "good evening", "sup", "yo"
        ] or (len(msg_lower.split()) <= 2 and any(msg_lower.startswith(w) for w in ["hi ", "hello ", "hey ", "namaste "]))

        # Execute appropriate tools based on intent
        if order_match:
            order_num = order_match.group(0).upper().strip().lstrip("#")
            matched_order = await execute_get_order_status(order_num, db_session)
            if matched_order:
                quick_suggestions = ["View Invoice", "Delivery Address", "Need Help with Order"]
            else:
                quick_suggestions = ["📦 Track Demo Order", "👕 Black Shirts under ₹1000", "💬 Customer Support", "🔄 7-Day Return Policy"]
        elif is_order_tracking_query and not order_match:
            quick_suggestions = ["How do I find Order ID?", "Need Help with Order", "7-Day Return Policy"]

        if is_delivery_time_query:
            quick_suggestions = ["👕 Black Shirts under ₹1000", "📦 Track an Order", "💳 Payment Modes"]

        if is_size_query:
            quick_suggestions = ["👕 Black Shirts under ₹1000", "🚚 Check Delivery Time", "🔄 7-Day Return Policy"]

        if is_color_query:
            quick_suggestions = ["Solid Black Shirt", "Navy Blue Shirt", "Classic White Shirt"]

        if is_product_query:
            # Extract price/budget filter supporting English & Hinglish (e.g. 'under 1000', '500 ke andar', '1500 tak')
            price_match = re.search(
                r"(?:under|below|less than|max|budget)\s*(?:rs\.?|inr|₹)?\s*(\d{2,6})|\b(\d{2,6})\s*(?:ke\s*an[a-z]+r|tak|k\s*andar|rupaye|\/-)",
                msg_lower
            )
            max_price = float(price_match.group(1) or price_match.group(2)) if price_match else None
            matched_products = await execute_search_products(
                query=user_message,
                max_price=max_price,
                db_session=db_session
            )
            quick_suggestions = ["View Size Guide", "Check Delivery Time", "Available Colors"]

        if is_policy_query and not quick_suggestions:
            if any(k in msg_lower for k in ["fit", "fitting", "exchange", "size"]):
                quick_suggestions = ["📏 View Size Guide", "👕 Black Shirts under ₹1000", "🚚 Check Delivery Time"]
            else:
                quick_suggestions = ["7-Day Return Policy", "Free Shipping Info", "Payment Modes"]

        # Fast Path: Deterministic store policies, delivery timelines, size guides, and order tracking
        # These are fixed facts that return in < 5ms without waiting for an external LLM network roundtrip
        is_fast_path = (
            is_delivery_time_query or 
            is_size_query or 
            is_color_query or 
            is_policy_query or 
            bool(order_match) or 
            (is_order_tracking_query and not order_match)
        )

        # Call real Gemini API for open-ended product queries and general conversation
        if not is_fast_path and not offline_mode and self.api_key and len(self.api_key) > 10:
            try:
                gemini_reply = await self._call_gemini(user_message, matched_products, matched_order)
                if gemini_reply and len(gemini_reply.strip()) > 5:
                    default_chips = (
                        ["Explore Casual Shirts", "Track Order", "Return Policy"] if is_english
                        else ["👕 Black Shirts under ₹1000", "📦 Track an Order", "🔄 7-Day Return Policy"]
                    )
                    return ChatResponse(
                        session_id=session_id,
                        reply=gemini_reply.strip(),
                        products=matched_products,
                        order_status=matched_order,
                        quick_suggestions=quick_suggestions or default_chips
                    )
            except Exception as exc:
                log.warning(f"Gemini call fallback: {exc}")

        # Intelligent Fallback Response Formulation (Offline / Fast) - Bilingual Support
        reply_parts = []
        if matched_order:
            reply_parts.append(
                f"📦 **Order Status for #{matched_order.order_number}:**\n"
                f"Your order is currently **{matched_order.order_status.replace('_', ' ').title()}** with **{matched_order.carrier_name}**.\n"
                f"• **Tracking Number:** `{matched_order.tracking_number}`\n"
                f"• **Estimated Delivery:** {matched_order.shipping_eta}\n"
                f"• **Total Amount:** ₹{matched_order.total:.2f} ({matched_order.payment_status})"
            )
        elif order_match and not matched_order:
            order_id_clean = order_match.group(0).upper().strip().lstrip("#")
            if is_english:
                reply_parts.append(
                    f"❌ **Order #{order_id_clean} Not Found**\n\n"
                    f"We could not find any active order matching this ID in our system. This usually happens if:\n"
                    f"1. **No order has been placed yet** under this number.\n"
                    f"2. There is a small typo in the Order ID.\n\n"
                    f"💡 *Tip: If you'd like to test live order tracking, try demo order **`ORD-2026-9021`** or **`ORD-2026-1002`**.*"
                )
            else:
                reply_parts.append(
                    f"❌ **Order #{order_id_clean} Ka Record Nahi Mila**\n\n"
                    f"Hamare system me is Order ID se koi active order registered nahi mila. Yeh do reasons se ho sakta hai:\n"
                    f"1. **Abhi tak is ID se koi order place nahi hua hai.**\n"
                    f"2. Order ID enter karne me koi typo ya galat number enter ho gaya hai.\n\n"
                    f"💡 *Agar aap tracking feature test karna chahte hain, toh demo order **`ORD-2026-9021`** ya **`ORD-2026-1002`** enter karke live status dekh sakte hain!*"
                )
        elif is_order_tracking_query and not order_match:
            if is_english:
                reply_parts.append(
                    "To track your order, please share your **Order Number** (e.g. `ORD-12345`) here. "
                    "I will check live carrier tracking and estimated delivery right away!"
                )
                quick_suggestions = ["How do I find Order ID?", "Need Help with Order", "7-Day Return Policy"]
            else:
                reply_parts.append(
                    "Aapka order track karne ke liye please apna **Order Number** (jaise `ORD-12345`) yahan share karein. "
                    "Main turant live carrier tracking aur delivery ETA check karke bata dunga!"
                )
                quick_suggestions = ["How do I find Order ID?", "Need Help with Order", "7-Day Return Policy"]
        elif is_delivery_time_query:
            if is_english:
                reply_parts.append(
                    "🚚 **TradeExpress Delivery Timelines:**\n\n"
                    "• **Standard Delivery:** Delivered across India within **3 to 7 business days**.\n"
                    "• **Express Delivery:** Delivered to metro cities (Delhi NCR, Mumbai, Bengaluru, etc.) within **1 to 3 business days**.\n"
                    "• **Shipping Charges:** **Free Delivery** on orders above ₹999! (A flat ₹49 fee applies for orders below ₹999)."
                )
                quick_suggestions = ["👕 Black Shirts under ₹1000", "📦 Track an Order", "💳 Payment Modes"]
            else:
                reply_parts.append(
                    "🚚 **TradeExpress Delivery Timelines:**\n\n"
                    "• **Standard Delivery:** Pure India me **3 se 7 business days** me delivery hoti hai.\n"
                    "• **Express Delivery:** Metro cities (Delhi NCR, Mumbai, Bengaluru, Hyderabad, etc.) me **1 se 3 business days** me deliver ho jata hai.\n"
                    "• **Shipping Charges:** ₹999 ya usse jyada ke orders par **Free Delivery** hai! (₹999 se kam par flat ₹49 fee)."
                )
                quick_suggestions = ["👕 Black Shirts under ₹1000", "📦 Track an Order", "💳 Payment Modes"]
        elif is_size_query:
            if is_english:
                reply_parts.append(
                    "👕 **TradeExpress Apparel Size Guide (Men's Regular Fit):**\n\n"
                    "• **S (Small):** Chest 38 inches | Length 28 inches\n"
                    "• **M (Medium):** Chest 40 inches | Length 29 inches\n"
                    "• **L (Large):** Chest 42 inches | Length 30 inches\n"
                    "• **XL (Extra Large):** Chest 44 inches | Length 31 inches\n"
                    "• **XXL:** Chest 46 inches | Length 31.5 inches\n\n"
                    "💡 *Tip: Our cotton and oxford shirts fit true to size. For a relaxed fit, we recommend selecting one size up.*"
                )
                quick_suggestions = ["👕 Black Shirts under ₹1000", "🚚 Check Delivery Time", "🔄 7-Day Return Policy"]
            else:
                reply_parts.append(
                    "👕 **TradeExpress Apparel Size Guide (Men's Regular Fit):**\n\n"
                    "• **S (Small):** Chest 38 inches | Length 28 inches\n"
                    "• **M (Medium):** Chest 40 inches | Length 29 inches\n"
                    "• **L (Large):** Chest 42 inches | Length 30 inches\n"
                    "• **XL (Extra Large):** Chest 44 inches | Length 31 inches\n"
                    "• **XXL:** Chest 46 inches | Length 31.5 inches\n\n"
                    "💡 *Tip: Hamare cotton aur oxford casual shirts true to size aate hain. Relaxed fitting ke liye aap ek size bada prefer kar sakte hain.*"
                )
                quick_suggestions = ["👕 Black Shirts under ₹1000", "🚚 Check Delivery Time", "🔄 7-Day Return Policy"]
        elif is_color_query:
            if is_english:
                reply_parts.append(
                    "🎨 **Available Color Options:**\n\n"
                    "Our shirt catalog features the following popular colors:\n"
                    "• **Solid Black** (Black Cotton Blend Regular Fit) — ₹899\n"
                    "• **Navy Blue** (100% Combed Cotton Casual) — ₹999\n"
                    "• **Classic White** (Premium Oxford Formal) — ₹1,199\n"
                    "• **Bio-Washed Black** (Everyday Slim Fit) — ₹449\n\n"
                    "You can search by specific color (e.g. *'Show Navy Blue shirts'* or *'White shirt under 1200'*)!"
                )
                quick_suggestions = ["Solid Black Shirt", "Navy Blue Shirt", "Classic White Shirt"]
            else:
                reply_parts.append(
                    "🎨 **Available Color Options:**\n\n"
                    "Hamare catalog me shirts in popular colors me available hain:\n"
                    "• **Solid Black** (Black Cotton Blend Regular Fit) — ₹899\n"
                    "• **Navy Blue** (100% Combed Cotton Casual) — ₹999\n"
                    "• **Classic White** (Premium Oxford Formal) — ₹1,199\n"
                    "• **Bio-Washed Black** (Everyday Slim Fit) — ₹449\n\n"
                    "Aap kisi bhi color ka naam likh kar search kar sakte hain (e.g. *'Show Navy Blue shirts'* ya *'White shirt under 1200'*)!"
                )
                quick_suggestions = ["Solid Black Shirt", "Navy Blue Shirt", "Classic White Shirt"]
        elif is_out_of_scope:
            if is_english:
                reply_parts.append(
                    "I apologize! 🙏 I am the **TradeExpress Shopping & Order Assistant**.\n\n"
                    "I can only help with questions regarding our store's **products, live pricing, order tracking, delivery timelines, and return policies**. I cannot assist with coding, recipes, or general knowledge.\n\n"
                    "Would you like to search for a product or track an order on TradeExpress?"
                )
                quick_suggestions = ["👕 Black Shirts under ₹1000", "📦 Track an Order", "🔄 7-Day Return Policy", "🚚 Check Delivery Time"]
            else:
                reply_parts.append(
                    "Maaf kijiye! 🙏 Main **TradeExpress Shopping & Order Assistant** hoon.\n\n"
                    "Main sirf hamare store ke **products, live pricing, order tracking, shipping aur return policies** se jude sawaalon me madad kar sakta hoon. Main general knowledge, coding ya cooking/recipes me assist nahi kar sakta.\n\n"
                    "Kya aapko TradeExpress par koi product search karna hai ya apna order track karna hai?"
                )
                quick_suggestions = ["👕 Black Shirts under ₹1000", "📦 Track an Order", "🔄 7-Day Return Policy", "🚚 Check Delivery Time"]
        elif is_greeting:
            if is_english:
                reply_parts.append(
                    "Welcome to **TradeExpress** ✨\n\n"
                    "Your personal shopping assistant for product discovery, live order tracking, and store queries. How may I assist you today?"
                )
                quick_suggestions = ["📦 Track an Order", "👕 Black Shirts under ₹1000", "🔄 7-Day Return Policy", "💼 Wholesale Bulk Rates"]
            else:
                reply_parts.append(
                    "Namaste! 🙏 Welcome to **TradeExpress**.\n\n"
                    "Main aapka personal shopping assistant hoon. Main products dhundhne, live order track karne, aur return/shipping policies batane me help kar sakta hoon. Aaj main aapki kya madad kar sakta hoon?"
                )
                quick_suggestions = ["📦 Track an Order", "👕 Black Shirts under ₹1000", "🔄 7-Day Return Policy", "💼 Wholesale Bulk Rates"]
        elif matched_products:
            matched_budget = [p for p in matched_products if max_price and p.price <= max_price]
            if is_english:
                if max_price and matched_budget:
                    reply_parts.append(
                        f"We found great options within your budget of **₹{int(max_price)}**! "
                        f"Check out the photos, real prices (₹), and available sizes in the cards below:"
                    )
                elif max_price and not matched_budget:
                    min_avail = min(p.price for p in matched_products)
                    reply_parts.append(
                        f"We couldn't find an exact match under ₹{int(max_price)}, but our best value quality option "
                        f"starts at **₹{int(min_avail)}**. Here are our top recommendations:"
                    )
                else:
                    reply_parts.append(
                        "Based on your preferences, here are our top recommendations! You can review images, "
                        "real prices (₹), and sizes in the cards below:"
                    )
            else:
                if max_price and matched_budget:
                    reply_parts.append(
                        f"Aapke **₹{int(max_price)}** budget ke andar humne best options dhundh liye hain! "
                        f"Niche diye gaye cards me aap photos, real price (₹), aur available sizes check kar sakte hain:"
                    )
                elif max_price and not matched_budget:
                    min_avail = min(p.price for p in matched_products)
                    reply_parts.append(
                        f"Filhaal ₹{int(max_price)} ke andar direct match nahi mila, lekin sabse affordable best quality option "
                        f"**₹{int(min_avail)}** se available hai. Niche aap closest recommendations dekh sakte hain:"
                    )
                else:
                    reply_parts.append(
                        "Aapki pasand ke hisaab se humne top recommendations dhundhi hain! Niche diye gaye cards me aap photos, "
                        "real price (₹), aur available sizes check kar sakte hain:"
                    )
        elif is_policy_query:
            policy_text = execute_get_store_policy(msg_lower)
            if is_english:
                reply_parts.append(
                    f"ℹ️ **TradeExpress Policy:**\n{policy_text}\n\nPlease let me know if you need more details!"
                )
            else:
                reply_parts.append(
                    f"ℹ️ **TradeExpress Policy:**\n{policy_text}\n\nAgar aapko iske alawa koi specific help chahiye toh batayein!"
                )
        else:
            if is_english:
                reply_parts.append(
                    f"Hello! I am the **TradeExpress AI Assistant**. I can help you with shopping, order tracking, "
                    f"and product discovery.\n\nYou can ask about any product, price budget, or your Order ID!"
                )
                quick_suggestions = ["📦 Track an Order", "👕 Black Shirts under ₹1000", "🔄 7-Day Return Policy", "💼 Wholesale Bulk Rates"]
            else:
                reply_parts.append(
                    f"Namaste! Main **TradeExpress AI Assistant** hoon. Main aapki shopping, order tracking, "
                    f"aur product search me help kar sakta hoon.\n\nAap mujhse kisi bhi product ka naam, budget, "
                    f"ya apna Order ID pooch sakte hain!"
                )
                quick_suggestions = ["📦 Track an Order", "👕 Black Shirts under ₹1000", "🔄 7-Day Return Policy", "💼 Wholesale Bulk Rates"]

        return ChatResponse(
            session_id=session_id,
            reply="\n\n".join(reply_parts),
            products=matched_products,
            order_status=matched_order,
            quick_suggestions=quick_suggestions
        )

    async def _call_gemini(
        self,
        prompt: str,
        products: List[ProductCardItem],
        order: Optional[OrderTrackingResult]
    ) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        context_data = ""
        if products:
            context_data += "\nAvailable catalog matches for query:\n" + "\n".join(
                f"- {p.name} (SKU: {p.sku}, Price: ₹{p.price}, Stock: {p.stock})" for p in products
            )
        if order:
            context_data += (
                f"\nLive order details:\n- Order #{order.order_number}: Status {order.order_status}, "
                f"Carrier: {order.carrier_name}, ETA: {order.shipping_eta}, Total: ₹{order.total}"
            )

        body = {
            "systemInstruction": {"parts": [{"text": CHATBOT_SYSTEM_PROMPT + context_data}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 250}
        }
        res = await self.client.post(url, json=body, headers={"x-goog-api-key": self.api_key})
        if res.status_code == 200:
            data = res.json()
            candidates = data.get("candidates", [])
            if candidates:
                return "".join(p.get("text", "") for p in candidates[0].get("content", {}).get("parts", []))
        return ""
