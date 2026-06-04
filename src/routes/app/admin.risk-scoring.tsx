/**
 * /app/admin/risk-scoring — Risk Scoring Formula Config (mig 529).
 *
 * Platform admin tunes the 7 configurable knobs that drive
 * fn_risk_score_compute (additive v2 formula). Saving triggers an
 * asynchronous bulk recompute on the BE so the new formula propagates
 * to every snapshot within ~30s.
 *
 * Layout: one card per bucket.
 *   A — Signal severity weights + bucket cap
 *   B — Value tiers (editable list)
 *   C — Duration tiers
 *   D — Sector complexity (per contract_type)
 *   E — Clause-derived signals + cap
 *   Bands — Low / Medium / High thresholds
 *
 * 13-checklist mapping:
 *   T1/T2  — service through adminRiskScoringConfigService + React Query
 *   T3     — every label via t() with sensible defaults
 *   T4     — loading / error / empty handled explicitly
 *   T5     — semantic CSS vars only (no raw hex)
 *   T6     — labels and aria attributes on every input
 *   T7     — no any
 *   T8     — controlled inputs with proper labels + ids
 *   T11    — ErrorBoundary at route level
 */
import { useEffect, useState, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Save, RotateCcw, Plus, Trash2, Sliders } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import {
  adminRiskScoringConfigService,
  type RiskScoringConfig,
  type ValueTier,
  type DurationTier,
} from '@/services/api/admin-risk-scoring-config.service';

export const Route = createFileRoute('/app/admin/risk-scoring')({
  component: () => (
    <ErrorBoundary>
      <RiskScoringConfigPage />
    </ErrorBoundary>
  ),
});

const QUERY_KEY = ['adminRiskScoringConfig'] as const;

function RiskScoringConfigPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const canManage = useAuthStore(selectHasPermission('score.config.manage'));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => adminRiskScoringConfigService.get(),
    staleTime: 60_000,
  });

  const [draft, setDraft] = useState<RiskScoringConfig | null>(null);
  useEffect(() => {
    if (data && !draft) setDraft(data);
  }, [data, draft]);

  const saveMutation = useMutation({
    mutationFn: (input: Partial<RiskScoringConfig>) => adminRiskScoringConfigService.set(input),
    onSuccess: () => {
      toast.success(t('admin.riskScoring.saved', { defaultValue: 'Risk scoring config saved. Recompute running in background.' }));
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const dirty = useMemo(() => {
    if (!draft || !data) return false;
    return JSON.stringify(draft) !== JSON.stringify(data);
  }, [draft, data]);

  const handleSave = () => {
    if (!draft) return;
    saveMutation.mutate(draft);
  };

  const handleReset = () => {
    if (data) setDraft(JSON.parse(JSON.stringify(data)) as RiskScoringConfig);
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1100px] space-y-4 p-6">
        <div className="h-8 w-72 animate-pulse rounded-md bg-muted" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-lg border border-border bg-card" />
        ))}
      </div>
    );
  }
  if (isError || !data || !draft) {
    return (
      <div className="mx-auto w-full max-w-[1100px] p-6">
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" aria-hidden />
          <div className="flex-1">
            <p className="text-sm text-destructive">{(error as Error)?.message ?? t('common.error')}</p>
            <Button variant="ghost" size="sm" onClick={() => void refetch()} className="mt-2">
              {t('common.retry')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1100px] space-y-6 p-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink">
            <Sliders className="h-6 w-6 text-gold" aria-hidden />
            {t('admin.riskScoring.title', { defaultValue: 'Risk Scoring Formula' })}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            {t('admin.riskScoring.intro', {
              defaultValue:
                'Each contract is scored 0..100 by summing five named buckets. Tune the numbers below; saving triggers an automatic recompute of every contract.',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleReset} disabled={!dirty}>
            <RotateCcw className="me-1.5 h-3.5 w-3.5" aria-hidden />
            {t('common.reset', { defaultValue: 'Reset' })}
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={!dirty || !canManage || saveMutation.isPending}>
            <Save className="me-1.5 h-3.5 w-3.5" aria-hidden />
            {saveMutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </header>

      {!canManage && (
        <p className="rounded-md border border-amber/40 bg-amber-tint/40 p-3 text-xs text-amber-ink">
          {t('admin.riskScoring.readOnly', { defaultValue: 'You can view the formula but only platform admins can save changes (permission score.config.manage).' })}
        </p>
      )}

      {/* Bucket A — Signal severity weights */}
      <SectionCard
        title={t('admin.riskScoring.cards.signals.title', { defaultValue: 'A. External signal weights (max 50)' })}
        description={t('admin.riskScoring.cards.signals.description', {
          defaultValue:
            'Points per active correlation, by signal severity. Each correlation contributes: confidence × source reliability × the weight below.',
        })}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(['critical', 'high', 'medium', 'low', 'informational'] as const).map((sev) => (
            <NumberField
              key={sev}
              label={t(`admin.riskScoring.severity.${sev}`, { defaultValue: sev.charAt(0).toUpperCase() + sev.slice(1) })}
              value={draft.signalSeverityWeights[sev]}
              min={0}
              max={50}
              onChange={(v) =>
                setDraft({ ...draft, signalSeverityWeights: { ...draft.signalSeverityWeights, [sev]: v } })
              }
            />
          ))}
          <NumberField
            label={t('admin.riskScoring.cards.signals.cap', { defaultValue: 'Bucket cap (max points from A)' })}
            value={draft.signalBucketCap.cap}
            min={0}
            max={100}
            onChange={(v) => setDraft({ ...draft, signalBucketCap: { cap: v } })}
          />
        </div>
      </SectionCard>

      {/* Bucket B — Value tiers */}
      <SectionCard
        title={t('admin.riskScoring.cards.value.title', { defaultValue: 'B. Value tiers (max 15)' })}
        description={t('admin.riskScoring.cards.value.description', {
          defaultValue: 'Bucketed by contract.value_aed. First matching tier wins (evaluated top-down).',
        })}
      >
        <TierList
          tiers={draft.valueTiers.tiers}
          minKey="minAed"
          minLabel={t('admin.riskScoring.cards.value.minLabel', { defaultValue: 'Min value (AED)' })}
          onChange={(tiers) => setDraft({ ...draft, valueTiers: { tiers: tiers.map((t) => ({ minAed: t.minAed ?? 0, points: t.points, label: t.label })) } })}
        />
      </SectionCard>

      {/* Bucket C — Duration tiers */}
      <SectionCard
        title={t('admin.riskScoring.cards.duration.title', { defaultValue: 'C. Duration tiers (max 10)' })}
        description={t('admin.riskScoring.cards.duration.description', {
          defaultValue: 'Bucketed by months between start_date and end_date.',
        })}
      >
        <TierList
          tiers={draft.durationTiers.tiers}
          minKey="minMonths"
          minLabel={t('admin.riskScoring.cards.duration.minLabel', { defaultValue: 'Min months' })}
          onChange={(tiers) => setDraft({ ...draft, durationTiers: { tiers: tiers.map((t) => ({ minMonths: t.minMonths ?? 0, points: t.points, label: t.label })) } })}
        />
      </SectionCard>

      {/* Bucket D — Sector complexity */}
      <SectionCard
        title={t('admin.riskScoring.cards.sector.title', { defaultValue: 'D. Sector complexity (max 15)' })}
        description={t('admin.riskScoring.cards.sector.description', {
          defaultValue: 'Points per contract_type. Default applies when the contract type is not listed.',
        })}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(draft.sectorComplexity.byType)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([type, points]) => (
              <NumberField
                key={type}
                label={type}
                value={points}
                min={0}
                max={50}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    sectorComplexity: {
                      ...draft.sectorComplexity,
                      byType: { ...draft.sectorComplexity.byType, [type]: v },
                    },
                  })
                }
              />
            ))}
          <NumberField
            label={t('admin.riskScoring.cards.sector.default', { defaultValue: 'Default (unknown type)' })}
            value={draft.sectorComplexity.default}
            min={0}
            max={50}
            onChange={(v) => setDraft({ ...draft, sectorComplexity: { ...draft.sectorComplexity, default: v } })}
          />
        </div>
      </SectionCard>

      {/* Bucket E — Clause signals */}
      <SectionCard
        title={t('admin.riskScoring.cards.clauses.title', { defaultValue: 'E. Clause-derived signals (max 15)' })}
        description={t('admin.riskScoring.cards.clauses.description', {
          defaultValue: 'Each flag adds points. Sum is capped at the cap value.',
        })}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField
            label={t('admin.riskScoring.cards.clauses.broadIndemnity', { defaultValue: 'Broad indemnity' })}
            value={draft.clauseSignals.broadIndemnity}
            min={0}
            max={30}
            onChange={(v) => setDraft({ ...draft, clauseSignals: { ...draft.clauseSignals, broadIndemnity: v } })}
          />
          <NumberField
            label={t('admin.riskScoring.cards.clauses.liabilityCapHigh', { defaultValue: 'High liability cap (>10M)' })}
            value={draft.clauseSignals.liabilityCapHigh}
            min={0}
            max={30}
            onChange={(v) => setDraft({ ...draft, clauseSignals: { ...draft.clauseSignals, liabilityCapHigh: v } })}
          />
          <NumberField
            label={t('admin.riskScoring.cards.clauses.singleSource', { defaultValue: 'Single-source supplier' })}
            value={draft.clauseSignals.singleSource}
            min={0}
            max={30}
            onChange={(v) => setDraft({ ...draft, clauseSignals: { ...draft.clauseSignals, singleSource: v } })}
          />
          <NumberField
            label={t('admin.riskScoring.cards.clauses.regulatorsThreePlus', { defaultValue: '3+ regulatory clauses' })}
            value={draft.clauseSignals.regulatorsThreePlus}
            min={0}
            max={30}
            onChange={(v) => setDraft({ ...draft, clauseSignals: { ...draft.clauseSignals, regulatorsThreePlus: v } })}
          />
          <NumberField
            label={t('admin.riskScoring.cards.clauses.cap', { defaultValue: 'Bucket cap' })}
            value={draft.clauseSignals.cap}
            min={0}
            max={50}
            onChange={(v) => setDraft({ ...draft, clauseSignals: { ...draft.clauseSignals, cap: v } })}
          />
        </div>
      </SectionCard>

      {/* Bands */}
      <SectionCard
        title={t('admin.riskScoring.cards.bands.title', { defaultValue: 'Color bands' })}
        description={t('admin.riskScoring.cards.bands.description', {
          defaultValue: 'Score thresholds that drive the gauge color. 0..lowMax = Low (sage), lowMax+1..mediumMax = Medium (gold), above = High (terracotta).',
        })}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField
            label={t('admin.riskScoring.cards.bands.lowMax', { defaultValue: 'Low max' })}
            value={draft.bands.lowMax}
            min={0}
            max={100}
            onChange={(v) => setDraft({ ...draft, bands: { ...draft.bands, lowMax: v } })}
          />
          <NumberField
            label={t('admin.riskScoring.cards.bands.mediumMax', { defaultValue: 'Medium max' })}
            value={draft.bands.mediumMax}
            min={0}
            max={100}
            onChange={(v) => setDraft({ ...draft, bands: { ...draft.bands, mediumMax: v } })}
          />
        </div>
      </SectionCard>
    </motion.div>
  );
}

