/**
 * /app/obligations — Obligations tracker, rebuilt to match the design system
 * locked in for Contracts / Parties / Clauses:
 *   - kicker + H1
 *   - 4-KPI strip
 *   - single filter row (search · direction · type · status chips · count)
 *   - 3 views via tab subnav (List table / Calendar / Reports)
 *
 * Recipient persona still blocked at the route level.
 */
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Zap,
  AlertTriangle,
  CalendarDays,
  BarChart3,
  ListChecks,
  Plus,
  Search,
  Flag,
} from "lucide-react";
import { obligationsService, type ObligationListItem } from "@/services/api/m_parity.service";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { formatDate, formatHijriDate } from "@/utils/datetime";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuthStore, selectHasPermission, readPersistedAuthSnapshot } from "@/store/auth.store";
import { CreateObligationDialog } from "@/features/m_parity/components/CreateEntityDialogs";
import { FlagObligationDialog } from "@/features/obligations/components/FlagObligationDialog";
import { humanizeLabel } from "@/features/dashboards/components/dashboard-primitives";

export const Route = createFileRoute("/app/obligations")({
  beforeLoad: () => {
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

type ViewMode = "list" | "calendar" | "reports";
type Direction = "all" | "we_owe" | "owed_to_us";

function isOurs(o: ObligationListItem): boolean {
  return o.responsibleParty === "our_party" || o.responsibleParty === "both";
}
function isTheirs(o: ObligationListItem): boolean {
  return o.responsibleParty === "counterparty" || o.responsibleParty === "both";
}
function isDueSoon(o: ObligationListItem): boolean {
  if (!o.dueDate) return false;
  if (o.status === "completed" || o.status === "waived") return false;
  const days = (new Date(o.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 30;
}

function ObligationsView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const [view, setView] = useState<ViewMode>("list");
  const [direction, setDirection] = useState<Direction>("all");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [flagTarget, setFlagTarget] = useState<ObligationListItem | null>(null);
  const canCreate = useAuthStore(selectHasPermission("contract.edit"));
  const canFlag = useAuthStore(selectHasPermission("obligation.flag"));
  const debounced = useDebounce(search, 300);

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

  const typeOptions = useMemo(
    () => Array.from(new Set(items.map((o) => o.obligationType))).sort(),
    [items],
  );

  const filteredItems = useMemo(() => {
    let out = items;
    if (direction === "we_owe") out = out.filter(isOurs);
    if (direction === "owed_to_us") out = out.filter(isTheirs);
    if (type) out = out.filter((o) => o.obligationType === type);
    if (debounced) {
      const q = debounced.toLowerCase();
      out = out.filter(
        (o) =>
          o.titleEn.toLowerCase().includes(q) ||
          o.contractNumber.toLowerCase().includes(q) ||
          (o.descriptionEn?.toLowerCase().includes(q) ?? false),
      );
    }
    return out;
  }, [items, direction, type, debounced]);

  const stats = useMemo(() => {
    const total = items.length;
    const overdue = items.filter((o) => o.status === "overdue").length;
    const dueSoon = items.filter(isDueSoon).length;
    const completed = items.filter((o) => o.status === "completed").length;
    return { total, overdue, dueSoon, completed };
  }, [items]);

  // Client-side pagination — mirrors the parties pattern. The list endpoint
  // returns up to 500 rows; the table only renders the current 25-row slice.
  const PAGE_SIZE = 25;
  const [currentPage, setCurrentPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredItems.length, debounced, direction, type, status, view]);
  const pagedItems = useMemo(
    () => filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredItems, currentPage],
  );

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
            {t("obligations.title", { defaultValue: "Obligations" })}
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
      <FlagObligationDialog
        open={flagTarget !== null}
        obligation={flagTarget}
        onClose={() => setFlagTarget(null)}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<CalendarClock className="h-4 w-4 text-gold" />}
          label={t("obligations.stats.total", { defaultValue: "Total tracked" })}
          value={stats.total}
        />
        <KpiCard
          icon={
            <Zap
              className={`h-4 w-4 ${stats.overdue > 0 ? "text-terracotta" : "text-ink-subtle"}`}
            />
          }
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

      {/* View tabs */}
      <div role="tablist" className="flex gap-1 border-b border-border">
        <ViewTab active={view === "list"} onClick={() => setView("list")}>
          <ListChecks className="me-1.5 h-3.5 w-3.5" />
          {t("obligations.views.list", { defaultValue: "List" })}
        </ViewTab>
        <ViewTab active={view === "calendar"} onClick={() => setView("calendar")}>
          <CalendarDays className="me-1.5 h-3.5 w-3.5" />
          {t("obligations.views.calendar", { defaultValue: "Calendar" })}
        </ViewTab>
        <ViewTab active={view === "reports"} onClick={() => setView("reports")}>
          <BarChart3 className="me-1.5 h-3.5 w-3.5" />
          {t("obligations.views.breakdown", { defaultValue: "Breakdown" })}
        </ViewTab>
      </div>

      {/* Filter row — only shown for list + calendar views (Reports uses
          the unfiltered universe). */}
      {view !== "reports" && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("obligations.searchPlaceholder", {
                defaultValue: "Search by title or contract #…",
              })}
              className="ps-9"
            />
          </div>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as Direction)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label={t("obligations.filter.responsibility", {
              defaultValue: "Responsibility",
            })}
          >
            <option value="all">
              {t("obligations.filter.allResponsibility", {
                defaultValue: "All responsibilities",
              })}
            </option>
            <option value="we_owe">
              {t("obligations.weOwe.tag", { defaultValue: "We owe" })}
            </option>
            <option value="owed_to_us">
              {t("obligations.owedToUs.tag", { defaultValue: "Owed to us" })}
            </option>
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label={t("obligations.filter.type", { defaultValue: "Type" })}
          >
            <option value="">
              {t("obligations.filter.allTypes", { defaultValue: "All types" })}
            </option>
            {typeOptions.map((o) => (
              <option key={o} value={o}>
                {humanizeLabel(o)}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label={t("obligations.filter.status", { defaultValue: "Status" })}
          >
            <option value="">
              {t("obligations.filter.allStatuses", { defaultValue: "All statuses" })}
            </option>
            <option value="open">
              {t("obligations.statusOpen", { defaultValue: "Open" })}
            </option>
            <option value="in_progress">
              {t("obligations.statusInProgress", { defaultValue: "In progress" })}
            </option>
            <option value="overdue">
              {t("obligations.statusOverdue", { defaultValue: "Overdue" })}
            </option>
            <option value="completed">
              {t("obligations.statusCompleted", { defaultValue: "Completed" })}
            </option>
          </select>
          <span className="ms-auto font-mono text-[11px] text-ink-subtle">
            {t("obligations.resultCount", {
              defaultValue: "{{count}} of {{total}} shown",
              count: filteredItems.length,
              total: items.length,
            })}
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-surface" aria-hidden />
          ))}
        </div>
      ) : view === "list" ? (
        <>
          <ObligationTable
            items={pagedItems}
            isAr={isAr}
            canFlag={canFlag}
            onFlag={(o) => setFlagTarget(o)}
          />
          {filteredItems.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-ink-muted">
                {t("obligations.pagination.showing", {
                  defaultValue: "Showing {{from}}-{{to}} of {{total}}",
                  from: (currentPage - 1) * PAGE_SIZE + 1,
                  to: Math.min(currentPage * PAGE_SIZE, filteredItems.length),
                  total: filteredItems.length,
                })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  {t("common.back", { defaultValue: "Back" })}
                </Button>
                <span className="font-mono text-xs text-ink-muted">
                  {currentPage} / {pageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                  disabled={currentPage >= pageCount}
                >
                  {t("common.next", { defaultValue: "Next" })}
                </Button>
              </div>
            </div>
          )}
        </>
      ) : view === "calendar" ? (
        <CalendarView items={filteredItems} />
      ) : (
        <ReportsView items={items} />
      )}
    </motion.div>
  );
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
        "inline-flex items-center border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        active
          ? "border-gold text-ink"
          : "border-transparent text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function DirectionTag({ o }: { o: ObligationListItem }) {
  const { t } = useTranslation();
  const ours = isOurs(o);
  const theirs = isTheirs(o);
  const both = ours && theirs;
  const label = both
    ? t("obligations.both.tag", { defaultValue: "Both" })
    : ours
      ? t("obligations.weOwe.tag", { defaultValue: "We owe" })
      : t("obligations.owedToUs.tag", { defaultValue: "Owed to us" });
  const cls = both
    ? "bg-surface text-ink-muted"
    : ours
      ? "bg-gold/10 text-gold"
      : "bg-sage/10 text-sage";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        cls,
      )}
    >
      {label}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        STATUS_TONE[status] ?? "bg-surface text-ink-muted",
      )}
    >
      {status === "overdue" && <Zap className="h-3 w-3" />}
      {status === "completed" && <CheckCircle2 className="h-3 w-3" />}
      {status === "in_progress" && <Clock className="h-3 w-3" />}
      {humanizeLabel(status)}
    </span>
  );
}

