/**
 * /app/clauses/review — Clause Review Queue (CR-D, S5 + S6)
 *
 * Legal Counsel / platform_admin review surface for extracted clauses
 * with confidence < 70%.
 *
 * A7: all HTTP via clauseExtractionService.
 * C12: all text via t().
 * C13: semantic tokens only.
 * C14: Router Link for internal nav.
 * D7: scope="col" on all <th>.
 * D6: htmlFor + id matched on filter inputs.
 * WCAG 2.1 AA.
 */
import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle, RefreshCw, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { clauseExtractionService } from '@/services/api/clause-extraction.service';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/utils/datetime';
import type {
  ClauseReviewQueueItem,
  ClauseReviewStatus,
  ClauseFamily,
  ClauseReviewAction,
} from '@/types/entities/clause.types';

const STATUS_FILTERS: Array<{ value: ClauseReviewStatus | 'all'; labelKey: string; defaultLabel: string }> = [
  { value: 'all',              labelKey: 'clauses.review.filter.all',             defaultLabel: 'All' },
  { value: 'pending_review',   labelKey: 'clauses.review.filter.pendingReview',   defaultLabel: 'Pending review' },
  { value: 'reviewed',         labelKey: 'clauses.review.filter.reviewed',        defaultLabel: 'Reviewed' },
  { value: 'rejected',         labelKey: 'clauses.review.filter.rejected',        defaultLabel: 'Rejected' },
];

const CONFIDENCE_BANDS: Array<{ value: string; label: string; max: number }> = [
  { value: 'all',    label: 'All',          max: 1.0 },
  { value: 'low',    label: '< 50%',        max: 0.5 },
  { value: 'medium', label: '50 – 70%',     max: 0.7 },
];

const FAMILY_COLORS: Record<ClauseFamily, string> = {
  force_majeure: 'bg-amber-100 text-amber-800',
  termination:   'bg-red-100 text-red-800',
  pricing:       'bg-emerald-100 text-emerald-800',
  performance:   'bg-blue-100 text-blue-800',
  indemnity:     'bg-purple-100 text-purple-800',
  compliance:    'bg-orange-100 text-orange-800',
  governance:    'bg-slate-100 text-slate-800',
  operational:   'bg-teal-100 text-teal-800',
};

export const Route = createFileRoute('/app/clauses/review')({
  component: () => (
    <ErrorBoundary>
      <ClauseReviewQueueView />
    </ErrorBoundary>
  ),
});

