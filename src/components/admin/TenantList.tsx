/**
 * TenantList — read-only table of tenant rows.
 * Used by /app/admin/tenants.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { adminTenantsService } from '@/services/api/admin/tenants.service';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { formatDateTime } from '@/utils/datetime';

export function TenantList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['adminTenants', { page, search: debouncedSearch }],
    queryFn: () =>
      adminTenantsService.list({ page, limit: 20, search: debouncedSearch || undefined }),
    staleTime: 60_000,
  });

  const tenants = data?.data ?? [];
  const totalPages = data?.pagination.totalPages ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <Input
            id="tenant-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('admin.tenants.searchPlaceholder', {
              defaultValue: 'Search tenants…',
            })}
            className="ps-9"
            aria-label={t('admin.tenants.searchLabel', { defaultValue: 'Search tenants' })}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-surface" aria-hidden />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-ink-muted">
            {t('common.errorLoading', { defaultValue: 'Failed to load data.' })}
          </p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => void refetch()}>
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        </div>
      ) : tenants.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t('admin.tenants.empty', { defaultValue: 'No tenants found.' })}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-ink-subtle">
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.tenants.col.name', { defaultValue: 'Name' })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.tenants.col.industry', { defaultValue: 'Industry' })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.tenants.col.riskAppetite', { defaultValue: 'Risk appetite' })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.tenants.col.dataRegion', { defaultValue: 'Data region' })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.tenants.col.configPack', { defaultValue: 'Config pack' })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.tenants.col.status', { defaultValue: 'Status' })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.tenants.col.createdAt', { defaultValue: 'Created' })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="border-t border-border/60 transition-colors hover:bg-surface/40"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{tenant.displayName}</div>
                      <div className="font-mono text-[10px] text-ink-subtle">{tenant.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {tenant.industry ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider bg-surface text-ink-muted">
                        {tenant.riskAppetite}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {tenant.dataRegion ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                      {tenant.configPack}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                          tenant.isActive
                            ? 'bg-sage/15 text-sage'
                            : 'bg-surface text-ink-muted'
                        }`}
                      >
                        {tenant.isActive
                          ? t('common.active', { defaultValue: 'Active' })
                          : t('common.inactive', { defaultValue: 'Inactive' })}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                      {formatDateTime(tenant.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('common.previous', { defaultValue: 'Previous' })}
              </Button>
              <span className="text-xs text-ink-subtle">
                {t('common.pageOf', {
                  defaultValue: 'Page {{page}} of {{total}}',
                  page,
                  total: totalPages,
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('common.next', { defaultValue: 'Next' })}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
