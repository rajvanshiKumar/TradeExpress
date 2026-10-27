import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  BellOff,
  CheckCheck,
  FileText,
  Mail,
  Package,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import Dropdown from "../common/Dropdown";
import useNotifications from "../../hooks/useNotifications";
import useAuth from "../../hooks/useAuth";
import { formatMessageTime } from "../../utils/formatDate";

export function CountDot({ count }) {
  if (!count) return null;
  return (
    <span className="absolute -top-1 -right-1 inline-flex min-w-[1rem] h-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-extrabold leading-none text-white ring-2 ring-white shadow-2xs">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function getNotificationIcon(type) {
  switch (type) {
    case "order":
      return { icon: Package, bg: "bg-blue-100 text-blue-700" };
    case "message":
      return { icon: Mail, bg: "bg-teal-100 text-teal-700" };
    case "rfq":
    case "quote":
      return { icon: FileText, bg: "bg-emerald-100 text-emerald-700" };
    case "verification":
      return { icon: ShieldCheck, bg: "bg-amber-100 text-amber-700" };
    default:
      return { icon: Sparkles, bg: "bg-purple-100 text-purple-700" };
  }
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

  const [filter, setFilter] = useState("all"); // 'all' | 'unread'

  const displayClass = className.includes("hidden") ? "" : "inline-flex ";
  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((item) => !item.read)
      : notifications;

  return (
    <Dropdown
      panelClassName="w-[22rem] sm:w-[24rem] overflow-hidden p-0"
      trigger={({ open, props }) => (
        <button
          type="button"
          {...props}
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
          title="Notifications"
          className={`relative ${displayClass}size-7.5 sm:size-8 xl:size-8.5 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors ${className} ${
            open ? "bg-slate-100 text-slate-900" : ""
          }`}
        >
          <Bell className="size-4" aria-hidden="true" />
          <CountDot count={unreadCount} />
        </button>
      )}
    >
      {({ close }) => (
        <div>
          {/* Header */}
          <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 shadow-2xs">
                  <Bell className="size-4" />
                </span>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Notifications
                  </h4>
                  {unreadCount > 0 && (
                    <span className="text-[11px] font-bold text-emerald-700">
                      {unreadCount} unread update{unreadCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 transition-colors"
                >
                  <CheckCheck className="size-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            {notifications.length > 0 && (
              <div className="mt-2.5 flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`flex-1 py-1 rounded-md transition-all ${
                    filter === "all"
                      ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                      : "hover:text-slate-900"
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("unread")}
                  className={`flex-1 py-1 rounded-md transition-all ${
                    filter === "unread"
                      ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                      : "hover:text-slate-900"
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>
            )}
          </div>

          {/* Body Content */}
          {!isAuthenticated ? (
            <div className="px-4 py-8 text-center text-xs text-slate-500 space-y-2">
              <p>Sign in to view real-time orders, quotes and message notifications.</p>
              <Link
                to="/login"
                onClick={close}
                className="inline-block rounded-full bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
              >
                Sign In
              </Link>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center text-xs text-slate-400">
              <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
                <BellOff className="size-6" aria-hidden="true" />
              </span>
              <p className="font-semibold text-slate-600">No notifications yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {filter === "unread" ? "You have no unread notifications." : "All your alerts will appear here."}
              </p>
            </div>
          ) : (
            <>
              <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {filteredNotifications.slice(0, 15).map((item) => {
                  const { icon: ItemIcon, bg: iconBg } = getNotificationIcon(item.type);
                  return (
                    <li key={item.id}>
                      <Link
                        to={item.link || "/"}
                        onClick={() => {
                          markRead(item.id);
                          close();
                        }}
                        className={`group flex items-start gap-3 px-4 py-3 transition-colors ${
                          item.read
                            ? "hover:bg-slate-50"
                            : "bg-emerald-50/50 hover:bg-emerald-50/80"
                        }`}
                      >
                        <span
                          className={`flex size-8 items-center justify-center rounded-xl shrink-0 ${iconBg} shadow-2xs`}
                        >
                          <ItemIcon className="size-4" aria-hidden="true" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="truncate text-xs font-bold text-slate-900 group-hover:text-emerald-950">
                              {item.title}
                            </span>
                            {!item.read && (
                              <span
                                className="size-2 shrink-0 rounded-full bg-emerald-600 ring-2 ring-emerald-200"
                                aria-label="Unread"
                              />
                            )}
                          </div>

                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-600">
                            {item.body || item.message}
                          </p>

                          <span className="mt-1 block text-[10px] font-medium text-slate-400">
                            {formatMessageTime(item.at || item.createdAt)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* Footer Actions */}
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
                <button
                  type="button"
                  onClick={clearNotifications}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="size-3" />
                  <span>Clear all</span>
                </button>

                <span className="text-[10px] text-slate-400">
                  Showing {Math.min(filteredNotifications.length, 15)} of {notifications.length}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </Dropdown>
  );
}
