import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Zap,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  BarChart3,
  ListChecks,
} from "lucide-react";
import { obligationsService, type ObligationListItem } from "@/services/api/m_parity.service";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { formatDate, formatHijriDate } from "@/utils/datetime";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore, selectHasPermission, readPersistedAuthSnapshot } from "@/store/auth.store";
import { CreateObligationDialog } from "@/features/m_parity/components/CreateEntityDialogs";

export const Route = createFileRoute("/app/obligations")({
  beforeLoad: () => {
    // R-RC0 — recipients see only their own contracts; obligations is hidden
    // from the sidebar AND blocked at the route level so a deep-link redirects
    // to the recipient dashboard rather than briefly flash-rendering the page.
    // Reads localStorage directly to avoid the Zustand persist-rehydration
    // microtask race on cold page loads (see auth.store.ts for details).
    // SSR-safe: skip when no window (TanStack Start runs beforeLoad on server too).
    if (typeof window === "undefined") return;
    const snap = readPersistedAuthSnapshot();
    if (snap?.user?.role?.name === "contract_recipient") {
      throw redirect({ to: "/app/dashboards/recipient" });
    }
  },
  component: () => (
    <ErrorBoundary>
      <ObligationsView />
    </ErrorBoundary>
  ),
});

const STATUS_TONE: Record<string, string> = {
  open: "bg-surface text-ink-muted",
  in_progress: "bg-amber/15 text-amber-ink",
  overdue: "bg-terracotta/15 text-terracotta",
  completed: "bg-sage/15 text-sage",
  waived: "bg-muted text-ink-subtle",
};

// R-LC5 LC-K2 — Lovable parity: 5 tabs (Owe / Owed / List / Calendar / Reports).
type ViewMode = "owe" | "owed" | "list" | "calendar" | "reports";
type Direction = "all" | "we_owe" | "owed_to_us";

function isOurs(o: ObligationListItem): boolean {
  return o.responsibleParty === "our_party" || o.responsibleParty === "both";
}
function isTheirs(o: ObligationListItem): boolean {
  return o.responsibleParty === "counterparty" || o.responsibleParty === "both";
}

