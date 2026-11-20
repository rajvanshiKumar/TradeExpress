import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.ai.factory import build_provider
from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.ratelimit import RateLimiter
from app.modules.order_address.router import router as order_address_router
from app.modules.rfq.router import router as rfq_router
from app.modules.transport_driver.router import router as transport_driver_router
from app.modules.transport_vehicle.router import router as transport_vehicle_router

# Add new form modules: import the router above and add one include_router line below.

log = logging.getLogger("app")


def _envelope(status: int, code: str, message: str, details: object = None) -> JSONResponse:
    return JSONResponse(status_code=status,
                        content={"error": {"code": code, "message": message, "details": details}})


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="TradeExpress Form Assistant", version="0.1.0",
                  docs_url="/docs" if settings.environment != "production" else None, redoc_url=None)
    app.state.settings = settings
    app.state.ai_provider = build_provider(settings)
    app.state.rate_limiter = RateLimiter()

    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["GET", "POST"],
                       allow_headers=["Content-Type", "X-API-Key"])

    @app.middleware("http")
    async def limit_body(request: Request, call_next):  # type: ignore[no-untyped-def]
        declared = request.headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > settings.max_request_bytes:
            return _envelope(413, "payload_too_large", "Request body too large")
        return await call_next(request)

    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError) -> JSONResponse:
        return _envelope(exc.status_code, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()]
        return _envelope(422, "validation_error", "Request validation failed", details)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _envelope(exc.status_code, "http_error", str(exc.detail))

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error")
        return _envelope(500, "internal_error", "Internal server error")

    @app.get("/health")
    async def health() -> dict[str, object]:
        return {"status": "ok", "provider": getattr(app.state.ai_provider, "name", None),
                "provider_ready": app.state.ai_provider is not None}

    for router in (rfq_router, order_address_router, transport_vehicle_router, transport_driver_router):
        app.include_router(router)
    return app


def app_factory() -> FastAPI:
    return create_app()
