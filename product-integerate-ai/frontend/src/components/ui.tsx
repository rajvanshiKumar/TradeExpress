"use client";
import { createContext, useCallback, useContext, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  const styles = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700",
    secondary: "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-slate-700 hover:bg-slate-100",
  }[variant];
  const sizeStyles = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-3.5 py-2 text-sm",
    lg: "px-4.5 py-2.5 text-base",
  }[size];
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600",
        styles,
        sizeStyles,
        className,
      )}
    >
      {loading && <Spinner size={size === "sm" ? 12 : 14} />}
      {children}
    </button>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      {(title || actions) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({
  label,
  error,
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; id: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        {...rest}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
      />
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-50",
        className
      )}
    />
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const msg = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      {msg}
      {retry && (
        <button onClick={retry} className="ml-3 underline">
          Retry
        </button>
      )}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
      <Spinner /> {label}
    </div>
  );
}

const TONES = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  gray: "bg-slate-100 text-slate-600 ring-slate-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
} as const;

export function Pill({ tone = "gray", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TONES[tone])}>{children}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const tone = ({ approved: "green", awaiting_review: "blue", running: "amber", queued: "amber", failed: "red", upload_failed: "red", rejected: "gray", analyzed: "blue" } as const)[status as "approved"] ?? "gray";
  const labels: Record<string, string> = { awaiting_review: "Needs review", running: "Processing", upload_failed: "Upload failed" };
  return <Pill tone={tone}>{labels[status] ?? status.replace("_", " ")}</Pill>;
}

interface Toast {
  id: number;
  kind: "success" | "error";
  text: string;
}
const ToastCtx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={cx("rounded-md px-4 py-2 text-sm text-white shadow-lg", t.kind === "success" ? "bg-emerald-700" : "bg-red-700")}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
