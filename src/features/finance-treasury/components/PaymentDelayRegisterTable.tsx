/**
 * Unit-3 / R-FT H2 — Payment Delay Register — real table.
 *
 * Renders a full table of payment delay rows when data is available.
 * Columns: Contract / Counterparty / Invoice Ref / Days Overdue / Amount (AED) / Severity / Actions.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { formatAedCompact, humanizeLabel } from "@/features/dashboards/components/dashboard-primitives";
import { DashboardEmptyState } from "@/features/dashboards/components/dashboard-primitives";

// F9 / F76 — local hook-using badge that pulls the locale-aware
// label via i18n, falling back to humanizeLabel when the key is missing.
function useSeverityLabel(severity: string): string {
  const { t } = useTranslation();
  const key = severity.toLowerCase();
  return t(`common.severity.${key}`, { defaultValue: humanizeLabel(severity) });
}
import {
  RecommendPaymentHoldDialog,
} from "./ActionDialogs";
import type { PaymentDelayRow } from "@/types/entities/crg-dashboards.types";

// F9 / F76 — severity badge displays locale-aware label via i18n.
// Drop `uppercase` class so "HIGH" → "High" (EN) / "عالٍ" (AR).
function SeverityBadge({ severity }: { severity: string }) {
  const label = useSeverityLabel(severity);
  const colorMap: Record<string, string> = {
    critical: "bg-terracotta/20 text-terracotta border-terracotta/30",
    high: "bg-amber/20 text-amber border-amber/30",
    medium: "bg-gold/20 text-ink border-gold/30",
    low: "bg-sage/20 text-sage border-sage/30",
  };
  const cls = colorMap[severity.toLowerCase()] ?? "bg-muted text-ink-muted border-border";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}

interface PaymentDelayRegisterTableProps {
  rows: PaymentDelayRow[];
}

export function PaymentDelayRegisterTable({ rows }: PaymentDelayRegisterTableProps) {
  const { t } = useTranslation();
  const [holdContractId, setHoldContractId] = useState<string | null>(null);
  const [holdOpen, setHoldOpen] = useState(false);

  if (rows.length === 0) {
    return (
      <DashboardEmptyState
        description={t("dashboards.financeTreasury.empty.noPaymentDelays")}
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
              <th scope="col" className="py-2 pe-3 font-medium">
                {t("dashboards.financeTreasury.table.contract")}
              </th>
              <th scope="col" className="py-2 pe-3 font-medium">
                {t("dashboards.financeTreasury.table.counterparty")}
              </th>
              <th scope="col" className="py-2 pe-3 font-medium">
                {t("dashboards.financeTreasury.paymentDelay.invoiceRef")}
              </th>
              <th scope="col" className="py-2 pe-3 font-medium tabular-nums">
                {t("dashboards.financeTreasury.paymentDelay.daysOverdue")}
              </th>
              <th scope="col" className="py-2 pe-3 font-medium tabular-nums">
                {t("dashboards.financeTreasury.paymentDelay.amountAed")}
              </th>
              <th scope="col" className="py-2 pe-3 font-medium">
                {t("dashboards.financeTreasury.table.severity")}
              </th>
              <th scope="col" className="py-2 pe-3 font-medium">
                {t("dashboards.financeTreasury.paymentDelay.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.correlationId} className="border-t border-border/60">
                <td className="py-2 pe-3">
                  <Link
                    to="/app/contracts/$id"
                    params={{ id: row.contractId }}
                    className="font-mono text-xs text-gold hover:underline"
                  >
                    {row.contractNumber}
                  </Link>
                </td>
                <td className="py-2 pe-3 text-ink">{row.counterpartyName}</td>
                <td className="py-2 pe-3 font-mono text-xs text-ink-muted">
                  {row.invoiceRef ?? "—"}
                </td>
                <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                  {row.daysOverdue != null ? `${row.daysOverdue}d` : "—"}
                </td>
                <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                  {formatAedCompact(Number(row.amountAed))}
                </td>
                <td className="py-2 pe-3">
                  <SeverityBadge severity={row.severity} />
                </td>
                <td className="py-2 pe-3">
                  <button
                    type="button"
                    onClick={() => {
                      setHoldContractId(row.contractId);
                      setHoldOpen(true);
                    }}
                    className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-ink hover:border-amber/60 hover:bg-amber/10"
                    aria-label={t("finance.actions.paymentHold.title")}
                  >
                    {t("finance.actions.paymentHold.shortLabel")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RecommendPaymentHoldDialog
        contractId={holdContractId}
        open={holdOpen}
        onClose={() => {
          setHoldOpen(false);
          setHoldContractId(null);
        }}
      />
    </>
  );
}
