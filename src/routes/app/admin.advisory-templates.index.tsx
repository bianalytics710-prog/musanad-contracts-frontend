/**
 * /app/admin/advisory-templates — Advisory Template list page.
 *
 * Aligned to the Contracts list design system: kicker + H1 header,
 * StatCard strip, Card-wrapped filter toolbar (search + Type + Channel),
 * Card-wrapped table with mono uppercase column headers, design-token
 * row hover, single "Edit" View-style action per row.
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
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { adminAdvisoryTemplatesService } from '@/services/api/admin/advisory-templates.service';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/utils/datetime';
import type { DraftType } from '@/types/admin/advisory-templates.types';
import { DRAFT_TYPES } from '@/types/admin/advisory-templates.types';

export const Route = createFileRoute('/app/admin/advisory-templates/')({
  component: () => (
    <ErrorBoundary>
      <AdminAdvisoryTemplatesView />
    </ErrorBoundary>
  ),
});

const PAGE_SIZE = 20;

function AdminAdvisoryTemplatesView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const canManage = useAuthStore(selectHasPermission('advisory.template.manage'));

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [draftTypeFilter, setDraftTypeFilter] = useState<DraftType | ''>('');
  const [channelFilter, setChannelFilter] = useState<string>('');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [
      'adminAdvisoryTemplates',
      { page, search: debouncedSearch, draftType: draftTypeFilter },
    ],
    queryFn: () =>
      adminAdvisoryTemplatesService.list({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        draftType: draftTypeFilter || undefined,
        isActive: true,
      }),
    enabled: canManage,
    staleTime: 30_000,
  });

  const rawItems = data?.data ?? [];
  const pagination = data?.pagination;

  const items = useMemo(() => {
    if (!channelFilter) return rawItems;
    return rawItems.filter((item) =>
      (item.dispatchChannels as readonly string[] | undefined)?.includes(channelFilter),
    );
  }, [rawItems, channelFilter]);

  const channelOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: string[] = [];
    for (const row of rawItems) {
      for (const ch of row.dispatchChannels ?? []) {
        if (!seen.has(ch)) {
          seen.add(ch);
          opts.push(ch);
        }
      }
    }
    return opts.sort();
  }, [rawItems]);

  const kpiCounts = useMemo(() => {
    const out = { total: rawItems.length, draftTypes: new Set<string>(), channels: new Set<string>(), latestUpdated: '' };
    for (const row of rawItems) {
      out.draftTypes.add(row.draftType);
      for (const ch of row.dispatchChannels ?? []) out.channels.add(ch);
      if (row.updatedAt && (!out.latestUpdated || row.updatedAt > out.latestUpdated)) {
        out.latestUpdated = row.updatedAt;
      }
    }
    return out;
  }, [rawItems]);

  const hasFilters =
    !!debouncedSearch.trim() || !!draftTypeFilter || !!channelFilter;

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setPage(1);
  };
  const handleClearFilters = () => {
    setSearchInput('');
    setDraftTypeFilter('');
    setChannelFilter('');
    setPage(1);
  };

  if (!canManage) {
    return (
      <div className="mx-auto w-full max-w-[1280px] p-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
            <p className="text-sm text-ink-muted">{t('common.accessDenied')}</p>
          </CardContent>
        </Card>
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
            {t('admin.advisoryTemplates.kicker', { defaultValue: 'Advisory templates' })}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t('admin.advisoryTemplates.title')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t('admin.advisoryTemplates.subtitle')}
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

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t('admin.advisoryTemplates.kpis.total', { defaultValue: 'Templates' })}
          value={kpiCounts.total.toLocaleString()}
        />
        <StatCard
          label={t('admin.advisoryTemplates.kpis.draftTypes', { defaultValue: 'Draft types' })}
          value={kpiCounts.draftTypes.size.toLocaleString()}
        />
        <StatCard
          label={t('admin.advisoryTemplates.kpis.channels', { defaultValue: 'Channels' })}
          value={kpiCounts.channels.size.toLocaleString()}
        />
        <StatCard
          label={t('admin.advisoryTemplates.kpis.latestUpdated', { defaultValue: 'Latest update' })}
          value={
            kpiCounts.latestUpdated
              ? formatDateTime(kpiCounts.latestUpdated)
              : '—'
          }
        />
      </div>

      {/* Filter toolbar — Contracts canonical pattern. */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <label htmlFor="advisory-templates-search" className="sr-only">
              {t('admin.advisoryTemplates.searchPlaceholder')}
            </label>
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <Input
              id="advisory-templates-search"
              type="search"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={t('admin.advisoryTemplates.searchPlaceholder')}
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
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="advisory-templates-type-filter"
              className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
            >
              {t('admin.advisoryTemplates.filters.draftType', { defaultValue: 'Draft type' })}
            </label>
            <select
              id="advisory-templates-type-filter"
              value={draftTypeFilter}
              onChange={(e) => {
                setDraftTypeFilter(e.target.value as DraftType | '');
                setPage(1);
              }}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-ink shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">
                {t('admin.advisoryTemplates.filters.allTypes', { defaultValue: 'All' })}
              </option>
              {DRAFT_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {t(`admin.advisoryTemplates.draftTypes.${dt}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="advisory-templates-channel-filter"
              className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
            >
              {t('admin.advisoryTemplates.filters.channel', { defaultValue: 'Channel' })}
            </label>
            <select
              id="advisory-templates-channel-filter"
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-ink shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">{t('common.all', { defaultValue: 'All' })}</option>
              {channelOptions.map((ch) => (
                <option key={ch} value={ch}>
                  {t(`admin.advisoryTemplates.channels.${ch}`, { defaultValue: ch })}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

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
                ? t('admin.advisoryTemplates.noResultsTitle', {
                    defaultValue: 'No templates match these filters',
                  })
                : t('admin.advisoryTemplates.emptyState')}
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
                      {t('admin.advisoryTemplates.columns.templateId')}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('admin.advisoryTemplates.columns.displayName')}
                    </th>
                    <th scope="col" className="px-2 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('admin.advisoryTemplates.columns.draftType')}
                    </th>
                    <th scope="col" className="px-2 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('admin.advisoryTemplates.columns.version')}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('admin.advisoryTemplates.columns.approverRole')}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('admin.advisoryTemplates.columns.channels')}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('admin.advisoryTemplates.columns.lastModified')}
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
                      <td className="px-4 py-3 font-mono text-xs text-ink-subtle">
                        {item.templateId}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-sm font-medium text-ink"
                          dir={isAr ? 'rtl' : 'ltr'}
                        >
                          {isAr ? item.displayNameAr : item.displayNameEn}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[10px] tracking-wider text-ink-muted">
                          {t(`admin.advisoryTemplates.draftTypes.${item.draftType}`)}
                        </span>
                      </td>
                      <td className="px-2 py-3 font-mono text-xs text-ink-muted">
                        v{item.version}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-muted">
                        {item.assignedApproverRole}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {item.dispatchChannels.map((ch) => (
                            <span
                              key={ch}
                              className="inline-flex items-center rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-ink"
                            >
                              {t(`admin.advisoryTemplates.channels.${ch}`, { defaultValue: ch })}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                        {formatDateTime(item.updatedAt)}
                        {item.lastModifiedByName && (
                          <span className="ms-1 text-ink-subtle">
                            — {item.lastModifiedByName}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Link
                          to="/app/admin/advisory-templates/$id"
                          params={{ id: String(item.id) }}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-3 text-xs font-medium text-ink hover:bg-surface"
                        >
                          {t('admin.advisoryTemplates.actions.edit')}
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
