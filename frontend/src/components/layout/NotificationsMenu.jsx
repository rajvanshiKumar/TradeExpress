import { Link } from "react-router-dom";
import { Bell, BellOff } from "lucide-react";
import Dropdown from "../common/Dropdown";
import useNotifications from "../../hooks/useNotifications";
import useAuth from "../../hooks/useAuth";
import { formatMessageTime } from "../../utils/formatDate";

export function CountDot({ count }) {
  if (!count) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-[0.95rem] h-3.5 items-center justify-center rounded-full bg-brand-500 px-1 text-[0.5625rem] font-bold leading-none text-navy-950 ring-2 ring-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function NotificationsMenu({ className = "" }) {
  const { isAuthenticated } = useAuth();
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    clearNotifications,
  } = useNotifications();

  const displayClass = className.includes("hidden") ? "" : "inline-flex ";

  return (
    <Dropdown
      panelClassName="w-80"
      trigger={({ props }) => (
        <button
          type="button"
          {...props}
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
          title="Notifications"
          className={`relative ${displayClass}size-7.5 sm:size-8 xl:size-8.5 items-center justify-center rounded-full text-navy-800 hover:bg-navy-900/5 hover:text-navy-950 transition-colors ${className}`}
        >
          <Bell className="size-4" aria-hidden="true" />
          <CountDot count={unreadCount} />
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <p className="font-display text-sm font-bold text-navy-900">
              Notifications
            </p>
            {unreadCount ? (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                Mark all as read
              </button>
            ) : null}
          </div>
          {!isAuthenticated ? (
            <div className="px-4 py-6 text-center text-sm text-muted">
              <p>Sign in to see order, quote and message updates.</p>
              <Link
                to="/login"
                onClick={close}
                className="mt-2 inline-block font-semibold text-brand-600"
              >
                Sign in
              </Link>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-8 text-center text-sm text-muted">
              <BellOff className="mb-2 size-6" aria-hidden="true" />
              You have no notifications.
            </div>
          ) : (
            <>
              <ul className="max-h-80 overflow-y-auto">
                {notifications.slice(0, 12).map((item) => (
                  <li key={item.id} className="border-b last:border-b-0">
                    <Link
                      to={item.link || "/"}
                      onClick={() => {
                        markRead(item.id);
                        close();
                      }}
                      className={`block px-4 py-3 hover:bg-navy-50 ${item.read ? "" : "bg-brand-50/60"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {item.title}
                        </span>
                        {!item.read ? (
                          <span
                            className="size-2 shrink-0 rounded-full bg-brand-500"
                            aria-label="Unread"
                          />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[0.8125rem] text-muted">
                        {item.body}
                      </span>
                      <span className="mt-1 block text-[0.6875rem] text-slate-400">
                        {formatMessageTime(item.at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="border-t px-4 py-2.5 text-right">
                <button
                  type="button"
                  onClick={clearNotifications}
                  className="text-xs font-semibold text-muted hover:text-danger"
                >
                  Clear all
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Dropdown>
  );
}