function ClauseReviewQueueView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const canReview = useAuthStore(selectHasPermission('clause.review'));

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClauseReviewStatus | 'all'>('all');
  const [confidenceBand, setConfidenceBand] = useState('all');
  const [selectedClause, setSelectedClause] = useState<ClauseReviewQueueItem | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const confidenceBelow = confidenceBand === 'low' ? 0.5 : confidenceBand === 'medium' ? 0.7 : undefined;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['clauseReviewQueue', { page, search: debouncedSearch, statusFilter, confidenceBelow }],
    queryFn: () =>
      clauseExtractionService.listReviewQueue({
        page,
        limit: 20,
        reviewStatus: statusFilter === 'all' ? undefined : statusFilter,
        confidenceBelow,
      }),
    enabled: canReview,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  if (!canReview) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-8 text-center">
        <p className="text-ink-muted">{t('common.accessDenied')}</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{t('clauses.review.title')}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t('clauses.review.subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Search */}
        <div>
          <label htmlFor="review-queue-search" className="mb-1 block text-xs font-medium text-ink">
            {t('clauses.review.searchLabel')}
          </label>
          <input
            id="review-queue-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('clauses.review.searchPlaceholder')}
            className="w-60 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Status filter chips */}
        <div>
          <p className="mb-1 text-xs font-medium text-ink">{t('clauses.review.statusFilter')}</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('clauses.review.statusFilter')}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => { setStatusFilter(f.value as ClauseReviewStatus | 'all'); setPage(1); }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? 'bg-ink text-background'
                    : 'bg-surface text-ink-muted hover:bg-surface/80'
                }`}
              >
                {t(f.labelKey, { defaultValue: f.defaultLabel })}
              </button>
            ))}
          </div>
        </div>

        {/* Confidence band */}
        <div>
          <label htmlFor="confidence-band-select" className="mb-1 block text-xs font-medium text-ink">
            {t('clauses.review.confidenceFilter')}
          </label>
          <select
            id="confidence-band-select"
            value={confidenceBand}
            onChange={(e) => { setConfidenceBand(e.target.value); setPage(1); }}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {CONFIDENCE_BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {t(`clauses.review.confidenceBand.${b.value}`, { defaultValue: b.label })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-ink-muted" aria-label={t('common.loading')} />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-ink-muted">{error instanceof Error ? error.message : t('common.error')}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="me-2 h-4 w-4" />
            {t('common.retry')}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <ClipboardCheck className="h-10 w-10 text-ink-muted" />
          <p className="text-ink-muted">{t('clauses.review.empty')}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                    {t('clauses.review.table.contract')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                    {t('clauses.review.table.family')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                    {t('clauses.review.table.type')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                    {t('clauses.review.table.confidence')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                    {t('clauses.review.table.page')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                    {t('clauses.review.table.status')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                    {t('clauses.review.table.age')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-ink">
                    {t('clauses.review.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => {
                  const contractTitle = isAr ? item.contractTitleAr : item.contractTitleEn;
                  const clauseName = isAr ? item.displayNameAr : item.displayNameEn;
                  const confidence = item.confidence != null ? Math.round(item.confidence * 100) : null;
                  const isLowConf = confidence != null && confidence < 50;

                  return (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-surface/50"
                    >
                      <td className="max-w-[200px] truncate px-4 py-3 text-ink" title={contractTitle}>
                        {contractTitle}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FAMILY_COLORS[item.family] ?? 'bg-surface text-ink-muted'}`}>
                          {t(`clauses.taxonomy.family.${item.family}`, { defaultValue: item.family })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{clauseName}</td>
                      <td className="px-4 py-3">
                        {confidence != null ? (
                          <span className={`font-mono text-xs ${isLowConf ? 'font-semibold text-destructive' : 'text-ink-muted'}`}>
                            {confidence}%
                            {isLowConf && (
                              <span className="ms-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
                                {t('clauses.review.lowConf')}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-ink-subtle">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {item.pageNo != null ? item.pageNo : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.reviewStatus} t={t} />
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-muted">
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedClause(item)}
                        >
                          {t('clauses.review.table.review')}
                        </Button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-muted">
                {t('clauses.review.pagination.showing', {
                  page: pagination.page,
                  totalPages: pagination.totalPages,
                  total: pagination.total,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('common.back')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Review modal */}
      {selectedClause && (
        <ClauseReviewModal
          clause={selectedClause}
          isAr={isAr}
          onClose={() => setSelectedClause(null)}
          onSuccess={() => {
            setSelectedClause(null);
            void refetch();
          }}
          t={t}
        />
      )}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({
  status,
  t,
}: {
  status: ClauseReviewStatus;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const classes: Record<ClauseReviewStatus, string> = {
    auto:               'bg-slate-100 text-slate-700',
    pending_review:     'bg-amber-100 text-amber-700',
    reviewed:           'bg-emerald-100 text-emerald-700',
    rejected:           'bg-red-100 text-red-700',
    pending_extraction: 'bg-blue-100 text-blue-700',
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes[status] ?? 'bg-surface text-ink-muted'}`}>
      {t(`clauses.review.status.${status}`, { defaultValue: status })}
    </span>
  );
}

// ─── Review Modal ─────────────────────────────────────────────────────────────

interface ReviewModalProps {
  clause: ClauseReviewQueueItem;
  isAr: boolean;
  onClose: () => void;
  onSuccess: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function ClauseReviewModal({ clause, isAr, onClose, onSuccess, t }: ReviewModalProps) {
  const qc = useQueryClient();
  const [action, setAction] = useState<ClauseReviewAction>('confirm');
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [excerptCorrections, setExcerptCorrections] = useState<Record<string, string>>({});
  const [rejectNote, setRejectNote] = useState('');

  const contractTitle = isAr ? clause.contractTitleAr : clause.contractTitleEn;
  const clauseName = isAr ? clause.displayNameAr : clause.displayNameEn;

  const resolveMutation = useMutation({
    mutationFn: () =>
      clauseExtractionService.resolveReview(clause.id, {
        action,
        ...(action === 'correct'
          ? {
              parametersCorrection: corrections,
              textExcerptsCorrection: excerptCorrections,
            }
          : {}),
      }),
    onSuccess: (result) => {
      toast.success(
        t('clauses.review.resolveSuccess', {
          status: result.newReviewStatus,
          defaultValue: `Clause ${result.newReviewStatus}`,
        }),
      );
      void qc.invalidateQueries({ queryKey: ['clauseReviewQueue'] });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message || t('common.error'));
    },
  });

  const paramEntries = Object.entries(clause.parametersPreview ?? {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
    >
      <div className="flex w-full max-w-4xl flex-col rounded-lg bg-background shadow-xl" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2 id="review-modal-title" className="text-base font-semibold text-ink">
              {t('clauses.review.modal.title')}
            </h2>
            <p className="text-sm text-ink-muted">{contractTitle} — {clauseName}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label={t('common.close')}>
            ×
          </Button>
        </div>

        {/* Body — 2 column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: parameters */}
          <div className="flex-1 overflow-y-auto border-r border-border px-6 py-4 space-y-4">
            <h3 className="text-sm font-semibold text-ink">{t('clauses.review.modal.parametersSection')}</h3>

            {/* Action selector */}
            <div>
              <p className="mb-2 text-xs font-medium text-ink">{t('clauses.review.modal.actionLabel')}</p>
              <div className="flex gap-2" role="group" aria-label={t('clauses.review.modal.actionLabel')}>
                {(['confirm', 'correct', 'reject'] as ClauseReviewAction[]).map((act) => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => setAction(act)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      action === act ? 'bg-ink text-background' : 'bg-surface text-ink-muted hover:bg-surface/80'
                    }`}
                  >
                    {t(`clauses.review.modal.action.${act}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Parameters preview */}
            {paramEntries.length > 0 ? (
              <div className="space-y-3">
                {paramEntries.map(([key, val]) => (
                  <div key={key}>
                    <label
                      htmlFor={`param-${key}`}
                      className="mb-1 block text-xs font-medium text-ink font-mono"
                    >
                      {key}
                    </label>
                    {action === 'correct' ? (
                      <>
                        <input
                          id={`param-${key}`}
                          type="text"
                          value={corrections[key] ?? String(val ?? '')}
                          onChange={(e) =>
                            setCorrections((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <label
                          htmlFor={`excerpt-${key}`}
                          className="mb-1 mt-2 block text-xs font-medium text-ink-muted"
                        >
                          {t('clauses.review.modal.excerptFor', { key })}
                        </label>
                        <textarea
                          id={`excerpt-${key}`}
                          rows={2}
                          value={excerptCorrections[key] ?? ''}
                          onChange={(e) =>
                            setExcerptCorrections((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder={t('clauses.review.modal.excerptPlaceholder')}
                        />
                      </>
                    ) : (
                      <p
                        id={`param-${key}`}
                        className="rounded-md bg-surface px-3 py-1.5 text-sm text-ink"
                      >
                        {JSON.stringify(val)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">{t('clauses.review.modal.noParameters')}</p>
            )}
          </div>

          {/* Right: source text region */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <h3 className="text-sm font-semibold text-ink">{t('clauses.review.modal.sourceSection')}</h3>
            <div className="rounded-md bg-surface p-4">
              <p className="text-xs text-ink-muted">
                {clause.pageNo != null
                  ? t('clauses.review.modal.sourcePage', { page: clause.pageNo })
                  : t('clauses.review.modal.sourcePageUnknown')}
              </p>
              <p className="mt-2 text-sm text-ink italic">
                {t('clauses.review.modal.sourceNotice')}
              </p>
            </div>
            <div className="rounded-md bg-surface/50 p-3 text-xs text-ink-muted">
              <p>{t('clauses.review.modal.confidenceNote', {
                confidence: clause.confidence != null
                  ? `${Math.round(clause.confidence * 100)}%`
                  : t('clauses.review.modal.confidenceUnknown'),
              })}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={resolveMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => resolveMutation.mutate()}
            disabled={resolveMutation.isPending}
            className={action === 'reject' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {resolveMutation.isPending ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : null}
            {t(`clauses.review.modal.action.${action}`)}
          </Button>
        </div>
      </div>
    </div>
  );
}
