import time
from collections import defaultdict, deque

from app.core.errors import RateLimitError


class RateLimiter:
    """In-process sliding window (single instance). Use a Redis-backed limiter if you run
    several replicas."""

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
