/**
 * /app/admin/migration/connections — list connected sources + sync button.
 */
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, Play, Power, RefreshCw } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { migrationService, type ExternalConnection } from '@/services/api/migration.service';
import { formatDateTime } from '@/utils/datetime';

export const Route = createFileRoute('/app/admin/migration/connections')({
  component: () => (
    <ErrorBoundary>
      <Page />
    </ErrorBoundary>
  ),
});

function Page() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canManage = useAuthStore(selectHasPermission('migration.connection.manage'));
  const canTrigger = useAuthStore(selectHasPermission('migration.batch.trigger'));

  const { data: conns, isLoading } = useQuery({
    queryKey: ['m22.connections'],
    queryFn: () => migrationService.listConnections(),
    refetchInterval: 30_000,
  });

  const triggerMutation = useMutation({
    mutationFn: async (connectionId: number) => migrationService.createBatch(connectionId),
    onSuccess: (r) => {
      toast.success(t('admin.migration.sync.queued', { defaultValue: 'Sync queued — batch #{{id}}', id: r.id }));
      void queryClient.invalidateQueries({ queryKey: ['m22.batches'] });
      void navigate({ to: '/app/admin/migration/batches/$batchId', params: { batchId: String(r.id) } });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${t('admin.migration.sync.failed', { defaultValue: 'Could not trigger sync.' })} — ${msg}`);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (id: number) => migrationService.disconnect(id),
    onSuccess: () => {
      toast.success(t('admin.migration.connect.disconnected', { defaultValue: 'Connection disconnected.' }));
      void queryClient.invalidateQueries({ queryKey: ['m22.connections'] });
      void queryClient.invalidateQueries({ queryKey: ['m22.connectors'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${t('admin.migration.connect.disconnectFailed', { defaultValue: 'Disconnect failed.' })} — ${msg}`);
    },
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
          {t('admin.migration.connections.title', { defaultValue: 'Connections' })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t('admin.migration.connections.subtitle', {
            defaultValue: 'Your connected sources. Click sync to start a new migration batch.',
          })}
        </p>
      </header>

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-lg border border-border bg-surface" />
      ) : conns && conns.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-[10px] uppercase tracking-wider text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-2">Provider</th>
                <th scope="col" className="px-4 py-2">Display name</th>
                <th scope="col" className="px-4 py-2">Resource</th>
                <th scope="col" className="px-4 py-2">Status</th>
                <th scope="col" className="px-4 py-2">Connected</th>
                <th scope="col" className="px-4 py-2">Last synced</th>
                <th scope="col" className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {conns.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-surface/40"
                >
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">{c.provider}</td>
                  <td className="px-4 py-3 text-ink">{c.displayName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">{c.sourceResourceId}</td>
                  <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{formatDateTime(c.connectedAt)}</td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{c.lastSyncedAt ? formatDateTime(c.lastSyncedAt) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {canTrigger && c.status === 'connected' && (
                        <Button
                          size="sm"
                          onClick={() => triggerMutation.mutate(c.id)}
                          disabled={triggerMutation.isPending}
                          className="gap-1.5"
                        >
                          <Play className="h-3.5 w-3.5" />
                          {t('admin.migration.sync.cta', { defaultValue: 'Sync now' })}
                        </Button>
                      )}
                      {canManage && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => disconnectMutation.mutate(c.id)}
                          disabled={disconnectMutation.isPending}
                          className="gap-1.5"
                        >
                          <Power className="h-3.5 w-3.5" />
                          {t('admin.migration.connect.disconnect', { defaultValue: 'Disconnect' })}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-12 text-center" role="status">
          <p className="text-sm text-ink-muted">
            {t('admin.migration.connections.empty', { defaultValue: 'No connections yet. Pick a source from the migration page to connect.' })}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => void navigate({ to: '/app/admin/migration' })}>
            {t('admin.migration.nav.back', { defaultValue: 'Back to migration' })}
          </Button>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: ExternalConnection['status'] }) {
  const map: Record<string, string> = {
    connected: 'border-success/30 bg-success/10 text-success',
    connecting: 'border-warning/30 bg-warning/10 text-warning',
    token_expired: 'border-warning/30 bg-warning/10 text-warning',
    disconnected: 'border-border bg-surface text-ink-muted',
    error: 'border-danger/30 bg-danger/10 text-danger',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] tracking-wider ${map[status] ?? ''}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
