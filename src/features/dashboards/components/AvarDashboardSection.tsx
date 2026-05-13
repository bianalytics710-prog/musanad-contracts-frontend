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
import { KpiTile } from './dashboard-primitives';
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

  const helperText = `${deltaDisplay} ${t('risk.avar.tile.vsLastWindow')} · ${data.contractCount} ${t('risk.avar.tile.contracts')}`;

  return (
    <section aria-label={t('risk.avar.sectionLabel')} className="space-y-4">
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
        {/* Delta detail mini-card */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
          <DeltaIcon className={cn('h-5 w-5 shrink-0', deltaColorClass)} aria-hidden />
          <div>
            <p className={cn('font-mono text-lg font-semibold tabular-nums', deltaColorClass)}>
              {deltaDisplay}
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
          <AvarBreakdownChart buckets={data.breakdown.slice(0, 5)} />
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
}: {
  buckets: Array<{ key: string; label: string; avar: string | null; contractCount: number }>;
}) {
  const { t } = useTranslation();

  const chartData = buckets.map((b) => ({
    name: b.label,
    avar: b.avar !== null ? Number(b.avar) : 0,
    contracts: b.contractCount,
  }));

  // Color cells with terracotta gradient (highest risk = most intense)
  const maxAvar = Math.max(...chartData.map((d) => d.avar), 1);

  return (
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
          width={80}
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
        <Bar dataKey="avar" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => {
            const intensity = maxAvar > 0 ? entry.avar / maxAvar : 0;
            const opacity = 0.4 + intensity * 0.6;
            return (
              <Cell
                key={`cell-${index}`}
                fill="var(--terracotta)"
                fillOpacity={opacity}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
