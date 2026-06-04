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
import { useState, useMemo } from 'react';
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
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, Sparkles, Info } from 'lucide-react';
import { useContractRiskScore, useContractRiskScoreHistory } from '../hooks/useRiskScore';
import { formatDateTime } from '@/utils/datetime';
import { cn } from '@/lib/utils';
import type {
  HydratedContributingCorrelation,
  RiskScoreAddend,
  RiskScoreHistorySnapshot,
} from '@/types/entities/risk-score.types';

/**
 * Picks the human-readable label for a correlation. Mig 528 added ruleName
 * via JOIN to correlation_rule; fall back to signal title, then ruleId.
 */
function correlationLabel(corr: HydratedContributingCorrelation): string {
  return corr.ruleName ?? corr.signal?.titleEn ?? corr.ruleId;
}

interface ContractRiskTabProps {
  contractId: number;
}

// ─── Risk score color band ─────────────────────────────────────────────────
// E-rev-8 fix: this metric is consumed as a RISK score everywhere else
// (dashboard "High-risk contracts" list orders DESC by it; ContractInfoCards
// labels >=60 as "high"). Previously this tab treated it as a HEALTH score
// (higher = healthier → "low risk") producing a contradictory label vs the
// dashboard. Aligned thresholds: <30 low, 30–60 medium, >=60 high.
// When score is 0 with no contributing correlations, the contract is
// effectively unscored (bootstrap baseline; no signals fired yet) — surface
// "Insufficient data" in muted neutral instead of "low risk".

function healthScoreColor(score: number, hasContributors = true): string {
  if (!hasContributors && score === 0) return 'var(--ink-subtle)';
  if (score < 30) return 'var(--sage)';
  if (score < 60) return 'var(--gold)';
  return 'var(--terracotta)';
}

function healthScoreLabel(score: number, t: (key: string) => string, hasContributors = true): string {
  if (!hasContributors && score === 0) return t('risk.score.gauge.insufficient');
  if (score < 30) return t('risk.score.gauge.low');
  if (score < 60) return t('risk.score.gauge.medium');
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
        <HealthScoreGauge
          score={data.healthScore}
          hasContributors={(data.contributingCorrelations?.length ?? 0) > 0}
          addends={data.addends ?? []}
          bucketSubtotals={data.bucketSubtotals ?? {}}
          band={data.band}
        />
        <FiveDimBreakdownBars
          dimensions={data.dimensions}
          addends={data.addends ?? []}
        />
      </div>

      {/* Row 1.5 — Narrative banner (mig 528). Plain-English one-liner
          explaining why this score is where it is. Always shown when present. */}
      {data.narrative && (
        <NarrativeBanner narrative={data.narrative} />
      )}

      {/* Row 2 — What-if panel */}
      {data.contributingCorrelations.length > 0 && (
        <WhatIfPanel correlations={data.contributingCorrelations} baseScore={data.healthScore} />
      )}

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

// ─── NarrativeBanner — plain-English one-liner from BE (mig 528) ───────────
function NarrativeBanner({ narrative }: { narrative: string }) {
  const { t } = useTranslation();
  return (
    <section
      className="flex items-start gap-3 rounded-lg border border-gold/30 bg-gold/5 p-4"
      role="region"
      aria-label={t('risk.score.narrative.ariaLabel', { defaultValue: 'Risk score summary' })}
    >
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
      <p className="text-sm leading-relaxed text-ink">{narrative}</p>
    </section>
  );
}

// ─── HealthScoreGauge ──────────────────────────────────────────────────────

function HealthScoreGauge({
  score,
  hasContributors = true,
  addends = [],
  bucketSubtotals = {},
  band,
}: {
  score: number;
  hasContributors?: boolean;
  addends?: RiskScoreAddend[];
  bucketSubtotals?: Record<string, number>;
  band?: string;
}) {
  const { t } = useTranslation();
  const [showBreakdown, setShowBreakdown] = useState(false);
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
    <div
      className="relative flex flex-col items-center rounded-lg border border-border bg-card p-4"
      onPointerEnter={() => setShowBreakdown(true)}
      onPointerLeave={() => setShowBreakdown(false)}
    >
      <button
        type="button"
        className="group flex flex-col items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 rounded-md"
        aria-expanded={showBreakdown}
        aria-controls="risk-score-breakdown"
        onFocus={() => setShowBreakdown(true)}
        onBlur={() => setShowBreakdown(false)}
      >
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
          {band ? `${band} risk` : riskLabel}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-ink-subtle">
          {t('risk.score.gauge.subtitle')}
        </p>
        <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-ink-subtle">
          <Info className="h-3 w-3" aria-hidden />
          {t('risk.score.gauge.hoverHint', { defaultValue: 'Hover for breakdown' })}
        </p>
      </button>

      {/* Hover/focus breakdown popover */}
      {showBreakdown && addends.length > 0 && (
        <ScoreBreakdownCard
          id="risk-score-breakdown"
          score={score}
          addends={addends}
          bucketSubtotals={bucketSubtotals}
        />
      )}
    </div>
  );
}

