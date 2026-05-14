/**
 * NotificationPayloadPreviewModal — shows captured Teams/Slack payload.
 *
 * M16 / CR-H — T6 useFocusTrap + role="dialog", T3 i18n, T7 type-safe,
 * C13 no hex.
 */
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFocusTrap } from '@/components/common/useFocusTrap';
import { adminNotificationDispatchLogService } from '@/services/api/admin/notification-dispatch-log.service';
import { formatDateTime } from '@/utils/datetime';
import type { NotificationDispatchLogListItem } from '@/types/admin/notification-dispatch-log.types';

interface Props {
  item: NotificationDispatchLogListItem;
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationPayloadPreviewModal({ item, isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, isOpen);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['notificationDispatchLogDetail', item.id],
    queryFn: () => adminNotificationDispatchLogService.getById(item.id),
    enabled: isOpen,
    staleTime: 60_000,
  });

  if (!isOpen) return null;

  const payloadStr = data?.channelPayload
    ? JSON.stringify(data.channelPayload, null, 2)
    : data?.bodyRendered ?? '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      aria-modal="true"
      role="dialog"
      aria-label={t('admin.notifications.payloadPreview.title')}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-xl"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">
              {t('admin.notifications.payloadPreview.title')}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {t(`admin.notifications.channels.${item.channel}`)} — #{item.id}
              {data?.deliveryAttemptedAt && (
                <> — {formatDateTime(data.deliveryAttemptedAt, { showTime: true })}</>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-muted hover:bg-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6">
          {isLoading && (
            <div className="flex h-32 items-center justify-center">
              <svg className="h-6 w-6 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="sr-only">{t('common.loading')}</span>
            </div>
          )}
          {isError && (
            <p className="text-sm text-error">{t('admin.notifications.payloadPreview.loadError')}</p>
          )}
          {!isLoading && !isError && (
            <>
              <p className="mb-2 text-xs text-ink-muted italic">
                {t('admin.notifications.payloadPreview.captureNote', {
                  channel: t(`admin.notifications.channels.${item.channel}`),
                })}
              </p>
              <pre className="max-h-[400px] overflow-auto rounded-lg bg-muted p-4 font-mono text-xs text-ink">
                {payloadStr || t('admin.notifications.payloadPreview.empty')}
              </pre>
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-border px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </div>
  );
}
