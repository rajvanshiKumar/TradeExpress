"use client";
import { useQuery } from "@tanstack/react-query";
import { AppShell, useMe } from "@/components/AppShell";
import { Card, EmptyState, ErrorState, Loading, Pill } from "@/components/ui";
import { api } from "@/lib/api";

interface Analytics {
  jobs_total: number; jobs_by_status: Record<string, number>; organizations: number; users: number; images: number;
  ai_calls: number; input_tokens: number; output_tokens: number; cost_usd: number | null;
  approval_rate: number | null; attribute_correction_rate: number | null;
}
interface ModelUsage { provider: string; model: string; prompt_version: string; calls: number; input_tokens: number; output_tokens: number; avg_latency_ms: number; failures: number }
interface Failed { total: number; items: { job_id: string; organization_id: string; stage: string; error: string | null; model: string | null; updated_at: string }[] }
interface Provider { provider: string; model: string | null; configured: boolean; active: boolean; timeout_seconds: number | null; pricing_configured: boolean }
interface Audit { items: { id: string; action: string; entity_type: string; created_at?: string; actor_user_id: string | null }[]; total: number }

export default function AdminPage() {
  const me = useMe();
  const enabled = !!me.data?.is_platform_admin;
  const analytics = useQuery({ queryKey: ["adm-an"], queryFn: () => api.get<Analytics>("/admin/analytics"), enabled });
  const usage = useQuery({ queryKey: ["adm-use"], queryFn: () => api.get<{ items: ModelUsage[] }>("/admin/ai-usage"), enabled });
  const failed = useQuery({ queryKey: ["adm-fail"], queryFn: () => api.get<Failed>("/admin/failed-jobs"), enabled });
  const providers = useQuery({ queryKey: ["adm-prov"], queryFn: () => api.get<{ items: Provider[] }>("/admin/ai-providers"), enabled });
  const audit = useQuery({ queryKey: ["adm-audit"], queryFn: () => api.get<Audit>("/admin/audit-logs?limit=10"), enabled });

  if (me.isLoading) return <AppShell><Loading /></AppShell>;
  if (!enabled) return <AppShell title="Admin"><EmptyState title="Administrator access required" /></AppShell>;
  const a = analytics.data;
  return (
    <AppShell title="Admin Dashboard">
      <div className="space-y-6">
        {analytics.isError && <ErrorState error={analytics.error} />}
        {a && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {([["Organizations", a.organizations], ["Users", a.users], ["Listings", a.jobs_total], ["Images", a.images], ["AI calls", a.ai_calls]] as const).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs uppercase text-slate-500">{k}</div><div className="text-2xl font-semibold tabular-nums">{v}</div></div>
            ))}
          </div>
        )}
        <Card title="AI providers & configuration">
          <ul className="divide-y divide-slate-100 text-sm">
            {providers.data?.items.map((p) => (
              <li key={p.provider} className="flex items-center justify-between py-2">
                <span className="font-medium capitalize">{p.provider} <span className="font-normal text-slate-500">{p.model ?? ""}</span></span>
                <span className="space-x-1">{p.active && <Pill tone="green">active</Pill>}<Pill tone={p.configured ? "blue" : "gray"}>{p.configured ? "key configured" : "not configured"}</Pill>{!p.pricing_configured && p.configured && <Pill tone="amber">no pricing</Pill>}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Credentials are server-side environment variables and are never sent to the browser.</p>
        </Card>
        <Card title="Usage by model & prompt version">
          {usage.data?.items.length ? (
            <table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th>Model</th><th>Prompt</th><th>Calls</th><th>Tokens in/out</th><th>Avg ms</th><th>Failures</th></tr></thead>
              <tbody>{usage.data.items.map((m) => <tr key={m.model + m.prompt_version}><td>{m.provider}/{m.model}</td><td>{m.prompt_version}</td><td>{m.calls}</td><td>{m.input_tokens.toLocaleString()} / {m.output_tokens.toLocaleString()}</td><td>{Math.round(m.avg_latency_ms)}</td><td>{m.failures}</td></tr>)}</tbody></table>
          ) : <EmptyState title="No AI usage yet" />}
        </Card>
        <Card title={`Failed jobs (${failed.data?.total ?? 0})`}>
          {failed.data?.items.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {failed.data.items.map((f) => <li key={f.job_id} className="py-2"><span className="font-mono text-xs">{f.job_id.slice(0, 8)}</span> · stage {f.stage} · <span className="text-red-700">{f.error}</span></li>)}
            </ul>
          ) : <p className="text-sm text-slate-500">No failed jobs.</p>}
        </Card>
        <Card title="Recent audit log">
          <ul className="divide-y divide-slate-100 text-sm">{audit.data?.items.map((l) => <li key={l.id} className="py-1.5"><code>{l.action}</code> <span className="text-slate-500">{l.entity_type}</span></li>)}</ul>
        </Card>
      </div>
    </AppShell>
  );
}