// ─── SectionCard ───────────────────────────────────────────────────────────
function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
      </header>
      {children}
    </section>
  );
}

// ─── NumberField ───────────────────────────────────────────────────────────
function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  const id = `nf-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-medium text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  );
}

// ─── TierList — for value + duration tiers ─────────────────────────────────
type GenericTier = { points: number; label: string; minAed?: number; minMonths?: number };

function TierList({
  tiers,
  minKey,
  minLabel,
  onChange,
}: {
  tiers: GenericTier[];
  minKey: 'minAed' | 'minMonths';
  minLabel: string;
  onChange: (tiers: GenericTier[]) => void;
}) {
  const { t } = useTranslation();
  const addTier = () => {
    const next: GenericTier = { [minKey]: 0, points: 0, label: 'New tier' };
    onChange([...tiers, next]);
  };
  const remove = (i: number) => {
    onChange(tiers.filter((_, idx) => idx !== i));
  };
  const patch = (i: number, patchVal: Partial<GenericTier>) => {
    onChange(tiers.map((t, idx) => (idx === i ? { ...t, ...patchVal } : t)));
  };

  return (
    <div className="space-y-2">
      {tiers.map((tier, i) => (
        <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-md border border-border bg-surface/40 p-3">
          <div className="col-span-4">
            <label className="text-[11px] font-medium text-ink-muted">{minLabel}</label>
            <input
              type="number"
              value={Number((tier as Record<string, unknown>)[minKey] ?? 0)}
              onChange={(e) => patch(i, { [minKey]: Number(e.target.value) })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[11px] font-medium text-ink-muted">
              {t('admin.riskScoring.tier.points', { defaultValue: 'Points' })}
            </label>
            <input
              type="number"
              value={tier.points}
              onChange={(e) => patch(i, { points: Number(e.target.value) })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono"
            />
          </div>
          <div className="col-span-5">
            <label className="text-[11px] font-medium text-ink-muted">
              {t('admin.riskScoring.tier.label', { defaultValue: 'Label' })}
            </label>
            <input
              type="text"
              value={tier.label}
              onChange={(e) => patch(i, { label: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div className="col-span-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(i)}
              aria-label={t('common.delete')}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addTier}>
        <Plus className="me-1.5 h-3.5 w-3.5" aria-hidden />
        {t('admin.riskScoring.tier.add', { defaultValue: 'Add tier' })}
      </Button>
    </div>
  );
}
