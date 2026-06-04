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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore, selectHasPermission, selectUser } from '@/store/auth.store';
import { riskCaseService } from '@/services/api/risk-case.service';
import { translateApiError } from '@/lib/translate-api-error';
import type { RiskCaseListItem } from '@/types/risk-case.types';
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
  const canEscalate = useAuthStore(selectHasPermission('risk.case.escalate'));
  // E-rev-E (Risk Cases): executive is a monitor, not a caseworker. Hide
  // per-row View pill, hide "Assigned to me" filter, surface a single
  // top-bar Escalate button that fires only when at-risk SLAs exist.
  const userRole = useAuthStore((s) => s.user?.role.name ?? null);
  const isExecutive = userRole === 'executive';

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
  const [showBulkEscalate, setShowBulkEscalate] = useState(false);

  const items = data?.data ?? [];
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
          {canEscalate && (
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
          {canCreate && (
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

        {/* E-rev-E — Executive doesn't act on individual cases, so the
            "Assigned to me" toggle is hidden for that role. */}
        {!isExecutive && (
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
                          {t('riskCases.columns.title')}
                        </th>
                        <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                          {t('riskCases.columns.priority')}
                        </th>
                        <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                          {t('riskCases.columns.status')}
                        </th>
                        <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                          {t('riskCases.columns.caseType')}
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
                        {/* E-rev-E — Actions column hidden for executive */}
                        {!isExecutive && (
                          <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                            {t('common.actions')}
                          </th>
                        )}
                      </tr>
                    </thead>
                <tbody className="divide-y divide-border bg-card">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-ink">
                        <Link
                          to="/app/risk-cases/$caseId"
                          params={{ caseId: String(item.id) }}
                          className="hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded block"
                        >
                          {item.title}
                        </Link>
                        {/* D50 — case title + linked contract title were
                            rendered as inline+block siblings which made the
                            DOM textContent read "Case TitleContract Title"
                            (no separator). Adding an explicit "Contract:"
                            prefix + block-level paragraph keeps them
                            visually identical but readable for screen
                            readers and DOM extractors. */}
                        {item.contractTitle && (
                          <p
                            className="mt-0.5 text-xs text-ink-muted truncate"
                            title={item.contractTitle}
                          >
                            <span className="text-ink-subtle">
                              {t("riskCases.linkedContractPrefix", {
                                defaultValue: "Contract:",
                              })}
                            </span>{" "}
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
                      {/* E-rev-E — Actions cell hidden for executive */}
                      {!isExecutive && (
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
                      )}
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
  if (roleName !== 'contract_drafter') return null;
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
