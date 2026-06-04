/**
 * /app/admin/migration — source picker + danger zone.
 */
import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Database, Settings, History } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { ConnectorPickerGrid } from '@/features/migration/components/ConnectorPickerGrid';
import { useGoogleDriveConnectFlow } from '@/features/migration/components/ConnectGoogleDriveFlow';
import { PurgeMigrationDataDangerZone } from '@/features/migration/components/PurgeMigrationDataDangerZone';

export const Route = createFileRoute('/app/admin/migration/')({
  component: () => (
    <ErrorBoundary>
      <MigrationLanding />
    </ErrorBoundary>
  ),
});

function MigrationLanding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canManageConn = useAuthStore(selectHasPermission('migration.connection.manage'));
  const canTrigger = useAuthStore(selectHasPermission('migration.batch.trigger'));
  const canPurge   = useAuthStore(selectHasPermission('migration.purge.all'));

  const connectFlow = useGoogleDriveConnectFlow({
    onConnected: (connectionId) => {
      toast.success(t('admin.migration.connect.success', { defaultValue: 'Google Drive connected.' }));
      void navigate({ to: '/app/admin/migration/connections' });
    },
  });

  // OAuth callback redirect signal — read from raw URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('connected') === '1') {
      toast.success(t('admin.migration.connect.success', { defaultValue: 'Google Drive connected.' }));
    } else if (sp.get('connectError')) {
      toast.error(`${t('admin.migration.connect.failed', { defaultValue: 'Connection failed.' })} — ${sp.get('connectError')}`);
    }
  }, [t]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto w-full max-w-[1400px] space-y-8 p-6"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-gold" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-semibold text-ink">
              {t('admin.migration.title', { defaultValue: 'Migration' })}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {t('admin.migration.subtitle', {
                defaultValue: 'Pick a source · authorise · sync · review · approve. Reversible at the batch level.',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void navigate({ to: '/app/admin/migration/connections' })}
            className="gap-1.5"
          >
            <Settings className="h-3.5 w-3.5" />
            {t('admin.migration.nav.connections', { defaultValue: 'Connections' })}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void navigate({ to: '/app/admin/migration/batches' })}
            className="gap-1.5"
          >
            <History className="h-3.5 w-3.5" />
            {t('admin.migration.nav.history', { defaultValue: 'Sync history' })}
          </Button>
        </div>
      </header>

      {!canManageConn && !canTrigger && (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-ink-muted" role="status">
          {t('admin.migration.viewOnly', {
            defaultValue: 'You can browse connectors but do not have permission to connect, sync, or roll back.',
          })}
        </div>
      )}

      <section aria-labelledby="m22-picker-heading">
        <h2 id="m22-picker-heading" className="mb-4 text-lg font-semibold text-ink">
          {t('admin.migration.picker.heading', { defaultValue: 'Choose a source' })}
        </h2>
        <ConnectorPickerGrid onConnectDrive={connectFlow.start} />
      </section>

      {canPurge && <PurgeMigrationDataDangerZone />}
    </motion.div>
  );
}
