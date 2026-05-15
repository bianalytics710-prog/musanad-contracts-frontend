/**
 * /app/admin/report-templates — Admin Report Template list (S-L-6).
 *
 * Gated by report.template.manage.
 */
import { useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Pencil, Plus, Search } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { adminReportTemplatesService } from '@/services/api/admin/report-templates.service';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/utils/datetime';
import type { ReportTemplateAdminListItem } from '@/types/report.types';

export const Route = createFileRoute('/app/admin/report-templates/')({
  component: () => (
    <ErrorBoundary>
      <AdminReportTemplatesListView />
    </ErrorBoundary>
  ),
});

function AdminReportTemplatesListView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const canManage = useAuthStore(selectHasPermission('report.template.manage'));

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['adminReportTemplates'],
    queryFn: () => adminReportTemplatesService.list(),
    enabled: canManage,
    staleTime: 30_000,
  });

  const items: ReportTemplateAdminListItem[] = data?.data ?? [];

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.templateId.toLowerCase().includes(q) ||
        it.displayNameEn.toLowerCase().includes(q) ||
        (it.displayNameAr ?? '').toLowerCase().includes(q),
    );
  }, [items, debouncedSearch]);

  if (!canManage) {
    return (
      <div className="mx-auto w-full max-w-[1400px] p-6">
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
      className="mx-auto w-full max-w-[1400px] space-y-6 p-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {t('admin.reportTemplates.list.title')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t('admin.reportTemplates.list.subtitle')}
          </p>
        </div>
        <Link
          to="/app/admin/report-templates/$templateId"
          params={{ templateId: 'new' }}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('admin.reportTemplates.actions.create')}
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search
            className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <label htmlFor="rt-list-search" className="sr-only">
            {t('admin.reportTemplates.filters.searchLabel')}
          </label>
          <Input
            id="rt-list-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.reportTemplates.filters.searchPlaceholder')}
            className="ps-9"
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex h-48 items-center justify-center">
          <svg className="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 rounded-lg border border-error/30 bg-error/5 p-4" role="alert">
          <AlertTriangle className="h-5 w-5 text-error" aria-hidden="true" />
          <p className="text-sm text-error">{(error as Error)?.message ?? t('common.error')}</p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card">
              <p className="text-sm text-ink-muted">{t('admin.reportTemplates.list.empty')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-surface">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.reportTemplates.columns.template')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.reportTemplates.columns.kind')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.reportTemplates.columns.dataSource')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.reportTemplates.columns.roles')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.reportTemplates.columns.schedule')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.reportTemplates.columns.enabled')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.reportTemplates.columns.lastRun')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {filtered.map((tpl) => (
                    <tr key={tpl.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          to="/app/admin/report-templates/$templateId"
                          params={{ templateId: String(tpl.id) }}
                          className="font-medium text-ink hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
                        >
                          {isAr && tpl.displayNameAr ? tpl.displayNameAr : tpl.displayNameEn}
                        </Link>
                        <p className="text-xs text-ink-muted">{tpl.templateId}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {t(`reports.kinds.${tpl.reportKind}`)}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-muted">{tpl.dataSource}</td>
                      <td className="px-4 py-3 text-xs text-ink-muted">
                        {tpl.assignedRoles.length === 0
                          ? '—'
                          : tpl.assignedRoles.slice(0, 3).join(', ') +
                            (tpl.assignedRoles.length > 3 ? '…' : '')}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {tpl.isScheduled ? (
                          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-ink">
                            {tpl.scheduleCron ?? '—'}
                          </code>
                        ) : (
                          <span className="text-ink-muted">{t('admin.reportTemplates.list.manual')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                            tpl.enabled
                              ? 'bg-success/10 text-success'
                              : 'bg-muted text-ink-muted'
                          }`}
                        >
                          {tpl.enabled ? t('common.active') : t('common.inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-muted">
                        {tpl.lastRunAt ? formatDateTime(tpl.lastRunAt, { showTime: true }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to="/app/admin/report-templates/$templateId"
                          params={{ templateId: String(tpl.id) }}
                          aria-label={t('common.edit')}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-ink hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('common.edit')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
