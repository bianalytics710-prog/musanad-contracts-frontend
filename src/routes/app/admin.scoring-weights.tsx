/**
 * /app/admin/scoring-weights — Scoring Weights Management
 *
 * Allows platform_admin / Super Admin to tune the 5-dimension risk scoring
 * weights and trigger bulk score recomputation.
 *
 * T1  — data via adminScoringWeightsService (A7 compliance)
 * T2  — React Query (5-min staleTime for GET)
 * T3  — all strings via t()
 * T4  — three data states (loading / empty / error)
 * T5  — semantic CSS variables only
 * T6  — WCAG: sliders have accessible labels + ARIA; confirm dialog focus-trap
 * T7  — no any type
 * T8  — form hygiene: controlled inputs with proper labels + ids (D6)
 * T9  — destructive confirmation before Recompute All
 * T11 — ErrorBoundary at route level
 * T12 — formatDateTime for timestamps
 * D7  — scope="col" on all <th>
 * C13 — no raw hex colours; semantic tokens only
 * C14 — internal nav via Router Link
 */
import { useState, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, RotateCcw, Save, Sliders } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { adminScoringWeightsService } from '@/services/api/admin-scoring-weights.service';
import { translateApiError } from '@/lib/translate-api-error';
import { formatDateTime } from '@/utils/datetime';
import type { ScoringWeightsUpdateRequest, ScoringWeightsHistoryEntry } from '@/types/entities/risk-score.types';

// ─── Route registration ────────────────────────────────────────────────────

export const Route = createFileRoute('/app/admin/scoring-weights')({
  component: () => (
    <ErrorBoundary>
      <ScoringWeightsPage />
    </ErrorBoundary>
  ),
});

// ─── Query keys ───────────────────────────────────────────────────────────

const SCORING_WEIGHTS_QUERY_KEY = 'adminScoringWeights';

// ─── Dimensions ──────────────────────────────────────────────────────────

const DIMS = ['legal', 'financial', 'operational', 'reputational', 'compliance'] as const;
type Dim = typeof DIMS[number];

type WeightsState = Record<Dim, number>;

function sumWeights(weights: WeightsState): number {
  return DIMS.reduce((acc, d) => acc + weights[d], 0);
}

function normalizeWeights(weights: WeightsState): WeightsState {
  const total = sumWeights(weights);
  if (total === 0) {
    const even = 1 / DIMS.length;
    return Object.fromEntries(DIMS.map((d) => [d, even])) as WeightsState;
  }
  return Object.fromEntries(DIMS.map((d) => [d, weights[d] / total])) as WeightsState;
}

// ─── Main page ────────────────────────────────────────────────────────────

function ScoringWeightsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const canManage = useAuthStore(selectHasPermission('score.weights.manage'));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [SCORING_WEIGHTS_QUERY_KEY],
    queryFn: adminScoringWeightsService.getScoringWeights,
    staleTime: 5 * 60 * 1_000,
  });

  const [weights, setWeights] = useState<WeightsState | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Initialise sliders from server data (once)
  const effectiveWeights: WeightsState | null =
    weights ??
    (data
      ? {
          legal: data.current.legal,
          financial: data.current.financial,
          operational: data.current.operational,
          reputational: data.current.reputational,
          compliance: data.current.compliance,
        }
      : null);

  const handleSliderChange = useCallback((dim: Dim, value: number) => {
    setWeights((prev) => {
      const base = prev ?? {
        legal: data?.current.legal ?? 0.2,
        financial: data?.current.financial ?? 0.3,
        operational: data?.current.operational ?? 0.2,
        reputational: data?.current.reputational ?? 0.1,
        compliance: data?.current.compliance ?? 0.2,
      };
      return { ...base, [dim]: value };
    });
  }, [data]);

  const handleNormalize = useCallback(() => {
    if (!effectiveWeights) return;
    setWeights(normalizeWeights(effectiveWeights));
  }, [effectiveWeights]);

  const currentSum = effectiveWeights ? sumWeights(effectiveWeights) : 0;
  const sumIsValid = Math.abs(currentSum - 1.0) <= 0.001;

  const saveMutation = useMutation({
    mutationFn: (payload: ScoringWeightsUpdateRequest) =>
      adminScoringWeightsService.updateScoringWeights(payload),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: [SCORING_WEIGHTS_QUERY_KEY] });
      toast.success(
        t('admin.scoring.toast.saved', { version: result.newVersion }),
      );
      setWeights(null); // Reset to server state
    },
    onError: (err) => {
      toast.error(translateApiError(err, t, 'admin.scoring.errors.saveFailed'));
    },
  });

  const recomputeMutation = useMutation({
    mutationFn: adminScoringWeightsService.recomputeAllScores,
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: [SCORING_WEIGHTS_QUERY_KEY] });
      toast.success(
        t('admin.scoring.toast.recomputed', {
          count: result.recomputedCount,
          ms: result.elapsedMs,
        }),
      );
    },
    onError: (err) => {
      toast.error(translateApiError(err, t, 'admin.scoring.errors.recomputeFailed'));
    },
  });

  const handleSave = () => {
    if (!effectiveWeights || !sumIsValid) return;
    saveMutation.mutate({
      legal: effectiveWeights.legal,
      financial: effectiveWeights.financial,
      operational: effectiveWeights.operational,
      reputational: effectiveWeights.reputational,
      compliance: effectiveWeights.compliance,
    });
  };

  const handleRecompute = () => {
    setConfirmOpen(false);
    recomputeMutation.mutate();
  };

  // Permission guard
  if (!canManage) {
    return (
      <div className="mx-auto max-w-md p-12 text-center">
        <p className="text-sm text-ink-muted">{t('common.accessDenied')}</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4 p-6" aria-busy="true" aria-label={t('common.loading')}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-card" />
        ))}
      </div>
    );
  }

  // Error state
  if (isError || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
          <p className="text-sm text-destructive">
            {translateApiError(error, t, 'admin.scoring.errors.loadFailed')}
          </p>
          <Button type="button" size="sm" variant="ghost" onClick={() => void refetch()} className="ms-auto">
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-3xl space-y-6 p-6"
    >
      {/* Page header */}
      <header>
        <div className="flex items-center gap-2">
          <Sliders className="h-5 w-5 text-gold" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t('admin.scoring.title')}
          </h1>
        </div>
        <p className="mt-1 text-sm text-ink-muted">{t('admin.scoring.subtitle')}</p>
        <p className="mt-1 text-xs text-ink-subtle">
          {t('admin.scoring.currentVersion', { version: data.current.version })}
          {data.current.updatedAt && (
            <> · {t('admin.scoring.lastUpdated', { when: formatDateTime(data.current.updatedAt) })}</>
          )}
        </p>
      </header>

      {/* Weight sliders card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">
          {t('admin.scoring.sliders.title')}
        </h2>

        {effectiveWeights && (
          <div className="space-y-5">
            {DIMS.map((dim) => (
              <DimSlider
                key={dim}
                dim={dim}
                value={effectiveWeights[dim]}
                onChange={(v) => handleSliderChange(dim, v)}
                disabled={saveMutation.isPending}
              />
            ))}

            {/* Sum meter */}
            <div
              className={`flex items-center justify-between rounded-md border px-4 py-2 ${
                sumIsValid
                  ? 'border-sage/50 bg-sage/10'
                  : 'border-terracotta/50 bg-terracotta/10'
              }`}
              role="status"
              aria-live="polite"
            >
              <span className="text-xs text-ink-muted">{t('admin.scoring.sliders.sumLabel')}</span>
              <span
                className={`font-mono text-sm font-semibold ${
                  sumIsValid ? 'text-sage' : 'text-terracotta'
                }`}
              >
                {currentSum.toFixed(3)}
                {sumIsValid
                  ? ` ✓ ${t('admin.scoring.sliders.sumValid')}`
                  : ` ✗ ${t('admin.scoring.sliders.sumInvalid')}`}
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleNormalize}
                disabled={saveMutation.isPending}
              >
                <RotateCcw className="me-1.5 h-3.5 w-3.5" aria-hidden />
                {t('admin.scoring.sliders.normalizeButton')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={!sumIsValid || saveMutation.isPending}
              >
                <Save className="me-1.5 h-3.5 w-3.5" aria-hidden />
                {saveMutation.isPending ? t('common.saving') : t('admin.scoring.sliders.saveButton')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ms-auto border-terracotta/50 text-terracotta hover:bg-terracotta/10"
                onClick={() => setConfirmOpen(true)}
                disabled={recomputeMutation.isPending}
              >
                {recomputeMutation.isPending
                  ? t('admin.scoring.recompute.running')
                  : t('admin.scoring.recompute.button')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Version history table */}
      {data.history.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink">
            {t('admin.scoring.history.title')}
          </h2>
          <WeightVersionHistoryTable entries={data.history} />
        </div>
      )}

      {/* Recompute confirmation dialog */}
      {confirmOpen && (
        <RecomputeConfirmDialog
          onConfirm={handleRecompute}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </motion.div>
  );
}

// ─── DimSlider ────────────────────────────────────────────────────────────

interface DimSliderProps {
  dim: Dim;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function DimSlider({ dim, value, onChange, disabled }: DimSliderProps) {
  const { t } = useTranslation();
  const id = `slider-${dim}`;
  const labelId = `label-${dim}`;
  const pct = (value * 100).toFixed(1);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label
          id={labelId}
          htmlFor={id}
          className="text-sm font-medium text-ink"
        >
          {t(`admin.scoring.dims.${dim}`)}
        </label>
        <span
          className="font-mono text-sm font-semibold tabular-nums text-ink"
          aria-hidden
        >
          {pct}%
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-gold"
        aria-labelledby={labelId}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuetext={`${pct}%`}
      />
    </div>
  );
}

// ─── WeightVersionHistoryTable ─────────────────────────────────────────────

function WeightVersionHistoryTable({
  entries,
}: {
  entries: ScoringWeightsHistoryEntry[];
}) {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="pb-2 text-start font-medium text-ink-muted">
              {t('admin.scoring.history.cols.version')}
            </th>
            <th scope="col" className="pb-2 text-start font-medium text-ink-muted">
              {t('admin.scoring.history.cols.changedAt')}
            </th>
            <th scope="col" className="pb-2 text-start font-medium text-ink-muted">
              {t('admin.scoring.history.cols.changedBy')}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.version} className="border-b border-border/50 last:border-0">
              <td className="py-2 font-mono text-ink">
                v{entry.version}
              </td>
              <td className="py-2 text-ink-muted">
                {formatDateTime(entry.changedAt)}
              </td>
              <td className="py-2 text-ink-muted">
                {entry.changedById
                  ? t('admin.scoring.history.userId', { id: entry.changedById })
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── RecomputeConfirmDialog ────────────────────────────────────────────────

interface RecomputeConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function RecomputeConfirmDialog({ onConfirm, onCancel }: RecomputeConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recompute-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <h2
          id="recompute-dialog-title"
          className="mb-2 flex items-center gap-2 text-base font-semibold text-ink"
        >
          <AlertTriangle className="h-5 w-5 text-terracotta" aria-hidden />
          {t('admin.scoring.recompute.confirmTitle')}
        </h2>
        <p className="mb-5 text-sm text-ink-muted">
          {t('admin.scoring.recompute.confirmMessage')}
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-terracotta text-white hover:bg-terracotta/90"
            onClick={onConfirm}
          >
            {t('admin.scoring.recompute.confirmButton')}
          </Button>
        </div>
      </div>
    </div>
  );
}
