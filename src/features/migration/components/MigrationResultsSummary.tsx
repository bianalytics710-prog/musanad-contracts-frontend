/**
 * M22 — Final results dashboard for a completed batch.
 * Three buckets + a coverage sentence (AC-5, AC-6).
 */
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertTriangle, XCircle, Copy as CopyIcon } from 'lucide-react';
import type { MigrationBatchSummary } from '@/services/api/migration.service';

interface Props {
  batch: MigrationBatchSummary;
}

export function MigrationResultsSummary({ batch }: Props) {
  const { t } = useTranslation();
  const attempted = batch.filesImported + batch.filesReview + batch.filesFailed;
  const skipped = batch.filesSkippedDuplicate;
  const missed = batch.filesDiscovered - (attempted + skipped);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card icon={<CheckCircle2 className="h-5 w-5 text-success" />}
            label={t('admin.migration.results.imported', { defaultValue: 'Imported' })}
            value={batch.filesImported}
            tone="success" />
      <Card icon={<AlertTriangle className="h-5 w-5 text-warning" />}
            label={t('admin.migration.results.review', { defaultValue: 'Needs review' })}
            value={batch.filesReview}
            tone="warning" />
      <Card icon={<XCircle className="h-5 w-5 text-danger" />}
            label={t('admin.migration.results.failed', { defaultValue: 'Failed' })}
            value={batch.filesFailed}
            tone="danger" />
      {skipped > 0 && (
        <Card icon={<CopyIcon className="h-5 w-5 text-ink-muted" />}
              label={t('admin.migration.results.skipped', { defaultValue: 'Skipped (duplicate)' })}
              value={skipped}
              tone="neutral" />
      )}
      <div className="sm:col-span-3 rounded-lg border border-border bg-surface p-4 text-sm text-ink">
        {t('admin.migration.results.coverageSentence', {
          defaultValue: '{{discovered}} files in source, {{attempted}} attempted, {{skipped}} skipped as already-imported, {{missed}} missed.',
          discovered: batch.filesDiscovered,
          attempted,
          skipped,
          missed,
        })}
      </div>
    </div>
  );
}

function Card({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  const ring =
    tone === 'success' ? 'border-success/30 bg-success/5' :
    tone === 'warning' ? 'border-warning/30 bg-warning/5' :
    tone === 'danger'  ? 'border-danger/30 bg-danger/5'  :
    'border-border bg-card';
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-5 ${ring}`}>
      <div className="rounded-md bg-card p-2">{icon}</div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}
