from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user, get_session, get_settings_dep
from app.core.config import Settings
from app.schemas.common import LoginIn, RefreshIn, RegisterIn, TokenOut, UserOut
from app.services import auth as svc

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_key(request: Request, extra: str = "") -> str:
    host = request.client.host if request.client else "unknown"
    return f"{host}:{extra}"


@router.post("/register", status_code=201, response_model=UserOut)
async def register(
    body: RegisterIn, request: Request, session: AsyncSession = Depends(get_session)
) -> UserOut:
    request.app.state.rate_limiter.check(_client_key(request, "register"), 20, 60)
    user = await svc.register(session, body.email, body.password, body.full_name)
    out = UserOut.model_validate(user)
    await session.commit()
    return out


@router.post("/login", response_model=TokenOut)
async def login(
    body: LoginIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings_dep),
) -> TokenOut:
    limiter = request.app.state.rate_limiter
    limiter.check(_client_key(request, body.email.lower()), 10, 60)
    tokens = await svc.login(session, body.email, body.password, settings,
                             request.headers.get("user-agent"))
    await session.commit()
    return tokens


@router.post("/refresh", response_model=TokenOut)
async def refresh(
    body: RefreshIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings_dep),
) -> TokenOut:
    request.app.state.rate_limiter.check(_client_key(request, "refresh"), 60, 60)
    tokens = await svc.refresh(session, body.refresh_token, settings)
    await session.commit()
    return tokens


@router.post("/logout", status_code=204)
async def logout(
    body: RefreshIn,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings_dep),
) -> Response:
    await svc.logout(session, body.refresh_token, settings)
    await session.commit()
    return Response(status_code=204)


@router.get("/me", response_model=UserOut)
async def me(current: CurrentUser = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current.user)
