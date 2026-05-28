/**
 * /app/compliance/regulatory-cascade/:runId — Run detail view.
 *
 * CR-M — Labor-Law Cascade detail: contractor-by-contractor remediation
 * table with ICV-impact section.
 *
 * Standards: A7, C13, C14, D6, D7, T3–T4, T10, T11, T12, WCAG AA.
 */
import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, FileEdit, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { regulatoryCascadeService } from '@/services/api/regulatory-cascade.service';
import { translateApiError } from '@/lib/translate-api-error';
import { formatDateTime } from '@/utils/datetime';
import type {
  RegulatoryCascadeItemDetail,
  RemediationStatus,
  HeadcountBand,
} from '@/types/entities/regulatory-cascade.types';
import { REMEDIATION_STATUSES } from '@/types/entities/regulatory-cascade.types';

export const Route = createFileRoute(
  '/app/compliance/regulatory-cascade/$runId',
)({
  component: () => (
    <ErrorBoundary>
      <CascadeRunDetailView />
    </ErrorBoundary>
  ),
});

// ─────────────────────────────────────────────────────────────
// Semantic colour maps — no raw hex (C13)
// ─────────────────────────────────────────────────────────────
const REMEDIATION_COLORS: Record<RemediationStatus, string> = {
  pending:     'bg-warning/10 text-warning border-warning/30',
  in_progress: 'bg-info/10 text-info border-info/30',
  amended:     'bg-success/10 text-success border-success/30',
  dismissed:   'bg-muted text-ink-muted border-border',
  resolved:    'bg-success/20 text-success border-success/40',
};

const BAND_COLORS: Record<HeadcountBand, string> = {
  '<20':   'bg-muted text-ink-muted border-border',
  '20-49': 'bg-gold/10 text-ink border-gold/30',
  '50+':   'bg-terracotta/10 text-terracotta border-terracotta/30',
};

