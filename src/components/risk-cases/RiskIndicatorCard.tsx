/**
 * RiskIndicatorCard — 2026-06-17 (A+B).
 *
 * Presents the engine's risk number honestly:
 *  - Relabelled "Risk indicator" (not a bare "score/100") — it's a weighted
 *    indicator, not a calibrated probability.
 *  - Split into ACTIVE risk (bucket A — live signals/correlations) vs INHERENT
 *    risk (buckets B+C+D+E — contract value, duration, sector, clause exposure),
 *    so "this is a big, long contract" isn't confused with "something is wrong".
 *  - Expandable breakdown of the exact addends that produced the number.
 *
 * Data: useContractRiskScore → fn_risk_score_explain (healthScore, band,
 * bucketSubtotals A..E, addends[]).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Activity, Layers, Info } from 'lucide-react';
import { useContractRiskScore } from '@/features/contracts/hooks/useRiskScore';

interface RiskIndicatorCardProps {
  contractId: number;
}

function bandTone(band: string | undefined): string {
  if (band === 'High') return 'bg-[var(--terracotta)]/15 text-[var(--terracotta)] border-[var(--terracotta)]/40';
  if (band === 'Medium') return 'bg-gold/15 text-gold border-gold/40';
  return 'bg-sage/15 text-sage border-sage/40';
}

export function RiskIndicatorCard({ contractId }: RiskIndicatorCardProps) {
  const { t } = useTranslation();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const { data, isLoading, isError } = useContractRiskScore(contractId);

  // No score row yet, or not permitted — render nothing (the managed-risks
  // list below is the primary content).
  if (isLoading || isError || !data) return null;

  const total = data.healthScore ?? 0;
  const buckets = data.bucketSubtotals ?? {};
  const active = Number(buckets['A'] ?? 0); // live signals
  const inherent =
    Number(buckets['B'] ?? 0) + Number(buckets['C'] ?? 0) +
    Number(buckets['D'] ?? 0) + Number(buckets['E'] ?? 0); // structural exposure
  const addends = data.addends ?? [];
  const activeAddends = addends.filter((a) => a.bucket === 'A');
  const inherentAddends = addends.filter((a) => a.bucket !== 'A');

  const Segment = ({
    icon: Icon,
    label,
    hint,
    points,
    barClass,
  }: {
    icon: typeof Activity;
    label: string;
    hint: string;
    points: number;
    barClass: string;
  }) => (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1 text-ink">
          <Icon className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
          {label}
        </span>
        <span className="font-mono font-semibold text-ink">+{points}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${label}: ${points} points`}>
        <div className={`h-full ${barClass}`} style={{ width: `${Math.min(100, points)}%` }} />
      </div>
      <p className="mt-0.5 text-[10px] text-ink-subtle">{hint}</p>
    </div>
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">
          {t('contracts.risk.indicator.title', { defaultValue: 'Risk indicator' })}
        </h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-semibold text-ink">{total}</span>
          <span className="text-xs text-ink-subtle">/ 100</span>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${bandTone(data.band)}`}>
            {data.band ?? '—'}
          </span>
        </div>
      </div>

      <p className="mb-3 text-[11px] text-ink-muted">
        {t('contracts.risk.indicator.disclaimer', {
          defaultValue:
            'A weighted indicator (not a calibrated probability): live signals plus the contract’s structural exposure.',
        })}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Segment
          icon={Activity}
          label={t('contracts.risk.indicator.active', { defaultValue: 'Active risk (live signals)' })}
          hint={t('contracts.risk.indicator.activeHint', { defaultValue: 'Correlations currently firing on this contract.' })}
          points={active}
          barClass="bg-[var(--terracotta)]"
        />
        <Segment
          icon={Layers}
          label={t('contracts.risk.indicator.inherent', { defaultValue: 'Inherent risk (exposure)' })}
          hint={t('contracts.risk.indicator.inherentHint', { defaultValue: 'Value, duration, sector and clause exposure — present even with no signals.' })}
          points={inherent}
          barClass="bg-gold"
        />
      </div>

      {addends.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            aria-expanded={showBreakdown}
            className="mt-3 inline-flex items-center gap-1 rounded text-[11px] text-gold hover:underline focus:outline-none focus:ring-1 focus:ring-gold/60"
          >
            {showBreakdown ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {t('contracts.risk.indicator.howCalc', { defaultValue: 'How is this calculated?' })}
          </button>

          {showBreakdown && (
            <div className="mt-2 space-y-3 rounded-md border border-border bg-surface/50 p-3">
              {[
                { heading: t('contracts.risk.indicator.active', { defaultValue: 'Active risk (live signals)' }), items: activeAddends },
                { heading: t('contracts.risk.indicator.inherent', { defaultValue: 'Inherent risk (exposure)' }), items: inherentAddends },
              ].map((group) =>
                group.items.length === 0 ? null : (
                  <div key={group.heading}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">{group.heading}</p>
                    <ul className="space-y-1">
                      {group.items.map((a, i) => (
                        <li key={i} className="flex items-start justify-between gap-2 text-[11px]">
                          <span className="flex-1 text-ink">
                            <span className="me-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-ink-muted">
                              {a.bucket}
                            </span>
                            {a.label}
                            {a.detail && <span className="ms-1 block ps-5 text-[10px] text-ink-subtle">{a.detail}</span>}
                          </span>
                          <span className="shrink-0 font-mono font-semibold text-ink">+{a.points}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
              <p className="flex items-start gap-1 border-t border-border pt-2 text-[10px] text-ink-subtle">
                <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                {t('contracts.risk.indicator.formulaNote', {
                  defaultValue:
                    'Each signal = confidence × source reliability × severity weight. Weights and tiers are admin-configurable.',
                })}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
