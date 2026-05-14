/**
 * /app/admin/notifications — Paginated notification dispatch log viewer.
 *
 * M16 / CR-H — gated by notification.dispatch_log.read
 * T1 service, T2 React Query, T3 i18n, T4 three data states, T5 tokens,
 * T6 a11y, T7 type-safe, T11 ErrorBoundary.
 * A7: apiClient only in service.
 * C13: no raw hex.
 */
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { NotificationDispatchLogTable } from '@/components/admin/NotificationDispatchLogTable';

export const Route = createFileRoute('/app/admin/notifications')({
  component: () => (
    <ErrorBoundary>
      <AdminNotificationsView />
    </ErrorBoundary>
  ),
});

function AdminNotificationsView() {
  const { t } = useTranslation();
  const canRead = useAuthStore(selectHasPermission('notification.dispatch_log.read'));

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
      <div>
        <h1 className="text-2xl font-semibold text-ink">
          {t('admin.notifications.title')}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t('admin.notifications.subtitle')}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <NotificationDispatchLogTable />
      </div>
    </motion.div>
  );
}
