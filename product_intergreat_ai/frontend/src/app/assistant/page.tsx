"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, cx, Pill } from "@/components/ui";
import { api } from "@/lib/api";
import type { CategoryNode } from "@/lib/types";
import {
  applySuggestions,
  buildBody,
  callAssist,
  claimField,
  fileToImage,
  flattenCategories,
  MODULES,
  moduleById,
  undoField,
  userTypedValues,
  type AiFilled,
  type AssistField,
  type AssistModule,
  type AssistResponse,
  type FieldSuggestion,
  type ModuleId,
} from "@/lib/assist";

interface Panel {
  text: string;
  extras: Record<string, string>;
  files: File[];
  today: string;
  skipFilled: boolean;
  values: Record<string, string>;
  aiFilled: AiFilled; // fields the AI filled automatically (+ previous value for Undo)
  result: AssistResponse | null;
  error: string | null;
}

const initPanel = (m: AssistModule): Panel => ({
  text: m.sampleText,
  extras: Object.fromEntries(m.extra.map((e) => [e.id, e.value])),
  files: [],
  today: "",
  skipFilled: true,
  values: {},
  aiFilled: {},
  result: null,
  error: null,
});

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-50";

export default function AssistantPage() {
  const [active, setActive] = useState<ModuleId>("rfq");
  const [panels, setPanels] = useState<Record<ModuleId, Panel>>(
    () => Object.fromEntries(MODULES.map((m) => [m.id, initPanel(m)])) as Record<ModuleId, Panel>,
  );
  const mod = moduleById(active);
  const panel = panels[active];
  // The RFQ category list is built automatically from the catalog (same data the Categories page uses).
  const tree = useQuery({ queryKey: ["category-tree"], queryFn: () => api.get<CategoryNode[]>("/categories/tree") });
  const autoCategories = useMemo(() => flattenCategories(tree.data), [tree.data]);
  const autoJson = useMemo(() => JSON.stringify(autoCategories, null, 1), [autoCategories]);
  const categoriesJson = (p: Panel) => (p.extras.categories?.trim() ? p.extras.categories : autoJson);
  const update = (id: ModuleId, fn: (p: Panel) => Panel) => setPanels((prev) => ({ ...prev, [id]: fn(prev[id]) }));
  const patch = (id: ModuleId, p: Partial<Panel>) => update(id, (cur) => ({ ...cur, ...p }));

  const suggest = useMutation({
    mutationFn: async (id: ModuleId) => {
      const m = moduleById(id);
      const s = panels[id];
      const images = await Promise.all(s.files.map(fileToImage));
      // Only what the user typed counts as "already filled"; earlier AI fills are replaced.
      const typed = userTypedValues(s.values, s.aiFilled);
      return callAssist(
        m,
        buildBody(m, { text: s.text, extras: { ...s.extras, categories: categoriesJson(s) }, values: typed, skipFilled: s.skipFilled, today: s.today, images }),
      );
    },
    // The form is filled automatically: no extra click needed.
    onSuccess: (result, id) =>
      update(id, (p) => ({ ...p, ...applySuggestions(p.values, p.aiFilled, result.suggestions), result, error: null })),
    onError: (e, id) => patch(id, { result: null, error: e.message }),
  });

  const result = panel.result;
  const filledCount = Object.keys(panel.aiFilled).length;
  const undoAll = () =>
    update(active, (p) => {
      let state = { values: p.values, aiFilled: p.aiFilled };
      for (const k of Object.keys(p.aiFilled)) state = undoField(state.values, state.aiFilled, k);
      return { ...p, ...state };
    });

  return (
    <AppShell title="AI Form Assistant">
      <div className="space-y-6">
        <p className="max-w-3xl text-sm text-slate-600">
          Type, paste or upload a document and click <b>Suggest</b>: the AI fills the form for you. Fields marked <b>Please confirm</b> are
          less certain, so check them. You can undo any field. Nothing is submitted by the AI, and money, verification and government-ID
          fields are never filled.
        </p>

        <div role="tablist" aria-label="Form assistant modules" className="flex flex-wrap gap-2">
          {MODULES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={m.id === active}
              onClick={() => setActive(m.id)}
              className={cx(
                "rounded-md border px-3.5 py-2 text-sm font-medium transition",
                m.id === active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={mod.title}>
            <p className="mb-3 text-xs text-slate-500">{mod.hint}</p>
            <label htmlFor="as-text" className="block text-sm font-medium text-slate-700">
              {mod.maxImages > 0 ? "Pasted text (optional)" : "Text"}
            </label>
            <textarea
              id="as-text"
              rows={mod.maxImages > 0 ? 3 : 5}
              value={panel.text}
              onChange={(e) => patch(active, { text: e.target.value })}
              className={cx(inputCls, "mt-1")}
            />
            {mod.maxImages > 0 && (
              <div className="mt-3">
                <label htmlFor="as-files" className="block text-sm font-medium text-slate-700">
                  Document photos (JPG, PNG or WebP, max {mod.maxImages}, 5 MB each)
                </label>
                <input
                  id="as-files"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(e) => patch(active, { files: Array.from(e.target.files ?? []).slice(0, mod.maxImages) })}
                  className="mt-1 block w-full text-sm"
                />
                {panel.files.length > 0 && <p className="mt-1 text-xs text-slate-500">{panel.files.map((f) => f.name).join(", ")}</p>}
              </div>
            )}
            {mod.id === "rfq" && (
              <CategoryList
                count={autoCategories.length}
                loading={tree.isPending}
                error={tree.isError ? tree.error.message : null}
                json={categoriesJson(panel)}
                edited={!!panel.extras.categories?.trim()}
                onChange={(v) => patch(active, { extras: { ...panel.extras, categories: v } })}
              />
            )}
            {mod.extra.filter((x) => x.id !== "categories").map((x) => (
              <div key={x.id} className="mt-3">
                <label htmlFor={`as-x-${x.id}`} className="block text-sm font-medium text-slate-700">
                  {x.label}
                </label>
                <textarea
                  id={`as-x-${x.id}`}
                  rows={x.rows}
                  value={panel.extras[x.id] ?? ""}
                  onChange={(e) => patch(active, { extras: { ...panel.extras, [x.id]: e.target.value } })}
                  className={cx(inputCls, "mt-1")}
                />
              </div>
            ))}
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={panel.skipFilled} onChange={(e) => patch(active, { skipFilled: e.target.checked })} />
              Don&apos;t overwrite fields I typed myself
            </label>
            <div className="mt-4 flex items-center gap-3">
              <Button
                onClick={() => suggest.mutate(active)}
                loading={suggest.isPending && suggest.variables === active}
                disabled={mod.id === "rfq" && tree.isPending}
              >
                ✨ Suggest &amp; fill form
              </Button>
            </div>
            {panel.error && (
              <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {panel.error}
              </div>
            )}
            {result && (
              <div className="mt-3 space-y-2">
                <div
                  className={cx(
                    "rounded-md px-3 py-2 text-xs",
                    result.usage.provider === "fake" ? "bg-amber-50 text-amber-800" : "bg-sky-50 text-sky-800",
                  )}
                >
                  {result.usage.provider === "fake"
                    ? "FAKE provider (offline stand-in, cannot read photos). Set ASSIST_AI_PROVIDER=gemini for real output."
                    : `Provider: ${result.usage.provider} / ${result.usage.model} · ${result.usage.input_tokens} in / ${result.usage.output_tokens} out · ${result.usage.latency_ms} ms`}
                </div>
                {result.warnings.map((w) => (
                  <div key={w} className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    ⚠ {w}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Form"
            actions={
              <>
                {filledCount > 0 && <span className="text-xs text-slate-500">{filledCount} filled by AI</span>}
                <Button size="sm" variant="secondary" disabled={filledCount === 0} onClick={undoAll}>
                  Undo all
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              {mod.fields.map((f) => (
                <FieldRow
                  key={f.key}
                  field={f}
                  value={panel.values[f.key] ?? ""}
                  suggestion={panel.aiFilled[f.key] ? result?.suggestions[f.key] : undefined}
                  skippedReason={result?.skipped[f.key]}
                  onChange={(v) =>
                    update(active, (p) => ({ ...p, values: { ...p.values, [f.key]: v }, aiFilled: claimField(p.aiFilled, f.key) }))
                  }
                  onUndo={() => update(active, (p) => ({ ...p, ...undoField(p.values, p.aiFilled, f.key) }))}
                />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function FieldRow({
  field,
  value,
  suggestion,
  skippedReason,
  onChange,
  onUndo,
}: {
  field: AssistField;
  value: string;
  suggestion?: FieldSuggestion; // set only while this field still holds the AI's value
  skippedReason?: string;
  onChange: (v: string) => void;
  onUndo: () => void;
}) {
  const id = `as-f-${field.key}`;
  const never = field.kind === "never";
  const confirm = suggestion?.routing === "confirm";
  const ring = suggestion ? (confirm ? "border-amber-400 bg-amber-50/40" : "border-emerald-400 bg-emerald-50/40") : "";
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {field.label}
        {never && <span className="ml-2 text-xs font-normal text-slate-400">AI never fills this</span>}
      </label>
      {field.kind === "area" ? (
        <textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputCls, "mt-1", ring)} />
      ) : (
        <input
          id={id}
          value={value}
          disabled={never}
          placeholder={never ? "you decide" : ""}
          onChange={(e) => onChange(e.target.value)}
          className={cx(inputCls, "mt-1", ring)}
        />
      )}
      {suggestion && (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Pill tone={confirm ? "amber" : "green"}>{confirm ? "AI filled · please confirm" : "AI filled"}</Pill>
          <span>{Math.round(suggestion.confidence * 100)}% sure</span>
          <button type="button" onClick={onUndo} className="underline hover:text-slate-800" aria-label={`Undo AI value for ${field.label}`}>
            Undo
          </button>
          {suggestion.reason && <span>· {suggestion.reason}</span>}
        </div>
      )}
      {!suggestion && skippedReason && <p className="mt-1 text-xs text-slate-400">AI left this empty: {skippedReason}</p>}
    </div>
  );
}

function CategoryList({
  count,
  loading,
  error,
  json,
  edited,
  onChange,
}: {
  count: number;
  loading: boolean;
  error: string | null;
  json: string;
  edited: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="text-sm font-medium text-slate-700">Category list</div>
      <p className="mt-0.5 text-xs text-slate-500">
        {loading
          ? "Loading categories from your catalog…"
          : error
            ? `Could not load categories (${error}). The AI will not suggest a category.`
            : edited
              ? "Using your edited JSON."
              : `${count} categories loaded automatically from your catalog. The AI can only pick from this list.`}
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-slate-600 underline">View / edit JSON</summary>
        <label htmlFor="as-x-categories" className="sr-only">
          Category list JSON
        </label>
        <textarea
          id="as-x-categories"
          rows={8}
          value={json}
          onChange={(e) => onChange(e.target.value)}
          className={cx(inputCls, "mt-2 font-mono text-xs")}
        />
        {edited && (
          <button type="button" onClick={() => onChange("")} className="mt-1 text-xs underline">
            Reset to the automatic list
          </button>
        )}
      </details>
    </div>
  );
}