function ObligationTable({
  items,
  isAr,
  canFlag,
  onFlag,
}: {
  items: ObligationListItem[];
  isAr: boolean;
  canFlag: boolean;
  onFlag: (o: ObligationListItem) => void;
}) {
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
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-surface text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
          <tr>
            <th scope="col" className="py-2 ps-3 text-start">
              {t("obligations.col.contract", { defaultValue: "Contract" })}
            </th>
            <th scope="col" className="py-2 text-start">
              {t("obligations.col.title", { defaultValue: "Obligation" })}
            </th>
            <th scope="col" className="py-2 text-start">
              {t("obligations.col.status", { defaultValue: "Status" })}
            </th>
            <th scope="col" className="py-2 text-start">
              {t("obligations.col.type", { defaultValue: "Type" })}
            </th>
            <th scope="col" className="py-2 text-start">
              {t("obligations.col.responsibility", { defaultValue: "Responsibility" })}
            </th>
            <th scope="col" className="py-2 text-end">
              {t("obligations.col.due", { defaultValue: "Due" })}
            </th>
            {canFlag && (
              <th scope="col" className="py-2 pe-3 text-end">
                <span className="sr-only">
                  {t("obligations.col.action", { defaultValue: "Action" })}
                </span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((o) => {
            const due = o.dueDate ? new Date(o.dueDate) : null;
            const daysUntil = due
              ? Math.floor((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;
            return (
              <tr
                key={o.id}
                className="border-b border-border/50 transition-colors hover:bg-surface/50"
              >
                <td className="py-2 ps-3">
                  <Link
                    to="/app/contracts/$id"
                    params={{ id: String(o.contractId) }}
                    className="font-mono text-[11px] text-ink hover:underline"
                  >
                    {o.contractNumber}
                  </Link>
                </td>
                <td className="max-w-[340px] py-2 pe-3">
                  <p className="line-clamp-2 font-medium text-ink">
                    {isAr && o.titleAr ? o.titleAr : o.titleEn}
                  </p>
                  {o.descriptionEn && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                      {o.descriptionEn}
                    </p>
                  )}
                </td>
                <td className="py-2">
                  <StatusChip status={o.status} />
                  {o.flaggedAt && (
                    <span
                      className="mt-1 inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-terracotta"
                      title={
                        (o.flaggedByName ? "Flagged by " + o.flaggedByName + " · " : "") +
                        (o.flaggedAt.slice(0, 10) ?? "")
                      }
                    >
                      <Flag className="h-2.5 w-2.5" />
                      {t("obligations.flaggedBadge", { defaultValue: "Flagged" })}
                    </span>
                  )}
                </td>
                <td className="py-2">
                  <span className="inline-flex items-center rounded-md bg-surface px-2 py-0.5 font-mono text-[10px] tracking-wider text-ink-muted">
                    {humanizeLabel(o.obligationType)}
                  </span>
                </td>
                <td className="py-2">
                  <DirectionTag o={o} />
                </td>
                <td className="py-2 text-end">
                  <p className="font-mono text-xs text-ink">
                    {due ? formatDate(o.dueDate!) : "—"}
                  </p>
                  {due && (
                    <p className="font-mono text-[10px] text-ink-subtle">
                      {formatHijriDate(o.dueDate!)}
                    </p>
                  )}
                  {daysUntil != null && o.status !== "completed" && (
                    <p
                      className={cn(
                        "mt-0.5 font-mono text-[10px]",
                        daysUntil < 0
                          ? "text-terracotta"
                          : daysUntil <= 30
                            ? "text-amber-ink"
                            : "text-ink-subtle",
                      )}
                    >
                      {daysUntil < 0
                        ? t("obligations.daysOverdue", {
                            defaultValue: "{{n}}d overdue",
                            n: Math.abs(daysUntil),
                          })
                        : t("obligations.daysToGo", {
                            defaultValue: "{{n}}d to go",
                            n: daysUntil,
                          })}
                    </p>
                  )}
                </td>
                {canFlag && (
                  <td className="py-2 pe-3 text-end">
                    {o.status !== "completed" && o.status !== "waived" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onFlag(o)}
                        aria-label={t("obligations.flag.cta", {
                          defaultValue: "Flag for action",
                        })}
                      >
                        <Flag className="h-3.5 w-3.5" />
                        <span className="ms-1 hidden text-xs lg:inline">
                          {t("obligations.flag.cta", {
                            defaultValue: "Flag",
                          })}
                        </span>
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CalendarView({ items }: { items: ObligationListItem[] }) {
  const { t } = useTranslation();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const monthLabel = useMemo(
    () => cursor.toLocaleString(undefined, { month: "long", year: "numeric" }),
    [cursor],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, ObligationListItem[]>();
    for (const o of items) {
      if (!o.dueDate) continue;
      const d = new Date(o.dueDate);
      if (d.getFullYear() !== cursor.getFullYear() || d.getMonth() !== cursor.getMonth())
        continue;
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

  const todayDate = new Date();
  const isToday = (d: number) =>
    todayDate.getFullYear() === cursor.getFullYear() &&
    todayDate.getMonth() === cursor.getMonth() &&
    todayDate.getDate() === d;

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
            onClick={() =>
              setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
            }
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
                      overdue
                        ? "bg-terracotta/15 text-terracotta"
                        : "bg-gold/15 text-gold",
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
                <span className="text-ink-muted">{humanizeLabel(s)}</span>
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
                <span className="text-ink-muted">{humanizeLabel(type)}</span>
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

function PartyTile({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
        {label}
      </p>
      <p className={cn("mt-1 font-mono text-2xl font-semibold", color)}>{count}</p>
    </div>
  );
}
