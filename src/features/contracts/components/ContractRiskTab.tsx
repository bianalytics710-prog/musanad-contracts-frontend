/**
 * M14 / CR-F — ContractRiskTab
 *
 * Risk tab on the contract detail page. Shows:
 *   1. HealthScoreGauge — single 0-100 number with color band
 *   2. FiveDimBreakdownBars — horizontal bars per dimension
 *   3. WhatIfPanel — client-side counterfactual (no BE call)
 *   4. MarPerCorrelationList — MaR per active correlation with reason codes
 *   5. ScoreHistoryChart — Recharts LineChart with 30/90/180-day toggle
 *
 * T1 — data via service layer (useContractRiskScore, useContractRiskScoreHistory)
 * T2 — React Query caching (5-min staleTime)
 * T3 — all strings via t()
 * T4 — three data states (loading / empty / error)
 * T5 — semantic CSS variables only (var(--gold), var(--sage), var(--terracotta))
 * T6 — ARIA on all interactive elements
 * T7 — no any type
 * T11 — ErrorBoundary at caller (ContractDetail route)
 * T12 — formatDateTime for timestamps
 * T13 — contributingCorrelations never in logs or error messages
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp } from 'lucide-react';
import { useContractRiskScore, useContractRiskScoreHistory } from '../hooks/useRiskScore';
import { formatDateTime } from '@/utils/datetime';
import { cn } from '@/lib/utils';
import type {
  HydratedContributingCorrelation,
  RiskScoreHistorySnapshot,
} from '@/types/entities/risk-score.types';

interface ContractRiskTabProps {
  contractId: number;
}

// ─── Health score color band ───────────────────────────────────────────────
// W7 fix: when score is 0 with no contributing correlations, the contract is
// effectively unscored (bootstrap baseline; no signals fired yet). Surfacing
// "High risk" in red would mislead — show "Insufficient data" in muted neutral
// instead. Real high-risk states still surface terracotta below score 20.

function healthScoreColor(score: number, hasContributors = true): string {
  if (!hasContributors && score === 0) return 'var(--ink-subtle)';
  if (score >= 80) return 'var(--sage)';
  if (score >= 50) return 'var(--gold)';
  return 'var(--terracotta)';
}

function healthScoreLabel(score: number, t: (key: string) => string, hasContributors = true): string {
  if (!hasContributors && score === 0) return t('risk.score.gauge.insufficient');
  if (score >= 80) return t('risk.score.gauge.low');
  if (score >= 50) return t('risk.score.gauge.medium');
  return t('risk.score.gauge.high');
}

// ─── Main component ────────────────────────────────────────────────────────

export function ContractRiskTab({ contractId }: ContractRiskTabProps) {
  const { t } = useTranslation();
  const [historyWindow, setHistoryWindow] = useState<30 | 90 | 180>(90);

  const { data, isLoading, isError, error, refetch } = useContractRiskScore(contractId);
  const historyQuery = useContractRiskScoreHistory(contractId, historyWindow);

  // Loading state
  if (isLoading) {
    return (
      <div
        className="space-y-4"
        aria-busy="true"
        aria-label={t('common.loading')}
      >
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-card" />
        ))}
      </div>
    );
  }

  // Error state — 404 means no score yet (bootstrap pending)
  const errorStatus = (error as { status?: number })?.status;
  if (isError || !data) {
    if (errorStatus === 404) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <AlertTriangle className="h-8 w-8 text-terracotta" aria-hidden />
          <p className="text-sm font-medium text-ink">
            {t('risk.score.emptyState.title')}
          </p>
          <p className="text-xs text-ink-muted">
            {t('risk.score.emptyState.description')}
          </p>
        </div>
      );
    }
    if (errorStatus === 403) {
      return (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-ink-muted">{t('common.accessDenied')}</p>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">{t('risk.score.errors.loadFailed')}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-2 text-xs text-ink-muted underline hover:text-ink"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Row 1 — Gauge + 5-dim breakdown */}
      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <HealthScoreGauge score={data.healthScore} hasContributors={(data.contributingCorrelations?.length ?? 0) > 0} />
        <FiveDimBreakdownBars dimensions={data.dimensions} />
      </div>

      {/* Row 2 — What-if panel */}
      {data.contributingCorrelations.length > 0 && (
        <WhatIfPanel correlations={data.contributingCorrelations} baseScore={data.healthScore} />
      )}

      {/* Row 3 — MaR per correlation list */}
      <MarPerCorrelationList
        correlations={data.contributingCorrelations}
        marValue={data.marValue}
      />

      {/* Row 4 — Score history chart */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gold" aria-hidden />
            <h3 className="text-sm font-semibold text-ink">
              {t('risk.score.history.title')}
            </h3>
          </div>
          <div
            role="group"
            aria-label={t('risk.score.history.windowLabel')}
            className="flex items-center gap-2"
          >
            {([30, 90, 180] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setHistoryWindow(w)}
                aria-pressed={historyWindow === w}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition',
                  historyWindow === w
                    ? 'border-gold bg-gold/10 text-ink'
                    : 'border-border bg-card text-ink-muted hover:border-gold/60 hover:text-ink',
                )}
              >
                {t(`risk.score.history.window.${w}d`)}
              </button>
            ))}
          </div>
        </div>
        {historyQuery.isLoading ? (
          <div className="h-40 animate-pulse rounded-md bg-muted" />
        ) : historyQuery.data && historyQuery.data.snapshots.length > 0 ? (
          <ScoreHistoryChart snapshots={historyQuery.data.snapshots} />
        ) : (
          <div className="flex h-32 items-center justify-center">
            <p className="text-xs text-ink-muted">{t('risk.score.history.noData')}</p>
          </div>
        )}
      </section>

      {/* Score metadata footer */}
      <p className="text-right text-[11px] text-ink-subtle">
        {t('risk.score.calculatedAt', { when: formatDateTime(data.calculatedAt) })}
        {' · '}
        {t('risk.score.weightsVersion', { version: data.weightsVersion })}
        {' · '}
        {t('risk.score.triggeredBy', { trigger: data.triggeredBy })}
      </p>
    </div>
  );
}

