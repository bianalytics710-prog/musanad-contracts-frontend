/**
 * R-EX2 — Executive dashboard list sections (Lovable parity).
 *
 *   1. HighRiskContractsCard       — top 8 by ai_risk_score
 *   2. MostUsedTemplatesCard       — top 8 templates (90d usage)
 *   3. MostAmendedContractsCard    — top 5 by current_version
 *
 * Each card consumes a slice of `ExecutiveDashboardLists` (from
 * fn_dashboard_executive migration 091).
 */
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, FileStack, History } from "lucide-react";
import type {
  ExecutiveAmendedContractRow,
  ExecutiveDashboardLists,
  ExecutiveHighRiskRow,
  ExecutiveTemplateUsageRow,
} from "@/types/entities/dashboards.types";
import { formatAedCompact, formatNumber } from "./dashboard-primitives";
import { RiskTypePill, type RiskTypeSlug } from "@/components/risk/RiskTypePill";

// ─── 1. High-risk contracts ─────────────────────────────────────────────────

/**
 * Row shape accepted by HighRiskContractsCard. Extends the legacy
 * highRiskContracts8 slice (id / contractNumber / titleEn / titleAr /
 * valueAed / riskScore) with the two columns sourced from the side-car
 * fn (mig 560): counterpartyName + riskType. Both are nullable — when
 * the side-car query hasn't returned (or the contract has no counterparty
 * / no open risk_case) we render an em-dash for counterparty and the
 * neutral "other" pill for risk type.
 */
export interface HighRiskContractRow extends ExecutiveHighRiskRow {
  counterpartyName?: string | null;
  riskType?: RiskTypeSlug | null;
}

export function HighRiskContractsCard({ rows }: { rows: HighRiskContractRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <AlertTriangle className="h-4 w-4 text-terracotta" />
          {t("dashboards.executive.lists.highRisk.title", {
            defaultValue: "High-risk contracts",
          })}
        </h3>
        <Link
          to="/app/contracts"
          search={{ risk: "flagged", sort: "risk" } as never}
          className="text-xs text-ink-subtle hover:text-ink"
        >
          {t("dashboards.executive.lists.highRisk.viewAll", {
            defaultValue: "View all flagged contracts →",
          })}
        </Link>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-muted">
              <th scope="col" className="py-2 pr-4 font-medium">
                {t("dashboards.executive.lists.highRisk.col.contract", {
                  defaultValue: "Contract",
                })}
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                {t("dashboards.executive.lists.highRisk.col.counterparty", {
                  defaultValue: "Counterparty",
                })}
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                {t("dashboards.executive.lists.highRisk.col.riskType", {
                  defaultValue: "Risk type",
                })}
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                {t("dashboards.executive.lists.highRisk.col.valueAed", {
                  defaultValue: "Value (AED)",
                })}
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                {t("dashboards.executive.lists.highRisk.col.riskScore", {
                  defaultValue: "Risk score",
                })}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border/40 last:border-0 hover:bg-surface/50"
              >
                <td className="py-2 pr-4 align-top">
                  <Link
                    to="/app/contracts/$id"
                    params={{ id: String(r.id) }}
                    className="block min-w-0"
                  >
                    <div className="font-mono text-xs text-ink-muted hover:underline">
                      {r.contractNumber}
                    </div>
                    <div className="truncate text-sm text-ink hover:underline">
                      {r.titleEn ?? r.titleAr ?? r.contractNumber}
                    </div>
                  </Link>
                </td>
                <td className="py-2 pr-4 align-top text-ink">
                  {r.counterpartyName ?? (
                    <span className="text-ink-subtle">—</span>
                  )}
                </td>
                <td className="py-2 pr-4 align-top">
                  <RiskTypePill type={r.riskType ?? null} />
                </td>
                <td className="py-2 pr-4 text-right align-top font-mono text-ink-muted">
                  {formatAedCompact(r.valueAed)}
                </td>
                <td className="py-2 text-right align-top">
                  <span className="rounded-md bg-terracotta/10 px-2 py-0.5 font-mono text-xs text-terracotta">
                    {r.riskScore ?? "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── 2. Most-used templates ─────────────────────────────────────────────────

export function MostUsedTemplatesCard({ rows }: { rows: ExecutiveTemplateUsageRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.usageCount), 1);
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-1 flex items-center gap-2">
        <FileStack className="h-4 w-4 text-gold" />
        <h3 className="text-sm font-semibold text-ink">
          {t("dashboards.executive.lists.mostUsedTemplates.title", {
            defaultValue: "Most-used templates",
          })}
        </h3>
      </header>
      <p className="mb-3 text-xs text-ink-subtle">
        {t("dashboards.executive.lists.mostUsedTemplates.subtitle", {
          defaultValue: "Uses (last 90 days)",
        })}
      </p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.templateId}
            className="flex items-center justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-ink">
                {r.nameEn ?? r.nameAr ?? `Template #${r.templateId}`}
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full bg-gold"
                  style={{ width: `${(r.usageCount / max) * 100}%` }}
                />
              </div>
            </div>
            <span className="font-mono text-sm text-ink-muted">
              {formatNumber(r.usageCount)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── 3. Most-amended contracts ──────────────────────────────────────────────

export function MostAmendedContractsCard({
  rows,
}: {
  rows: ExecutiveAmendedContractRow[];
}) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  // E-rev-11 redesign: horizontal bars showing amendment count, scaled to the
  // top contract. Each row is a clickable link to the contract detail.
  const max = Math.max(...rows.map((r) => Number(r.amendmentCount ?? 0)), 1);
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-plum" />
        <h3 className="text-sm font-semibold text-ink">
          {t("dashboards.executive.lists.mostAmendedContracts.title", {
            defaultValue: "Most-amended contracts",
          })}
        </h3>
      </header>
      <ul className="space-y-3">
        {rows.map((r) => {
          const count = Number(r.amendmentCount ?? 0);
          const pct = Math.max(2, Math.round((count / max) * 100));
          return (
            <li key={r.id}>
              <Link
                to="/app/contracts/$id"
                params={{ id: String(r.id) }}
                className="block hover:opacity-90"
                aria-label={`${r.contractNumber} — ${count} amendments`}
              >
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm text-ink hover:underline">
                    {r.titleEn ?? r.titleAr ?? r.contractNumber}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-ink-muted">
                    {count} {t("dashboards.executive.lists.mostAmendedContracts.amendmentsShort", { defaultValue: "amend." })}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={count}
                  aria-valuemin={0}
                  aria-valuemax={max}
                  className="h-2 w-full overflow-hidden rounded-full bg-surface"
                >
                  <div
                    className="h-full rounded-full bg-plum/80"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px] text-ink-subtle">
                  <span>{r.contractNumber}</span>
                  <span>v{r.currentVersion}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─── Combined block ──────────────────────────────────────────────────────────

export function ExecutiveLists({ lists }: { lists: ExecutiveDashboardLists }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <HighRiskContractsCard rows={lists.highRiskContracts8} />
      <MostUsedTemplatesCard rows={lists.mostUsedTemplates8} />
      <MostAmendedContractsCard rows={lists.mostAmendedContracts5} />
    </div>
  );
}
