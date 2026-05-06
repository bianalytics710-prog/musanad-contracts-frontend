import { createFileRoute, Link } from "@tanstack/react-router";
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
} from "lucide-react";
import { obligationsService } from "@/services/api/m_parity.service";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { formatDate } from "@/utils/datetime";

export const Route = createFileRoute("/app/obligations")({
  component: () => (
    <ErrorBoundary>
      <ObligationsListView />
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

function ObligationsListView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["obligations", status],
    queryFn: () =>
      obligationsService.list({
        status: status || undefined,
        limit: 200,
      }),
    staleTime: 60_000,
  });

  const items = data?.data ?? [];

  const stats = useMemo(() => {
    const total = items.length;
    const overdue = items.filter((o) => o.status === "overdue").length;
    const dueSoon = items.filter((o) => {
      if (!o.dueDate || o.status === "completed") return false;
      const days =
        (new Date(o.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 30;
    }).length;
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
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("obligations.title", { defaultValue: "Obligations tracker" })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("obligations.subtitle", {
            defaultValue:
              "Per-contract payment, delivery, reporting, and compliance commitments.",
          })}
        </p>
      </header>

      {/* Stat strip */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-gold" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("obligations.stats.total", { defaultValue: "Total tracked" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {stats.total}
          </p>
        </div>
        <div className={`rounded-lg border border-border bg-card p-4 ${stats.overdue > 0 ? "border-l-2 border-l-terracotta" : ""}`}>
          <div className="flex items-center gap-2">
            <Zap className={`h-4 w-4 ${stats.overdue > 0 ? "text-terracotta" : "text-ink-subtle"}`} />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("obligations.stats.overdue", { defaultValue: "Overdue" })}
            </p>
          </div>
          <p className={`mt-1.5 font-mono text-2xl font-semibold ${stats.overdue > 0 ? "text-terracotta" : "text-ink"}`}>
            {stats.overdue}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-ink" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("obligations.stats.dueSoon", { defaultValue: "Due in 30 days" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {stats.dueSoon}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-sage" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("obligations.stats.completed", { defaultValue: "Completed" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {stats.completed}
          </p>
        </div>
      </section>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-3">
        {[
          { v: "", l: t("common.all", { defaultValue: "All" }) },
          { v: "open", l: t("obligations.statusOpen", { defaultValue: "Open" }) },
          { v: "in_progress", l: t("obligations.statusInProgress", { defaultValue: "In progress" }) },
          { v: "overdue", l: t("obligations.statusOverdue", { defaultValue: "Overdue" }) },
          { v: "completed", l: t("obligations.statusCompleted", { defaultValue: "Completed" }) },
          { v: "waived", l: t("obligations.statusWaived", { defaultValue: "Waived" }) },
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

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-surface" aria-hidden />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t("obligations.empty", { defaultValue: "No obligations match the filter." })}
          </p>
        </div>
      ) : (
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
                    </div>
                    <p className="text-sm text-ink">
                      {isAr && o.titleAr ? o.titleAr : o.titleEn}
                    </p>
                    {o.descriptionEn && (
                      <p className="mt-0.5 truncate text-xs text-ink-muted">
                        {o.descriptionEn}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="font-mono text-xs text-ink">
                      {due ? formatDate(o.dueDate!) : "—"}
                    </p>
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
      )}
    </motion.div>
  );
}
