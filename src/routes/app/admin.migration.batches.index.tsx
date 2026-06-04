/**
 * /app/admin/migration/batches — sync history.
 */
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { migrationService } from '@/services/api/migration.service';
import { formatDateTime } from '@/utils/datetime';

export const Route = createFileRoute('/app/admin/migration/batches/')({
  component: () => (
    <ErrorBoundary>
      <Page />
    </ErrorBoundary>
  ),
});

function Page() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['m22.batches'],
    queryFn: () => migrationService.listBatches({ limit: 50 }),
    refetchInterval: 5_000,
  });

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link to="/app/admin/migration" className="text-sm text-ink-muted hover:text-gold">
          <ChevronLeft className="inline h-3.5 w-3.5" />
          {t('admin.migration.nav.back', { defaultValue: 'Back to migration' })}
        </Link>
      </div>
      <header>
        <h1 className="text-2xl font-semibold text-ink">
          {t('admin.migration.batches.title', { defaultValue: 'Sync history' })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t('admin.migration.batches.subtitle', { defaultValue: 'Past and in-progress migration batches.' })}
        </p>
      </header>

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-lg border border-border bg-surface" />
      ) : data && data.rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-[10px] uppercase tracking-wider text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-2">Batch</th>
                <th scope="col" className="px-4 py-2">Connection</th>
                <th scope="col" className="px-4 py-2">Status</th>
                <th scope="col" className="px-4 py-2">Imported</th>
                <th scope="col" className="px-4 py-2">Review</th>
                <th scope="col" className="px-4 py-2">Failed</th>
                <th scope="col" className="px-4 py-2">Skipped</th>
                <th scope="col" className="px-4 py-2">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rows.map((b) => (
                <tr key={b.id} className="hover:bg-surface/40">
                  <td className="px-4 py-3">
                    <Link
                      to="/app/admin/migration/batches/$batchId"
                      params={{ batchId: String(b.id) }}
                      className="text-gold hover:underline"
                    >
                      #{b.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink">{b.connectionDisplayName}</td>
                  <td className="px-4 py-3"><Status status={b.status} /></td>
                  <td className="px-4 py-3 font-mono text-xs">{b.filesImported}</td>
                  <td className="px-4 py-3 font-mono text-xs">{b.filesReview}</td>
                  <td className="px-4 py-3 font-mono text-xs">{b.filesFailed}</td>
                  <td className="px-4 py-3 font-mono text-xs">{b.filesSkippedDuplicate}</td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{formatDateTime(b.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-12 text-center" role="status">
          <p className="text-sm text-ink-muted">
            {t('admin.migration.batches.empty', { defaultValue: 'No batches yet. Connect a source and click "Sync now".' })}
          </p>
        </div>
      )}
    </div>
  );
}

function Status({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued: 'border-border bg-surface text-ink-muted',
    in_progress: 'border-gold/40 bg-gold/10 text-ink',
    completed: 'border-success/30 bg-success/10 text-success',
    completed_with_errors: 'border-warning/30 bg-warning/10 text-warning',
    rolled_back: 'border-border bg-surface text-ink-muted',
    failed: 'border-danger/30 bg-danger/10 text-danger',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] tracking-wider ${map[status] ?? ''}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
