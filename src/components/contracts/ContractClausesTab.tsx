/**
 * ContractClausesTab — CR-D clause list for a single contract.
 *
 * Lists extracted clauses with family badge, clause type, confidence,
 * parameter preview, text_excerpt, page_no.
 *
 * A7: all HTTP via clauseExtractionService.
 * C12: all text via t().
 * C13: semantic tokens only.
 * D7: scope="col" on all <th>.
 * WCAG 2.1 AA.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle, RefreshCw, FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clauseExtractionService } from '@/services/api/clause-extraction.service';
import type { ClauseFamily, ClauseReviewQueueItem } from '@/types/entities/clause.types';

const FAMILY_COLORS: Record<ClauseFamily, string> = {
  force_majeure: 'bg-amber-100 text-amber-800',
  termination:   'bg-red-100 text-red-800',
  pricing:       'bg-emerald-100 text-emerald-800',
  performance:   'bg-blue-100 text-blue-800',
  indemnity:     'bg-purple-100 text-purple-800',
  compliance:    'bg-orange-100 text-orange-800',
  governance:    'bg-slate-100 text-slate-800',
  operational:   'bg-teal-100 text-teal-800',
};

interface ContractClausesTabProps {
  contractId: number;
}

export function ContractClausesTab({ contractId }: ContractClausesTabProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['contractClauses', contractId, page],
    queryFn: () =>
      clauseExtractionService.listReviewQueue({
        contractId,
        page,
        limit: 20,
      }),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-muted" aria-label={t('common.loading')} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-ink-muted">{error instanceof Error ? error.message : t('common.error')}</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="me-2 h-4 w-4" />
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <FileSearch className="h-10 w-10 text-ink-muted" />
        <p className="font-medium text-ink">{t('clauses.tab.empty')}</p>
        <p className="text-sm text-ink-muted">{t('clauses.tab.emptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                {t('clauses.tab.table.family')}
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                {t('clauses.tab.table.type')}
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                {t('clauses.tab.table.confidence')}
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                {t('clauses.tab.table.parameters')}
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                {t('clauses.tab.table.page')}
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                {t('clauses.tab.table.status')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((clause) => {
              const clauseName = isAr ? clause.displayNameAr : clause.displayNameEn;
              const confidence = clause.confidence != null ? Math.round(clause.confidence * 100) : null;
              const topParams = Object.entries(clause.parametersPreview ?? {}).slice(0, 3);

              return (
                <tr key={clause.id} className="hover:bg-surface/50">
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        FAMILY_COLORS[clause.family] ?? 'bg-surface text-ink-muted'
                      }`}
                    >
                      {t(`clauses.taxonomy.family.${clause.family}`, { defaultValue: clause.family })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink">{clauseName}</td>
                  <td className="px-4 py-3">
                    {confidence != null ? (
                      <span
                        className={`font-mono text-xs ${
                          confidence < 50 ? 'text-destructive' : confidence < 70 ? 'text-amber-600' : 'text-emerald-600'
                        }`}
                      >
                        {confidence}%
                      </span>
                    ) : (
                      <span className="text-ink-subtle">—</span>
                    )}
                  </td>
                  <td className="max-w-[240px] px-4 py-3">
                    {topParams.length > 0 ? (
                      <div className="space-y-0.5">
                        {topParams.map(([k, v]) => (
                          <div key={k} className="truncate text-xs text-ink-muted">
                            <span className="font-mono">{k}:</span>{' '}
                            <span>{JSON.stringify(v)}</span>
                          </div>
                        ))}
                        {Object.keys(clause.parametersPreview ?? {}).length > 3 && (
                          <span className="text-xs text-ink-subtle">
                            {t('clauses.tab.moreParams', {
                              count: Object.keys(clause.parametersPreview ?? {}).length - 3,
                            })}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-ink-subtle">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-muted">
                    {clause.pageNo != null ? `p. ${clause.pageNo}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={clause.reviewStatus} t={t} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-muted">
            {t('clauses.tab.pagination.showing', {
              page: pagination.page,
              totalPages: pagination.totalPages,
              total: pagination.total,
            })}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('common.back')}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const classes: Record<string, string> = {
    auto:               'bg-slate-100 text-slate-700',
    pending_review:     'bg-amber-100 text-amber-700',
    reviewed:           'bg-emerald-100 text-emerald-700',
    rejected:           'bg-red-100 text-red-700',
    pending_extraction: 'bg-blue-100 text-blue-700',
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes[status] ?? 'bg-surface text-ink-muted'}`}>
      {t(`clauses.review.status.${status}`, { defaultValue: status })}
    </span>
  );
}
