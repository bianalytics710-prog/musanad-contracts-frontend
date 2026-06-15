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
import { useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowUpRight, Eye, Plus, Search } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore, selectHasPermission, selectUser } from '@/store/auth.store';
import { riskCaseService } from '@/services/api/risk-case.service';
import { translateApiError } from '@/lib/translate-api-error';
import type { AssignableUser, RiskCaseListItem } from '@/types/risk-case.types';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/utils/datetime';
import {
  RISK_CASE_STATUSES,
  RISK_CASE_PRIORITIES,
} from '@/types/risk-case.types';
import type {
  RiskCaseStatus,
  RiskCasePriority,
} from '@/types/risk-case.types';
import { StatusBadge, PriorityBadge, SlaCountdown } from '@/components/risk-cases/Badges';
import { RiskTypePill, RISK_TYPE_SLUGS } from '@/components/risk/RiskTypePill';
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
  const canEscalate = useAuthStore(selectHasPermission('risk.case.escalate'));
  // E-rev-E (Risk Cases): executive is a monitor, not a caseworker. Hide
  // per-row View pill, hide "Assigned to me" filter, surface a single
  // top-bar Escalate button that fires only when at-risk SLAs exist.
  const userRole = useAuthStore((s) => s.user?.role.name ?? null);
  const isExecutive = userRole === 'executive';
  // 2026-06-14 — Legal Counsel sees this page AS her personal risk inbox
  // (mirrors My Work's risk-case branch). Force assignedToMe=true, hide
  // the "Assigned to" filter (moot — only her cases shown) and the
  // "Assigned to me" toggle (already implicit). Exec / platform_admin /
  // Super Admin keep the global oversight view.
  const isLegalCounsel = userRole === 'legal_counsel';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RiskCaseStatus | 'open_all' | ''>('open_all');
  const [priorityFilter, setPriorityFilter] = useState<RiskCasePriority | ''>('');
  // 2026-06-04 — case_type filter dropped from the UI in favour of risk_type
  // (the rule-based taxonomy from fn_classify_risk). case_type stays in the
  // BE response as provenance metadata but is no longer rendered/filterable.
  // riskType filter is client-side because the BE list fn doesn't accept it
  // yet (only filters on case_type / status / priority / SLA / search).
  const [riskTypeFilter, setRiskTypeFilter] = useState<string>('');
  // Phase A — new server-side "Assigned to" filter. Passes assignedUserId
  // through to fn_risk_case_list. '' means "any assignee".
  const [assignedUserIdFilter, setAssignedUserIdFilter] = useState<string>('');
  // LC starts narrowed to "assigned to me" by construction; other roles
  // start wide-open and opt in.
  const [assignedToMe, setAssignedToMe] = useState(isLegalCounsel);
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
        assignedToMe,
        slaDueWithinHours,
        assignedUserIdFilter,
      },
    ],
    queryFn: () =>
      riskCaseService.list({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        assignedToMe: assignedToMe || undefined,
        slaDueWithinHours: slaDueWithinHours ? Number(slaDueWithinHours) : undefined,
        assignedUserId: assignedUserIdFilter ? Number(assignedUserIdFilter) : undefined,
      }),
    staleTime: 30_000,
  });

  // Phase A — assignable users for the inline reassign dropdown + the
  // Assigned-to filter. Cached for 5 minutes since the role/user roster
  // doesn't change between page loads.
  const { data: assignableUsers = [] } = useQuery({
    queryKey: ['riskCases', 'assignableUsers'],
    queryFn: () => riskCaseService.assignableUsers(),
    staleTime: 5 * 60_000,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [showBulkEscalate, setShowBulkEscalate] = useState(false);

  const rawItems = data?.data ?? [];
  // Client-side risk-type filter — BE list fn doesn't accept riskType yet,
  // but classification is computed server-side and shipped on every row,
  // so the filter is cheap and consistent. Pagination total stays the
  // backend total when no risk-type filter is active.
  const items = riskTypeFilter
    ? rawItems.filter((item: RiskCaseListItem) => item.riskType === riskTypeFilter)
    : rawItems;
  const pagination = data?.pagination;

  // Cases that are overdue OR due within 24h, excluding terminal states.
  // E-rev-E — drives the top-bar Escalate button (visible only when > 0
  // and the actor has the escalate permission).
  const atRiskCases = useMemo(
    () =>
      items.filter((c) => {
        if (!c.dueAt) return false;
        if (['closed', 'rejected', 'approved', 'accept_risk'].includes(c.status)) return false;
        const hours = (new Date(c.dueAt).getTime() - Date.now()) / (1000 * 60 * 60);
        return hours <= 24;
      }),
    [items],
  );

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
          {/* D51 — scope caption clarifies that the contract_drafter sees
              department-wide risk cases in read mode (none assigned to her
              directly), so the empty assigned-to-me state doesn't read as
              "the platform has no cases". */}
          <ScopeCaption />
          {/* A43 (Aisha audit fix 2026-06-01) — surface a banner whenever a
              case is approaching SLA-breach in the next 24h. Otherwise
              critical-priority cases are easy to miss in a long table. */}
          <ImminentSlaBanner items={items} />
        </div>
        <div className="flex items-center gap-2">
          {/* E-rev-E — single top-bar Escalate button for executive (and any
              other role with risk.case.escalate). Disabled when no cases are
              at-risk; the count badge surfaces urgency. */}
          {canEscalate && !isLegalCounsel && (
            <Button
              type="button"
              variant={atRiskCases.length > 0 ? 'default' : 'outline'}
              size="sm"
              disabled={atRiskCases.length === 0}
              onClick={() => setShowBulkEscalate(true)}
            >
              <ArrowUpRight className="me-1 h-4 w-4" aria-hidden="true" />
              {t('riskCases.actions.escalateAtRisk', {
                count: atRiskCases.length,
                defaultValue:
                  atRiskCases.length === 0
                    ? 'No overdue cases'
                    : atRiskCases.length === 1
                      ? 'Escalate 1 overdue case'
                      : `Escalate ${atRiskCases.length} overdue cases`,
              })}
            </Button>
          )}
          {canCreate && !isLegalCounsel && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="me-1 h-4 w-4" aria-hidden="true" />
              {t('riskCases.actions.createManual')}
            </Button>
          )}
        </div>
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
          <label htmlFor="rc-list-risk-type" className="sr-only">
            {t('riskCases.filters.riskType', { defaultValue: 'Risk type' })}
          </label>
          <select
            id="rc-list-risk-type"
            value={riskTypeFilter}
            onChange={(e) => {
              setRiskTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">
              {t('riskCases.filters.allRiskTypes', { defaultValue: 'All risk types' })}
            </option>
            {RISK_TYPE_SLUGS.map((slug) => (
              <option key={slug} value={slug}>
                {t(`riskTypes.${slug}`)}
              </option>
            ))}
          </select>
        </div>

        {/* LC's page is already personal — assignee filter is moot. */}
        {!isLegalCounsel && (
          <div>
            <label htmlFor="rc-list-assignee" className="sr-only">
              {t('riskCases.filters.assignedTo', { defaultValue: 'Assigned to' })}
            </label>
            <select
              id="rc-list-assignee"
              value={assignedUserIdFilter}
              onChange={(e) => {
                setAssignedUserIdFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">
                {t('riskCases.filters.allAssignees', { defaultValue: 'All assignees' })}
              </option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.roleDisplay}
                </option>
              ))}
            </select>
          </div>
        )}

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

        {/* E-rev-E — Executive doesn't act on individual cases, so the
            "Assigned to me" toggle is hidden for that role.
            2026-06-14 — Also hidden for Legal Counsel: assignedToMe is
            forced on, so the toggle would be a no-op. */}
        {!isExecutive && !isLegalCounsel && (
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
        )}
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
            // E-rev-E — Card + font-mono [10px] uppercase th matches the
            // ContractListView idiom across the rest of the app.
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-surface">
                      <tr className="text-left">
                        <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                          {t('riskCases.columns.contract', { defaultValue: 'Contract' })}
                        </th>
                        <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                          {t('riskCases.columns.counterparty', { defaultValue: 'Counterparty' })}
                        </th>
                        <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                          {t('riskCases.columns.riskType', { defaultValue: 'Risk type' })}
                        </th>
                        <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                          {t('riskCases.columns.priority')}
                        </th>
                        <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                          {t('riskCases.columns.status')}
                        </th>
                        <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                          {t('riskCases.columns.assignedTo')}
                        </th>
                        <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                          {t('riskCases.columns.sla')}
                        </th>
                        <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                          {t('riskCases.columns.dueAt')}
                        </th>
                      </tr>
                    </thead>
                <tbody className="divide-y divide-border bg-card">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-surface/50 transition-colors">
                      {/* Contract column — number links to detail page;
                          title below in muted text for context. */}
                      <td className="px-4 py-3 align-top">
                        {item.contractId ? (
                          <Link
                            to="/app/contracts/$id"
                            params={{ id: String(item.contractId) }}
                            className="font-mono text-xs text-gold hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
                          >
                            {item.contractNumber ?? `#${item.contractId}`}
                          </Link>
                        ) : (
                          <span className="text-xs text-ink-muted">—</span>
                        )}
                        {item.contractTitle && (
                          <p className="mt-0.5 max-w-[260px] truncate text-xs text-ink-muted" title={item.contractTitle}>
                            {item.contractTitle}
                          </p>
                        )}
                      </td>
                      {/* Counterparty column */}
                      <td className="px-4 py-3 align-top text-xs text-ink">
                        {item.counterpartyName ?? <span className="text-ink-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <RiskTypePill type={item.riskType} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <PriorityBadge priority={item.priority} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusBadge status={item.status} />
                      </td>
                      {/* Inline reassign dropdown */}
                      <td className="px-4 py-3 align-top">
                        <AssigneeCell item={item} assignableUsers={assignableUsers} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <SlaCountdown seconds={item.slaCountdownSeconds} />
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-ink-muted">
                        {item.dueAt ? formatDateTime(item.dueAt, { showTime: true }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pagination — E-rev-E matches the ContractListView idiom:
              "Showing X-Y of N" + Back/Next outline buttons + page-of-N. */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-ink-muted">
                {t('contracts.showingRange', {
                  from: (pagination.page - 1) * pagination.limit + 1,
                  to: Math.min(pagination.page * pagination.limit, pagination.total),
                  total: pagination.total,
                  defaultValue: 'Showing {{from}}-{{to}} of {{total}}',
                })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  {t('common.back', { defaultValue: 'Back' })}
                </Button>
                <span className="font-mono text-xs text-ink-muted">
                  {page} / {pagination.totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                >
                  {t('common.next', { defaultValue: 'Next' })}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <CreateRiskCaseDialog open={showCreate} onClose={() => setShowCreate(false)} />
      <BulkEscalateDialog
        open={showBulkEscalate}
        onClose={() => setShowBulkEscalate(false)}
        cases={atRiskCases}
      />
    </motion.div>
  );
}

/**
 * D51 — scope caption for personas like contract_drafter who land here with
 * read-only access but no cases directly assigned. Renders a one-line
 * advisory below the H1 so the page doesn't read as "no cases on the
 * platform" when in fact she's looking at the department-wide queue.
 */
function ScopeCaption() {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);
  const roleName = user?.role?.name;
  if (roleName === 'contract_drafter') {
    return (
      <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-[11px] text-ink-muted">
        <span aria-hidden="true">•</span>
        {t('riskCases.list.drafterScopeCaption', {
          defaultValue:
            'Read-only view — these are department-wide risk cases; none are assigned to you directly.',
        })}
      </p>
    );
  }
  if (roleName === 'legal_counsel') {
    return (
      <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-[11px] text-ink-muted">
        <span aria-hidden="true">•</span>
        {t('riskCases.list.legalCounselScopeCaption', {
          defaultValue:
            'Showing cases assigned to you. Open My Work for the full inbox (approvals, third-party reviews, advisory drafts).',
        })}
      </p>
    );
  }
  return null;
}

/**
 * A43 (Aisha audit fix 2026-06-01) — renders a banner when one or more
 * cases is due within the next 24 hours. Mid-table critical cases were too
 * easy to miss; the banner pulls the count above the fold and links the
 * user to the at-risk subset via the standard SLA filter.
 */
function ImminentSlaBanner({ items }: { items: Array<{ dueAt: string | null; status: string }> }) {
  const { t } = useTranslation();
  const within24hCount = items.filter((c) => {
    if (!c.dueAt) return false;
    if (['closed', 'rejected'].includes(c.status)) return false;
    const due = new Date(c.dueAt).getTime();
    const now = Date.now();
    const hours = (due - now) / (1000 * 60 * 60);
    return hours > 0 && hours <= 24;
  }).length;
  if (within24hCount === 0) return null;
  return (
    <div className="mt-2 flex items-start gap-2 rounded-md border border-terracotta/40 bg-terracotta/5 px-3 py-2 text-xs text-terracotta">
      <span aria-hidden="true">⚠</span>
      <p className="font-medium">
        {t('riskCases.list.imminentSlaBanner', {
          count: within24hCount,
          defaultValue:
            within24hCount === 1
              ? '1 case nearing SLA breach in next 24h — review now'
              : `${within24hCount} cases nearing SLA breach in next 24h — review now`,
        })}
      </p>
    </div>
  );
}

/**
 * E-rev-E — BulkEscalateDialog. Executive picks any subset of the at-risk
 * cases and escalates them in one click. Loops over the existing single-
 * case escalate endpoint so we don't need a new BE route; success/failure
 * is surfaced as a single toast.
 */
function BulkEscalateDialog({
  open,
  onClose,
  cases,
}: {
  open: boolean;
  onClose: () => void;
  cases: RiskCaseListItem[];
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Reset selection to "all selected" each time the dialog opens.
  useMemo(() => {
    if (open) setSelected(new Set(cases.map((c) => c.id)));
  }, [open, cases]);

  const mutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const results = await Promise.allSettled(
        ids.map((id) => riskCaseService.escalate(id, { reason: reason.trim() || null })),
      );
      return {
        ok: results.filter((r) => r.status === 'fulfilled').length,
        fail: results.filter((r) => r.status === 'rejected').length,
      };
    },
    onSuccess: ({ ok, fail }) => {
      if (ok > 0) {
        toast.success(
          t('riskCases.toasts.bulkEscalated', {
            count: ok,
            defaultValue:
              ok === 1
                ? '1 case escalated to next role per escalation matrix'
                : `${ok} cases escalated to next role per escalation matrix`,
          }),
        );
      }
      if (fail > 0) {
        toast.error(
          t('riskCases.toasts.bulkEscalatedSomeFailed', {
            count: fail,
            defaultValue: `${fail} case(s) failed to escalate — check permissions`,
          }),
        );
      }
      void qc.invalidateQueries({ queryKey: ['riskCases'] });
      setReason('');
      setSelected(new Set());
      onClose();
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {t('riskCases.bulkEscalate.title', { defaultValue: 'Escalate overdue cases' })}
          </DialogTitle>
          <DialogDescription>
            {t('riskCases.bulkEscalate.description', {
              defaultValue:
                'Selected cases will be reassigned to the next role per the escalation matrix. Add an optional reason that will be recorded against each case.',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border bg-surface p-2">
            {cases.length === 0 ? (
              <li className="py-4 text-center text-xs text-ink-muted">
                {t('riskCases.bulkEscalate.empty', {
                  defaultValue: 'Nothing overdue right now.',
                })}
              </li>
            ) : (
              cases.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded p-2 hover:bg-card">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink" title={c.title}>
                        {c.title}
                      </p>
                      <p className="text-[11px] text-ink-muted">
                        {c.priority} · {c.status} · due{' '}
                        {c.dueAt ? new Date(c.dueAt).toLocaleString() : '—'}
                      </p>
                    </div>
                  </label>
                </li>
              ))
            )}
          </ul>

          <div>
            <label htmlFor="rc-bulk-esc-reason" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.fields.escalationReason', { defaultValue: 'Reason (optional)' })}
            </label>
            <textarea
              id="rc-bulk-esc-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={5000}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('riskCases.fields.escalationReasonHint', {
                defaultValue: 'Why are you escalating these now?',
              })}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || selected.size === 0}
            >
              {mutation.isPending
                ? t('common.submitting', { defaultValue: 'Escalating…' })
                : t('riskCases.bulkEscalate.confirm', {
                    count: selected.size,
                    defaultValue:
                      selected.size === 1
                        ? 'Escalate 1 case'
                        : `Escalate ${selected.size} cases`,
                  })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── AssigneeCell ────────────────────────────────────────────────────
// Phase A — inline reassignment dropdown for the Risk Cases list.
// Selecting a new person opens a confirm modal — on confirm, calls the
// existing /risk-cases/:id/assign endpoint (fn_risk_case_assign) with the
// new user_id + that user's role. On success, invalidates the list query
// so the row updates in place. On cancel or error, the dropdown reverts.
//
// Renders a plain text label (no select) when the actor doesn't hold
// risk.case.escalate — non-eligible callers see a read-only column.
function AssigneeCell({
  item,
  assignableUsers,
}: {
  item: RiskCaseListItem;
  assignableUsers: AssignableUser[];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canReassign =
    useAuthStore(selectHasPermission('risk.case.escalate')) ||
    useAuthStore(selectHasPermission('risk.case.create'));
  const [pending, setPending] = useState<AssignableUser | null>(null);

  const mutation = useMutation({
    mutationFn: (target: AssignableUser) =>
      riskCaseService.assign(item.id, {
        assignedUserId: Number(target.id),
        assignedRole: target.roleName,
      }),
    onSuccess: (_data, target) => {
      toast.success(
        t('riskCases.reassign.success', {
          defaultValue: 'Reassigned to {{name}}',
          name: target.name,
        }),
      );
      void queryClient.invalidateQueries({ queryKey: ['riskCases'] });
      setPending(null);
    },
    onError: (e) => {
      toast.error(translateApiError(e, t));
      setPending(null);
    },
  });

  // When the actor can't reassign, fall back to the same read-only label
  // we rendered before — keeps non-privileged callers' UI clean.
  if (!canReassign) {
    return (
      <span className="text-xs text-ink">
        {item.assignedUserName ?? (
          <span className="text-ink-muted">
            {item.assignedRole
              ? `— · ${humanizeLabel(item.assignedRole)}`
              : t('riskCases.list.unassigned')}
          </span>
        )}
      </span>
    );
  }

  return (
    <>
      <label htmlFor={`rc-assignee-${item.id}`} className="sr-only">
        {t('riskCases.columns.assignedTo')}
      </label>
      <select
        id={`rc-assignee-${item.id}`}
        value={item.assignedUserId ? String(item.assignedUserId) : ''}
        onChange={(e) => {
          const target = assignableUsers.find((u) => u.id === e.target.value);
          if (target && Number(target.id) !== item.assignedUserId) {
            setPending(target);
          }
        }}
        disabled={mutation.isPending}
        className="max-w-[180px] truncate rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">
          {item.assignedRole
            ? t('riskCases.reassign.roleOnlyOption', {
                defaultValue: '— · {{role}}',
                role: humanizeLabel(item.assignedRole),
              })
            : t('riskCases.list.unassigned')}
        </option>
        {assignableUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('riskCases.reassign.confirmTitle', { defaultValue: 'Reassign case?' })}
            </DialogTitle>
            <DialogDescription>
              {t('riskCases.reassign.confirmBody', {
                defaultValue:
                  'Reassign this case to {{name}} ({{role}}). They will be notified and the SLA clock continues from where it stood.',
                name: pending?.name ?? '',
                role: pending?.roleDisplay ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPending(null)}
              disabled={mutation.isPending}
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              type="button"
              onClick={() => pending && mutation.mutate(pending)}
              disabled={mutation.isPending || !pending}
            >
              {mutation.isPending
                ? t('common.submitting', { defaultValue: 'Reassigning…' })
                : t('riskCases.reassign.confirmCta', { defaultValue: 'Reassign' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
