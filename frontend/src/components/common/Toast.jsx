import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import useNotifications from '../../hooks/useNotifications';

const styles = {
  success: {
    icon: CircleCheck,
    border: 'border-emerald-500/40',
    bg: 'bg-white',
    iconColor: 'text-emerald-600',
    badge: 'Success',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  error: {
    icon: CircleAlert,
    border: 'border-rose-500/60',
    bg: 'bg-rose-50/95',
    iconColor: 'text-rose-600',
    badge: 'Unavailable / Error',
    badgeBg: 'bg-rose-100 text-rose-900 border-rose-300',
  },
  info: {
    icon: Info,
    border: 'border-navy-300',
    bg: 'bg-white',
    iconColor: 'text-navy-700',
    badge: 'Notification',
    badgeBg: 'bg-navy-50 text-navy-800 border-navy-200',
  },
};

/** Renders the toast stack at the TOP RIGHT CORNER of the screen. Mounted once in App. */
export default function ToastViewport() {
  const { toasts, dismissToast } = useNotifications();

  return (
    <div
      id="toast-viewport"
      className="pointer-events-none fixed top-4 right-4 sm:top-6 sm:right-6 z-[99999] flex flex-col items-end gap-2.5 max-w-sm sm:max-w-md w-full px-3 sm:px-0"
      aria-live="assertive"
      aria-atomic="false"
    >
      {toasts.map((toast) => {
        const theme = styles[toast.tone] ?? styles.success;
        const Icon = theme.icon;
        const isUnavailable =
          toast.message?.toLowerCase().includes('not available') ||
          toast.message?.toLowerCase().includes('unavailable');

        return (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto flex w-full items-start gap-3 rounded-2xl border-2 ${theme.border} ${theme.bg} p-4 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4`}
          >
            <div className={`mt-0.5 shrink-0 ${theme.iconColor}`}>
              <Icon className="size-5" aria-hidden="true" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${
                    isUnavailable ? 'bg-rose-200/80 text-rose-950 border-rose-400' : theme.badgeBg
                  }`}
                >
                  {isUnavailable ? 'Product Unavailable' : theme.badge}
                </span>
              </div>
              <p className="text-sm font-bold text-navy-950 leading-snug break-words">
                {toast.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="rounded-lg p-1 text-navy-400 hover:text-navy-900 hover:bg-navy-100/60 transition-colors shrink-0"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
