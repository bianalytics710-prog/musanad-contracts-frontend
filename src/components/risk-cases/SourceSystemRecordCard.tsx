/**
 * 690/691 — SourceSystemRecordCard. For internal risk cases, renders the ACTUAL
 * record fetched from the source system (SAP/ServiceNow/Primavera/…) that
 * triggered the correlation: system identity + the field/value snapshot + when
 * it was captured. The "open in system" link is secondary — the data shows
 * in-app. Shared between the risk-case detail page and the triage detail drawer.
 */
import { useTranslation } from 'react-i18next';
import { Database, ExternalLink } from 'lucide-react';
import { formatDateTime } from '@/utils/datetime';
import type { SourceSystemRecord } from '@/types/risk-case.types';

export function SourceSystemRecordCard({ record }: { record: SourceSystemRecord }) {
  const { t } = useTranslation();
  const snap = record.snapshot;
  const systemName = record.systemName ?? snap?.systemName ?? '—';
  const recordType = snap?.recordType ?? null;
  const recordId = snap?.recordId ?? record.recordRef ?? null;
  const recordUrl = record.recordUrl ?? snap?.recordUrl ?? null;
  const fields = snap?.fields ?? [];

  return (
    <div className="rounded-lg border border-sage/40 bg-sage/5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <Database className="h-4 w-4 text-sage" aria-hidden />
          {t('riskCases.detail.sourceRecord.title', { defaultValue: 'Source system record' })}
        </h2>
        <span className="inline-flex items-center rounded-full border border-sage/40 bg-sage/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sage">
          {systemName}
        </span>
      </div>

      <p className="text-xs text-ink-muted">
        {t('riskCases.detail.sourceRecord.intro', {
          defaultValue:
            'This internal risk was identified from the following record fetched from {{system}}.',
          system: systemName,
        })}
      </p>

      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {recordType && (
          <div className="flex justify-between gap-2 sm:contents">
            <dt className="text-ink-muted">
              {t('riskCases.detail.sourceRecord.recordType', { defaultValue: 'Record type' })}
            </dt>
            <dd className="text-ink">{recordType}</dd>
          </div>
        )}
        {recordId && (
          <div className="flex justify-between gap-2 sm:contents">
            <dt className="text-ink-muted">
              {t('riskCases.detail.sourceRecord.recordId', { defaultValue: 'Record' })}
            </dt>
            <dd className="font-mono text-ink">{recordId}</dd>
          </div>
        )}
      </dl>

      {fields.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-md border border-border">
          <table className="w-full text-xs">
            <tbody>
              {fields.map((f, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-card' : 'bg-surface/50'}>
                  <th
                    scope="row"
                    className="w-1/2 px-3 py-1.5 text-start font-medium text-ink-muted"
                  >
                    {f.label}
                  </th>
                  <td className="px-3 py-1.5 font-mono text-ink">{f.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-ink-subtle">
        <span>
          {t('riskCases.detail.sourceRecord.captured', {
            defaultValue: 'Fetched from {{system}}{{at}}',
            system: systemName,
            at: record.capturedAt ? ` · ${formatDateTime(record.capturedAt, { showTime: true })}` : '',
          })}
        </span>
        {recordUrl && (
          <a
            href={recordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded text-gold hover:underline focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {t('riskCases.detail.sourceRecord.openInSystem', { defaultValue: 'Open in system' })}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}
