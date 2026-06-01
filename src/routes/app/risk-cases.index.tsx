/**
 * /app/risk-cases — Risk Case list view (S-K-3).
 *
 * Unit 7 / CR-K — gated by case visibility (BE enforces; FE shows list to
 * all dashboard personas; cross-tenant rows hidden by RLS).
 * T1 service, T2 React Query, T3 i18n, T4 three data states, T5 tokens,
 * T6 a11y D7 scope="col", T7 type-safe, T10 debounce, T11 ErrorBoundary,
 * T12 formatDateTime.
 * A7: apiClient only in service.
 * C13: no raw hex.
 * C14: Router Link for internal nav.
 * D7: scope="col" on every <th>.
 * D6: htmlFor + id on every filter input.
 */
import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Eye, Plus, Search } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { riskCaseService } from '@/services/api/risk-case.service';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/utils/datetime';
import {
  RISK_CASE_STATUSES,
  RISK_CASE_PRIORITIES,
  RISK_CASE_CASE_TYPES,
} from '@/types/risk-case.types';
import type {
  RiskCaseStatus,
  RiskCasePriority,
  RiskCaseType,
} from '@/types/risk-case.types';
import { StatusBadge, PriorityBadge, SlaCountdown } from '@/components/risk-cases/Badges';
import { CreateRiskCaseDialog } from '@/components/risk-cases/CreateRiskCaseDialog';
// Re-audit fix — humanize assignedRole slug display.
import { humanizeLabel } from '@/features/dashboards/components/dashboard-primitives';

export const Route = createFileRoute('/app/risk-cases/')({
  component: () => (
    <ErrorBoundary>
      <RiskCaseListView />
    </ErrorBoundary>
  ),
});

