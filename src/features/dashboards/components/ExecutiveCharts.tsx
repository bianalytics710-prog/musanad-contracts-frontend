/**
 * R-EX1 — Executive dashboard chart sections (Lovable parity).
 *
 *   1. SpendByCategoryCard            — donut + breakdown list
 *   2. TopSuppliersCard               — table with 12m sparkline
 *   3. RevenueUnderContract12mCard    — area chart (active + pipeline)
 *   4. CycleTimeFunnelCard            — horizontal bar (4 stages)
 *   5. ContractThroughput12mCard      — grouped bar (initiated + signed)
 *   6. ExpiryCliffCard                — bar chart (6 horizon buckets)
 *
 * Each card consumes a slice of `ExecutiveDashboardCharts` (from
 * fn_dashboard_executive migration 090) and renders without making
 * additional fetches. Recharts is shared across the dashboard.
 */
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ExecutiveCycleTimeFunnel,
  ExecutiveDashboardCharts,
  ExecutiveExpiryCliffBucket,
  ExecutiveRevenueMonthRow,
  ExecutiveSpendByCategoryRow,
  ExecutiveSupplierSparklinePoint,
  ExecutiveThroughputMonthRow,
  ExecutiveTopSupplierRow,
} from "@/types/entities/dashboards.types";
import {
  formatAedAxis,
  formatAedCompact,
  formatMonthAxisLocalized,
  formatNumber,
  humanizeLabel,
  humanizeLabelLocalized,
} from "./dashboard-primitives";

const PIE_COLORS = [
  "#bb945a",
  "#7a8b6f",
  "#c69779",
  "#9c4f4f",
  "#7a6e8b",
  "#a59560",
  "#5a7a8b",
  "#8b7a5a",
];

// v617 - moved to dashboard-primitives.formatMonthAxisLocalized so the same
// helper serves multiple charts and respects EN/AR locale.

// ─── 1. Spend by category ────────────────────────────────────────────────────

