import time
from collections import defaultdict, deque

from app.core.errors import AppError


class RateLimitError(AppError):
    status_code = 429
    code = "rate_limited"


class RateLimiter:
    """In-process sliding window. Single-instance only; swap for a Redis-backed limiter when
    running several API replicas (see docs/DEPLOYMENT.md)."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, limit: int, window_seconds: int) -> None:
        now = time.monotonic()
        q = self._hits[key]
        while q and now - q[0] > window_seconds:
            q.popleft()
        if len(q) >= limit:
            raise RateLimitError("Too many requests, slow down")
        q.append(now)

    def reset(self) -> None:
        self._hits.clear()
