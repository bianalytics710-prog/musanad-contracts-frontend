/**
 * /app/admin/migration/batches/$batchId — single batch detail.
 *  - in-progress: live progress panel
 *  - completed:   results summary + records table + rollback + coverage report
 */
import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { migrationService } from '@/services/api/migration.service';
import { MigrationProgressPanel } from '@/features/migration/components/MigrationProgressPanel';
import { MigrationResultsSummary } from '@/features/migration/components/MigrationResultsSummary';
import { MigrationRecordsTable } from '@/features/migration/components/MigrationRecordsTable';
import { RollbackConfirmDialog } from '@/features/migration/components/RollbackConfirmDialog';
import { CoverageReportButton } from '@/features/migration/components/CoverageReportButton';

export const Route = createFileRoute('/app/admin/migration/batches/$batchId')({
  component: () => (
    <ErrorBoundary>
      <Page />
    </ErrorBoundary>
  ),
});

function Page() {
  const { t } = useTranslation();
  const params = Route.useParams();
  const batchId = parseInt(params.batchId, 10);
  const canRollback = useAuthStore(selectHasPermission('migration.batch.rollback'));
  const [rollbackOpen, setRollbackOpen] = useState(false);

  const { data: batch, refetch } = useQuery({
    queryKey: ['m22.batch', batchId],
    queryFn: () => migrationService.getBatch(batchId),
    refetchInterval: (q) => {
      const status = (q.state.data as { status?: string } | undefined)?.status;
      return status && !['completed','completed_with_errors','failed','rolled_back'].includes(status)
        ? 2000 : false;
    },
  });

  if (!batch) {
    return <div className="mx-auto w-full max-w-[1200px] p-6 text-sm text-ink-muted">Loading…</div>;
  }

  const terminal = ['completed','completed_with_errors','failed','rolled_back'].includes(batch.status);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link to="/app/admin/migration/batches" className="text-sm text-ink-muted hover:text-gold">
          <ChevronLeft className="inline h-3.5 w-3.5" />
          {t('admin.migration.nav.history', { defaultValue: 'Sync history' })}
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {t('admin.migration.batch.title', { defaultValue: 'Batch' })} #{batch.id}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{batch.connectionDisplayName}</p>
        </div>
        <div className="flex gap-2">
          <CoverageReportButton batchId={batchId} />
          {canRollback && terminal && batch.status !== 'rolled_back' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setRollbackOpen(true)}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t('admin.migration.rollback.cta', { defaultValue: 'Roll back' })}
            </Button>
          )}
        </div>
      </header>

      {!terminal ? (
        <MigrationProgressPanel batchId={batchId} onTerminal={() => void refetch()} />
      ) : (
        <MigrationResultsSummary batch={batch} />
      )}

      <section aria-labelledby="m22-records-heading">
        <h2 id="m22-records-heading" className="mb-3 text-lg font-semibold text-ink">
          {t('admin.migration.batch.records', { defaultValue: 'Records' })}
        </h2>
        <MigrationRecordsTable batchId={batchId} />
      </section>

      <RollbackConfirmDialog
        batchId={batchId}
        open={rollbackOpen}
        onClose={() => setRollbackOpen(false)}
        onRolledBack={() => void refetch()}
      />
    </div>
  );
}
