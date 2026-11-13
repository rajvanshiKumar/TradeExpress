"use client";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, ErrorState, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/store";

interface Usage {
  jobs: Record<string, number>;
  images: number;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
  avg_latency_ms: number;
  approval_rate: number | null;
  attribute_correction_rate: number | null;
}
const pct = (v: number | null) => (v === null ? "n/a" : `${(v * 100).toFixed(0)}%`);

export default function UsagePage() {
  const orgId = useSession((s) => s.orgId);
  const q = useQuery({ queryKey: ["usage", orgId], queryFn: () => api.get<Usage>("/ai/usage"), enabled: !!orgId });
  const u = q.data;
  const max = u ? Math.max(1, ...Object.entries(u.jobs).filter(([k]) => k !== "total").map(([, v]) => v)) : 1;
  return (
    <AppShell title="AI Usage Analytics">
      {q.isPending && !q.isError ? <Loading /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Usage & cost">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {([
                ["AI calls", u!.calls], ["Images uploaded", u!.images], ["Input tokens", u!.input_tokens.toLocaleString()],
                ["Output tokens", u!.output_tokens.toLocaleString()], ["Avg latency", `${Math.round(u!.avg_latency_ms)} ms`],
                ["Estimated cost", u!.cost_usd === null ? "not configured" : `$${u!.cost_usd.toFixed(4)}`],
              ] as const).map(([k, v]) => <div key={k}><dt className="text-xs uppercase text-slate-500">{k}</dt><dd className="text-lg font-semibold tabular-nums">{v}</dd></div>)}
            </dl>
            {u!.cost_usd === null && <p className="mt-3 text-xs text-slate-500">Set TX_GEMINI_PRICE_IN_PER_M / TX_GEMINI_PRICE_OUT_PER_M on the server to enable cost estimates.</p>}
          </Card>
          <Card title="Quality signals">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs uppercase text-slate-500">Approval rate</dt><dd className="text-lg font-semibold">{pct(u!.approval_rate)}</dd></div>
              <div><dt className="text-xs uppercase text-slate-500">Attribute correction rate</dt><dd className="text-lg font-semibold">{pct(u!.attribute_correction_rate)}</dd></div>
            </dl>
          </Card>
          <Card title="Listings by status" className="lg:col-span-2">
            <ul className="space-y-2">
              {Object.entries(u!.jobs).filter(([k]) => k !== "total").map(([k, v]) => (
                <li key={k} className="flex items-center gap-3 text-sm">
                  <span className="w-32 text-slate-600">{k.replace("_", " ")}</span>
                  <div className="h-3 flex-1 rounded bg-slate-100"><div className="h-3 rounded bg-emerald-600" style={{ width: `${(v / max) * 100}%` }} /></div>
                  <span className="w-8 text-right tabular-nums">{v}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
