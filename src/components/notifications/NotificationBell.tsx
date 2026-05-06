/**
 * NotificationBell — TopBar bell with unread badge + dropdown panel.
 * Wired to NotificationProvider; persists per-user in localStorage.
 */
import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, Check, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "./NotificationProvider";
import type { NotificationSeverity } from "./NotificationProvider";

type NotificationFilter = "all" | "unread" | "mentions" | "this_week";

const severityDot: Record<NotificationSeverity, string> = {
  critical: "bg-terracotta",
  high: "bg-terracotta",
  medium: "bg-amber",
  low: "bg-sage",
  info: "bg-slate",
};

function timeAgo(iso: string, lng: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 60) return lng === "ar" ? `قبل ${m} د` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return lng === "ar" ? `قبل ${h} س` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return lng === "ar" ? `قبل ${d} ي` : `${d}d ago`;
}

export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const lng = i18n.language?.startsWith("ar") ? "ar" : "en";
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllRead } =
    useNotifications();
  // R-LC4 LC-A2 — Lovable parity filter pills (All / Unread / Mentions /
  // This week). Mentions is a stub until @-mention notifications ship.
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const filtered = useMemo(() => {
    switch (filter) {
      case "unread":
        return notifications.filter((n) => !n.readAt);
      case "mentions":
        return notifications.filter((n) =>
          // Title or body mentioning the assignee — best-effort heuristic.
          /@\w+/.test(`${n.titleEn ?? ""} ${n.bodyEn ?? ""}`),
        );
      case "this_week": {
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return notifications.filter((n) => new Date(n.createdAt).getTime() >= cutoff);
      }
      default:
        return notifications;
    }
  }, [notifications, filter]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          aria-label={t("notifications.label", { defaultValue: "Notifications" })}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              aria-label={t("notifications.unread", {
                count: unreadCount,
                defaultValue: "{{count}} unread",
              })}
              className="absolute -top-0.5 -end-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 font-mono text-[9px] font-semibold text-card"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] overflow-hidden p-0"
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold text-ink">
            {t("notifications.title", { defaultValue: "Notifications" })}
            {unreadCount > 0 && (
              <span className="ms-2 font-mono text-xs text-ink-muted">
                ({unreadCount})
              </span>
            )}
          </p>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              className="h-auto px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
            >
              <Check className="me-1 h-3 w-3" />
              {t("notifications.markAllRead", { defaultValue: "Mark all read" })}
            </Button>
          )}
        </div>

        {/* R-LC4 LC-A2 — filter pills (All / Unread / Mentions / This week) */}
        <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
          {(
            [
              { key: "all", labelKey: "all", defaultLabel: "All" },
              { key: "unread", labelKey: "unread", defaultLabel: "Unread" },
              { key: "mentions", labelKey: "mentions", defaultLabel: "Mentions" },
              { key: "this_week", labelKey: "thisWeek", defaultLabel: "This week" },
            ] as const
          ).map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setFilter(p.key)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                filter === p.key
                  ? "bg-gold/20 text-gold"
                  : "text-ink-muted hover:bg-surface"
              }`}
            >
              {t(`notifications.filter.${p.labelKey}`, { defaultValue: p.defaultLabel })}
            </button>
          ))}
        </div>

        <ul className="max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="p-6 text-center text-xs text-ink-subtle">
              {t("notifications.empty", { defaultValue: "No notifications." })}
            </li>
          ) : (
            (() => {
              // R5 audit 5.1 — two-section layout: Recent (last 24h) +
              // Earlier. Mirrors Lovable's notification dropdown.
              const recentCutoffMs = Date.now() - 24 * 60 * 60 * 1000;
              const recentList = filtered.filter(
                (n) => new Date(n.createdAt).getTime() >= recentCutoffMs,
              );
              const earlierList = filtered.filter(
                (n) => new Date(n.createdAt).getTime() < recentCutoffMs,
              );
              const sectionHeader = (label: string) => (
                <li
                  className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
                  aria-hidden="true"
                >
                  {label}
                </li>
              );
              return (
                <>
                  {recentList.length > 0 && (
                    <>
                      {sectionHeader(
                        t("notifications.sectionRecent", { defaultValue: "Recent" }),
                      )}
                      {renderNotifications(recentList)}
                    </>
                  )}
                  {earlierList.length > 0 && (
                    <>
                      {sectionHeader(
                        t("notifications.sectionEarlier", { defaultValue: "Earlier" }),
                      )}
                      {renderNotifications(earlierList)}
                    </>
                  )}
                </>
              );
            })()
          )}
        </ul>
        {/* R-LC4 LC-A3 — footer link to notification preferences (Lovable parity). */}
        <div className="border-t border-border px-3 py-2">
          <Link
            to="/app/settings"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gold hover:underline"
          >
            <Settings className="h-3 w-3" />
            {t("notifications.preferences", { defaultValue: "Notification preferences" })}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );

  function renderNotifications(list: typeof notifications) {
    return list.map((n) => {
              const title = lng === "ar" ? n.titleAr : n.titleEn;
              const body = lng === "ar" ? n.bodyAr : n.bodyEn;
              const inner = (
                <div
                  className={`flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-surface ${
                    n.readAt ? "" : "bg-gold/5"
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      severityDot[n.severity] ?? "bg-slate"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs ${
                        n.readAt ? "text-ink-muted" : "font-semibold text-ink"
                      }`}
                    >
                      {title}
                    </p>
                    {body && (
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        {body}
                      </p>
                    )}
                    <p className="mt-0.5 font-mono text-[10px] text-ink-subtle">
                      {timeAgo(n.createdAt, lng)}
                    </p>
                  </div>
                </div>
              );
              return (
                <li
                  key={n.id}
                  className="border-b border-border/40 last:border-b-0"
                >
                  {n.linkUrl ? (
                    <Link
                      to={n.linkUrl}
                      onClick={() => {
                        markAsRead(n.id);
                        setOpen(false);
                      }}
                      className="block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => markAsRead(n.id)}
                      className="block w-full text-start"
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            });
  }
}
