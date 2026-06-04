/**
 * M14 / CR-F — AVaR extension for the Executive Dashboard.
 *
 * Renders:
 *   1. AvarTopTile — single AED compact number with delta-vs-prior-window
 *   2. AvarBreakdownSection — 4 bar chart sub-cards (by business_unit /
 *      counterparty_id / geography / risk_kind)
 *
 * CR-G scope: WhatChangedToday / RecommendedActions / ClausesTriggered
 * are NOT in CR-F — do not add them here.
 *
 * Defensive guard: if useAvar errors with 403 or the data is absent,
 * the section renders nothing (silently skipped per brief).
 *
 * T1–T13 compliance applied throughout.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useAvar } from '@/features/contracts/hooks/useRiskScore';
import { KpiTile, humanizeLabel } from './dashboard-primitives';
import type { AvarGroupBy } from '@/types/entities/risk-score.types';
import { cn } from '@/lib/utils';

// ─── Formatters ────────────────────────────────────────────────────────────

function formatAedCompactString(value: string | null): string {
  if (!value) return '—';
  const num = Number(value);
  if (isNaN(num)) return '—';
  try {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  } catch {
    const abs = Math.abs(num);
    if (abs >= 1_000_000_000) return `AED ${(abs / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `AED ${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `AED ${(abs / 1_000).toFixed(1)}K`;
    return `AED ${abs.toFixed(0)}`;
  }
}

function formatDeltaPct(deltaPct: number | null): string {
  if (deltaPct === null) return '—';
  const sign = deltaPct >= 0 ? '+' : '';
  return `${sign}${deltaPct.toFixed(1)}%`;
}

// ─── AvarGroupBy panel tabs ─────────────────────────────────────────────────

const GROUP_BY_OPTIONS: Array<{ key: AvarGroupBy; labelKey: string }> = [
  { key: 'business_unit', labelKey: 'risk.avar.breakdown.groupBy.businessUnit' },
  { key: 'counterparty_id', labelKey: 'risk.avar.breakdown.groupBy.counterparty' },
  { key: 'geography', labelKey: 'risk.avar.breakdown.groupBy.geography' },
  { key: 'risk_kind', labelKey: 'risk.avar.breakdown.groupBy.riskKind' },
];

// ─── Main component ────────────────────────────────────────────────────────

interface AvarDashboardSectionProps {
  windowDays?: number;
}

export function AvarDashboardSection({ windowDays = 90 }: AvarDashboardSectionProps) {
  const { t } = useTranslation();
  const [activeGroup, setActiveGroup] = useState<AvarGroupBy>('business_unit');

  const { data, isLoading, isError, error } = useAvar({
    groupBy: activeGroup,
    windowDays,
  });

  // Defensive: silent skip on 403 (no score.read — unlikely for executive but safe)
  const errorStatus = (error as { status?: number })?.status;
  if (isError && errorStatus === 403) return null;

  // Loading state — single skeleton row
  if (isLoading) {
    return (
      <div
        className="space-y-3"
        aria-busy="true"
        aria-label={t('common.loading')}
      >
        <div className="h-24 animate-pulse rounded-lg border border-border bg-card" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
      </div>
    );
  }

  // Error state (non-403) — render nothing to avoid breaking the dashboard
  if (isError || !data) return null;

  const delta = data.deltaVsPriorWindow;
  const deltaNum = delta.deltaPct;
  const deltaDisplay = formatDeltaPct(deltaNum);
  const deltaPositive = deltaNum !== null && deltaNum > 0;
  const deltaNeutral = deltaNum === null || deltaNum === 0;

  const DeltaIcon = deltaNeutral ? Minus : deltaPositive ? TrendingUp : TrendingDown;
  const deltaColorClass = deltaNeutral
    ? 'text-ink-muted'
    : deltaPositive
      ? 'text-terracotta' // more risk = worse
      : 'text-sage'; // less risk = better

  // BUG-014 polish (QA Phase 3.2 from user screenshot 2026-05-31): when delta
  // is null, drop the "— vs prior window" prefix so the helper reads
  // "33 contracts" instead of "— vs prior window · 33 contracts".
  const helperText = deltaNum === null
    ? `${data.contractCount} ${t('risk.avar.tile.contracts')}`
    : `${deltaDisplay} ${t('risk.avar.tile.vsLastWindow')} · ${data.contractCount} ${t('risk.avar.tile.contracts')}`;

  return (
    <section aria-label={t('risk.avar.sectionLabel')} className="space-y-4">
      {/* E1 fix — explicit heading for the AVaR section so the 3 top KPI
          tiles are visibly grouped under "Asset Value at Risk (AVaR)" and
          the user can tell what they belong to. */}
      <h2 className="text-base font-semibold text-ink">
        {t('risk.avar.sectionHeading', { defaultValue: 'Asset Value at Risk (AVaR)' })}
      </h2>
      {/* Top KPI tile */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <KpiTile
            label={t('risk.avar.tile.label')}
            value={formatAedCompactString(data.totalAvar)}
            helper={helperText}
            variant="risk"
          />
        </div>
        {/* Delta detail mini-card.
            BUG-014 fix (QA Phase 3.2 from user screenshot 2026-05-31): when
            `deltaNum` is null the card previously showed a lonely "—" with no
            explanation, reading as broken data. Now shows "Insufficient
            history" subtitle and a tooltip clarifying the prior-window data
            is missing. */}
        <div
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
          title={deltaNum === null ? t('risk.avar.tile.deltaNoHistoryTooltip', { defaultValue: 'Prior-window risk scores are not yet available for the selected period.' }) : undefined}
        >
          <DeltaIcon className={cn('h-5 w-5 shrink-0', deltaColorClass)} aria-hidden />
          <div>
            <p className={cn('font-mono text-lg font-semibold tabular-nums', deltaColorClass)}>
              {deltaNum === null ? t('risk.avar.tile.deltaNoHistory', { defaultValue: 'No prior data' }) : deltaDisplay}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-ink-subtle">
              {t('risk.avar.tile.deltaSubtitle')}
            </p>
          </div>
        </div>
        {/* No-value count */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-1 font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
            {t('risk.avar.tile.noValueLabel')}
          </div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-ink">
            {data.noValueCount}
          </div>
          <p className="mt-1 font-mono text-[11px] text-ink-subtle">
            {t('risk.avar.tile.noValueHelper')}
          </p>
        </div>
      </div>

      {/* Breakdown chart section */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">
            {t('risk.avar.breakdown.title')}
          </h3>
          <div
            role="group"
            aria-label={t('risk.avar.breakdown.groupByLabel')}
            className="flex flex-wrap gap-2"
          >
            {GROUP_BY_OPTIONS.map(({ key, labelKey }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveGroup(key)}
                aria-pressed={activeGroup === key}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition',
                  activeGroup === key
                    ? 'border-terracotta bg-terracotta/10 text-ink'
                    : 'border-border bg-card text-ink-muted hover:border-terracotta/60 hover:text-ink',
                )}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        {data.breakdown.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-xs text-ink-muted">{t('risk.avar.breakdown.noData')}</p>
          </div>
        ) : (
          <AvarBreakdownChart buckets={data.breakdown.slice(0, 5)} groupBy={activeGroup} />
        )}

        {data.noValueCount > 0 && (
          <p className="mt-3 text-[10px] text-ink-subtle">
            {t('risk.avar.breakdown.noValueNote', { count: data.noValueCount })}
          </p>
        )}
      </div>
    </section>
  );
}

