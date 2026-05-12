/**
 * /app/admin/ingestion-queue — Ingestion review queue monitor.
 *
 * Lists all ingestion_review_queue rows (pending_auto / pending_human /
 * resolved / rejected) with pagination + filter chips by review_status.
 * Clicking a row opens IngestionReviewPanel modal.
 *
 * Permission gate: ingestion_queue.read OR document.review.
 * D7: scope="col" on all <th>.
 * C13: semantic tokens only.
 * C14: internal nav via router Link.
 * A7: all HTTP via adminIngestionQueueService.
 */
import { useState } from 'react';
import { createFileRoute, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Inbox, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth.store';
import { adminIngestionQueueService } from '@/services/api/admin/ingestion-queue.service';
import { IngestionReviewPanel } from '@/components/admin/IngestionReviewPanel';
import { formatDateTime } from '@/utils/datetime';
import type {
  ReviewStatus,
  IngestionReviewQueueItem,
} from '@/types/admin/ingestion-queue.types';

// TanStack file-based routing search schema
interface IngestionQueueSearch {
  reviewStatus?: ReviewStatus;
  contractVersionId?: number;
  page?: number;
}

export const Route = createFileRoute('/app/admin/ingestion-queue')({
  validateSearch: (search: Record<string, unknown>): IngestionQueueSearch => ({
    reviewStatus: search.reviewStatus as ReviewStatus | undefined,
    contractVersionId: search.contractVersionId
      ? Number(search.contractVersionId)
      : undefined,
    page: search.page ? Number(search.page) : undefined,
  }),
  component: () => (
    <ErrorBoundary>
      <IngestionQueueView />
    </ErrorBoundary>
  ),
});

const REVIEW_STATUS_FILTERS: Array<{ value: ReviewStatus | 'all'; labelKey: string; defaultLabel: string }> =
  [
    { value: 'all', labelKey: 'admin.ingestionQueue.filter.all', defaultLabel: 'All' },
    {
      value: 'pending_auto',
      labelKey: 'admin.ingestionQueue.filter.pendingAuto',
      defaultLabel: 'Pending auto',
    },
    {
      value: 'pending_human',
      labelKey: 'admin.ingestionQueue.filter.pendingHuman',
      defaultLabel: 'Pending review',
    },
    {
      value: 'resolved',
      labelKey: 'admin.ingestionQueue.filter.resolved',
      defaultLabel: 'Resolved',
    },
    {
      value: 'rejected',
      labelKey: 'admin.ingestionQueue.filter.rejected',
      defaultLabel: 'Rejected',
    },
  ];

function IngestionQueueView() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const search = useSearch({ from: '/app/admin/ingestion-queue' });

  const hasPermission =
    (user?.permissions.includes('ingestion_queue.read') ||
      user?.permissions.includes('document.review')) ??
    false;

  const [page, setPage] = useState(search.page ?? 1);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<ReviewStatus | 'all'>(
    search.reviewStatus ?? 'all',
  );
  const [selectedItem, setSelectedItem] = useState<IngestionReviewQueueItem | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'adminIngestionQueue',
      { page, reviewStatus: reviewStatusFilter, contractVersionId: search.contractVersionId },
    ],
    queryFn: () =>
      adminIngestionQueueService.list({
        page,
        limit: 20,
        reviewStatus: reviewStatusFilter === 'all' ? undefined : reviewStatusFilter,
        contractVersionId: search.contractVersionId,
      }),
    staleTime: 30_000,
    enabled: hasPermission,
  });

  if (!hasPermission) {
    return (
      <div className="mx-auto w-full max-w-[1400px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t('common.forbidden', {
              defaultValue: 'You do not have permission to access this page.',
            })}
          </p>
        </div>
      </div>
    );
  }

  const rows = data?.data ?? [];
  const totalPages = data?.pagination.totalPages ?? 0;
  const total = data?.pagination.total ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] space-y-4 p-6"
    >
      <header>
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-gold" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t('admin.ingestionQueue.title', { defaultValue: 'Ingestion review queue' })}
          </h1>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {t('admin.ingestionQueue.subtitle', {
            defaultValue:
              'Review low-confidence OCR pages extracted from uploaded contract PDFs.',
          })}
        </p>
      </header>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('admin.ingestionQueue.filterLabel', { defaultValue: 'Filter by status' })}>
        {REVIEW_STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setReviewStatusFilter(f.value);
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              reviewStatusFilter === f.value
                ? 'border-gold bg-gold/10 text-gold'
                : 'border-border text-ink-muted hover:border-gold/50 hover:text-ink'
            }`}
          >
            {t(f.labelKey, { defaultValue: f.defaultLabel })}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-surface" aria-hidden />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-terracotta" />
            <p className="text-sm text-terracotta">
              {t('admin.ingestionQueue.loadError', {
                defaultValue: 'Failed to load ingestion queue.',
              })}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
            >
              <RefreshCw className="me-1 h-3.5 w-3.5" />
              {t('common.retry', { defaultValue: 'Retry' })}
            </Button>
          </div>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && rows.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-ink-subtle" />
          <p className="text-sm font-medium text-ink">
            {t('admin.ingestionQueue.empty.title', {
              defaultValue: 'No pending ingestions',
            })}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {t('admin.ingestionQueue.empty.description', {
              defaultValue:
                'Low-confidence OCR pages will appear here after documents are uploaded.',
            })}
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && rows.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-ink-subtle">
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.ingestionQueue.col.contract', { defaultValue: 'Contract' })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.ingestionQueue.col.pageNo', { defaultValue: 'Page' })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.ingestionQueue.col.confidence', { defaultValue: 'Confidence' })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.ingestionQueue.col.gpt4o', { defaultValue: 'GPT-4o' })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.ingestionQueue.col.status', { defaultValue: 'Status' })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.ingestionQueue.col.reviewedBy', { defaultValue: 'Reviewed by' })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.ingestionQueue.col.reviewedAt', { defaultValue: 'Reviewed at' })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.ingestionQueue.col.createdAt', { defaultValue: 'Created' })}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <QueueRow
                    key={row.id}
                    item={row}
                    onClick={() => setSelectedItem(row)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-ink-muted">
              <span>
                {t('admin.ingestionQueue.totalRows', {
                  defaultValue: '{{total}} rows',
                  total,
                })}
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  {t('common.previous', { defaultValue: 'Previous' })}
                </Button>
                <span className="flex items-center px-3 text-xs">
                  {page} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  {t('common.next', { defaultValue: 'Next' })}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Review panel modal */}
      {selectedItem && (
        <IngestionReviewPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </motion.div>
  );
}

// ── Row component ──────────────────────────────────────────────────────────

interface QueueRowProps {
  item: IngestionReviewQueueItem;
  onClick: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  pending_auto: 'text-sage',
  pending_human: 'text-amber-600',
  resolved: 'text-gold',
  rejected: 'text-terracotta',
};

function QueueRow({ item, onClick }: QueueRowProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const contractTitle =
    (isAr && item.contractTitleAr) ? item.contractTitleAr : item.contractTitleEn;

  return (
    <tr
      className="cursor-pointer transition-colors hover:bg-surface"
      onClick={onClick}
      tabIndex={0}
      role="row"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <td className="max-w-[200px] truncate px-4 py-3 text-ink" title={contractTitle}>
        {contractTitle}
      </td>
      <td className="px-4 py-3 font-mono text-ink">{item.pageNo}</td>
      <td className="px-4 py-3">
        {item.tesseractConfidence != null ? (
          <span
            className={
              item.tesseractConfidence < 0.75
                ? 'text-terracotta'
                : 'text-ink'
            }
          >
            {Math.round(item.tesseractConfidence * 100)}%
          </span>
        ) : (
          <span className="text-ink-subtle">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {item.gpt4oUsed ? (
          <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-medium text-gold">
            {t('admin.ingestionQueue.badge.gpt4o', { defaultValue: 'GPT-4o' })}
          </span>
        ) : (
          <span className="text-ink-subtle">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`text-xs font-medium ${STATUS_COLOR[item.reviewStatus] ?? 'text-ink'}`}
        >
          {t(`admin.ingestionQueue.status.${item.reviewStatus}`, {
            defaultValue: item.reviewStatus,
          })}
        </span>
      </td>
      <td className="px-4 py-3 text-ink-muted">
        {item.reviewedByName ?? '—'}
      </td>
      <td className="px-4 py-3 text-ink-muted">
        {item.reviewedAt ? formatDateTime(item.reviewedAt) : '—'}
      </td>
      <td className="px-4 py-3 text-ink-muted">
        {formatDateTime(item.createdAt)}
      </td>
    </tr>
  );
}
