/**
 * Unit-3 / R-CES H3 — ICV Certificate Summary Section.
 *
 * Renders 4 KPI tiles (up-to-date / expiring-within-90d / expired / missing)
 * plus a list of up to 10 contracts with their ICV status.
 *
 * Data shape: icvCertificateSummary from fn_dashboard_compliance_esg extension.
 */
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import {
  KpiTile,
  DashboardEmptyState,
} from "@/features/dashboards/components/dashboard-primitives";
import { formatDateTime } from "@/utils/datetime";
// K7 fix — donut visualisation of the 4 ICV status buckets so the 87%-missing
// proportion lands instantly rather than being hidden in equal-size tiles.
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface IcvItem {
  contractId: string;
  contractNumber: string;
  counterpartyName: string;
  validUntil: string | null;
  daysToExpiry: number | null;
  status: "upToDate" | "expiringWithin90d" | "expired" | "missing";
}

export interface IcvCertificateSummaryData {
  upToDate: number;
  expiringWithin90d: number;
  expired: number;
  missing: number;
  totalContractsScoped: number;
  list: IcvItem[];
}

interface IcvCertificateSummarySectionProps {
  data: IcvCertificateSummaryData;
  onUpload: (contractId: string) => void;
}

type IcvStatus = "upToDate" | "expiringWithin90d" | "expired" | "missing";

const VALID_ICV_STATUSES: ReadonlySet<string> = new Set<IcvStatus>([
  "upToDate",
  "expiringWithin90d",
  "expired",
  "missing",
]);

/**
 * Resolves a safe ICV status from the item, deriving one from validUntil /
 * daysToExpiry when item.status is missing or unexpected.
 */
function resolveIcvStatus(item: IcvItem): IcvStatus {
  if (item.status && VALID_ICV_STATUSES.has(item.status)) {
    return item.status;
  }
  if (item.validUntil == null) return "missing";
  if (item.daysToExpiry != null && item.daysToExpiry < 0) return "expired";
  if (item.daysToExpiry != null && item.daysToExpiry <= 90) return "expiringWithin90d";
  return "upToDate";
}

function icvStatusClass(status: string): string {
  switch (status) {
    case "upToDate":
      return "bg-sage/20 text-sage border-sage/30";
    case "expiringWithin90d":
      return "bg-amber/20 text-amber border-amber/30";
    case "expired":
      return "bg-terracotta/20 text-terracotta border-terracotta/30";
    case "missing":
      return "bg-muted text-ink-muted border-border";
    default:
      return "bg-muted text-ink-muted border-border";
  }
}