// ─── ScoreBreakdownCard — the hover popover with the actual addends ──────
function ScoreBreakdownCard({
  id,
  score,
  addends,
  bucketSubtotals,
}: {
  id: string;
  score: number;
  addends: RiskScoreAddend[];
  bucketSubtotals: Record<string, number>;
}) {
  const { t } = useTranslation();
  const total =
    (bucketSubtotals.A ?? 0) +
    (bucketSubtotals.B ?? 0) +
    (bucketSubtotals.C ?? 0) +
    (bucketSubtotals.D ?? 0) +
    (bucketSubtotals.E ?? 0);
  return (
    <div
      id={id}
      role="dialog"
      aria-label={t('risk.score.gauge.breakdownAriaLabel', { defaultValue: 'Risk score calculation' })}
      className="absolute left-full top-0 z-20 ms-3 w-[340px] rounded-lg border border-border bg-card shadow-lg p-3"
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-ink">
          {t('risk.score.gauge.breakdownTitle', { defaultValue: 'How this score is calculated' })}
        </h4>
        <span className="font-mono text-[11px] text-ink-subtle">
          {t('risk.score.gauge.totalLine', { defaultValue: 'Total {{score}}/100', score })}
        </span>
      </header>
      <ul className="space-y-1.5">
        {addends.map((a, i) => (
          <li key={i} className="flex flex-col gap-0.5 rounded-md bg-surface/60 p-2 text-[11px]">
            <div className="flex items-start justify-between gap-2">
              <span className="flex-1 font-medium text-ink">
                <span className="me-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-gold/20 text-[9px] font-bold text-gold">
                  {a.bucket}
                </span>
                {a.label}
              </span>
              <span className="shrink-0 font-mono font-semibold text-ink">+{a.points}</span>
            </div>
            <span className="ms-5 text-[10px] text-ink-muted">{a.detail}</span>
          </li>
        ))}
      </ul>
      <footer className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[11px]">
        <span className="font-medium text-ink-muted">
          {t('risk.score.gauge.sumLine', { defaultValue: 'Sum of addends' })}
        </span>
        <span className="font-mono font-semibold text-ink">{total} → {score}/100</span>
      </footer>
      {total !== score && (
        <p className="mt-1 text-[10px] text-ink-subtle">
          {t('risk.score.gauge.clampNote', {
            defaultValue: 'Clamped to 0..100',
          })}
        </p>
      )}
    </div>
  );
}

// ─── FiveDimBreakdownBars ──────────────────────────────────────────────────

const DIM_KEYS = ['legal', 'financial', 'operational', 'reputational', 'compliance'] as const;
type DimKey = typeof DIM_KEYS[number];

/**
 * Mig 529 — each dim is a rebucketing of one or more of the gauge addend
 * buckets (A..E). When the user expands a dim, we surface the addends from
 * the source bucket(s) so the bar is no longer an opaque number.
 *
 * Mapping mirrors fn_risk_score_compute's per-dim aggregation:
 *   legal        ← bucket D (sector complexity)
 *   financial    ← bucket B (value tier)
 *   operational  ← buckets C (duration) + E (clauses)
 *   reputational ← bucket A (signals, capped — dim shows half)
 *   compliance   ← bucket A (signals, capped — dim shows full)
 */
const DIM_TO_BUCKETS: Record<DimKey, string[]> = {
  legal:        ['D'],
  financial:    ['B'],
  operational:  ['C', 'E'],
  reputational: ['A'],
  compliance:   ['A'],
};

