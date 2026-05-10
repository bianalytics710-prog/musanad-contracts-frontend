/**
 * /app/admin/demo/purge — Demo data purge (Super Admin only).
 */
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { DemoPurgePanel } from '@/components/admin/DemoPurgePanel';
import { useAuthStore } from '@/store/auth.store';

export const Route = createFileRoute('/app/admin/demo/purge')({
  component: () => (
    <ErrorBoundary>
      <DemoPurgeView />
    </ErrorBoundary>
  ),
});

function DemoPurgeView() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role.name === 'Super Admin';

  // Super Admin only guard
  if (!isSuperAdmin) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1200px] space-y-4 p-6"
    >
      <header>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-terracotta" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t('admin.demoPurge.title', { defaultValue: 'Demo data purge' })}
          </h1>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {t('admin.demoPurge.subtitle', {
            defaultValue:
              'Delete all demo-classified rows across content tables. Run a dry-run first to preview what will be removed.',
          })}
        </p>
        <div className="mt-2 flex items-start gap-2 rounded-md border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-xs text-terracotta">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            {t('admin.demoPurge.warning', {
              defaultValue:
                'This action is irreversible. All rows with data_classification = "demo" will be permanently deleted.',
            })}
          </p>
        </div>
      </header>

      <DemoPurgePanel />
    </motion.div>
  );
}
