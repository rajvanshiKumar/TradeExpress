"use client";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { Button, Card, EmptyState, ErrorState, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import type { ImageOut, ListingResult } from "@/lib/types";

interface Run {
  ms: number;
  result: ListingResult;
}

/** Runs the analysis stages (vision, OCR, classification, extraction) on an image and exposes the raw
 *  structured output. Studio runs use "analyze" mode and never produce publishable content. */
export default function StudioPage() {
  const input = useRef<HTMLInputElement>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [tab, setTab] = useState<"json" | "ocr" | "attrs">("attrs");
  const run = useMutation({
    mutationFn: async (file: File) => {
      const started = performance.now();
      const fd = new FormData();
      fd.append("file", file);
      const img = await api.post<ImageOut>("/images/upload", fd);
      const { job_id } = await api.post<{ job_id: string }>("/ai/listings/analyze", { image_ids: [img.id], seller_hints: "Studio test run" });
      for (let i = 0; i < 90; i++) {
        const r = await api.get<ListingResult>(`/ai/listings/${job_id}/result`);
        if (!["queued", "running"].includes(r.job.status)) return { ms: Math.round(performance.now() - started), result: r };
        await new Promise((res) => setTimeout(res, 1500));
      }
      throw new Error("Timed out waiting for the analysis");
    },
    onSuccess: (r) => setRuns((cur) => [r, ...cur]),
  });
  const latest = runs[0];
  return (
    <AppShell title="AI Testing Studio">
      <div className="space-y-6">
        <Card title="Run the analysis pipeline on a test image">
          <p className="mb-3 text-sm text-slate-600">Inspect raw structured output, OCR text, confidence values, timing and token usage. Studio runs stop before content generation.</p>
          <Button onClick={() => input.current?.click()} loading={run.isPending}>Choose test image</Button>
          <input ref={input} data-testid="studio-input" type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && run.mutate(e.target.files[0])} />
        </Card>
        {run.isPending && <Loading label="Running vision → OCR → classification → extraction…" />}
        {run.isError && <ErrorState error={run.error} />}
        {!latest && !run.isPending && <EmptyState title="No runs yet" />}
        {latest && (
          <Card title={`Result · ${latest.result.job.status}`} actions={<span className="text-xs text-slate-500">{latest.ms} ms · {latest.result.usage.input_tokens + latest.result.usage.output_tokens} tokens · {latest.result.job.model}</span>}>
            <div role="tablist" className="mb-3 flex gap-1">
              {(["attrs", "ocr", "json"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1 text-xs ${tab === t ? "bg-[#0b1f3a] text-white" : "bg-slate-100"}`}>
                  {{ attrs: "Attributes & confidence", ocr: "OCR output", json: "Raw JSON" }[t]}
                </button>
              ))}
            </div>
            {latest.result.job.error && <ErrorState error={new Error(latest.result.job.error)} />}
            {tab === "attrs" && (
              <>
                <p className="mb-2 text-sm">Category: <b>{latest.result.category?.name ?? "unknown"}</b> {latest.result.category?.confidence != null && `(${Math.round(latest.result.category.confidence * 100)}%)`}</p>
                <ul className="divide-y divide-slate-100 text-sm">
                  {latest.result.attributes.filter((a) => a.routing !== "empty").map((a) => (
                    <li key={a.attribute_key} className="flex items-center justify-between py-1.5">
                      <span>{a.attribute_key}: <b>{JSON.stringify(a.ai_value)}</b> <span className="text-xs text-slate-400">({a.source})</span></span>
                      <ConfidenceBadge confidence={a.confidence} routing={a.routing} />
                    </li>
                  ))}
                </ul>
              </>
            )}
            {tab === "ocr" && <pre className="overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs">{JSON.stringify(latest.result.ocr, null, 2)}</pre>}
            {tab === "json" && <pre className="max-h-[32rem] overflow-auto rounded bg-slate-50 p-3 text-xs">{JSON.stringify(latest.result, null, 2)}</pre>}
          </Card>
        )}
        {runs.length > 1 && (
          <Card title="Previous runs (model comparison)">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th>Model</th><th>Category</th><th>Time</th><th>Tokens</th></tr></thead>
              <tbody>{runs.slice(1).map((r, i) => <tr key={i}><td>{r.result.job.model}</td><td>{r.result.category?.name ?? "–"}</td><td>{r.ms} ms</td><td>{r.result.usage.input_tokens + r.result.usage.output_tokens}</td></tr>)}</tbody>
            </table>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
