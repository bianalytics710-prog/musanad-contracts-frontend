/**
 * /app/legal/advisory-queue — Legal Counsel advisory draft list.
 *
 * Brought in line with the Contracts + Approvals list design system:
 *   - kicker + H1 + subtitle header
 *   - StatCard strip (always rendered, not gated on result presence)
 *   - filter toolbar: search + status + draft type + my queue
 *   - Card-wrapped table with StatusBadge tones
 *   - single primary "View" action per row (navigates to detail page)
 */
import { useMemo, useState, type ChangeEvent } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/patterns';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { advisoryDraftsService } from '@/services/api/advisory-drafts.service';
import { formatDateTime } from '@/utils/datetime';
import type { ApprovalStatus } from '@/types/advisory-drafts.types';

export const Route = createFileRoute('/app/legal/advisory-queue/')({
  component: () => (
    <ErrorBoundary>
      <LegalAdvisoryQueueView />
    </ErrorBoundary>
  ),
});

const STATUS_TONE: Record<ApprovalStatus, string> = {
  unapproved: 'bg-amber-tint/40 text-amber-ink',
  approved: 'bg-sage-tint text-sage-ink',
  rejected: 'bg-terracotta/10 text-terracotta',
  modified: 'bg-gold/10 text-ink',
};

const DRAFT_TYPE_OVERRIDES: Record<string, string> = {
  cure_notice: 'Cure Notice',
  fm_invocation: 'Force Majeure Invocation',
  sanctions_hold: 'Sanctions Hold',
  esg_concern: 'ESG Concern',
  icv_rectification: 'ICV Rectification',
  insurance_renewal: 'Insurance Renewal',
  custom: 'Custom Advisory',
};

