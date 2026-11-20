"""FastAPI APIRouter for E-Commerce Chatbot."""
import asyncio
import json
import uuid
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from chatbot.backend.agent import ChatbotAgent
from chatbot.backend.config import chatbot_settings
from chatbot.backend.models import ChatRequest, ChatResponse, OrderTrackingResult
from chatbot.backend.tools import execute_get_order_status, execute_get_store_policy

router = APIRouter(prefix="/chat", tags=["Chatbot"])
agent = ChatbotAgent()


@router.post("/message", response_model=ChatResponse)
async def send_chat_message(req: ChatRequest) -> ChatResponse:
    """Send a chat message and receive AI response with structured cards (products, order tracking)."""
    session_id = req.session_id or f"sess_{uuid.uuid4().hex[:12]}"
    res = await agent.chat(
        user_message=req.message,
        session_id=session_id
    )
    return res


@router.post("/stream")
async def stream_chat_message(req: ChatRequest) -> StreamingResponse:
    """Server-Sent Events (SSE) streaming endpoint for live typewriter chat experience."""
    session_id = req.session_id or f"sess_{uuid.uuid4().hex[:12]}"
    
    async def event_generator() -> AsyncGenerator[str, None]:
        res = await agent.chat(user_message=req.message, session_id=session_id)
        
        # Send initial metadata (matched products, order cards, quick chips)
        meta_payload = {
            "type": "metadata",
            "session_id": session_id,
            "products": [p.model_dump() for p in res.products],
            "order_status": res.order_status.model_dump() if res.order_status else None,
            "quick_suggestions": res.quick_suggestions
        }
        yield f"data: {json.dumps(meta_payload)}\n\n"
        
        # Stream text words in chunks for typewriter animation
        words = res.reply.split(" ")
        for i in range(0, len(words), 3):
            chunk = " ".join(words[i:i+3]) + " "
            yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"
            await asyncio.sleep(0.04)

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/order/{order_number}", response_model=OrderTrackingResult)
async def track_order(order_number: str) -> OrderTrackingResult:
    """Direct live order status lookup matching TradeExpress Order schema."""
    return await execute_get_order_status(order_number)


@router.get("/policies")
async def get_policies() -> dict:
    """Returns store policies for FAQs and quick reference."""
    return chatbot_settings.policies.model_dump()
