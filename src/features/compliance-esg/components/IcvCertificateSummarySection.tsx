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
                    {item.validUntil
                      ? formatDateTime(item.validUntil, { showTime: false })
                      : "—"}
                  </td>
                  <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                    {item.daysToExpiry != null ? `${item.daysToExpiry}d` : "—"}
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
