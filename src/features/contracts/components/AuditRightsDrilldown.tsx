/**
 * Unit-3 / R-CES H5 — Audit Rights Drilldown.
 *
 * Standalone component that fetches and renders audit-rights clauses
 * for a given contract. Can be used as a tab panel inside ContractDetail
 * or as a page-level surface.
 *
 * GET /api/v1/contracts/:contractId/audit-rights
 * Perm: contract.read
 */
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";
import {
  DashboardLoadingSkeleton,
  DashboardErrorState,
  DashboardEmptyState,
} from "@/features/dashboards/components/dashboard-primitives";
import { formatDateTime } from "@/utils/datetime";
import { personaActionsService } from "@/services/api/persona-actions.service";

function SeverityBadge({ severity }: { severity: string }) {
  const colorMap: Record<string, string> = {
    critical: "bg-terracotta/20 text-terracotta border-terracotta/30",
    high: "bg-amber/20 text-amber border-amber/30",
    medium: "bg-gold/20 text-ink border-gold/30",
    low: "bg-sage/20 text-sage border-sage/30",
  };
  const cls = colorMap[severity.toLowerCase()] ?? "bg-muted text-ink-muted border-border";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls}`}
    >
      {severity}
    </span>
  );
}

interface AuditRightsDrilldownProps {
  contractId: string;
}

export function AuditRightsDrilldown({ contractId }: AuditRightsDrilldownProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["audit-rights", contractId],
    queryFn: () => personaActionsService.getAuditRights(contractId),
    enabled: !!contractId,
  });

  if (isLoading) return <DashboardLoadingSkeleton rows={1} />;
  if (isError) {
    return (
      <DashboardErrorState
        error={error}
        onRetry={() => void refetch()}
        fallbackKey="audit.rights.drilldown.loadFailed"
      />
    );
  }
  if (!data || data.auditRightsClauses.length === 0) {
    return (
      <DashboardEmptyState
        description={t("audit.rights.drilldown.empty")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-sage" aria-hidden />
        <h3 className="text-sm font-semibold text-ink">
          {t("audit.rights.drilldown.title")}
        </h3>
        <span className="ms-auto font-mono text-xs text-ink-muted">
          {data.count} {t("audit.rights.drilldown.clauseCount")}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
              <th scope="col" className="py-2 pe-3 font-medium">
                {t("audit.rights.drilldown.table.clauseType")}
              </th>
              <th scope="col" className="py-2 pe-3 font-medium">
                {t("audit.rights.drilldown.table.scope")}
              </th>
              <th scope="col" className="py-2 pe-3 font-medium">
                {t("audit.rights.drilldown.table.frequency")}
              </th>
              <th scope="col" className="py-2 pe-3 font-medium tabular-nums">
                {t("audit.rights.drilldown.table.dateRange")}
              </th>
              <th scope="col" className="py-2 pe-3 font-medium tabular-nums">
                {t("audit.rights.drilldown.table.daysToExpiry")}
              </th>
              <th scope="col" className="py-2 pe-3 font-medium">
                {t("audit.rights.drilldown.table.severity")}
              </th>
              <th scope="col" className="py-2 pe-3 font-medium">
                {t("audit.rights.drilldown.table.summary")}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.auditRightsClauses.map((clause) => (
              <tr key={clause.clauseId} className="border-t border-border/60 align-top">
                <td className="py-2 pe-3">
                  <span className="inline-flex rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-ink-muted">
                    {clause.clauseType}
                  </span>
                </td>
                <td className="py-2 pe-3 text-xs text-ink-muted max-w-[120px] truncate">
                  {clause.parameters.scope ?? "—"}
                </td>
                <td className="py-2 pe-3 text-xs text-ink-muted">
                  {clause.parameters.frequency ?? "—"}
                </td>
                <td className="py-2 pe-3 text-xs text-ink-muted whitespace-nowrap">
                  {clause.parameters.startDate
                    ? formatDateTime(clause.parameters.startDate, { showTime: false })
                    : "—"}{" "}
                  →{" "}
                  {clause.parameters.endDate
                    ? formatDateTime(clause.parameters.endDate, { showTime: false })
                    : "—"}
                </td>
                <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                  {clause.daysToExpiry != null ? `${clause.daysToExpiry}d` : "—"}
                </td>
                <td className="py-2 pe-3">
                  <SeverityBadge severity={clause.severity} />
                </td>
                <td className="py-2 pe-3 text-xs text-ink max-w-xs">
                  {isAr && clause.summaryAr ? clause.summaryAr : clause.summaryEn}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
