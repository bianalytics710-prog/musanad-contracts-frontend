/**
 * AdvisoryDraftPreview — single-draft renderer.
 * EN/AR side-by-side + source-traceability strip (correlation → clause → signal).
 *
 * M16 / CR-H — T3 i18n, T5 tokens, T6 a11y, T7 type-safe, T12 formatDateTime,
 * C14 Router Link.
 */
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, GitMerge, FileText, Radio } from 'lucide-react';
import { formatDateTime } from '@/utils/datetime';
import type { AdvisoryDraft } from '@/types/advisory-drafts.types';

interface Props {
  draft: AdvisoryDraft;
}

const STATUS_COLORS: Record<string, string> = {
  unapproved: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-error/10 text-error',
  modified: 'bg-info/10 text-info',
};

export function AdvisoryDraftPreview({ draft }: Props) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');

  const displayEn = draft.finalTextEn ?? draft.generatedTextEn;
  const displayAr = draft.finalTextAr ?? draft.generatedTextAr;
  const statusColor = STATUS_COLORS[draft.approvalStatus] ?? 'bg-muted text-ink-muted';

  return (
    <div className="space-y-6">
      {/* Header meta */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${statusColor}`}
          aria-label={t('legal.advisoryQueue.fields.approvalStatus')}
        >
          {t(`legal.advisoryQueue.status.${draft.approvalStatus}`)}
        </span>
        {draft.templateMeta && (
          <span className="rounded-full bg-muted px-3 py-0.5 text-xs text-ink-muted">
            {isAr ? draft.templateMeta.displayNameAr : draft.templateMeta.displayNameEn}{' '}
            v{draft.templateMeta.version}
          </span>
        )}
        <span className="text-xs text-ink-muted">
          {t('legal.advisoryQueue.fields.generatedAt')}:{' '}
          {formatDateTime(draft.generatedAt, { showTime: true })}
        </span>
        {draft.approvedAt && (
          <span className="text-xs text-ink-muted">
            {t('legal.advisoryQueue.fields.approvedAt')}:{' '}
            {formatDateTime(draft.approvedAt, { showTime: true })}{' '}
            {draft.approvedByName && `— ${draft.approvedByName}`}
          </span>
        )}
      </div>

      {/* Rejection reason */}
      {draft.approvalStatus === 'rejected' && draft.rejectionReason && (
        <div
          className="flex items-start gap-3 rounded-lg border border-error/30 bg-error/5 p-4"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-error" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-error">
              {t('legal.advisoryQueue.fields.rejectionReason')}
            </p>
            <p className="mt-0.5 text-sm text-ink">{draft.rejectionReason}</p>
          </div>
        </div>
      )}

      {/* EN/AR side-by-side body */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {t('legal.advisoryQueue.bodyEn')}
          </p>
          <pre className="whitespace-pre-wrap font-sans text-sm text-ink">{displayEn}</pre>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4" dir="rtl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {t('legal.advisoryQueue.bodyAr')}
          </p>
          <pre className="whitespace-pre-wrap font-sans text-sm text-ink">{displayAr}</pre>
        </div>
      </div>

      {/* Source traceability strip */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-semibold text-ink">
          {t('legal.advisoryQueue.traceability.title')}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Correlation */}
          <div className="flex items-start gap-2">
            <GitMerge className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium text-ink-muted">
                {t('legal.advisoryQueue.traceability.correlation')}
              </p>
              {draft.sourceCorrelation ? (
                <Link
                  to="/app/contracts/$id"
                  params={{ id: String(draft.contractId ?? 0) }}
                  className="text-sm text-primary underline-offset-2 hover:underline"
                >
                  #{draft.sourceCorrelation.id} — {draft.sourceCorrelation.severity}
                </Link>
              ) : (
                <p className="text-sm text-ink-muted">—</p>
              )}
            </div>
          </div>

          {/* Matched clause */}
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium text-ink-muted">
                {t('legal.advisoryQueue.traceability.clause')}
              </p>
              {draft.matchedClauses.length > 0 ? (
                <ul className="space-y-1">
                  {draft.matchedClauses.map((c) => (
                    <li key={c.id} className="text-sm text-ink">
                      {c.clauseTitle ?? `#${c.id}`}
                      {c.snippet && (
                        <span className="ml-1 text-xs text-ink-muted">
                          — "{c.snippet.slice(0, 60)}…"
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">—</p>
              )}
            </div>
          </div>

          {/* Matched signal */}
          <div className="flex items-start gap-2">
            <Radio className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium text-ink-muted">
                {t('legal.advisoryQueue.traceability.signal')}
              </p>
              {draft.matchedSignal ? (
                <p className="text-sm text-ink">
                  {draft.matchedSignal.title ?? `#${draft.matchedSignal.id}`}{' '}
                  <span className="text-xs text-ink-muted">({draft.matchedSignal.kind})</span>
                </p>
              ) : (
                <p className="text-sm text-ink-muted">—</p>
              )}
            </div>
          </div>
        </div>

        {/* Risk score */}
        {draft.riskScoreSummary?.healthScore !== null && draft.riskScoreSummary?.healthScore !== undefined && (
          <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
            <span className="text-xs text-ink-muted">
              {t('legal.advisoryQueue.traceability.riskScore')}:
            </span>
            <span className="text-sm font-semibold text-ink">
              {draft.riskScoreSummary.healthScore}
            </span>
            {draft.riskScoreSummary.computedAt && (
              <span className="text-xs text-ink-muted">
                ({formatDateTime(draft.riskScoreSummary.computedAt)})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