// ─── AvarBreakdownChart ────────────────────────────────────────────────────

function AvarBreakdownChart({
  buckets,
  groupBy,
}: {
  buckets: Array<{ key: string; label: string; avar: string | null; contractCount: number }>;
  groupBy: string;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<{ name: string; avar: number; contracts: number; key: string } | null>(null);

  const chartData = buckets.map((b) => ({
    name: humanizeLabel(b.label),
    avar: b.avar !== null ? Number(b.avar) : 0,
    contracts: b.contractCount,
    key: b.key,
  }));
  const maxAvar = Math.max(...chartData.map((d) => d.avar), 1);

  // E-rev-1: click on a bar opens an explanation panel below the chart
  // describing what this exposure means and why it counts toward AVaR.
  const explanationFor = (name: string): string => {
    const explanationByGroup: Record<string, string> = {
      business_unit:
        `Aggregate Asset Value at Risk attributable to contracts owned by ${name}. Indicates how much capital this business unit has on the line if active correlations crystallise.`,
      contract_type:
        `${name} contracts contribute this much to total AVaR. Driven by characteristic risk surface: clause density, regulatory touch points, and value concentration typical for the type.`,
      counterparty_id:
        `Concentration risk from ${name}. Higher AVaR means more of the portfolio depends on this single counterparty's performance.`,
      counterparty_chain:
        `Aggregate AVaR concentrated within ${name}'s wider corporate group / chain. Useful for cross-entity exposure caps.`,
      geography:
        `AVaR concentrated in ${name}. Indicates geopolitical, regulatory, and FX risk dependence on a single jurisdiction.`,
      risk_kind:
        `AVaR contributed by contracts where the dominant correlation reason is "${name}". Surfaces which risk family is driving the portfolio's worst-case exposure.`,
    };
    return t(`risk.avar.breakdown.explain.${groupBy}`, {
      defaultValue:
        explanationByGroup[groupBy] ??
        `AVaR contributed by "${name}". This is the modelled loss if correlations active on these contracts crystallise.`,
      name,
    });
  };

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
          layout="vertical"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: 'var(--ink-subtle)' }}
            tickFormatter={(v: number) => {
              if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
              if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
              return String(v);
            }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={160}
            interval={0}
            tick={{ fontSize: 10, fill: 'var(--ink-subtle)' }}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
            }}
            formatter={(value: number) => [
              `AED ${value.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`,
              t('risk.avar.breakdown.chartLabel'),
            ]}
          />
          <Bar
            dataKey="avar"
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={(d) => {
              const c = d as unknown as { name: string; avar: number; contracts: number; key: string };
              setSelected({ name: c.name, avar: c.avar, contracts: c.contracts, key: c.key });
            }}
          >
            {chartData.map((entry, index) => {
              const intensity = maxAvar > 0 ? entry.avar / maxAvar : 0;
              const opacity = 0.4 + intensity * 0.6;
              const isSelected = selected?.name === entry.name;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill="var(--terracotta)"
                  fillOpacity={isSelected ? 1 : opacity}
                  stroke={isSelected ? 'var(--terracotta)' : 'none'}
                  strokeWidth={isSelected ? 2 : 0}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {selected && (
        <div className="rounded-md border border-terracotta/30 bg-terracotta/5 p-3">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-ink">
              {selected.name}
              <span className="ml-2 font-mono text-[11px] text-ink-muted">
                · {selected.contracts} {t('risk.avar.breakdown.contracts', { defaultValue: 'contracts' })}
              </span>
            </span>
            <span className="font-mono text-xs text-ink">
              AED {selected.avar.toLocaleString('en-AE', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <p className="text-xs leading-5 text-ink-muted">{explanationFor(selected.name)}</p>
          <button
            type="button"
            className="mt-1 text-[10px] text-ink-subtle underline hover:text-ink"
            onClick={() => setSelected(null)}
          >
            {t('common.close', { defaultValue: 'Close' })}
          </button>
        </div>
      )}
    </div>
  );
}
