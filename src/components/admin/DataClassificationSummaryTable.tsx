/**
 * DataClassificationSummaryTable — per-table classification counts.
 */
import { useTranslation } from 'react-i18next';
import type { DataClassificationSummary } from '@/types/admin/demo.types';

interface Props {
  summary: DataClassificationSummary;
}

export function DataClassificationSummaryTable({ summary }: Props) {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-ink-subtle">
            <th scope="col" className="px-4 py-3 font-medium">
              {t('admin.demoPurge.table.tableName', { defaultValue: 'Table' })}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              {t('admin.demoPurge.table.demo', { defaultValue: 'Demo' })}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              {t('admin.demoPurge.table.pilot', { defaultValue: 'Pilot' })}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              {t('admin.demoPurge.table.production', { defaultValue: 'Production' })}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              {t('admin.demoPurge.table.total', { defaultValue: 'Total' })}
            </th>
          </tr>
        </thead>
        <tbody>
          {summary.summary.map((row) => (
            <tr
              key={row.tableName}
              className="border-t border-border/60 transition-colors hover:bg-surface/40"
            >
              <td className="px-4 py-2 font-mono text-xs text-ink">{row.tableName}</td>
              <td className="px-4 py-2 text-right font-mono text-xs">
                <span className={row.demo > 0 ? 'text-terracotta' : 'text-ink-muted'}>
                  {row.demo.toLocaleString()}
                </span>
              </td>
              <td className="px-4 py-2 text-right font-mono text-xs">
                <span className={row.pilot > 0 ? 'text-gold' : 'text-ink-muted'}>
                  {row.pilot.toLocaleString()}
                </span>
              </td>
              <td className="px-4 py-2 text-right font-mono text-xs text-ink-muted">
                {row.production.toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right font-mono text-xs font-medium text-ink">
                {row.total.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-surface/60">
          <tr>
            <td className="px-4 py-2 font-mono text-xs font-semibold text-ink">
              {t('admin.demoPurge.table.totals', { defaultValue: 'Totals' })}
            </td>
            <td className="px-4 py-2 text-right font-mono text-xs font-semibold text-terracotta">
              {summary.totals.demo.toLocaleString()}
            </td>
            <td className="px-4 py-2 text-right font-mono text-xs font-semibold text-gold">
              {summary.totals.pilot.toLocaleString()}
            </td>
            <td className="px-4 py-2 text-right font-mono text-xs font-semibold text-ink-muted">
              {summary.totals.production.toLocaleString()}
            </td>
            <td className="px-4 py-2 text-right font-mono text-xs font-semibold text-ink">
              {summary.totals.total.toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