// ─── HealthScoreGauge ──────────────────────────────────────────────────────

function HealthScoreGauge({ score, hasContributors = true }: { score: number; hasContributors?: boolean }) {
  const { t } = useTranslation();
  const color = healthScoreColor(score, hasContributors);
  const riskLabel = healthScoreLabel(score, t, hasContributors);

  // Simple SVG arc gauge
  const radius = 56;
  const cx = 72;
  const cy = 72;
  const startAngle = -210;
  const endAngle = 30;
  const totalDeg = endAngle - startAngle; // 240°
  const scoreDeg = (score / 100) * totalDeg;
  const scoreFinalAngle = startAngle + scoreDeg;

  function polarToXY(deg: number): { x: number; y: number } {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  const start = polarToXY(startAngle);
  const end = polarToXY(scoreFinalAngle);
  const largeArc = scoreDeg > 180 ? 1 : 0;

  const trackStart = polarToXY(startAngle);
  const trackEnd = polarToXY(endAngle);
  const trackLargeArc = totalDeg > 180 ? 1 : 0;

  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-card p-4">
      <svg
        width="144"
        height="120"
        role="img"
        aria-label={t('risk.score.gauge.ariaLabel', { score, risk: riskLabel })}
      >
        {/* Track arc */}
        <path
          d={`M ${trackStart.x} ${trackStart.y} A ${radius} ${radius} 0 ${trackLargeArc} 1 ${trackEnd.x} ${trackEnd.y}`}
          fill="none"
          stroke="var(--border)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Score arc */}
        {score > 0 && (
          <path
            d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
          />
        )}
        {/* Score number */}
        <text
          x={cx}
          y={cy + 8}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="28"
          fontWeight="600"
          fontFamily="monospace"
          fill="currentColor"
        >
          {score}
        </text>
      </svg>
      <p className="mt-1 text-xs font-semibold" style={{ color }}>
        {riskLabel}
      </p>
      <p className="text-[10px] uppercase tracking-widest text-ink-subtle">
        {t('risk.score.gauge.subtitle')}
      </p>
    </div>
  );
}

// ─── FiveDimBreakdownBars ──────────────────────────────────────────────────

const DIM_KEYS = ['legal', 'financial', 'operational', 'reputational', 'compliance'] as const;
type DimKey = typeof DIM_KEYS[number];