function FiveDimBreakdownBars({
  dimensions,
  addends = [],
}: {
  dimensions: {
    legal?:        { score: number; weight?: number | null; reasons?: string[] | null } | null;
    financial?:    { score: number; weight?: number | null; reasons?: string[] | null } | null;
    operational?:  { score: number; weight?: number | null; reasons?: string[] | null } | null;
    reputational?: { score: number; weight?: number | null; reasons?: string[] | null } | null;
    compliance?:   { score: number; weight?: number | null; reasons?: string[] | null } | null;
  } | null | undefined;
  addends?: RiskScoreAddend[];
}) {
  const { t } = useTranslation();
  const [expandedDim, setExpandedDim] = useState<DimKey | null>(null);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">
        {t('risk.score.dimBreakdown.title')}
      </h3>
      <div className="space-y-2">
        {DIM_KEYS.map((dim) => {
          const score = dimensions?.[dim]?.score ?? 0;
          const weight = dimensions?.[dim]?.weight ?? null;
          const reasons = dimensions?.[dim]?.reasons ?? [];
          const barColor = healthScoreColor(score);
          const isExpanded = expandedDim === dim;
          return (
            <div key={dim} className="rounded-md border border-transparent transition-colors hover:border-border">
              <button
                type="button"
                onClick={() => setExpandedDim(isExpanded ? null : dim)}
                className="block w-full px-2 py-1.5 text-start focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-expanded={isExpanded}
                aria-controls={`risk-dim-${dim}-detail`}
              >
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 text-ink-muted">
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {t(`risk.score.dim.${dim}`)}
                    {typeof weight === 'number' && (
                      <span className="ms-1 font-mono text-[10px] text-ink-subtle">
                        · w {(weight * 100).toFixed(0)}%
                      </span>
                    )}
                  </span>
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
              </button>
              {isExpanded && (
                <div id={`risk-dim-${dim}-detail`} className="mx-2 my-2 rounded-md border border-border bg-surface/40 p-3 text-xs">
                  <DimensionDetail
                    dim={dim}
                    score={score}
                    addends={addends}
                    legacyReasons={reasons}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DimensionDetail — addends that drove a particular dim ───────────────
function DimensionDetail({
  dim,
  score,
  addends,
  legacyReasons,
}: {
  dim: DimKey;
  score: number;
  addends: RiskScoreAddend[];
  legacyReasons: string[];
}) {
  const { t } = useTranslation();
  const buckets = DIM_TO_BUCKETS[dim];
  const matched = addends.filter((a) => buckets.includes(a.bucket));
  const hasAddends = matched.length > 0;
  const usesLegacy = !hasAddends && legacyReasons.length > 0;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="font-semibold text-ink">
          {t('risk.score.dimBreakdown.detailTitle', { defaultValue: 'What drove this score' })}
        </p>
        <p className="font-mono text-[10px] text-ink-subtle">
          {t('risk.score.dimBreakdown.derivedFrom', {
            defaultValue: 'from bucket{{plural}} {{buckets}}',
            buckets: buckets.join(' + '),
            plural: buckets.length > 1 ? 's' : '',
          })}
        </p>
      </div>

      {hasAddends ? (
        <>
          <ul className="space-y-1.5">
            {matched.map((a, i) => (
              <li key={i} className="flex flex-col gap-0.5 rounded-md bg-card px-2 py-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex-1 font-medium text-ink">
                    <span className="me-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-gold/20 text-[9px] font-bold text-gold">
                      {a.bucket}
                    </span>
                    {a.label}
                  </span>
                  <span className="shrink-0 font-mono font-semibold text-ink">+{a.points}</span>
                </div>
                <span className="ms-5 text-[10px] text-ink-muted">{a.detail}</span>
              </li>
            ))}
          </ul>
          {dim === 'reputational' && (
            <p className="mt-2 text-[10px] text-ink-subtle">
              {t('risk.score.dimBreakdown.reputationalNote', {
                defaultValue: 'Reputational shows half of bucket A (signal load).',
              })}
            </p>
          )}
          {dim === 'operational' && score === 0 && (
            <p className="mt-2 text-[10px] text-ink-subtle">
              {t('risk.score.dimBreakdown.operationalEmpty', {
                defaultValue: 'No duration or clause-derived factors yet.',
              })}
            </p>
          )}
        </>
      ) : usesLegacy ? (
        <ul className="space-y-1.5">
          {legacyReasons.map((line, i) => (
            <li key={i} className="flex gap-2 text-ink">
              <span aria-hidden className="text-ink-subtle">·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">
          {t('risk.score.dimBreakdown.detailEmpty', {
            defaultValue: 'No factors currently driving this dimension.',
          })}
        </p>
      )}
    </div>
  );
}

// ─── WhatIfPanel ───────────────────────────────────────────────────────────

/**
 * Counterfactual delta — how many score points the contract would shed if
 * this signal were resolved. The formula matches the existing client-side
 * approximation; see "How is this calculated" tooltip for the breakdown.
 */
function correlationDelta(corr: HydratedContributingCorrelation): number {
  const dims = corr.dimensionsAffected.length || 1;
  return Math.round((corr.probability * corr.impactMultiplier) / (dims * 10));
}

interface WhatIfRow {
  label: string;
  members: HydratedContributingCorrelation[];
  totalDelta: number;
}

/**
 * Group correlations by ruleName so "Weather FM Eligible" firing 3 times
 * collapses to one row. Each row's delta is the sum of member deltas.
 */
function groupCorrelations(correlations: HydratedContributingCorrelation[]): WhatIfRow[] {
  const groups = new Map<string, WhatIfRow>();
  for (const c of correlations) {
    const label = correlationLabel(c);
    const delta = correlationDelta(c);
    const existing = groups.get(label);
    if (existing) {
      existing.members.push(c);
      existing.totalDelta += delta;
    } else {
      groups.set(label, { label, members: [c], totalDelta: delta });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.totalDelta - a.totalDelta);
}

function WhatIfPanel({
  correlations,
  baseScore: _baseScore,
}: {
  correlations: HydratedContributingCorrelation[];
  baseScore: number;
}) {
  const { t } = useTranslation();
  const rows = useMemo(() => groupCorrelations(correlations), [correlations]);

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">
        {t('risk.score.whatif.title')}
      </h3>
      <p className="mb-3 text-xs text-ink-muted">
        {t('risk.score.whatif.description')}
      </p>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <WhatIfRowView key={i} row={row} />
        ))}
      </div>
      <p className="mt-2 text-[10px] text-ink-subtle">
        {t('risk.score.whatif.disclaimer')}
      </p>
    </section>
  );
}

function WhatIfRowView({ row }: { row: WhatIfRow }) {
  const { t } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(false);
  const deltaLabel = row.totalDelta > 0 ? `-${row.totalDelta}` : '0';
  const memberCount = row.members.length;

  return (
    <div className="relative flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
      <p className="min-w-0 flex-1 truncate text-xs font-medium text-ink">
        {row.label}
        {memberCount > 1 && (
          <span className="ms-1 font-mono text-[10px] text-ink-muted">
            ({memberCount}×)
          </span>
        )}
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onPointerEnter={() => setShowTooltip(true)}
          onPointerLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          aria-label={t('risk.score.whatif.tooltipAria', { defaultValue: 'How this delta is calculated' })}
          className="rounded-full p-0.5 text-ink-subtle transition hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/60"
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold',
            row.totalDelta > 0 ? 'bg-sage/15 text-sage' : 'bg-muted text-ink-muted',
          )}
        >
          {t('risk.score.whatif.deltaLabel', { delta: deltaLabel })}
        </span>
      </div>
      {showTooltip && <WhatIfTooltip row={row} />}
    </div>
  );
}

function WhatIfTooltip({ row }: { row: WhatIfRow }) {
  const { t } = useTranslation();
  return (
    <div
      role="tooltip"
      className="absolute right-0 top-full z-30 mt-1 w-[360px] rounded-lg border border-border bg-card p-3 shadow-lg"
    >
      <p className="mb-2 text-xs font-semibold text-ink">
        {t('risk.score.whatif.tooltipTitle', { defaultValue: 'How this delta is calculated' })}
      </p>
      <p className="mb-2 text-[11px] text-ink-muted">
        {t('risk.score.whatif.tooltipFormula', {
          defaultValue: 'Per signal: round(probability × impact / (dims × 10)). Group total = sum across firings.',
        })}
      </p>
      <ul className="space-y-1.5">
        {row.members.map((c, i) => {
          const dims = c.dimensionsAffected.length || 1;
          const pts = correlationDelta(c);
          return (
            <li key={i} className="rounded-md bg-surface/60 p-2 text-[11px]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-ink">
                  {row.members.length > 1
                    ? t('risk.score.whatif.firing', { defaultValue: 'Firing {{n}}', n: i + 1 })
                    : t('risk.score.whatif.signal', { defaultValue: 'Signal' })}
                </span>
                <span className="font-mono text-ink-muted">-{pts} pts</span>
              </div>
              <p className="mt-0.5 text-[10px] text-ink-muted">
                round({c.probability} × {c.impactMultiplier.toFixed(1)} / ({dims} × 10)) = {pts}
              </p>
              {c.severity && (
                <p className="text-[10px] text-ink-subtle">
                  {t('risk.score.whatif.severity', { defaultValue: 'Severity: {{sev}}', sev: c.severity })}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 border-t border-border pt-2 text-right font-mono text-[11px] font-semibold text-ink">
        {t('risk.score.whatif.tooltipTotal', { defaultValue: 'Total: -{{n}} pts', n: row.totalDelta })}
      </p>
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