function formatAedRange(min: number, max: number): string {
  const fmt = (n: number): string => {
    try {
      return new Intl.NumberFormat('en-AE', {
        style: 'currency',
        currency: 'AED',
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(n);
    } catch {
      if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
      return `AED ${n.toFixed(0)}`;
    }
  };
  if (min === max) return fmt(min);
  return `${fmt(min)} – ${fmt(max)}`;
}

// ─────────────────────────────────────────────────────────────
// Main detail view
// ─────────────────────────────────────────────────────────────
function CascadeRunDetailView() {
  const { t } = useTranslation();
  const { runId } = Route.useParams();
  const numericRunId = Number(runId);

  const canRead       = useAuthStore(selectHasPermission('regulatory.cascade.read'));
  const canRun        = useAuthStore(selectHasPermission('regulatory.cascade.run'));
  const canDraftAmend = useAuthStore(selectHasPermission('advisory.draft.review'));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['regulatory-cascade-detail', numericRunId],
    queryFn: () => regulatoryCascadeService.getById(numericRunId),
    enabled: canRead && !isNaN(numericRunId),
    staleTime: 30_000,
  });

  const run = data;

  if (!canRead) {
    return (
      <div className="mx-auto w-full max-w-[1400px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">{t('common.accessDenied')}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] space-y-6 p-6"
    >
      {/* Back nav */}
      <div>
        <Link
          to="/app/compliance/regulatory-cascade"
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary rounded"
          aria-label={t('regulatory.cascade.detail.backToList')}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('regulatory.cascade.detail.backToList')}
        </Link>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4" aria-busy="true">
          <div className="h-8 w-64 animate-pulse rounded bg-surface" aria-hidden="true" />
          <div className="h-48 animate-pulse rounded-lg bg-surface" aria-hidden="true" />
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div
          className="flex items-center gap-3 rounded-lg border border-error/30 bg-error/5 p-4"
          role="alert"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-error" aria-hidden="true" />
          <p className="text-sm text-error">
            {translateApiError(error, t, 'regulatory.cascade.errors.fetchFailed')}
          </p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            <RefreshCcw className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('common.retry')}
          </Button>
        </div>
      )}

      {/* Content */}
      {!isLoading && !isError && run && (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">
                {run.regulationRef ?? t('regulatory.cascade.detail.unnamedRun')}
              </h1>
              <p className="mt-1 text-xs text-ink-muted">
                {t('regulatory.cascade.detail.runAt')}
                {' '}
                {formatDateTime(run.runAt, { showTime: true })}
                {run.createdByName ? ` · ${run.createdByName}` : ''}
              </p>
            </div>
          </div>

          {/* Summary strip */}
          <section
            aria-label={t('regulatory.cascade.detail.summaryLabel')}
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            <SummaryTile
              label={t('regulatory.cascade.detail.summary.affectedContractors')}
              value={String(run.affectedContractorCount)}
            />
            <SummaryTile
              label={t('regulatory.cascade.detail.summary.nonCompliant')}
              value={String(run.summary.totals.nonCompliantCount)}
              variant="warning"
            />
            <SummaryTile
              label={t('regulatory.cascade.detail.summary.penaltyMin')}
              value={formatAedRange(run.totalPenaltyMinAed, run.totalPenaltyMinAed)}
            />
            <SummaryTile
              label={t('regulatory.cascade.detail.summary.penaltyMax')}
              value={formatAedRange(run.totalPenaltyMaxAed, run.totalPenaltyMaxAed)}
              variant="risk"
            />
          </section>

          {/* Remediation table */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-ink">
              {t('regulatory.cascade.detail.remediationTable.heading')}
            </h2>
            {run.items.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-8 text-center">
                <p className="text-sm text-ink-muted">
                  {t('regulatory.cascade.detail.remediationTable.empty')}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
                <table className="min-w-full text-sm">
                  <thead className="bg-surface">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        {t('regulatory.cascade.detail.columns.contractor')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        {t('regulatory.cascade.detail.columns.emirate')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        {t('regulatory.cascade.detail.columns.headcountBand')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        {t('regulatory.cascade.detail.columns.affectedClauses')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                        {t('regulatory.cascade.detail.columns.penaltyExposure')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                        {t('regulatory.cascade.detail.columns.icvAttachments')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        {t('regulatory.cascade.detail.columns.remediationStatus')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        <span className="sr-only">{t('common.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {run.items.map((item) => (
                      <CascadeItemRow
                        key={item.id}
                        item={item}
                        canRead={canRead}
                        canRun={canRun}
                        canDraftAmend={canDraftAmend}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ICV Impact section */}
          <IcvImpactSection items={run.items} />
        </>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// SummaryTile — KPI tile for run header
// ─────────────────────────────────────────────────────────────
function SummaryTile({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: string;
  variant?: 'default' | 'warning' | 'risk';
}) {
  const variantClass =
    variant === 'risk'
      ? 'border-terracotta/30 bg-terracotta/5'
      : variant === 'warning'
        ? 'border-warning/30 bg-warning/5'
        : 'border-border bg-card';

  const valueClass =
    variant === 'risk'
      ? 'text-terracotta'
      : variant === 'warning'
        ? 'text-warning'
        : 'text-ink';

  return (
    <div className={`rounded-lg border p-4 ${variantClass}`}>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CascadeItemRow — per-contractor row with inline status + actions
// ─────────────────────────────────────────────────────────────
function CascadeItemRow({
  item,
  canRead,
  canRun,
  canDraftAmend,
}: {
  item: RegulatoryCascadeItemDetail;
  canRead: boolean;
  canRun: boolean;
  canDraftAmend: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [statusNote, setStatusNote] = useState('');
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<RemediationStatus>(
    item.remediationStatus,
  );

  const setStatusMutation = useMutation({
    mutationFn: (payload: { status: RemediationStatus; note?: string }) =>
      regulatoryCascadeService.setItemStatus(item.id, {
        status: payload.status,
        note: payload.note ?? null,
      }),
    onSuccess: () => {
      toast.success(t('regulatory.cascade.toast.statusUpdated'));
      void queryClient.invalidateQueries({ queryKey: ['regulatory-cascade-detail'] });
      setShowStatusForm(false);
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'regulatory.cascade.errors.statusUpdateFailed'));
    },
  });

  const draftMutation = useMutation({
    mutationFn: () =>
      regulatoryCascadeService.draftAmendment(item.id, {}),
    onSuccess: (res) => {
      toast.success(
        t('regulatory.cascade.toast.draftCreated', {
          draftId: res.draftId,
          defaultValue: 'Amendment draft #{{draftId}} created.',
        }),
      );
      void queryClient.invalidateQueries({ queryKey: ['regulatory-cascade-detail'] });
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'regulatory.cascade.errors.draftFailed'));
    },
  });

  const bandClass =
    BAND_COLORS[item.headcountBand] ?? 'bg-muted text-ink-muted border-border';
  const statusClass =
    REMEDIATION_COLORS[item.remediationStatus] ??
    'bg-muted text-ink-muted border-border';

  return (
    <>
      <tr className="transition-colors hover:bg-surface/50">
        <td className="px-4 py-3">
          <p className="font-medium text-ink">{item.contractorNameEn}</p>
          {item.contractorNameAr && (
            <p className="text-xs text-ink-muted" dir="rtl">
              {item.contractorNameAr}
            </p>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-ink-muted">
          {item.emirate ?? '—'}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider ${bandClass}`}
          >
            {item.headcountBand}
          </span>
        </td>
        <td className="px-4 py-3">
          {item.affectedClauseCount > 0 ? (
            <span className="inline-flex items-center rounded-full bg-ink/10 px-2 py-0.5 text-xs font-medium text-ink">
              {t('regulatory.cascade.detail.clauseCount', {
                count: item.affectedClauseCount,
              })}
            </span>
          ) : (
            <span className="text-xs text-ink-muted">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right font-mono tabular-nums text-sm text-ink">
          {formatAedRange(item.penaltyExposureMinAed, item.penaltyExposureMaxAed)}
        </td>
        <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
          {item.icvAttachmentCount}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${statusClass}`}
          >
            {t(`regulatory.cascade.remediationStatus.${item.remediationStatus}`)}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {canRead && (
              <button
                type="button"
                onClick={() => setShowStatusForm((v) => !v)}
                className="rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-ink hover:border-gold/60 hover:bg-gold/10 focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={t('regulatory.cascade.detail.actions.updateStatus')}
              >
                {t('regulatory.cascade.detail.actions.updateStatus')}
              </button>
            )}
            {canDraftAmend && item.advisoryDraftId === null && (
              <button
                type="button"
                disabled={
                  draftMutation.isPending ||
                  item.affectedContractIds.length === 0
                }
                onClick={() => draftMutation.mutate()}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-ink hover:border-primary/60 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                aria-label={t('regulatory.cascade.detail.actions.draftAmendment')}
              >
                <FileEdit className="h-3 w-3" aria-hidden="true" />
                {draftMutation.isPending
                  ? t('common.saving')
                  : t('regulatory.cascade.detail.actions.draftAmendment')}
              </button>
            )}
            {item.advisoryDraftId !== null && (
              <span className="rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] text-success">
                {t('regulatory.cascade.detail.draftLinked')}
              </span>
            )}
          </div>
        </td>
      </tr>

      {/* Inline status update form */}
      {showStatusForm && (
        <tr className="bg-surface/60">
          <td colSpan={8} className="px-4 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label
                  htmlFor={`status-select-${item.id}`}
                  className="text-xs font-medium text-ink-muted"
                >
                  {t('regulatory.cascade.detail.statusForm.newStatus')}
                </Label>
                <select
                  id={`status-select-${item.id}`}
                  value={selectedStatus}
                  onChange={(e) =>
                    setSelectedStatus(e.target.value as RemediationStatus)
                  }
                  className="h-8 rounded-md border border-border bg-card px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {REMEDIATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`regulatory.cascade.remediationStatus.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[220px] flex-1 space-y-1">
                <Label
                  htmlFor={`status-note-${item.id}`}
                  className="text-xs font-medium text-ink-muted"
                >
                  {t('regulatory.cascade.detail.statusForm.note')}
                </Label>
                <input
                  id={`status-note-${item.id}`}
                  type="text"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder={t(
                    'regulatory.cascade.detail.statusForm.notePlaceholder',
                  )}
                  className="h-8 w-full rounded-md border border-border bg-card px-2 text-sm text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={setStatusMutation.isPending}
                  onClick={() =>
                    setStatusMutation.mutate({
                      status: selectedStatus,
                      note: statusNote || undefined,
                    })
                  }
                >
                  {t('common.save')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowStatusForm(false)}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// IcvImpactSection — affected contractors' ICV attachments
// ─────────────────────────────────────────────────────────────
function IcvImpactSection({
  items,
}: {
  items: RegulatoryCascadeItemDetail[];
}) {
  const { t } = useTranslation();

  const withIcv = items.filter((i) => i.icvAttachmentCount > 0);

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-ink">
        {t('regulatory.cascade.detail.icvImpact.heading')}
      </h2>
      <p className="mb-4 text-xs text-ink-muted">
        {t('regulatory.cascade.detail.icvImpact.description')}
      </p>
      {withIcv.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-ink-muted">
            {t('regulatory.cascade.detail.icvImpact.empty')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-surface">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {t('regulatory.cascade.detail.icvImpact.columns.contractor')}
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {t('regulatory.cascade.detail.icvImpact.columns.emirate')}
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                  {t('regulatory.cascade.detail.icvImpact.columns.icvCerts')}
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                  {t('regulatory.cascade.detail.icvImpact.columns.emiratisationGap')}
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {t('regulatory.cascade.detail.icvImpact.columns.tenderEffect')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {withIcv.map((item) => (
                <tr
                  key={item.id}
                  className="transition-colors hover:bg-surface/50"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">
                      {item.contractorNameEn}
                    </p>
                    {item.contractorNameAr && (
                      <p className="text-xs text-ink-muted" dir="rtl">
                        {item.contractorNameAr}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-muted">
                    {item.emirate ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                    {item.icvAttachmentCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                    {item.emiratisationGap}
                  </td>
                  <td className="px-4 py-3">
                    {item.isCompliant ? (
                      <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                        {t('regulatory.cascade.detail.icvImpact.tenderEffect.compliant')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                        {t('regulatory.cascade.detail.icvImpact.tenderEffect.atRisk')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
