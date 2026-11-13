import { routingInfo } from "@/lib/listing";
import type { Routing } from "@/lib/types";
import { Pill } from "./ui";

export function ConfidenceBadge({ confidence, routing }: { confidence: number; routing: Routing }) {
  const info = routingInfo(routing);
  return (
    <span className="inline-flex items-center gap-1.5">
      {routing !== "empty" && <span className="text-xs tabular-nums text-slate-500">{Math.round(confidence * 100)}%</span>}
      <Pill tone={info.tone}>{info.label}</Pill>
    </span>
  );
}
