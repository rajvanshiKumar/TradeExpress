import logging
import sys
from pathlib import Path

# Ensure project root is in sys.path for standalone modules like chatbot
_root_dir = Path(__file__).resolve().parent.parent.parent
if str(_root_dir) not in sys.path:
    sys.path.insert(0, str(_root_dir))

try:
    from chatbot.backend.routes import router as chat_router
except Exception as _chat_err:
    logging.getLogger("app").warning(f"Chatbot router not loaded: {_chat_err}")
    chat_router = None

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.ai.factory import build_provider
from app.api.v1 import (
    admin as admin_api,
    ai as ai_api,
    ai_extra,
    auth,
    categories,
    compliance,
    developer,
    images,
    international,
    offers,
    organizations,
    products,
    sellers,
)
from app.core.config import Settings, get_settings
from app.core.db import create_engine, create_sessionmaker
from app.core.errors import AppError
from app.core.ratelimit import RateLimiter
from app.services.images import LocalImageStore
from app.services.jobs import JobRunner

log = logging.getLogger("app")


def _envelope(status: int, code: str, message: str, details: object = None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "details": details}},
    )


class BodySizeLimit:
    """Rejects oversized bodies by Content-Length and while streaming."""

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        declared = dict(scope["headers"]).get(b"content-length")
        if declared and int(declared) > self.max_bytes:
            await _envelope(413, "payload_too_large", "Request body too large")(
                scope, receive, send)
            return
        seen = 0

        async def limited() -> Message:
            nonlocal seen
            msg = await receive()
            if msg["type"] == "http.request":
                seen += len(msg.get("body", b""))
                if seen > self.max_bytes:
                    raise AppError("Request body too large")
            return msg

        await self.app(scope, limited, send)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(
        title="TradeExpress Product Listing AI",
        version="0.1.0",
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url=None,
    )
    engine = create_engine(settings)
    app.state.settings = settings
    app.state.engine = engine
    app.state.sessionmaker = create_sessionmaker(engine)
    app.state.rate_limiter = RateLimiter()
    app.state.image_store = LocalImageStore(settings.storage_dir)
    app.state.job_runner = JobRunner(settings.job_concurrency)
    app.state.ai_provider = build_provider(settings)

    app.add_middleware(BodySizeLimit, max_bytes=settings.max_request_bytes)
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Organization-Id", "Idempotency-Key", "X-API-Key"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        if not request.url.path.startswith("/docs"):
            response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        if settings.environment in ("staging", "production"):
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response

    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError) -> JSONResponse:
        return _envelope(exc.status_code, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {"loc": list(e["loc"]), "msg": str(e["msg"]), "type": e["type"]} for e in exc.errors()
        ]
        return _envelope(422, "validation_error", "Request validation failed", details)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _envelope(exc.status_code, "http_error", str(exc.detail))

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error", exc_info=exc)
        return _envelope(500, "internal_error", "Internal server error")

    @app.get("/health", tags=["health"])
    @app.get("/health/live", tags=["health"])
    async def live() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready", tags=["health"])
    async def ready() -> JSONResponse:
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        except Exception:
            return JSONResponse(status_code=503, content={"status": "unavailable", "database": "down"})
        return JSONResponse(content={"status": "ok", "database": "ok"})

    routers = [
        auth.router, organizations.router, sellers.router, categories.router,
        categories.admin, admin_api.router, images.router, ai_api.router, ai_extra.router,
        products.router, offers.router, international.router, compliance.router, developer.router,
    ]
    if chat_router:
        routers.append(chat_router)

    for r in routers:
        app.include_router(r, prefix="/api/v1")
    return app


try:
    app = create_app()
except Exception:
    app = None
