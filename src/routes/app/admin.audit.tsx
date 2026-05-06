import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ScrollText, AlertCircle } from "lucide-react";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { useLegalCounselDashboard } from "@/features/dashboards/hooks/useDashboards";
import { formatNumber } from "@/features/dashboards/components/dashboard-primitives";

export const Route = createFileRoute("/app/admin/audit")({
  component: () => (
    <ErrorBoundary>
      <AdminAuditView />
    </ErrorBoundary>
  ),
});

function AdminAuditView() {
  const { t } = useTranslation();
  // The fn_dashboard_legal_counsel.auditSummary returns audit-event counts
  // keyed by table_name (NULL when caller lacks audit.read). Super Admin /
  // platform_admin both hold audit.read by default — Q3 lock.
  const { data, isLoading, isError } = useLegalCounselDashboard({ windowDays: 30 });

  const auditSummary = data?.kpis.auditSummary ?? null;
  const totalEvents = auditSummary
    ? Object.values(auditSummary).reduce((s, v) => s + v, 0)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("admin.audit.title", { defaultValue: "Audit log" })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("admin.audit.subtitle", {
            defaultValue:
              "Audit-event counts by table over the last 30 days. Detailed log viewer with filtering coming in a follow-up.",
          })}
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-surface" aria-hidden />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-md border border-terracotta/30 bg-terracotta/5 p-4 text-sm text-terracotta">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            {t("admin.audit.loadFailed", { defaultValue: "Failed to load audit summary." })}
          </div>
        </div>
      ) : !auditSummary ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t("admin.audit.permissionDenied", {
              defaultValue:
                "You don't have the audit.read permission to view audit summaries.",
            })}
          </p>
        </div>
      ) : (
        <>
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-gold" />
              <h2 className="text-sm font-semibold text-ink">
                {t("admin.audit.totalEvents", { defaultValue: "Total events (30d)" })}
              </h2>
            </div>
            <p className="font-mono text-3xl font-semibold text-ink">
              {formatNumber(totalEvents)}
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">
              {t("admin.audit.byTable", { defaultValue: "By table" })}
            </h2>
            {Object.keys(auditSummary).length === 0 ? (
              <p className="py-4 text-center text-xs text-ink-subtle">
                {t("admin.audit.empty", { defaultValue: "No events in the window." })}
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(auditSummary)
                  .sort((a, b) => b[1] - a[1])
                  .map(([tableName, count]) => {
                    const max = Math.max(...Object.values(auditSummary), 1);
                    const pct = (count / max) * 100;
                    return (
                      <li
                        key={tableName}
                        className="rounded-md border border-border bg-surface p-3"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-mono text-xs text-ink-subtle">
                            {tableName}
                          </span>
                          <span className="font-mono text-base font-semibold tabular-nums text-ink">
                            {formatNumber(count)}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full bg-gold transition-all"
                            style={{ width: `${pct}%` }}
                            aria-hidden
                          />
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </section>
        </>
      )}
    </motion.div>
  );
}
