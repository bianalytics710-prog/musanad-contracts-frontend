/**
 * /app/admin/advisory-templates — Advisory Template list page.
 *
 * M16 / CR-H — gated by advisory.template.manage
 * T1 data via service, T2 React Query, T3 i18n, T4 three data states,
 * T5 tokens, T6 a11y D7 scope="col", T7 type-safe, T10 debounce,
 * T11 ErrorBoundary, T12 formatDateTime.
 * A7: apiClient only in service layer.
 * C13: no raw hex.
 * C14: Router Link for internal nav.
 * D7: scope="col" on all <th>.
 * D6: htmlFor + id on filter inputs.
 */
import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Pencil, Search } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

function AdminAdvisoryTemplatesView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const canManage = useAuthStore(selectHasPermission('advisory.template.manage'));

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [draftTypeFilter, setDraftTypeFilter] = useState<DraftType | ''>('');
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      'adminAdvisoryTemplates',
      { page, search: debouncedSearch, draftType: draftTypeFilter },
    ],
    queryFn: () =>
      adminAdvisoryTemplatesService.list({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        draftType: draftTypeFilter || undefined,
        isActive: true,
      }),
    enabled: canManage,
    staleTime: 30_000,
  });

  if (!canManage) {
    return (
      <div className="mx-auto w-full max-w-[1400px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">{t('common.accessDenied')}</p>
        </div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-semibold text-ink">
            {t('admin.advisoryTemplates.title')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t('admin.advisoryTemplates.subtitle')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <Input
            id="advisory-templates-search"
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('admin.advisoryTemplates.searchPlaceholder')}
            className="pl-9"
            aria-label={t('admin.advisoryTemplates.searchLabel')}
          />
        </div>
        <div>
          <label htmlFor="advisory-templates-type-filter" className="sr-only">
            {t('admin.advisoryTemplates.filters.draftType')}
          </label>
          <select
            id="advisory-templates-type-filter"
            value={draftTypeFilter}
            onChange={(e) => { setDraftTypeFilter(e.target.value as DraftType | ''); setPage(1); }}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t('admin.advisoryTemplates.filters.allTypes')}</option>
            {DRAFT_TYPES.map((dt) => (
              <option key={dt} value={dt}>
                {t(`admin.advisoryTemplates.draftTypes.${dt}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex h-48 items-center justify-center">
          <svg className="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
          <p className="text-sm text-error">
            {(error as Error)?.message ?? t('common.error')}
          </p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && (
        <>
          {items.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card">
              <p className="text-sm text-ink-muted">
                {t('admin.advisoryTemplates.emptyState')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-surface">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.advisoryTemplates.columns.templateId')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.advisoryTemplates.columns.displayName')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.advisoryTemplates.columns.draftType')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.advisoryTemplates.columns.version')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.advisoryTemplates.columns.approverRole')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.advisoryTemplates.columns.channels')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.advisoryTemplates.columns.lastModified')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                        {item.templateId}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">
                        {isAr ? item.displayNameAr : item.displayNameEn}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-ink-muted">
                          {t(`admin.advisoryTemplates.draftTypes.${item.draftType}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">v{item.version}</td>
                      <td className="px-4 py-3 text-ink-muted">{item.assignedApproverRole}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {item.dispatchChannels.map((ch) => (
                            <span
                              key={ch}
                              className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                            >
                              {t(`admin.advisoryTemplates.channels.${ch}`)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-muted">
                        {formatDateTime(item.updatedAt)}{' '}
                        {item.lastModifiedByName && `— ${item.lastModifiedByName}`}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to="/app/admin/advisory-templates/$id"
                          params={{ id: String(item.id) }}
                          aria-label={t('admin.advisoryTemplates.actions.edit')}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-ink hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('admin.advisoryTemplates.actions.edit')}
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
                })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label={t('common.pagination.prev')}
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
                  aria-label={t('common.pagination.next')}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
