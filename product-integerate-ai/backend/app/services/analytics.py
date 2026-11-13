import uuid
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AIAttributePrediction,
    AIListingJob,
    AIUsageLog,
    Organization,
    ProductImage,
    User,
)


def _f(v: Any) -> float:
    return float(v) if v is not None else 0.0


async def usage_summary(s: AsyncSession, org_id: uuid.UUID | None = None) -> dict[str, Any]:
    """Usage/quality metrics. RLS already scopes rows; org_id filters further for admins."""

    def scoped(stmt: Any, col: Any) -> Any:
        return stmt.where(col == org_id) if org_id else stmt

    status_rows = (await s.execute(scoped(
        select(AIListingJob.status, func.count()).group_by(AIListingJob.status),
        AIListingJob.organization_id))).all()
    jobs: dict[str, Any] = {st: n for st, n in status_rows}
    jobs["total"] = sum(n for _, n in status_rows)
    u: Any = (await s.execute(scoped(select(
        func.count(), func.coalesce(func.sum(AIUsageLog.input_tokens), 0),
        func.coalesce(func.sum(AIUsageLog.output_tokens), 0), func.sum(AIUsageLog.cost_usd),
        func.coalesce(func.avg(AIUsageLog.latency_ms), 0)), AIUsageLog.organization_id))).one()
    approved, rejected = jobs.get("approved", 0), jobs.get("rejected", 0)
    pred_q: Any = select(
        func.count().filter(
            AIAttributePrediction.seller_provided | AIAttributePrediction.ai_value.is_not(None)),
        func.count().filter(
            AIAttributePrediction.seller_provided
            & AIAttributePrediction.seller_value.is_distinct_from(AIAttributePrediction.ai_value)),
    ).join(AIListingJob, AIListingJob.id == AIAttributePrediction.job_id
           ).where(AIListingJob.status == "approved")
    denom, corrected = (await s.execute(scoped(pred_q, AIAttributePrediction.organization_id))).one()
    images = await s.scalar(scoped(select(func.count()).select_from(ProductImage),
                                   ProductImage.organization_id))
    return {
        "jobs": jobs, "images": images or 0, "calls": u[0], "input_tokens": int(u[1]),
        "output_tokens": int(u[2]), "cost_usd": _f(u[3]) if u[3] is not None else None,
        "avg_latency_ms": _f(u[4]),
        "approval_rate": approved / (approved + rejected) if approved + rejected else None,
        "attribute_correction_rate": corrected / denom if denom else None,
    }


async def platform_analytics(s: AsyncSession) -> dict[str, Any]:
    base = await usage_summary(s)
    return {
        "jobs_total": base["jobs"]["total"], "jobs_by_status": base["jobs"],
        "organizations": await s.scalar(select(func.count()).select_from(Organization)) or 0,
        "users": await s.scalar(select(func.count()).select_from(User)) or 0,
        "images": base["images"], "ai_calls": base["calls"],
        "input_tokens": base["input_tokens"], "output_tokens": base["output_tokens"],
        "cost_usd": base["cost_usd"], "approval_rate": base["approval_rate"],
        "attribute_correction_rate": base["attribute_correction_rate"],
    }


async def usage_by_model(s: AsyncSession) -> list[dict[str, Any]]:
    rows = (await s.execute(
        select(AIUsageLog.provider, AIUsageLog.model, AIUsageLog.prompt_version, func.count(),
               func.sum(AIUsageLog.input_tokens), func.sum(AIUsageLog.output_tokens),
               func.sum(AIUsageLog.cost_usd), func.avg(AIUsageLog.latency_ms),
               func.count().filter(AIUsageLog.success.is_(False)))
        .group_by(AIUsageLog.provider, AIUsageLog.model, AIUsageLog.prompt_version)
        .order_by(func.count().desc()))).all()
    return [{"provider": r[0], "model": r[1], "prompt_version": r[2], "calls": r[3],
             "input_tokens": int(r[4] or 0), "output_tokens": int(r[5] or 0),
             "cost_usd": _f(r[6]) if r[6] is not None else None,
             "avg_latency_ms": _f(r[7]), "failures": r[8]} for r in rows]


__all__ = ["case", "platform_analytics", "usage_by_model", "usage_summary"]