function RiskCaseListView() {
  const { t } = useTranslation();
  const canCreate = useAuthStore(selectHasPermission('risk.case.create'));

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RiskCaseStatus | 'open_all' | ''>('open_all');
  const [priorityFilter, setPriorityFilter] = useState<RiskCasePriority | ''>('');
  const [caseTypeFilter, setCaseTypeFilter] = useState<RiskCaseType | ''>('');
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [slaDueWithinHours, setSlaDueWithinHours] = useState<string>('');

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      'riskCases',
      {
        page,
        search: debouncedSearch,
        status: statusFilter,
        priority: priorityFilter,
        caseType: caseTypeFilter,
        assignedToMe,
        slaDueWithinHours,
      },
    ],
    queryFn: () =>
      riskCaseService.list({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        caseType: caseTypeFilter || undefined,
        assignedToMe: assignedToMe || undefined,
        slaDueWithinHours: slaDueWithinHours ? Number(slaDueWithinHours) : undefined,
      }),
    staleTime: 30_000,
  });

  const [showCreate, setShowCreate] = useState(false);

  const items = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{t('riskCases.list.title')}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t('riskCases.list.subtitle')}</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="me-1 h-4 w-4" aria-hidden="true" />
            {t('riskCases.actions.createManual')}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search
            className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <label htmlFor="rc-list-search" className="sr-only">
            {t('riskCases.filters.searchLabel')}
          </label>
          <Input
            id="rc-list-search"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('riskCases.filters.searchPlaceholder')}
            className="ps-9"
            aria-label={t('riskCases.filters.searchLabel')}
          />
        </div>

        <div>
          <label htmlFor="rc-list-status" className="sr-only">
            {t('riskCases.filters.status')}
          </label>
          <select
            id="rc-list-status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as RiskCaseStatus | 'open_all' | '');
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t('riskCases.filters.allStatuses')}</option>
            <option value="open_all">{t('riskCases.filters.openAll')}</option>
            {RISK_CASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`riskCases.statuses.${s}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rc-list-priority" className="sr-only">
            {t('riskCases.filters.priority')}
          </label>
          <select
            id="rc-list-priority"
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value as RiskCasePriority | '');
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t('riskCases.filters.allPriorities')}</option>
            {RISK_CASE_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`riskCases.priorities.${p}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rc-list-type" className="sr-only">
            {t('riskCases.filters.caseType')}
          </label>
          <select
            id="rc-list-type"
            value={caseTypeFilter}
            onChange={(e) => {
              setCaseTypeFilter(e.target.value as RiskCaseType | '');
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t('riskCases.filters.allCaseTypes')}</option>
            {RISK_CASE_CASE_TYPES.map((c) => (
              <option key={c} value={c}>
                {t(`riskCases.caseTypes.${c}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rc-list-sla" className="sr-only">
            {t('riskCases.filters.slaDueWithin')}
          </label>
          <select
            id="rc-list-sla"
            value={slaDueWithinHours}
            onChange={(e) => {
              setSlaDueWithinHours(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t('riskCases.filters.anySla')}</option>
            <option value="4">{t('riskCases.filters.slaWithin', { hours: 4 })}</option>
            <option value="24">{t('riskCases.filters.slaWithin', { hours: 24 })}</option>
            <option value="72">{t('riskCases.filters.slaWithin', { hours: 72 })}</option>
          </select>
        </div>

        <label htmlFor="rc-list-mine" className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            id="rc-list-mine"
            type="checkbox"
            checked={assignedToMe}
            onChange={(e) => {
              setAssignedToMe(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          {t('riskCases.filters.assignedToMe')}
        </label>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex h-48 items-center justify-center">
          <svg
            className="h-8 w-8 animate-spin text-primary"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div
          className="flex items-center gap-3 rounded-lg border border-error/30 bg-error/5 p-4"
          role="alert"
        >
          <AlertTriangle className="h-5 w-5 text-error" aria-hidden="true" />
          <p className="text-sm text-error">{(error as Error)?.message ?? t('common.error')}</p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {/* Table / empty */}
      {!isLoading && !isError && (
        <>
          {items.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card">
              <p className="text-sm text-ink-muted">{t('riskCases.list.empty')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-surface">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('riskCases.columns.title')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('riskCases.columns.priority')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('riskCases.columns.status')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('riskCases.columns.caseType')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('riskCases.columns.assignedTo')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('riskCases.columns.sla')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('riskCases.columns.dueAt')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-ink">
                        <Link
                          to="/app/risk-cases/$caseId"
                          params={{ caseId: String(item.id) }}
                          className="hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
                        >
                          {item.title}
                        </Link>
                        {item.contractTitle && (
                          <p className="mt-0.5 text-xs text-ink-muted truncate" title={item.contractTitle}>
                            {item.contractTitle}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={item.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-muted">
                        {t(`riskCases.caseTypes.${item.caseType}`, { defaultValue: item.caseType })}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink">
                        {/* O22: distinguish person assignment from role-only routing.
                            When no user is assigned (only a role), render "— · {role}"
                            so the column reads as pending-assignment rather than
                            falsely implying a role name is a person name. */}
                        {item.assignedUserName ? (
                          item.assignedUserName
                        ) : item.assignedRole ? (
                          <span className="text-ink-muted">
                            — · {humanizeLabel(item.assignedRole)}
                          </span>
                        ) : (
                          <span className="text-ink-muted">{t('riskCases.list.unassigned')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <SlaCountdown seconds={item.slaCountdownSeconds} />
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-muted">
                        {item.dueAt ? formatDateTime(item.dueAt, { showTime: true }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to="/app/risk-cases/$caseId"
                          params={{ caseId: String(item.id) }}
                          aria-label={t('riskCases.actions.view')}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-ink hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('riskCases.actions.view')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-ink-muted">
                {t('common.pagination.showing', {
                  count: items.length,
                  total: pagination.total,
                  defaultValue: '{{count}} of {{total}}',
                })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label={t('common.pagination.prev', { defaultValue: 'Prev' })}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className="text-sm text-ink">
                  {page} / {pagination.totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  aria-label={t('common.pagination.next', { defaultValue: 'Next' })}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <CreateRiskCaseDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </motion.div>
  );
}