export function IcvCertificateSummarySection({
  data,
  onUpload,
}: IcvCertificateSummarySectionProps) {
  const { t } = useTranslation();

  if (data.totalContractsScoped === 0) {
    return (
      <DashboardEmptyState
        description={t("dashboards.complianceEsg.icvCertificateSummary.empty")}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label={t("dashboards.complianceEsg.icvCertificateSummary.upToDate")}
          value={String(data.upToDate)}
          variant="success"
        />
        <KpiTile
          label={t("dashboards.complianceEsg.icvCertificateSummary.expiringWithin90d")}
          value={String(data.expiringWithin90d)}
          variant={data.expiringWithin90d > 0 ? "warning" : "default"}
        />
        <KpiTile
          label={t("dashboards.complianceEsg.icvCertificateSummary.expired")}
          value={String(data.expired)}
          variant={data.expired > 0 ? "risk" : "default"}
        />
        <KpiTile
          label={t("dashboards.complianceEsg.icvCertificateSummary.missing")}
          value={String(data.missing)}
          variant={data.missing > 0 ? "warning" : "default"}
        />
      </div>

      {/* K7 fix — donut chart so the 87%-missing proportion lands. */}
      {(() => {
        const donutData = [
          { key: "upToDate", count: data.upToDate, fill: "var(--color-chart-2)" },
          { key: "expiringWithin90d", count: data.expiringWithin90d, fill: "var(--color-chart-1)" },
          { key: "expired", count: data.expired, fill: "var(--color-chart-4)" },
          { key: "missing", count: data.missing, fill: "var(--color-ink-muted)" },
        ].filter((d) => d.count > 0);
        const total = donutData.reduce((s, d) => s + d.count, 0);
        if (total === 0) return null;
        return (
          <div
            className="h-[200px] rounded-lg border border-border bg-card p-3"
            aria-label={t("dashboards.complianceEsg.icvCertificateSummary.donutLabel", {
              defaultValue: "ICV certificate status distribution",
            })}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="count"
                  nameKey="key"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {donutData.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name) => {
                    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
                    return [
                      `${value} (${pct}%)`,
                      t(`dashboards.complianceEsg.icvCertificateSummary.${name}`, {
                        defaultValue: String(name),
                      }),
                    ];
                  }}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  formatter={(value) => (
                    <span className="text-xs text-ink-muted">
                      {t(`dashboards.complianceEsg.icvCertificateSummary.${value}`, {
                        defaultValue: String(value),
                      })}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      {/* Contract list */}
      {data.list.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
                <th scope="col" className="py-2 pe-3 font-medium">
                  {t("dashboards.complianceEsg.table.contract")}
                </th>
                <th scope="col" className="py-2 pe-3 font-medium">
                  {t("dashboards.complianceEsg.table.counterparty")}
                </th>
                <th scope="col" className="py-2 pe-3 font-medium">
                  {t("dashboards.complianceEsg.icvCertificateSummary.validUntil")}
                </th>
                <th scope="col" className="py-2 pe-3 font-medium tabular-nums">
                  {t("dashboards.complianceEsg.icvCertificateSummary.daysToExpiry")}
                </th>
                <th scope="col" className="py-2 pe-3 font-medium">
                  {t("dashboards.complianceEsg.icvCertificateSummary.status")}
                </th>
                <th scope="col" className="py-2 pe-3 font-medium">
                  {t("dashboards.complianceEsg.icvCertificateSummary.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.list.slice(0, 10).map((item) => {
                const resolvedStatus = resolveIcvStatus(item);
                return (
                <tr key={item.contractId} className="border-t border-border/60">
                  <td className="py-2 pe-3">
                    <Link
                      to="/app/contracts/$id"
                      params={{ id: item.contractId }}
                      className="font-mono text-xs text-gold hover:underline"
                    >
                      {item.contractNumber}
                    </Link>
                  </td>
                  <td className="py-2 pe-3 text-ink">{item.counterpartyName}</td>
                  <td className="py-2 pe-3 text-xs text-ink-muted">
                    {/* K8 fix — surface "Never uploaded" copy for missing
                        certificates instead of a lonely em-dash. */}
                    {item.validUntil
                      ? formatDateTime(item.validUntil, { showTime: false })
                      : t("dashboards.complianceEsg.icvCertificateSummary.neverUploaded", { defaultValue: "Never uploaded" })}
                  </td>
                  <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                    {/* K6 fix — negative integers like "-700d" read as
                        broken to a non-technical reviewer. Render expired
                        certificates as "Expired Nd ago"; only show the bare
                        "Nd" form for future-dated certificates. */}
                    {item.daysToExpiry == null
                      ? "—"
                      : item.daysToExpiry < 0
                        ? t("dashboards.complianceEsg.icvCertificateSummary.expiredDaysAgo", {
                            days: Math.abs(item.daysToExpiry),
                            defaultValue: `Expired ${Math.abs(item.daysToExpiry)}d ago`,
                          })
                        : `${item.daysToExpiry}d`}
                  </td>
                  <td className="py-2 pe-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${icvStatusClass(resolvedStatus)}`}
                    >
                      {t(`dashboards.complianceEsg.icvCertificateSummary.statusLabel.${resolvedStatus}`)}
                    </span>
                  </td>
                  <td className="py-2 pe-3">
                    {(resolvedStatus === "missing" || resolvedStatus === "expired") && (
                      <button
                        type="button"
                        onClick={() => onUpload(item.contractId)}
                        className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-ink hover:border-gold/60 hover:bg-gold/10"
                        aria-label={t("compliance.actions.icvUpload.uploadButtonAriaLabel", {
                          contract: item.contractNumber,
                        })}
                      >
                        {t("compliance.actions.icvUpload.uploadButton")}
                      </button>
                    )}
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
