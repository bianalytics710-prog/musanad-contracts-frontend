/**
 * /app/profile/notification-preferences — User notification preferences matrix.
 *
 * M16 / CR-H — all authenticated users
 * T1 service, T2 React Query, T3 i18n, T4 three data states, T5 tokens,
 * T6 a11y, T7 type-safe, T11 ErrorBoundary.
 * A7: apiClient only in service.
 * C13: no raw hex.
 */
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useAuthStore } from '@/store/auth.store';
import { NotificationPreferencesMatrix } from '@/components/profile/NotificationPreferencesMatrix';

export const Route = createFileRoute('/app/profile/notification-preferences')({
  component: () => (
    <ErrorBoundary>
      <ProfileNotificationPreferencesView />
    </ErrorBoundary>
  ),
});

function ProfileNotificationPreferencesView() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto w-full max-w-[900px] p-6">
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
      className="mx-auto w-full max-w-[900px] space-y-6 p-6"
    >
      <div>
        <h1 className="text-2xl font-semibold text-ink">
          {t('profile.notificationPreferences.title')}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t('profile.notificationPreferences.subtitle')}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <NotificationPreferencesMatrix />
      </div>
    </motion.div>
  );
}
