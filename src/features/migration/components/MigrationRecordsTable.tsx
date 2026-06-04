/**
 * M22 — Records table with status filter chips + open-contract link.
 */
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { migrationService, type MigrationRecord } from '@/services/api/migration.service';
import { formatDateTime } from '@/utils/datetime';

interface Props {
  batchId: number;
}

const STATUS_CHIPS = [
  { key: '', label: 'All' },
  { key: 'imported', label: 'Imported' },
  { key: 'needs_review', label: 'Needs review' },
  { key: 'failed', label: 'Failed' },
  { key: 'skipped_duplicate_id', label: 'Duplicate (file id)' },
  { key: 'skipped_duplicate_hash', label: 'Duplicate (content)' },
  { key: 'flagged_logical_duplicate', label: 'Logical duplicate' },
];

export function MigrationRecordsTable({ batchId }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>('');
  const { data, isLoading } = useQuery({
    queryKey: ['m22.batch.records', batchId, status],
    queryFn: () => migrationService.listBatchRecords(batchId, { status: status || undefined, limit: 200 }),
    staleTime: 5_000,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter records by status">
        {STATUS_CHIPS.map((c) => {
          const active = status === c.key;
          return (
            <button
              key={c.key || 'all'}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatus(c.key)}
              className={
                'rounded-full border px-3 py-1 text-xs font-medium transition ' +
                (active
                  ? 'border-gold bg-gold/10 text-ink'
                  : 'border-border bg-surface text-ink-muted hover:border-gold/40 hover:text-ink')
              }
            >
              {t(`admin.migration.records.filter.${c.key || 'all'}`, { defaultValue: c.label })}
            </button>
          );
        })}
      </div>
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-lg border border-border bg-surface" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-[10px] uppercase tracking-wider text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-2">File</th>
                <th scope="col" className="px-4 py-2">Status</th>
                <th scope="col" className="px-4 py-2">Confidence</th>
                <th scope="col" className="px-4 py-2">Contract</th>
                <th scope="col" className="px-4 py-2">Imported at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.rows ?? []).map((r) => (
                <RecordRow key={r.id} r={r} />
              ))}
              {data?.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-muted">
                    {t('admin.migration.records.empty', { defaultValue: 'No records for this filter.' })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecordRow({ r }: { r: MigrationRecord }) {
  const conf = r.confidenceScoreAvg ? Math.round(parseFloat(r.confidenceScoreAvg)) : null;
  const dot =
    conf == null ? 'bg-ink-subtle' :
    conf >= 80 ? 'bg-success' :
    conf >= 60 ? 'bg-warning' : 'bg-danger';
  return (
    <tr className="hover:bg-surface/40">
      <td className="px-4 py-3">
        <div className="text-ink">{r.sourceFileName ?? r.sourceFileId}</div>
        <div className="text-[10px] text-ink-subtle">{r.sourceFileMime}</div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={r.status} />
        {r.duplicateOfRecordId != null && (
          <div className="mt-0.5 text-[10px] text-ink-muted">
            duplicate of #{r.duplicateOfRecordId}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        {conf != null ? (
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
            <span className="font-mono text-xs">{conf}%</span>
          </span>
        ) : (
          <span className="text-xs text-ink-subtle">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {r.contractId ? (
          <Link
            to="/app/contracts/$id"
            params={{ id: String(r.contractId) }}
            className="text-gold hover:underline"
          >
            #{r.contractId}
          </Link>
        ) : (
          <span className="text-ink-subtle">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-ink-muted">
        {r.importedAt ? formatDateTime(r.importedAt) : '—'}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    imported: 'border-success/30 bg-success/10 text-success',
    needs_review: 'border-warning/30 bg-warning/10 text-warning',
    failed: 'border-danger/30 bg-danger/10 text-danger',
    skipped_duplicate_id: 'border-border bg-surface text-ink-muted',
    skipped_duplicate_hash: 'border-border bg-surface text-ink-muted',
    flagged_logical_duplicate: 'border-warning/30 bg-warning/10 text-warning',
    discovered: 'border-border bg-surface text-ink-muted',
    downloading: 'border-border bg-surface text-ink',
    ingesting: 'border-border bg-surface text-ink',
  };
  const cls = map[status] ?? 'border-border bg-surface text-ink-muted';
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] tracking-wider ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
