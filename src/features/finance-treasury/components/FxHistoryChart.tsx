/**
 * Unit-3 / R-FT H4 — FX Volatility historical chart.
 *
 * 30d AED-peg deviation line chart with severity threshold reference line.
 * Uses Recharts LineChart + ReferenceLine.
 */
import { useTranslation } from "react-i18next";
import {
  CartesianGrid,
  LineChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardEmptyState } from "@/features/dashboards/components/dashboard-primitives";

interface FxHistoryPoint {
  date: string;
  deviationBps: number;
}

export interface FxHistoryData {
  pair: string;
  currentDeviationBps: number | null;
  series30d: FxHistoryPoint[];
  severityThresholdBps: number;
}

interface FxHistoryChartProps {
  data: FxHistoryData;
}

export function FxHistoryChart({ data }: FxHistoryChartProps) {
  const { t } = useTranslation();

  if (!data.series30d || data.series30d.length < 2) {
    return (
      <DashboardEmptyState
        description={t("dashboards.financeTreasury.fxHistory.empty")}
      />
    );
  }

  const chartData = data.series30d.map((p) => ({
    date: p.date,
    deviation: p.deviationBps,
  }));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-sm font-medium text-ink">{data.pair}</span>
        <span className="text-xs text-ink-muted">
          {data.currentDeviationBps != null
            ? t("dashboards.financeTreasury.fxHistory.currentDeviation", {
                bps: data.currentDeviationBps,
                defaultValue: `Current deviation: ${data.currentDeviationBps} bps`,
              })
            : t("common.noData", { defaultValue: "—" })}
        </span>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "var(--ink-muted)" }}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "var(--ink-muted)" }}
              label={{
                value: "bps",
                angle: -90,
                position: "insideLeft",
                fontSize: 9,
                fill: "var(--ink-muted)",
              }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 10,
              }}
              formatter={(v: number) => [
                `${v} bps`,
                t("dashboards.financeTreasury.fxHistory.deviation"),
              ]}
            />
            <ReferenceLine
              y={data.severityThresholdBps}
              stroke="var(--amber)"
              strokeDasharray="4 2"
              label={{
                value: t("dashboards.financeTreasury.fxHistory.severityThreshold"),
                fill: "var(--amber)",
                fontSize: 9,
                position: "insideTopRight",
              }}
            />
            <Line
              type="monotone"
              dataKey="deviation"
              stroke="var(--sage)"
              dot={false}
              strokeWidth={2}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-ink-subtle">
        {t("dashboards.financeTreasury.fxHistory.severityThresholdNote", {
          bps: data.severityThresholdBps,
          defaultValue: `Severity threshold: ${data.severityThresholdBps} bps`,
        })}
      </p>
    </div>
  );
}
