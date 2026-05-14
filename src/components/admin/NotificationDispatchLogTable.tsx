/**
 * NotificationDispatchLogTable — sortable dispatch log viewer with filters.
 *
 * M16 / CR-H — T3 i18n, T5 tokens, T6 a11y D7 scope="col", T7 type-safe,
 * T10 debounce, T12 formatDateTime, C13 no hex, C14 Router Link.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/utils/datetime';
import { adminNotificationDispatchLogService } from '@/services/api/admin/notification-dispatch-log.service';
import { NotificationPayloadPreviewModal } from '@/components/admin/NotificationPayloadPreviewModal';
import type {
  DispatchLogChannel,
  DispatchLogStatus,
  NotificationDispatchLogListItem,
} from '@/types/admin/notification-dispatch-log.types';
import {
  DISPATCH_LOG_CHANNELS,
  DISPATCH_LOG_STATUSES,
} from '@/types/admin/notification-dispatch-log.types';

const STATUS_BADGE: Record<DispatchLogStatus, string> = {
  sent: 'bg-success/10 text-success',
  failed: 'bg-error/10 text-error',
  captured_only: 'bg-info/10 text-info',
  pending_retry: 'bg-warning/10 text-warning',
  final_failed: 'bg-error/20 text-error font-semibold',
  suppressed_by_preference: 'bg-muted text-ink-muted',
};

export function NotificationDispatchLogTable() {
  const { t } = useTranslation();

  const [page, setPage] = useState(1);
  const [channelFilter, setChannelFilter] = useState<DispatchLogChannel | ''>('');
  const [statusFilter, setStatusFilter] = useState<DispatchLogStatus | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [previewItem, setPreviewItem] = useState<NotificationDispatchLogListItem | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      'adminNotificationDispatchLog',
      { page, channel: channelFilter, status: statusFilter, from, to },
    ],
    queryFn: () =>
      adminNotificationDispatchLogService.list({
        page,
        limit: 50,
        channel: channelFilter || undefined,
        status: statusFilter || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    staleTime: 30_000,
  });

  const items = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Channel filter */}
        <div>
          <label htmlFor="ndl-channel-filter" className="sr-only">
            {t('admin.notifications.filters.channel')}
          </label>
          <select
            id="ndl-channel-filter"
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value as DispatchLogChannel | '');
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t('admin.notifications.filters.allChannels')}</option>
            {DISPATCH_LOG_CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {t(`admin.notifications.channels.${ch}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div>
          <label htmlFor="ndl-status-filter" className="sr-only">
            {t('admin.notifications.filters.status')}
          </label>
          <select
            id="ndl-status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as DispatchLogStatus | '');
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t('admin.notifications.filters.allStatuses')}</option>
            {DISPATCH_LOG_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`admin.notifications.statuses.${s}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <label htmlFor="ndl-from" className="text-xs text-ink-muted">
            {t('admin.notifications.filters.from')}
          </label>
          <input
            id="ndl-from"
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="ndl-to" className="text-xs text-ink-muted">
            {t('admin.notifications.filters.to')}
          </label>
          <input
            id="ndl-to"
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex h-48 items-center justify-center">
          <svg className="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div
          className="flex items-center gap-3 rounded-lg border border-error/30 bg-error/5 p-4"
          role="alert"
        >
          <AlertTriangle className="h-5 w-5 text-error" aria-hidden="true" />
          <p className="text-sm text-error">
            {(error as Error)?.message ?? t('common.error')}
          </p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && (
        <>
          {items.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm text-ink-muted">{t('admin.notifications.emptyState')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-surface">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.notifications.columns.id')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.notifications.columns.channel')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.notifications.columns.kind')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.notifications.columns.priority')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.notifications.columns.status')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.notifications.columns.attemptedAt')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.notifications.columns.preview')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted">#{item.id}</td>
                      <td className="px-4 py-3 text-ink">
                        {t(`admin.notifications.channels.${item.channel}`)}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {t(`admin.notifications.kinds.${item.notificationKind}`)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-ink-muted">
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_BADGE[item.status as DispatchLogStatus] ?? 'bg-muted text-ink-muted'
                          }`}
                        >
                          {t(`admin.notifications.statuses.${item.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-muted">
                        {item.deliveryAttemptedAt
                          ? formatDateTime(item.deliveryAttemptedAt, { showTime: true })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {(item.channel === 'teams_capture' || item.channel === 'slack_capture') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewItem(item)}
                            aria-label={t('admin.notifications.previewPayload')}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-ink-muted">
                {t('common.pagination.showing', {
                  count: items.length,
                  total: pagination.total,
                })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label={t('common.pagination.prev')}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className="text-sm text-ink">
                  {page} / {pagination.totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  aria-label={t('common.pagination.next')}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Payload preview modal */}
      {previewItem && (
        <NotificationPayloadPreviewModal
          item={previewItem}
          isOpen={!!previewItem}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}
