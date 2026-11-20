# TradeExpress E-Commerce AI Chatbot

A self-contained, modular AI Chatbot engine designed for e-commerce marketplaces.
Powered by **Google Gemini 2.5 Flash Lite** with real-time tool calling (function calling).

---

## 🌟 Key Capabilities

1. **Natural Language Product Search**:
   - Buyers can search items using natural language (e.g. *"Show black shirts under ₹1000"*).
   - Returns interactive, clickable **Product Cards** with photo, title, price (₹ INR), stock status, and a "View" button.
2. **Live Order Tracking (Exact TradeExpress Order Schema)**:
   - Queries orders using `orderNumber` (e.g. `ORD-2026-9021`).
   - Returns visual **Order Tracking Cards** with live delivery progress bar (`Placed -> Packed -> Shipped -> Delivered`), carrier name (`Delhivery`), tracking number, ETA, and line items.
3. **Store Policies & FAQs**:
   - Answers return & exchange windows (7-day hassle-free policy), delivery charges, payment options (UPI, Razorpay, COD), and B2B wholesale pricing.
4. **Currency & Strict Guardrails**:
   - Strictly quotes in **Indian Rupees (₹)**.
   - Zero-hallucination policy: never fabricates prices, stock numbers, or unauthorized discount codes.
5. **Plug-and-Play Frontend Widget**:
   - Floating chat bubble at the bottom-right of the screen (`fixed bottom-6 right-6 z-50`).
   - Quick action chips (*"Track ORD-2026-9021"*, *"Black Shirts under ₹1000"*, *"Return Policy"*).

---

## 📁 Directory Structure

```text
chatbot/
├── backend/
│   ├── config.py         # Store policies, return window, shipping rules, support contacts
│   ├── models.py         # Pydantic models matching TradeExpress Prisma Order & Product schemas
│   ├── prompts.py        # System prompt, guardrails, e-commerce persona
│   ├── tools.py          # Function declarations: search_products, get_order_status, get_store_policy
│   ├── agent.py          # Gemini 2.5 Flash Lite orchestrator with tool execution
│   ├── routes.py         # FastAPI endpoints (/api/v1/chat/message, /api/v1/chat/stream, /api/v1/chat/order/{id})
│   └── test_chat.py      # Automated test suite (all 4 tests pass)
│
└── widget/
    ├── types.ts          # TypeScript interfaces for Product, Order, and Chat messages
    ├── ProductCard.tsx   # Mini e-commerce product card with photo, price & view link
    ├── OrderTracker.tsx  # Interactive order status tracker with progress bar & item breakdown
    ├── ChatWindow.tsx    # Header, message scroll area, quick suggestions, and input bar
    ├── ChatWidget.tsx    # Floating action button with online status badge & toggle animation
    └── index.ts          # Barrel export
```

---

## 🔌 How to Integrate into Any Next.js Website

In your Next.js `app/layout.tsx`:

```tsx
import { ChatWidget } from "@/components/ChatWidget";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Floating AI Chatbot on every page */}
        <ChatWidget />
      </body>
    </html>
  );
}
```

---

## 🧪 Testing

Run the automated backend test suite:

```powershell
.\backend\.venv\Scripts\python.exe -u chatbot/backend/test_chat.py
```
