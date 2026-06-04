/**
 * M22 — Live progress panel. Polls /progress every 2s; stops on terminal.
 */
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { migrationService } from '@/services/api/migration.service';

interface Props {
  batchId: number;
  onTerminal?: (status: string) => void;
}

export function MigrationProgressPanel({ batchId, onTerminal }: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['m22.batch.progress', batchId],
    queryFn: async () => {
      const r = await migrationService.getBatchProgress(batchId);
      if (r.terminal) onTerminal?.(r.status);
      return r;
    },
    refetchInterval: (q) => (q.state.data?.terminal ? false : 2000),
    refetchIntervalInBackground: true,
  });

  if (isLoading || !data) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-sm text-ink-muted" aria-busy="true">
        {t('admin.migration.progress.starting', { defaultValue: 'Starting sync…' })}
      </div>
    );
  }

  const total = data.counts.imported + data.counts.review + data.counts.failed + data.counts.skippedDuplicate;
  const pct = data.counts.discovered > 0
    ? Math.round((total / data.counts.discovered) * 100)
    : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-6" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">
          {t('admin.migration.progress.title', { defaultValue: 'Sync in progress' })}
        </h3>
        <span className="text-xs uppercase tracking-wider text-ink-muted">{data.status.replace('_', ' ')}</span>
      </div>
      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-surface">
          <div className="h-full bg-gold transition-all" style={{ width: `${pct}%` }} aria-hidden="true" />
        </div>
        <div className="mt-2 text-xs text-ink-muted">
          {t('admin.migration.progress.coverage', {
            defaultValue: '{{done}} of {{total}} files processed ({{pct}}%)',
            done: total, total: data.counts.discovered, pct,
          })}
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
        <Stat label={t('admin.migration.progress.discovered')} value={data.counts.discovered} />
        <Stat label={t('admin.migration.progress.imported')} value={data.counts.imported} variant="success" />
        <Stat label={t('admin.migration.progress.review')} value={data.counts.review} variant="warning" />
        <Stat label={t('admin.migration.progress.failed')} value={data.counts.failed} variant="danger" />
        <Stat label={t('admin.migration.progress.skipped')} value={data.counts.skippedDuplicate} />
      </dl>
    </div>
  );
}

function Stat({ label, value, variant }: { label: string; value: number; variant?: 'success' | 'warning' | 'danger' }) {
  const tone =
    variant === 'success' ? 'text-success' :
    variant === 'warning' ? 'text-warning' :
    variant === 'danger'  ? 'text-danger'  :
    'text-ink';
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className={`mt-1 text-xl font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}
