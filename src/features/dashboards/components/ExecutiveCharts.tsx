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
import { formatAedCompact, formatNumber } from "./dashboard-primitives";

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

const formatMonthAxis = (yyyy_mm: string): string => {
  const [, mm] = yyyy_mm.split("-");
  const idx = Math.max(1, Math.min(12, Number.parseInt(mm ?? "1", 10))) - 1;
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][idx];
};

// ─── 1. Spend by category ────────────────────────────────────────────────────

export function SpendByCategoryCard({
  rows,
  totalValueAed,
}: {
  rows: ExecutiveSpendByCategoryRow[];
  totalValueAed: number;
}) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-card p-4">
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
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="valueAed"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {rows.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => formatAedCompact(v)}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1.5 text-sm">
          {rows.map((r, i) => (
            <li
              key={r.category}
              className="flex items-center justify-between gap-2 border-b border-border/40 pb-1 last:border-0"
            >
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="capitalize text-ink">
                  {r.category.replace(/_/g, " ")}
                </span>
              </span>
              <span className="font-mono text-xs text-ink-muted">
                {formatAedCompact(r.valueAed)}{" "}
                <span className="text-ink-subtle">{r.pct.toFixed(1)}%</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── 2. Top suppliers (with sparkline) ───────────────────────────────────────

function SupplierSparkline({ points }: { points: ExecutiveSupplierSparklinePoint[] }) {
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
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  const data = rows.map((r) => ({ ...r, monthShort: formatMonthAxis(r.month) }));
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
  const data = [
    {
      stage: t("dashboards.executive.charts.cycleTime.drafting", { defaultValue: "Drafting" }),
      days: funnel.draftingDays,
    },
    {
      stage: t("dashboards.executive.charts.cycleTime.legalReview", { defaultValue: "Legal review" }),
      days: funnel.legalReviewDays,
    },
    {
      stage: t("dashboards.executive.charts.cycleTime.approvalChain", { defaultValue: "Approval chain" }),
      days: funnel.approvalChainDays,
    },
    {
      stage: t("dashboards.executive.charts.cycleTime.signature", { defaultValue: "Counterparty signature" }),
      days: funnel.counterpartySignatureDays,
    },
  ];
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-1 text-sm font-semibold text-ink">
        {t("dashboards.executive.charts.cycleTime.title", { defaultValue: "Cycle time funnel" })}
      </h3>
      <p className="mb-3 text-xs text-ink-subtle">
        {t("dashboards.executive.charts.cycleTime.subtitle", {
          defaultValue: "Average days per stage",
        })}
      </p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 24, bottom: 8, left: 80 }}
          >
            <CartesianGrid strokeDasharray="2 4" opacity={0.3} />
            <XAxis type="number" fontSize={10} tickFormatter={(v) => `${v}d`} />
            <YAxis dataKey="stage" type="category" fontSize={11} />
            <Tooltip formatter={(v: number) => `${v.toFixed(1)} d`} />
            <Bar dataKey="days" fill="#7a8b6f" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ─── 5. Contract throughput — 12 months ─────────────────────────────────────

export function ContractThroughput12mCard({
  rows,
}: {
  rows: ExecutiveThroughputMonthRow[];
}) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  const data = rows.map((r) => ({ ...r, monthShort: formatMonthAxis(r.month) }));
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
      <h3 className="mb-3 text-sm font-semibold text-ink">
        {t("dashboards.executive.charts.expiryCliff.title", {
          defaultValue: "Expiry cliff by horizon",
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
      <SpendByCategoryCard rows={charts.spendByCategory} totalValueAed={totalValueAed} />
      <TopSuppliersCard rows={charts.topSuppliers} />
      <RevenueUnderContract12mCard rows={charts.revenueUnderContract12m} />
      <CycleTimeFunnelCard funnel={cycleTimeFunnel} />
      <ContractThroughput12mCard rows={charts.contractThroughput12m} />
      <ExpiryCliffCard rows={charts.expiryCliff} />
    </div>
  );
}
