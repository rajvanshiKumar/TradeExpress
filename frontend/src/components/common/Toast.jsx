import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import useNotifications from '../../hooks/useNotifications';

const styles = {
  success: { icon: CircleCheck, accent: 'text-success' },
  error: { icon: CircleAlert, accent: 'text-danger' },
  info: { icon: Info, accent: 'text-navy-700' },
};

/** Renders the toast stack. Mounted once in App. */
export default function ToastViewport() {
  const { toasts, dismissToast } = useNotifications();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 p-4 sm:items-end" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const { icon: Icon, accent } = styles[toast.tone] ?? styles.success;
        return (
          <div key={toast.id} role="status" className="ts-slide-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-pop">
            <Icon className={`mt-0.5 size-5 shrink-0 ${accent}`} aria-hidden="true" />
            <p className="flex-1 text-sm font-medium text-ink">{toast.message}</p>
            <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification" className="rounded p-0.5 text-muted hover:text-ink">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
