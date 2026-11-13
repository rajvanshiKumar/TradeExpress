import asyncio
from collections.abc import Coroutine
from typing import Any


class JobRunner:
    """In-process background executor for AI jobs.

    Intermediate results are committed per stage, so a crash loses at most the running stage.
    This is the seam where a Celery/Redis queue plugs in for multi-worker deployments.
    """

    def __init__(self, max_concurrency: int = 3) -> None:
        self._tasks: set[asyncio.Task[Any]] = set()
        self._sem = asyncio.Semaphore(max_concurrency)  # protects provider rate limits

    def submit(self, coro: Coroutine[Any, Any, Any]) -> None:
        task = asyncio.create_task(self._guarded(coro))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _guarded(self, coro: Coroutine[Any, Any, Any]) -> None:
        async with self._sem:
            await coro

    async def wait_all(self) -> None:
        while self._tasks:
            await asyncio.gather(*list(self._tasks), return_exceptions=True)