function humanizeDraftType(slug: string | null | undefined): string {
  if (!slug) return '—';
  if (DRAFT_TYPE_OVERRIDES[slug]) return DRAFT_TYPE_OVERRIDES[slug];
  return slug
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

const PAGE_SIZE = 20;

function LegalAdvisoryQueueView() {
  const { t } = useTranslation();
  const canReview = useAuthStore(selectHasPermission('advisory.draft.review'));

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | ''>('');
  const [draftTypeFilter, setDraftTypeFilter] = useState<string>('');
  const [myQueue, setMyQueue] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['advisoryDrafts', { page, approvalStatus: statusFilter, myQueue }],
    queryFn: () =>
      advisoryDraftsService.list({
        page,
        limit: PAGE_SIZE,
        approvalStatus: statusFilter || undefined,
        myQueue: myQueue || undefined,
      }),
    enabled: canReview,
    staleTime: 30_000,
  });

  const rawItems = data?.data ?? [];
  const pagination = data?.pagination;

  // Client-side search + draft-type filter (BE list takes status + myQueue only).
  const items = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return rawItems.filter((row) => {
      if (q) {
        const hay = `${row.contractNumber ?? ''} ${row.contractTitle ?? ''} ${row.contractTitleEn ?? ''} ${row.counterpartyName ?? ''} ${row.createdByName ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (draftTypeFilter && row.draftType !== draftTypeFilter) return false;
      return true;
    });
  }, [rawItems, debouncedSearch, draftTypeFilter]);

  const typeOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: Array<{ value: string; label: string }> = [];
    for (const row of rawItems) {
      if (!row.draftType || seen.has(row.draftType)) continue;
      seen.add(row.draftType);
      opts.push({ value: row.draftType, label: humanizeDraftType(row.draftType) });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [rawItems]);

  const kpiCounts = useMemo(() => {
    const out = { unapproved: 0, approved: 0, rejected: 0, modified: 0 };
    for (const r of rawItems) {
      out[r.approvalStatus] = (out[r.approvalStatus] ?? 0) + 1;
    }
    return out;
  }, [rawItems]);

  const hasFilters =
    !!debouncedSearch.trim() ||
    !!statusFilter ||
    !!draftTypeFilter ||
    myQueue;

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setPage(1);
  };
  const handleClearFilters = () => {
    setSearchInput('');
    setStatusFilter('');
    setDraftTypeFilter('');
    setMyQueue(false);
    setPage(1);
  };

  if (!canReview) {
    return (
      <div className="mx-auto w-full max-w-[1280px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">{t('common.accessDenied')}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 font-mono text-xs uppercase tracking-wider text-ink-subtle">
            {t('legal.advisoryQueue.kicker', { defaultValue: 'Advisory queue' })}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t('legal.advisoryQueue.title')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t('legal.advisoryQueue.subtitle')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label={t('common.refresh', { defaultValue: 'Refresh' })}
        >
          <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          {t('common.refresh', { defaultValue: 'Refresh' })}
        </Button>
      </header>

      {/* KPI strip — always rendered for consistency with Contracts/Approvals. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t('legal.advisoryQueue.status.unapproved')}
          value={kpiCounts.unapproved.toLocaleString()}
          variant={kpiCounts.unapproved > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label={t('legal.advisoryQueue.status.approved')}
          value={kpiCounts.approved.toLocaleString()}
        />
        <StatCard
          label={t('legal.advisoryQueue.status.modified')}
          value={kpiCounts.modified.toLocaleString()}
        />
        <StatCard
          label={t('legal.advisoryQueue.status.rejected')}
          value={kpiCounts.rejected.toLocaleString()}
          variant={kpiCounts.rejected > 0 ? 'risk' : 'default'}
        />
      </div>

      {/* Filter toolbar — search + status + type + my queue. */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <label htmlFor="aq-search" className="sr-only">
              {t('legal.advisoryQueue.searchPlaceholder', {
                defaultValue: 'Search contract, counterparty, drafter…',
              })}
            </label>
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <Input
              id="aq-search"
              type="search"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={t('legal.advisoryQueue.searchPlaceholder', {
                defaultValue: 'Search contract, counterparty, drafter…',
              })}
              className="ps-9"
              autoComplete="off"
            />
          </div>
          {hasFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={handleClearFilters}>
              <X className="h-3.5 w-3.5" />
              {t('common.clear', { defaultValue: 'Clear' })}
            </Button>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="aq-status-filter"
              className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
            >
              {t('legal.advisoryQueue.filters.status', { defaultValue: 'Status' })}
            </label>
            <select
              id="aq-status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ApprovalStatus | '');
                setPage(1);
              }}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-ink shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">
                {t('legal.advisoryQueue.filters.allStatuses', { defaultValue: 'All' })}
              </option>
              <option value="unapproved">
                {t('legal.advisoryQueue.status.unapproved')}
              </option>
              <option value="approved">
                {t('legal.advisoryQueue.status.approved')}
              </option>
              <option value="rejected">
                {t('legal.advisoryQueue.status.rejected')}
              </option>
              <option value="modified">
                {t('legal.advisoryQueue.status.modified')}
              </option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="aq-type-filter"
              className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
            >
              {t('legal.advisoryQueue.filters.draftType', { defaultValue: 'Type' })}
            </label>
            <select
              id="aq-type-filter"
              value={draftTypeFilter}
              onChange={(e) => {
                setDraftTypeFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-ink shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">{t('common.all', { defaultValue: 'All' })}</option>
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(`legal.advisoryQueue.draftType.${o.value}`, {
                    defaultValue: o.label,
                  })}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="aq-my-queue"
              className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
            >
              {t('legal.advisoryQueue.filters.scope', { defaultValue: 'Scope' })}
            </label>
            <label
              htmlFor="aq-my-queue"
              className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-input bg-transparent px-2 text-xs text-ink shadow-sm"
            >
              <input
                type="checkbox"
                id="aq-my-queue"
                checked={myQueue}
                onChange={(e) => {
                  setMyQueue(e.target.checked);
                  setPage(1);
                }}
                className="h-3.5 w-3.5 cursor-pointer rounded border-border accent-gold"
              />
              {t('legal.advisoryQueue.filters.myQueue')}
            </label>
          </div>
        </div>
      </div>

      {/* Three data states */}
      {isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-md bg-surface"
                aria-hidden="true"
              />
            ))}
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
            <p className="text-sm font-medium text-destructive">
              {(error as Error)?.message ?? t('common.error')}
            </p>
            <Button type="button" size="sm" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
            <h2 className="text-base font-semibold text-ink">
              {hasFilters
                ? t('legal.advisoryQueue.noResultsTitle', {
                    defaultValue: 'No advisories match these filters',
                  })
                : t('legal.advisoryQueue.emptyState')}
            </h2>
            {hasFilters && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={handleClearFilters}
              >
                <X className="h-3.5 w-3.5" />
                {t('common.clear', { defaultValue: 'Clear filters' })}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table
                className="w-full text-sm"
                aria-busy={isFetching ? 'true' : 'false'}
              >
                <thead className="border-b border-border bg-surface">
                  <tr className="text-left">
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('legal.advisoryQueue.columns.contract')}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('legal.advisoryQueue.columns.counterparty')}
                    </th>
                    <th scope="col" className="px-2 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('legal.advisoryQueue.columns.draftType')}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('legal.advisoryQueue.columns.generatedAt')}
                    </th>
                    <th scope="col" className="px-2 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('legal.advisoryQueue.columns.status')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-end font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      <span className="sr-only">{t('common.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="group border-b border-border/60 transition-colors hover:bg-surface/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <Link
                            to="/app/contracts/$id"
                            params={{ id: String(item.contractId ?? 0) }}
                            className="font-mono text-xs text-ink-muted hover:text-gold hover:underline"
                          >
                            {item.contractNumber ?? '—'}
                          </Link>
                          {item.contractTitle && (
                            <span className="text-sm font-medium text-ink">
                              {item.contractTitle}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-muted">
                        {item.counterpartyName ?? '—'}
                      </td>
                      <td className="px-2 py-3">
                        <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[10px] tracking-wider text-ink-muted">
                          {t(`legal.advisoryQueue.draftType.${item.draftType}`, {
                            defaultValue: humanizeDraftType(item.draftType),
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                        {formatDateTime(item.generatedAt, { showTime: true })}
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            STATUS_TONE[item.approvalStatus] ?? 'bg-muted text-ink-muted'
                          }`}
                        >
                          {t(`legal.advisoryQueue.status.${item.approvalStatus}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Link
                          to="/app/legal/advisory-queue/$id"
                          params={{ id: String(item.id) }}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-3 text-xs font-medium text-ink hover:bg-surface"
                        >
                          {t('legal.advisoryQueue.actions.view')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-ink-muted">
            {t('common.pagination.showing', {
              count: items.length,
              total: pagination.total,
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
              aria-label={t('common.pagination.prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-mono text-xs text-ink-muted">
              {page} / {pagination.totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages || isFetching}
              aria-label={t('common.pagination.next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