function FiveDimBreakdownBars({
  dimensions,
}: {
  dimensions: {
    legal?: { score: number } | null;
    financial?: { score: number } | null;
    operational?: { score: number } | null;
    reputational?: { score: number } | null;
    compliance?: { score: number } | null;
  } | null | undefined;
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">
        {t('risk.score.dimBreakdown.title')}
      </h3>
      <div className="space-y-3">
        {DIM_KEYS.map((dim) => {
          const score = dimensions?.[dim]?.score ?? 0;
          const barColor = healthScoreColor(score);
          return (
            <div key={dim}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-ink-muted">{t(`risk.score.dim.${dim}`)}</span>
                <span className="font-mono font-semibold text-ink">{score}</span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('risk.score.dimBreakdown.barAriaLabel', {
                  dim: t(`risk.score.dim.${dim}`),
                  score,
                })}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${score}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── WhatIfPanel ───────────────────────────────────────────────────────────

function WhatIfPanel({
  correlations,
  baseScore,
}: {
  correlations: HydratedContributingCorrelation[];
  baseScore: number;
}) {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">
        {t('risk.score.whatif.title')}
      </h3>
      <p className="mb-3 text-xs text-ink-muted">
        {t('risk.score.whatif.description')}
      </p>
      <div className="space-y-2">
        {correlations.map((corr) => {
          // Client-side counterfactual: estimate delta by removing this correlation's contribution
          // approximation: reduce probability of each affected dimension proportionally
          const affectedDimCount = corr.dimensionsAffected.length || 1;
          const estimatedContribution = Math.round(
            (corr.probability * corr.impactMultiplier) / (affectedDimCount * 10),
          );
          const deltaLabel = estimatedContribution > 0 ? `+${estimatedContribution}` : '0';

          return (
            <div
              key={corr.correlationId}
              className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink">{corr.ruleId}</p>
                <p className="text-[10px] text-ink-subtle">
                  {t('risk.score.whatif.probabilityLabel', {
                    value: (corr.probability).toFixed(0),
                  })}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold',
                  estimatedContribution > 0
                    ? 'bg-sage/15 text-sage'
                    : 'bg-muted text-ink-muted',
                )}
              >
                {t('risk.score.whatif.deltaLabel', { delta: deltaLabel })}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-ink-subtle">
        {t('risk.score.whatif.disclaimer')}
      </p>
    </section>
  );
}

// ─── MarPerCorrelationList ─────────────────────────────────────────────────

function MarPerCorrelationList({
  correlations,
  marValue,
}: {
  correlations: HydratedContributingCorrelation[];
  marValue: string | null;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (correlations.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold text-ink">
          {t('risk.mar.listTitle')}
        </h3>
        <p className="text-xs text-ink-muted">{t('risk.mar.noCorrelations')}</p>
      </section>
    );
  }

  const totalMarDisplay = marValue
    ? `AED ${Number(marValue).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`
    : t('risk.mar.noContractValue');

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{t('risk.mar.listTitle')}</h3>
        <span className="font-mono text-xs text-ink-muted">
          {t('risk.mar.totalLabel')}: <span className="font-semibold text-ink">{totalMarDisplay}</span>
        </span>
      </div>
      <div className="space-y-2">
        {correlations.map((corr) => {
          const isOpen = expanded === corr.correlationId;
          const marContrib = corr.marContribution
            ? `AED ${Number(corr.marContribution).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`
            : t('risk.mar.noContractValue');

          const severityBand =
            corr.impactMultiplier >= 1.5
              ? 'critical'
              : corr.impactMultiplier >= 1.3
                ? 'high'
                : 'medium';

          return (
            <div
              key={corr.correlationId}
              className="rounded-md border border-border bg-card"
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : corr.correlationId)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <SeverityBadge severity={severityBand} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">{corr.ruleId}</p>
                    {corr.signal.titleEn && (
                      <p className="truncate text-[10px] text-ink-muted">{corr.signal.titleEn}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="shrink-0 font-mono text-xs font-semibold text-ink">
                    {marContrib}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border px-4 py-3">
                  <ReasonCodeDetail correlation={corr} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SeverityBadge({ severity }: { severity: 'critical' | 'high' | 'medium' }) {
  const { t } = useTranslation();
  const styles = {
    critical: 'bg-terracotta/15 text-terracotta border-terracotta/30',
    high: 'bg-gold/15 text-gold border-gold/30',
    medium: 'bg-sage/15 text-sage border-sage/30',
  };
  return (
    <span
      className={cn(
        'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        styles[severity],
      )}
    >
      {t(`risk.mar.severity.${severity}`)}
    </span>
  );
}

function ReasonCodeDetail({ correlation }: { correlation: HydratedContributingCorrelation }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2 text-xs">
      {/* Rule trace */}
      <div>
        <span className="font-medium text-ink-muted">{t('risk.mar.detail.rule')}: </span>
        <span className="text-ink">{correlation.ruleId}</span>
        {correlation.ruleVersionHash && (
          <span className="ms-1 font-mono text-[10px] text-ink-subtle">
            @{correlation.ruleVersionHash.slice(0, 8)}
          </span>
        )}
      </div>

      {/* Match reason */}
      {correlation.matchReason && (
        <div>
          <span className="font-medium text-ink-muted">{t('risk.mar.detail.matchReason')}: </span>
          <span className="text-ink">{correlation.matchReason}</span>
        </div>
      )}

      {/* Matched clause snippet — T13: snippet is display-safe (first 240 chars) */}
      {correlation.matchedClause ? (
        <div>
          <span className="font-medium text-ink-muted">{t('risk.mar.detail.matchedClause')}: </span>
          <span className="text-ink">
            {correlation.matchedClause.clauseTypeV2 && (
              <span className="me-1 font-semibold">[{correlation.matchedClause.clauseTypeV2}]</span>
            )}
            {correlation.matchedClause.snippet ?? t('risk.mar.detail.noSnippet')}
          </span>
        </div>
      ) : (
        <p className="text-ink-subtle">{t('risk.mar.detail.noMatchedClause')}</p>
      )}

      {/* MaR formula — W6 fix: surface all 4 factors per BRD §11.3 */}
      <div className="rounded-md bg-muted/40 px-3 py-2">
        <p className="mb-1 font-medium text-ink-muted">{t('risk.mar.detail.marFormula')}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] text-ink">
          {correlation.contractValue != null && (
            <>
              <span>{t('risk.mar.detail.contractValue')}</span>
              <span className="text-end">
                AED {Number(correlation.contractValue).toLocaleString('en-AE', { maximumFractionDigits: 0 })}
              </span>
            </>
          )}
          {correlation.exposureFraction != null && (
            <>
              <span>{t('risk.mar.detail.exposureFraction')}</span>
              <span className="text-end">×{Number(correlation.exposureFraction).toFixed(2)}</span>
            </>
          )}
          <span>{t('risk.mar.detail.probability')}</span>
          <span className="text-end">{(correlation.probability).toFixed(0)}%</span>
          <span>{t('risk.mar.detail.impactMultiplier')}</span>
          <span className="text-end">×{correlation.impactMultiplier.toFixed(1)}</span>
          <span className="font-semibold">{t('risk.mar.detail.contribution')}</span>
          <span className="text-end font-semibold">
            {correlation.marContribution
              ? `AED ${Number(correlation.marContribution).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`
              : '—'}
          </span>
        </div>
      </div>

      {/* Signal info */}
      <div>
        <span className="font-medium text-ink-muted">{t('risk.mar.detail.signal')}: </span>
        <span className="text-ink">
          {correlation.signal.titleEn ?? t('risk.mar.detail.unknownSignal')}
        </span>
        {correlation.signal.occurredAt && (
          <span className="ms-1 text-ink-subtle">
            ({formatDateTime(correlation.signal.occurredAt)})
          </span>
        )}
      </div>
    </div>
  );
}

// ─── ScoreHistoryChart ─────────────────────────────────────────────────────

const DIM_LINE_COLORS: Record<string, string> = {
  healthScore:     'var(--ink)',
  dimLegal:        'var(--gold)',
  dimFinancial:    'var(--terracotta)',
  dimOperational:  'var(--sage)',
  dimReputational: '#8b5cf6', // purple — no semantic token for this
  dimCompliance:   '#06b6d4', // cyan — no semantic token for this
};

function ScoreHistoryChart({ snapshots }: { snapshots: RiskScoreHistorySnapshot[] }) {
  const { t } = useTranslation();

  const chartData = snapshots.map((s) => ({
    date: formatDateTime(s.calculatedAt),
    healthScore: s.healthScore,
    dimLegal: s.dimLegal,
    dimFinancial: s.dimFinancial,
    dimOperational: s.dimOperational,
    dimReputational: s.dimReputational,
    dimCompliance: s.dimCompliance,
  }));

  const lines = [
    { key: 'healthScore', labelKey: 'risk.score.history.lines.healthScore', strokeWidth: 2.5 },
    { key: 'dimLegal', labelKey: 'risk.score.dim.legal', strokeWidth: 1.5 },
    { key: 'dimFinancial', labelKey: 'risk.score.dim.financial', strokeWidth: 1.5 },
    { key: 'dimOperational', labelKey: 'risk.score.dim.operational', strokeWidth: 1.5 },
    { key: 'dimReputational', labelKey: 'risk.score.dim.reputational', strokeWidth: 1.5 },
    { key: 'dimCompliance', labelKey: 'risk.score.dim.compliance', strokeWidth: 1.5 },
  ] as const;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: 'var(--ink-subtle)' }}
          tickFormatter={(v: string) => v.split(' ')[0] ?? v}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: 'var(--ink-subtle)' }}
          width={28}
        />
        <Tooltip
          contentStyle={{
            fontSize: 11,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
          }}
          labelStyle={{ color: 'var(--ink)', fontWeight: 600 }}
          itemStyle={{ color: 'var(--ink-muted)' }}
        />
        <Legend
          iconType="line"
          wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
          formatter={(value: string) => t(value, { defaultValue: value })}
        />
        {lines.map(({ key, labelKey, strokeWidth }) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={DIM_LINE_COLORS[key]}
            strokeWidth={strokeWidth}
            dot={false}
            activeDot={{ r: 4 }}
            name={labelKey}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
