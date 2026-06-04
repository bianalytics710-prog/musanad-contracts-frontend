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

// ─── 1. High-risk contracts ─────────────────────────────────────────────────

export function HighRiskContractsCard({ rows }: { rows: ExecutiveHighRiskRow[] }) {
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
          search={{ sort: "alpha" } as never}
          className="text-xs text-ink-subtle hover:text-ink"
        >
          {t("dashboards.executive.lists.highRisk.viewAll", {
            defaultValue: "View all flagged contracts →",
          })}
        </Link>
      </header>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 last:border-0"
          >
            <Link
              to="/app/contracts/$id"
              params={{ id: String(r.id) }}
              className="min-w-0 flex-1"
            >
              <div className="font-mono text-xs text-ink-muted">{r.contractNumber}</div>
              <div className="truncate text-sm text-ink hover:underline">
                {r.titleEn ?? r.titleAr ?? r.contractNumber}
              </div>
            </Link>
            <div className="flex items-center gap-3 text-xs">
              <span className="font-mono text-ink-muted">
                {formatAedCompact(r.valueAed)}
              </span>
              <span className="rounded-md bg-terracotta/10 px-2 py-0.5 font-mono text-terracotta">
                {t("dashboards.executive.lists.highRisk.riskBadge", {
                  defaultValue: "Risk {{score}}",
                  score: String(r.riskScore),
                })}
              </span>
            </div>
          </li>
        ))}
      </ul>
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
