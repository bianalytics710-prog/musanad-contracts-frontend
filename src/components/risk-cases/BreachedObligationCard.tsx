/**
 * 696 — BreachedObligationCard. The contract "promise" behind an internal risk:
 * the obligation that was breached + the clause it derives from. Rendered next to
 * the SourceSystemRecordCard (the operational "reality") so a reviewer sees
 * expected (contract) vs actual (system) at a glance.
 */
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { formatDateTime } from '@/utils/datetime';
import type { BreachedObligation } from '@/types/risk-case.types';

export function BreachedObligationCard({ obligation }: { obligation: BreachedObligation }) {
  const { t } = useTranslation();
  const title = obligation.titleEn ?? obligation.titleAr ?? '—';

  return (
    <div className="rounded-lg border border-gold/40 bg-gold/5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <FileText className="h-4 w-4 text-gold" aria-hidden />
          {t('riskCases.detail.breachedObligation.title', { defaultValue: 'Contract obligation breached' })}
        </h2>
        {obligation.clauseHeading && (
          <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
            {obligation.clauseHeading}
          </span>
        )}
      </div>

      <p className="text-xs text-ink-muted">
        {t('riskCases.detail.breachedObligation.intro', {
          defaultValue: 'The contract commitment this risk is measured against (the expected side).',
        })}
      </p>

      <p className="mt-2 text-sm font-medium text-ink">{title}</p>

      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {obligation.dueDate && (
          <div className="flex justify-between gap-2 sm:contents">
            <dt className="text-ink-muted">
              {t('riskCases.detail.breachedObligation.dueDate', { defaultValue: 'Due / target' })}
            </dt>
            <dd className="text-ink">{formatDateTime(obligation.dueDate)}</dd>
          </div>
        )}
        {obligation.status && (
          <div className="flex justify-between gap-2 sm:contents">
            <dt className="text-ink-muted">
              {t('riskCases.detail.breachedObligation.status', { defaultValue: 'Obligation status' })}
            </dt>
            <dd className="font-medium text-ink">{obligation.status}</dd>
          </div>
        )}
      </dl>

      {obligation.clauseSnippet && (
        <blockquote className="mt-3 border-s-2 border-gold/40 bg-card/60 px-3 py-2 text-xs italic text-ink-muted">
          “{obligation.clauseSnippet}”
        </blockquote>
      )}
    </div>
  );
}
