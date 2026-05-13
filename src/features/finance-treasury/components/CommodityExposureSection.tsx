/**
 * Unit-3 / R-FT H3 — Commodity Exposure Section.
 *
 * Three commodity cards (Brent / Dubai / Murban) each showing:
 *   - currentPriceUsd
 *   - 30d sparkline (Recharts LineChart)
 *   - thresholdProximityBps
 *   - contractsExposed list
 */
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { DashboardEmptyState } from "@/features/dashboards/components/dashboard-primitives";

interface TrendPoint {
  date: string;
  priceUsd: number;
}

interface ExposedContract {
  contractId: string;
  contractNumber: string;
  threshold: number;
  clauseRef: string;
}

interface CommodityCard {
  currentPriceUsd: number | null;
  trend30d: TrendPoint[];
  thresholdProximityBps: number | null;
  contractsExposed: ExposedContract[];
}

export interface CommodityExposureData {
  brent: CommodityCard;
  dubai: CommodityCard;
  murban: CommodityCard;
}

interface CommodityCardProps {
  name: string;
  card: CommodityCard;
  color: string;
}

function SingleCommodityCard({ name, card, color }: CommodityCardProps) {
  const { t } = useTranslation();

  const sparkData = (card.trend30d ?? []).map((p) => ({ date: p.date, price: p.priceUsd }));
  const hasPrice = card.currentPriceUsd != null && Number.isFinite(card.currentPriceUsd);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{name}</h3>
        {card.thresholdProximityBps != null && (
          <span className="font-mono text-xs text-ink-muted">
            {t("dashboards.financeTreasury.commodityExposure.thresholdProximity", {
              bps: card.thresholdProximityBps,
              defaultValue: `${card.thresholdProximityBps} bps to threshold`,
            })}
          </span>
        )}
      </div>
      <div className="mb-3 font-mono text-xl font-semibold tabular-nums text-ink">
        {hasPrice ? (
          <>
            ${(card.currentPriceUsd as number).toFixed(2)}
            <span className="ms-1 text-xs font-normal text-ink-muted">
              {t("dashboards.financeTreasury.commodityExposure.usdPerBarrel")}
            </span>
          </>
        ) : (
          <span className="text-ink-muted">—</span>
        )}
      </div>
      {sparkData.length > 1 && (
        <div className="h-14 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="price"
                stroke={color}
                dot={false}
                strokeWidth={1.5}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 10,
                }}
                formatter={(v: number) => [`$${v.toFixed(2)}`, t("dashboards.financeTreasury.commodityExposure.currentPriceUsd")]}
                labelFormatter={(label) => String(label)}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {card.contractsExposed.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
            {t("dashboards.financeTreasury.commodityExposure.contractsExposed")}
          </p>
          <ul className="space-y-0.5">
            {card.contractsExposed.slice(0, 3).map((c) => (
              <li key={c.contractId} className="flex items-center gap-2">
                <Link
                  to="/app/contracts/$id"
                  params={{ id: c.contractId }}
                  className="font-mono text-[11px] text-gold hover:underline"
                >
                  {c.contractNumber}
                </Link>
                <span className="text-[10px] text-ink-subtle">
                  {t("dashboards.financeTreasury.commodityExposure.threshold", {
                    value: c.threshold,
                    defaultValue: `threshold $${c.threshold}`,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface CommodityExposureSectionProps {
  data: CommodityExposureData;
}

export function CommodityExposureSection({ data }: CommodityExposureSectionProps) {
  const { t } = useTranslation();

  const cards: { key: keyof CommodityExposureData; name: string; color: string }[] = [
    { key: "brent", name: t("dashboards.financeTreasury.commodityExposure.brent"), color: "var(--terracotta)" },
    { key: "dubai", name: t("dashboards.financeTreasury.commodityExposure.dubai"), color: "var(--gold)" },
    { key: "murban", name: t("dashboards.financeTreasury.commodityExposure.murban"), color: "var(--sage)" },
  ];

  const hasData = Object.values(data).some(
    (card) => card.currentPriceUsd > 0 || card.contractsExposed.length > 0,
  );

  if (!hasData) {
    return (
      <DashboardEmptyState
        description={t("dashboards.financeTreasury.commodityExposure.empty")}
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map(({ key, name, color }) => (
        <SingleCommodityCard key={key} name={name} card={data[key]} color={color} />
      ))}
    </div>
  );
}