function ObligationsView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const [view, setView] = useState<ViewMode>("list");
  const [direction, setDirection] = useState<Direction>("all");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const canCreate = useAuthStore(selectHasPermission("contract.edit"));

  const { data, isLoading } = useQuery({
    queryKey: ["obligations", status],
    queryFn: () =>
      obligationsService.list({
        status: status || undefined,
        limit: 500,
      }),
    staleTime: 60_000,
  });

  const items = data?.data ?? [];

  const directionalSplit = useMemo(() => {
    const we = items.filter(isOurs);
    const them = items.filter(isTheirs);
    return {
      we: {
        count: we.length,
        overdue: we.filter((o) => o.status === "overdue").length,
        dueSoon: we.filter((o) => isDueSoon(o)).length,
      },
      them: {
        count: them.length,
        overdue: them.filter((o) => o.status === "overdue").length,
        dueSoon: them.filter((o) => isDueSoon(o)).length,
      },
    };
  }, [items]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, { total: number; overdue: number }>();
    for (const o of items) {
      const c = counts.get(o.obligationType) ?? { total: 0, overdue: 0 };
      c.total += 1;
      if (o.status === "overdue") c.overdue += 1;
      counts.set(o.obligationType, c);
    }
    return [...counts.entries()].sort(([, a], [, b]) => b.total - a.total);
  }, [items]);

  const filteredItems = useMemo(() => {
    let out = items;
    if (direction === "we_owe") out = out.filter(isOurs);
    if (direction === "owed_to_us") out = out.filter(isTheirs);
    if (category) out = out.filter((o) => o.obligationType === category);
    return out;
  }, [items, direction, category]);

  const stats = useMemo(() => {
    const total = items.length;
    const overdue = items.filter((o) => o.status === "overdue").length;
    const dueSoon = items.filter(isDueSoon).length;
    const completed = items.filter((o) => o.status === "completed").length;
    return { total, overdue, dueSoon, completed };
  }, [items]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("obligations.title", { defaultValue: "Obligations tracker" })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("obligations.subtitle", {
              defaultValue:
                "Per-contract payment, delivery, reporting, and compliance commitments.",
            })}
          </p>
        </div>
        {canCreate && (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("obligations.create.cta", { defaultValue: "Add obligation" })}
          </Button>
        )}
      </header>
      <CreateObligationDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* KPI strip */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<CalendarClock className="h-4 w-4 text-gold" />}
          label={t("obligations.stats.total", { defaultValue: "Total tracked" })}
          value={stats.total}
        />
        <KpiCard
          icon={<Zap className={`h-4 w-4 ${stats.overdue > 0 ? "text-terracotta" : "text-ink-subtle"}`} />}
          label={t("obligations.stats.overdue", { defaultValue: "Overdue" })}
          value={stats.overdue}
          accent={stats.overdue > 0 ? "border-l-terracotta" : undefined}
          tone={stats.overdue > 0 ? "text-terracotta" : "text-ink"}
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4 text-amber-ink" />}
          label={t("obligations.stats.dueSoon", { defaultValue: "Due in 30 days" })}
          value={stats.dueSoon}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4 text-sage" />}
          label={t("obligations.stats.completed", { defaultValue: "Completed" })}
          value={stats.completed}
        />
      </section>

      {/* Directional split */}
      <section className="grid gap-3 md:grid-cols-2">
        <DirectionCard
          icon={<ArrowUpFromLine className="h-4 w-4 text-gold" />}
          title={t("obligations.weOwe.title", { defaultValue: "We owe" })}
          subtitle={t("obligations.weOwe.subtitle", {
            defaultValue: "Commitments your team must deliver.",
          })}
          count={directionalSplit.we.count}
          overdue={directionalSplit.we.overdue}
          dueSoon={directionalSplit.we.dueSoon}
          active={direction === "we_owe"}
          onClick={() => setDirection((d) => (d === "we_owe" ? "all" : "we_owe"))}
        />
        <DirectionCard
          icon={<ArrowDownToLine className="h-4 w-4 text-sage" />}
          title={t("obligations.owedToUs.title", { defaultValue: "Owed to us" })}
          subtitle={t("obligations.owedToUs.subtitle", {
            defaultValue: "Commitments your counterparties must deliver.",
          })}
          count={directionalSplit.them.count}
          overdue={directionalSplit.them.overdue}
          dueSoon={directionalSplit.them.dueSoon}
          active={direction === "owed_to_us"}
          onClick={() => setDirection((d) => (d === "owed_to_us" ? "all" : "owed_to_us"))}
        />
      </section>

      {/* By-category breakdown */}
      {categoryCounts.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("obligations.byCategory", { defaultValue: "By category" })}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
            {categoryCounts.map(([cat, c]) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory((prev) => (prev === cat ? "" : cat))}
                className={cn(
                  "rounded-md border bg-surface p-3 text-start transition-colors",
                  category === cat
                    ? "border-gold"
                    : "border-border hover:border-gold/50",
                )}
              >
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {cat.replace(/_/g, " ")}
                </p>
                <p className="mt-1 font-mono text-xl font-semibold text-ink">{c.total}</p>
                {c.overdue > 0 && (
                  <p className="mt-0.5 font-mono text-[10px] text-terracotta">
                    {t("obligations.overdueN", {
                      defaultValue: "{{count}} overdue",
                      count: c.overdue,
                    })}
                  </p>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* View tabs + status filter */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div role="tablist" className="flex flex-wrap gap-1">
          {/* R-LC5 LC-K2 — Lovable parity: 5 tabs starting with directional splits. */}
          <ViewTab active={view === "owe"} onClick={() => setView("owe")}>
            <ArrowUpFromLine className="me-1 h-3.5 w-3.5" />
            {t("obligations.views.owe", { defaultValue: "Obligations I Owe" })}
          </ViewTab>
          <ViewTab active={view === "owed"} onClick={() => setView("owed")}>
            <ArrowDownToLine className="me-1 h-3.5 w-3.5" />
            {t("obligations.views.owed", { defaultValue: "Obligations Owed to Me" })}
          </ViewTab>
          <ViewTab active={view === "list"} onClick={() => setView("list")}>
            <ListChecks className="me-1 h-3.5 w-3.5" />
            {t("obligations.views.list", { defaultValue: "List" })}
          </ViewTab>
          <ViewTab active={view === "calendar"} onClick={() => setView("calendar")}>
            <CalendarDays className="me-1 h-3.5 w-3.5" />
            {t("obligations.views.calendar", { defaultValue: "Calendar" })}
          </ViewTab>
          <ViewTab active={view === "reports"} onClick={() => setView("reports")}>
            <BarChart3 className="me-1 h-3.5 w-3.5" />
            {t("obligations.views.reports", { defaultValue: "Reports" })}
          </ViewTab>
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          {[
            { v: "", l: t("common.all", { defaultValue: "All" }) },
            { v: "open", l: t("obligations.statusOpen", { defaultValue: "Open" }) },
            { v: "in_progress", l: t("obligations.statusInProgress", { defaultValue: "In progress" }) },
            { v: "overdue", l: t("obligations.statusOverdue", { defaultValue: "Overdue" }) },
            { v: "completed", l: t("obligations.statusCompleted", { defaultValue: "Completed" }) },
          ].map((c) => (
            <button
              key={c.v || "all"}
              type="button"
              onClick={() => setStatus(c.v)}
              className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                status === c.v
                  ? "bg-gold text-ink"
                  : "border border-border bg-surface text-ink-muted hover:border-gold"
              }`}
            >
              {c.l}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-surface" aria-hidden />
          ))}
        </div>
      ) : view === "owe" ? (
        <ObligationList
          items={filteredItems.filter(isOurs)}
          isAr={isAr}
        />
      ) : view === "owed" ? (
        <ObligationList
          items={filteredItems.filter(isTheirs)}
          isAr={isAr}
        />
      ) : view === "list" ? (
        <ObligationList items={filteredItems} isAr={isAr} />
      ) : view === "calendar" ? (
        <CalendarView items={filteredItems} />
      ) : (
        <ReportsView items={items} />
      )}
    </motion.div>
  );
}

function isDueSoon(o: ObligationListItem): boolean {
  if (!o.dueDate) return false;
  if (o.status === "completed" || o.status === "waived") return false;
  const days = (new Date(o.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 30;
}

function KpiCard({
  icon,
  label,
  value,
  accent,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: string;
  tone?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        accent && `border-l-2 ${accent}`,
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
          {label}
        </p>
      </div>
      <p className={cn("mt-1.5 font-mono text-2xl font-semibold", tone ?? "text-ink")}>
        {value}
      </p>
    </div>
  );
}

interface DirectionCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  overdue: number;
  dueSoon: number;
  active: boolean;
  onClick: () => void;
}

function DirectionCard({
  icon,
  title,
  subtitle,
  count,
  overdue,
  dueSoon,
  active,
  onClick,
}: DirectionCardProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg border bg-card p-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        active ? "border-gold" : "border-border hover:border-gold/40",
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
      <p className="mt-3 font-mono text-3xl font-semibold text-ink">{count}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        <span className={overdue > 0 ? "text-terracotta" : "text-ink-subtle"}>
          {t("obligations.overdueN", {
            defaultValue: "{{count}} overdue",
            count: overdue,
          })}
        </span>
        <span className="text-ink-subtle">
          {t("obligations.dueSoonN", {
            defaultValue: "{{count}} due soon",
            count: dueSoon,
          })}
        </span>
      </div>
    </button>
  );
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        active ? "bg-gold/10 text-ink font-medium" : "text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function ObligationList({ items, isAr }: { items: ObligationListItem[]; isAr: boolean }) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <p className="text-sm text-ink-muted">
          {t("obligations.empty", { defaultValue: "No obligations match the filter." })}
        </p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {items.map((o) => {
        const due = o.dueDate ? new Date(o.dueDate) : null;
        const daysUntil = due
          ? Math.floor((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null;
        return (
          <li key={o.id}>
            <Link
              to="/app/contracts/$id"
              params={{ id: String(o.contractId) }}
              className="flex items-start gap-3 p-3 transition hover:bg-surface"
            >
              <span
                className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                  STATUS_TONE[o.status] ?? ""
                }`}
              >
                {o.status === "overdue" && <Zap className="h-3 w-3" />}
                {o.status === "completed" && <CheckCircle2 className="h-3 w-3" />}
                {o.status === "in_progress" && <Clock className="h-3 w-3" />}
                {o.status.replace(/_/g, " ")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                    {o.contractNumber} · {o.obligationType}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-wider",
                      isOurs(o) && !isTheirs(o)
                        ? "text-gold"
                        : isTheirs(o) && !isOurs(o)
                          ? "text-sage"
                          : "text-ink-subtle",
                    )}
                  >
                    {isOurs(o) && !isTheirs(o)
                      ? t("obligations.weOwe.tag", { defaultValue: "we owe" })
                      : isTheirs(o) && !isOurs(o)
                        ? t("obligations.owedToUs.tag", { defaultValue: "owed to us" })
                        : t("obligations.both.tag", { defaultValue: "both" })}
                  </span>
                </div>
                <p className="text-sm text-ink">
                  {isAr && o.titleAr ? o.titleAr : o.titleEn}
                </p>
                {o.descriptionEn && (
                  <p className="mt-0.5 truncate text-xs text-ink-muted">{o.descriptionEn}</p>
                )}
              </div>
              <div className="shrink-0 text-end">
                <p className="font-mono text-xs text-ink">
                  {due ? formatDate(o.dueDate!) : "—"}
                </p>
                {/* L66 — show Hijri date alongside Gregorian (consistent with contracts list). */}
                {due && (
                  <p className="font-mono text-[10px] text-ink-subtle">
                    {formatHijriDate(o.dueDate!)}
                  </p>
                )}
                {daysUntil != null && o.status !== "completed" && (
                  <p
                    className={`mt-0.5 font-mono text-[10px] ${
                      daysUntil < 0
                        ? "text-terracotta"
                        : daysUntil <= 30
                          ? "text-amber-ink"
                          : "text-ink-subtle"
                    }`}
                  >
                    {daysUntil < 0
                      ? `${Math.abs(daysUntil)}d overdue`
                      : `${daysUntil}d to go`}
                  </p>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function CalendarView({ items }: { items: ObligationListItem[] }) {
  const { t } = useTranslation();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const monthLabel = useMemo(
    () =>
      cursor.toLocaleString(undefined, { month: "long", year: "numeric" }),
    [cursor],
  );

  // Group obligations by yyyy-mm-dd for the displayed month.
  const byDay = useMemo(() => {
    const map = new Map<string, ObligationListItem[]>();
    for (const o of items) {
      if (!o.dueDate) continue;
      const d = new Date(o.dueDate);
      if (d.getFullYear() !== cursor.getFullYear() || d.getMonth() !== cursor.getMonth()) continue;
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const arr = map.get(key) ?? [];
      arr.push(o);
      map.set(key, arr);
    }
    return map;
  }, [items, cursor]);

  const firstWeekday = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: Array<{ day: number | null }> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
  while (cells.length % 7 !== 0) cells.push({ day: null });

  const todayStr = new Date();
  const isToday = (d: number) =>
    todayStr.getFullYear() === cursor.getFullYear() &&
    todayStr.getMonth() === cursor.getMonth() &&
    todayStr.getDate() === d;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{monthLabel}</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() =>
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
            }
            className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-ink-muted hover:border-gold"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
            className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-ink-muted hover:border-gold"
          >
            {t("obligations.calendar.today", { defaultValue: "Today" })}
          </button>
          <button
            type="button"
            onClick={() =>
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
            }
            className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-ink-muted hover:border-gold"
          >
            ›
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="px-1 py-1 text-center font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
          >
            {d}
          </div>
        ))}
        {cells.map((cell, idx) => {
          if (!cell.day) {
            return <div key={idx} className="h-20 rounded bg-surface/30" />;
          }
          const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}-${cell.day}`;
          const dayItems = byDay.get(key) ?? [];
          const overdue = dayItems.some((o) => o.status === "overdue");
          return (
            <div
              key={idx}
              className={cn(
                "h-20 rounded-md border bg-surface p-1.5 text-xs",
                isToday(cell.day) ? "border-gold" : "border-border",
              )}
            >
              <div className="flex items-baseline justify-between">
                <span
                  className={cn(
                    "font-mono text-[11px]",
                    isToday(cell.day) ? "text-ink font-semibold" : "text-ink-muted",
                  )}
                >
                  {cell.day}
                </span>
                {dayItems.length > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0 font-mono text-[10px]",
                      overdue ? "bg-terracotta/15 text-terracotta" : "bg-gold/15 text-gold",
                    )}
                  >
                    {dayItems.length}
                  </span>
                )}
              </div>
              <ul className="mt-1 space-y-0.5">
                {dayItems.slice(0, 2).map((o) => (
                  <li
                    key={o.id}
                    className="truncate text-[10px] text-ink-muted"
                    title={o.titleEn}
                  >
                    · {o.titleEn}
                  </li>
                ))}
                {dayItems.length > 2 && (
                  <li className="font-mono text-[10px] text-ink-subtle">
                    +{dayItems.length - 2}
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportsView({ items }: { items: ObligationListItem[] }) {
  const { t } = useTranslation();
  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of items) m.set(o.status, (m.get(o.status) ?? 0) + 1);
    return [...m.entries()];
  }, [items]);
  const byType = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of items) m.set(o.obligationType, (m.get(o.obligationType) ?? 0) + 1);
    return [...m.entries()].sort(([, a], [, b]) => b - a);
  }, [items]);
  const byParty = useMemo(() => {
    let our = 0;
    let cp = 0;
    let both = 0;
    for (const o of items) {
      if (o.responsibleParty === "our_party") our += 1;
      else if (o.responsibleParty === "counterparty") cp += 1;
      else both += 1;
    }
    return { our, cp, both };
  }, [items]);
  const totalForType = byType.reduce((s, [, c]) => s + c, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink">
          {t("obligations.reports.byStatus", { defaultValue: "By status" })}
        </h3>
        <ul className="space-y-2">
          {byStatus.map(([s, c]) => (
            <li key={s}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-ink-muted">{s.replace(/_/g, " ")}</span>
                <span className="font-mono text-ink">{c}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                <div
                  className={cn(
                    "h-full rounded-full",
                    s === "overdue"
                      ? "bg-terracotta"
                      : s === "completed"
                        ? "bg-sage"
                        : "bg-gold",
                  )}
                  style={{
                    width: `${items.length === 0 ? 0 : Math.round((c / items.length) * 100)}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink">
          {t("obligations.reports.byType", { defaultValue: "By type" })}
        </h3>
        <ul className="space-y-2">
          {byType.map(([type, c]) => (
            <li key={type}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-ink-muted">{type.replace(/_/g, " ")}</span>
                <span className="font-mono text-ink">{c}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{
                    width: `${totalForType === 0 ? 0 : Math.round((c / totalForType) * 100)}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 md:col-span-2">
        <h3 className="mb-3 text-sm font-semibold text-ink">
          {t("obligations.reports.byParty", { defaultValue: "By responsible party" })}
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <PartyTile
            label={t("obligations.weOwe.title", { defaultValue: "We owe" })}
            count={byParty.our}
            color="text-gold"
          />
          <PartyTile
            label={t("obligations.owedToUs.title", { defaultValue: "Owed to us" })}
            count={byParty.cp}
            color="text-sage"
          />
          <PartyTile
            label={t("obligations.both.tag", { defaultValue: "Both" })}
            count={byParty.both}
            color="text-ink-muted"
          />
        </div>
      </section>
    </div>
  );
}

function PartyTile({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
        {label}
      </p>
      <p className={cn("mt-1 font-mono text-2xl font-semibold", color)}>{count}</p>
    </div>
  );
}