export function SpendByCategoryCard({
  rows,
  totalValueAed,
}: {
  rows: ExecutiveSpendByCategoryRow[];
  totalValueAed: number;
}) {
  const { t, i18n } = useTranslation();
  if (rows.length === 0) return null;
  // E-rev-1b redesign: legend column on the LEFT (sorted descending), pie on
  // the RIGHT (no internal labels — they overlap on small slices). Each
  // legend row has a colour swatch, label, AED value and % share so the user
  // gets the full picture at a glance without squinting at the pie.
  const sorted = [...rows].sort((a, b) => b.valueAed - a.valueAed);
  return (
    <section className="rounded-lg border border-border bg-card p-4 xl:col-span-2">
      <header className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink">
          {t("dashboards.executive.charts.spendByCategory.title", {
            defaultValue: "Spend by category",
          })}
        </h3>
        <div className="text-right text-xs text-ink-subtle">
          <div>{t("dashboards.executive.charts.totalSpend", { defaultValue: "Total spend" })}</div>
          <div className="font-mono text-sm text-ink">{formatAedCompact(totalValueAed)}</div>
        </div>
      </header>
      <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
        {/* Left: full legend (color swatch + label + AED value + % share) */}
        <ul className="space-y-1.5">
          {sorted.map((r) => {
            const originalIdx = rows.findIndex((x) => x.category === r.category);
            return (
              <li
                key={r.category}
                className="grid grid-cols-[16px_minmax(0,1fr)_auto_56px] items-center gap-3 border-b border-border/40 pb-1.5 last:border-0"
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: PIE_COLORS[originalIdx % PIE_COLORS.length] }}
                  aria-hidden
                />
                <span className="truncate text-sm text-ink">{humanizeLabelLocalized(r.category, i18n.language)}</span>
                <span className="font-mono text-xs text-ink-muted">
                  {formatAedCompact(r.valueAed)}
                </span>
                <span className="text-right font-mono text-xs text-ink-subtle">
                  {r.pct.toFixed(1)}%
                </span>
              </li>
            );
          })}
        </ul>
        {/* Right: donut chart, no inline labels (legend on the left replaces them) */}
        <div className="h-64 w-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="valueAed"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={64}
                outerRadius={100}
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={2}
              >
                {rows.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, _key: string, item) => [
                  `${formatAedCompact(v)} · ${item?.payload?.pct?.toFixed?.(1) ?? "0.0"}%`,
                  humanizeLabelLocalized(String(item?.payload?.category ?? ""), i18n.language),
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

// ─── 2. Top suppliers (with sparkline) ───────────────────────────────────────

function SupplierSparkline({ points }: { points: ExecutiveSupplierSparklinePoint[] }) {
  // Render a graceful empty state when the BE returns no points or all
  // points are zero — an empty chart reads as a rendering bug to the
  // audience. A horizontal rule with the "no trend data" hint is
  // honest and visually intentional.
  const hasMeaningfulData =
    Array.isArray(points) &&
    points.length > 1 &&
    points.some((p) => Number(p?.valueAed ?? 0) > 0);

  if (!hasMeaningfulData) {
    return (
      <div
        className="flex h-8 w-24 items-center justify-center text-[10px] text-ink-subtle"
        title="No 12-month trend data for this supplier"
        aria-label="No 12-month trend"
      >
        ───
      </div>
    );
  }
  return (
    <div className="h-8 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <Line
            type="monotone"
            dataKey="valueAed"
            stroke="#bb945a"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopSuppliersCard({ rows }: { rows: ExecutiveTopSupplierRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">
        {t("dashboards.executive.charts.topSuppliers.title", {
          defaultValue: "Top suppliers by spend",
        })}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-ink-subtle">
              <th className="px-2 py-1.5">
                {t("dashboards.executive.charts.topSuppliers.col.supplier", {
                  defaultValue: "Supplier",
                })}
              </th>
              <th className="px-2 py-1.5 text-right">
                {t("dashboards.executive.charts.topSuppliers.col.contracts", {
                  defaultValue: "Contracts",
                })}
              </th>
              <th className="px-2 py-1.5 text-right">
                {t("dashboards.executive.charts.topSuppliers.col.totalValue", {
                  defaultValue: "Total value",
                })}
              </th>
              <th className="px-2 py-1.5 text-right">
                {t("dashboards.executive.charts.topSuppliers.col.pctOfSpend", {
                  defaultValue: "% of spend",
                })}
              </th>
              <th className="px-2 py-1.5">
                {t("dashboards.executive.charts.topSuppliers.col.trend", {
                  defaultValue: "12m trend",
                })}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.counterpartyId} className="border-b border-border/40 last:border-0">
                <td className="px-2 py-1.5 text-ink">{r.name}</td>
                <td className="px-2 py-1.5 text-right font-mono text-xs text-ink-muted">
                  {formatNumber(r.contractCount)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-xs text-ink-muted">
                  {formatAedCompact(r.totalValueAed)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-xs text-ink-muted">
                  {r.pctOfSpend.toFixed(1)}%
                </td>
                <td className="px-2 py-1.5">
                  <SupplierSparkline points={r.sparkline12m} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── 3. Revenue under contract — 12 months ──────────────────────────────────

export function RevenueUnderContract12mCard({
  rows,
}: {
  rows: ExecutiveRevenueMonthRow[];
}) {
  const { t, i18n } = useTranslation();
  if (rows.length === 0) return null;
  const data = rows.map((r) => ({ ...r, monthShort: formatMonthAxisLocalized(r.month, i18n.language) }));
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">
        {t("dashboards.executive.charts.revenueUnderContract.title", {
          defaultValue: "Revenue under contract · 12 months",
        })}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="2 4" opacity={0.3} />
            <XAxis dataKey="monthShort" fontSize={10} />
            <YAxis fontSize={10} tickFormatter={(v) => formatAedCompact(v)} />
            <Tooltip
              formatter={(v: number, key: string) => [
                formatAedCompact(v),
                key === "activeValueAed"
                  ? t("dashboards.executive.charts.revenueUnderContract.active", { defaultValue: "Active contract revenue" })
                  : t("dashboards.executive.charts.revenueUnderContract.pipeline", { defaultValue: "Pipeline revenue" }),
              ]}
            />
            <Legend
              formatter={(value) =>
                value === "activeValueAed"
                  ? t("dashboards.executive.charts.revenueUnderContract.active", { defaultValue: "Active contract revenue" })
                  : t("dashboards.executive.charts.revenueUnderContract.pipeline", { defaultValue: "Pipeline revenue" })
              }
            />
            <Area
              type="monotone"
              dataKey="activeValueAed"
              stackId="1"
              stroke="#bb945a"
              fill="#bb945a"
              fillOpacity={0.5}
            />
            <Area
              type="monotone"
              dataKey="pipelineValueAed"
              stackId="1"
              stroke="#7a8b6f"
              fill="#7a8b6f"
              fillOpacity={0.4}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ─── 4. Cycle time funnel ────────────────────────────────────────────────────

export function CycleTimeFunnelCard({ funnel }: { funnel: ExecutiveCycleTimeFunnel }) {
  const { t } = useTranslation();
  const clampDays = (v: number | null | undefined): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0;
  // E-rev-1c redesign: stacked stage cards filling the full card width.
  // Each stage shows label + day count + a coloured fill bar whose width is
  // scaled to the longest stage. Removes the cramped Recharts horizontal bar
  // and uses the available real-estate proportionally.
  const stages = [
    {
      stage: t("dashboards.executive.charts.cycleTime.drafting", { defaultValue: "Drafting" }),
      days: clampDays(funnel.draftingDays),
      color: "var(--gold)",
    },
    {
      stage: t("dashboards.executive.charts.cycleTime.legalReview", { defaultValue: "Legal review" }),
      days: clampDays(funnel.legalReviewDays),
      color: "var(--sage)",
    },
    {
      stage: t("dashboards.executive.charts.cycleTime.approvalChain", { defaultValue: "Approval chain" }),
      days: clampDays(funnel.approvalChainDays),
      color: "var(--terracotta)",
    },
    {
      stage: t("dashboards.executive.charts.cycleTime.signature", { defaultValue: "Counterparty signature" }),
      days: clampDays(funnel.counterpartySignatureDays),
      color: "var(--plum)",
    },
  ];
  const maxDays = Math.max(...stages.map((s) => s.days), 1);
  const totalDays = stages.reduce((acc, s) => acc + s.days, 0);
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            {t("dashboards.executive.charts.cycleTime.title", { defaultValue: "Cycle time funnel" })}
          </h3>
          <p className="text-xs text-ink-subtle">
            {t("dashboards.executive.charts.cycleTime.subtitle", {
              defaultValue: "Average days per stage",
            })}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs uppercase tracking-wider text-ink-subtle">
            {t("dashboards.executive.charts.cycleTime.totalLabel", { defaultValue: "Total cycle" })}
          </div>
          <div className="font-mono text-base font-semibold text-ink">
            {totalDays}{" "}
            <span className="text-xs text-ink-subtle">
              {t("dashboards.executive.charts.cycleTime.daysSuffix", { defaultValue: "days" })}
            </span>
          </div>
        </div>
      </header>
      <ul className="space-y-3">
        {stages.map((s, idx) => {
          const pct = Math.max(8, Math.round((s.days / maxDays) * 100));
          return (
            <li key={s.stage} className="flex items-center gap-3">
              <div className="flex w-6 shrink-0 items-center justify-center">
                <span
                  className="grid h-6 w-6 place-content-center rounded-full bg-surface font-mono text-[10px] font-semibold text-ink-muted"
                  aria-hidden
                >
                  {idx + 1}
                </span>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-ink">{s.stage}</span>
                  <span className="font-mono text-xs text-ink">
                    {s.days}{" "}
                    <span className="text-ink-subtle">
                      {s.days === 1
                        ? t("dashboards.executive.charts.cycleTime.daySuffix", { defaultValue: "day" })
                        : t("dashboards.executive.charts.cycleTime.daysSuffix", { defaultValue: "days" })}
                    </span>
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    role="progressbar"
                    aria-valuenow={s.days}
                    aria-valuemin={0}
                    aria-valuemax={maxDays}
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: s.color }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─── 5. Contract throughput — 12 months ─────────────────────────────────────

export function ContractThroughput12mCard({
  rows,
}: {
  rows: ExecutiveThroughputMonthRow[];
}) {
  const { t, i18n } = useTranslation();
  if (rows.length === 0) return null;
  const data = rows.map((r) => ({ ...r, monthShort: formatMonthAxisLocalized(r.month, i18n.language) }));
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">
        {t("dashboards.executive.charts.throughput.title", {
          defaultValue: "Contract throughput (12m)",
        })}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="2 4" opacity={0.3} />
            <XAxis dataKey="monthShort" fontSize={10} />
            <YAxis fontSize={10} />
            <Tooltip
              formatter={(v: number, key: string) => [
                formatNumber(v),
                key === "initiated"
                  ? t("dashboards.executive.charts.throughput.initiated", { defaultValue: "Initiated" })
                  : t("dashboards.executive.charts.throughput.signed", { defaultValue: "Signed" }),
              ]}
            />
            <Legend
              formatter={(value) =>
                value === "initiated"
                  ? t("dashboards.executive.charts.throughput.initiated", { defaultValue: "Initiated" })
                  : t("dashboards.executive.charts.throughput.signed", { defaultValue: "Signed" })
              }
            />
            <Bar dataKey="initiated" fill="#bb945a" radius={[3, 3, 0, 0]} />
            <Bar dataKey="signed" fill="#7a8b6f" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ─── 6. Expiry cliff by horizon ──────────────────────────────────────────────

export function ExpiryCliffCard({ rows }: { rows: ExecutiveExpiryCliffBucket[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      {/* E6 fix — renamed to "Expiry cliff — value distribution" so the
          chart isn't confused with the count-based "Expiry cliffs" KPI
          tiles earlier on the page. */}
      <h3 className="mb-3 text-sm font-semibold text-ink">
        {t("dashboards.executive.charts.expiryCliff.title", {
          defaultValue: "Expiry cliff — value distribution",
        })}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="2 4" opacity={0.3} />
            <XAxis dataKey="horizon" fontSize={10} />
            <YAxis fontSize={10} tickFormatter={(v) => formatAedCompact(v)} />
            <Tooltip
              formatter={(v: number) => [
                formatAedCompact(v),
                t("dashboards.executive.charts.expiryCliff.atRisk", { defaultValue: "AED at risk" }),
              ]}
            />
            <Bar dataKey="valueAedAtRisk" fill="#9c4f4f" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ─── Combined block ──────────────────────────────────────────────────────────

export function ExecutiveCharts({
  charts,
  cycleTimeFunnel,
  totalValueAed,
}: {
  charts: ExecutiveDashboardCharts;
  cycleTimeFunnel: ExecutiveCycleTimeFunnel;
  totalValueAed: number;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {/* Spend by Category spans both columns (pie + table stacked). */}
      <SpendByCategoryCard rows={charts.spendByCategory} totalValueAed={totalValueAed} />
      <TopSuppliersCard rows={charts.topSuppliers} />
      <CycleTimeFunnelCard funnel={cycleTimeFunnel} />
      <ContractThroughput12mCard rows={charts.contractThroughput12m} />
      <ExpiryCliffCard rows={charts.expiryCliff} />
      {/* Removed: RevenueUnderContract12mCard per E-rev-5 — duplicated value tile signal. */}
    </div>
  );
}
