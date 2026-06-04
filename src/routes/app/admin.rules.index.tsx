/**
 * /app/admin/rules — Correlation Rules List (CR-E, S12 + S13)
 *
 * platform_admin + legal_counsel can view the rule registry.
 * platform_admin can toggle enabled, create rules, and navigate to edit.
 *
 * A7: all HTTP via rulesService.
 * C12: all text via t().
 * C13: semantic tokens only.
 * C14: Router Link for internal nav.
 * D7: scope="col" on all <th>.
 * D6: htmlFor + id matched on filter inputs.
 * WCAG 2.1 AA.
 */
import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle, RefreshCw, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { rulesService } from '@/services/api/rules.service';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/utils/datetime';
import type { CorrelationRuleListItem } from '@/types/entities/rule.types';

export const Route = createFileRoute('/app/admin/rules/')({
  component: () => (
    <ErrorBoundary>
      <AdminRulesListView />
    </ErrorBoundary>
  ),
});

function AdminRulesListView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const canRead = useAuthStore(selectHasPermission('rule.read'));
  const canManage = useAuthStore(selectHasPermission('rule.manage'));

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [scenarioFilter, setScenarioFilter] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const debouncedScenario = useDebounce(scenarioFilter, 300);

  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['adminRules', { page, search: debouncedSearch, scenario: debouncedScenario }],
    queryFn: () =>
      rulesService.list({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        scenario: debouncedScenario || undefined,
      }),
    enabled: canRead,
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      rulesService.update(id, { enabled }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['adminRules'] });
      toast.success(t('admin.rules.toggleSuccess'));
    },
    onError: (err: Error) => {
      toast.error(err.message || t('common.error'));
    },
  });

  if (!canRead) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-8 text-center">
        <p className="text-ink-muted">{t('common.accessDenied')}</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{t('admin.rules.title')}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t('admin.rules.subtitle')}</p>
        </div>
        {canManage && (
          <Link to="/app/admin/rules/$id" params={{ id: 'new' }}>
            <Button type="button" size="sm">
              {t('admin.rules.createButton')}
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label htmlFor="rules-search" className="mb-1 block text-xs font-medium text-ink">
            {t('admin.rules.searchLabel')}
          </label>
          <input
            id="rules-search"
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('admin.rules.searchPlaceholder')}
            className="w-60 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label htmlFor="rules-scenario" className="mb-1 block text-xs font-medium text-ink">
            {t('admin.rules.scenarioFilter')}
          </label>
          <input
            id="rules-scenario"
            type="text"
            value={scenarioFilter}
            onChange={(e) => { setScenarioFilter(e.target.value); setPage(1); }}
            placeholder={t('admin.rules.scenarioPlaceholder')}
            className="w-40 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-ink-muted" aria-label={t('common.loading')} />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-ink-muted">{error instanceof Error ? error.message : t('common.error')}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="me-2 h-4 w-4" />
            {t('common.retry')}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Shield className="h-10 w-10 text-ink-muted" />
          <p className="text-ink-muted">{t('admin.rules.empty')}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                    {t('admin.rules.table.ruleId')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                    {t('admin.rules.table.name')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                    {t('admin.rules.table.scenario')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                    {t('admin.rules.table.enabled')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                    {t('admin.rules.table.lastReviewed')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-ink">
                    {t('admin.rules.table.versionHash')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-ink">
                    {t('admin.rules.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((rule) => {
                  const ruleName = isAr ? rule.nameAr : rule.name;
                  // Humanize the dot-segmented ruleId into a one-line
                  // predicate description ("rule.brent.price_review_trigger_high"
                  // → "Brent · Price review trigger high"). Audience can read
                  // the rule's intent without opening the edit modal — the
                  // demo Act 10 "rules in plain language" talking point.
                  const segments = rule.ruleId.replace(/^rule\./, '').split('.');
                  // Industry acronyms render ALL-CAPS; everything else stays
                  // Title-case ("Brent · Price Review Trigger High",
                  // "EPC · Cure Notice Pattern", "ESG · ICV Downgrade").
                  const ACRONYMS = new Set([
                    'epc', 'esg', 'icv', 'ofac', 'eu', 'uae', 'sla', 'fm',
                    'mar', 'avar', 'msa', 'sow', 'nda',
                  ]);
                  const capitalize = (w: string): string =>
                    ACRONYMS.has(w.toLowerCase())
                      ? w.toUpperCase()
                      : w.charAt(0).toUpperCase() + w.slice(1);
                  const predicateLine = segments
                    .map((seg) => seg.split('_').map(capitalize).join(' '))
                    .join(' · ');
                  return (
                    <motion.tr
                      key={rule.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-surface/50"
                    >
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs text-ink-muted">{rule.ruleId}</code>
                      </td>
                      <td className="max-w-[260px] px-4 py-3 text-ink" title={ruleName}>
                        <div className="truncate">{ruleName}</div>
                        <div className="mt-0.5 truncate text-[11px] text-ink-subtle">
                          {predicateLine}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {rule.scenario ? (
                          <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink-muted">
                            {rule.scenario}
                          </span>
                        ) : (
                          <span className="text-ink-subtle">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={rule.enabled}
                            aria-label={t('admin.rules.table.toggleAriaLabel', { name: ruleName })}
                            disabled={toggleMutation.isPending}
                            onClick={() =>
                              toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })
                            }
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              rule.enabled ? 'bg-emerald-500' : 'bg-border'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                rule.enabled ? 'translate-x-4' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        ) : (
                          <span
                            className={`text-xs font-medium ${rule.enabled ? 'text-emerald-600' : 'text-ink-muted'}`}
                          >
                            {rule.enabled ? t('common.yes') : t('common.no')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-muted">
                        {rule.lastReviewedAt ? formatDateTime(rule.lastReviewedAt) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <code
                          className="cursor-help font-mono text-xs text-ink-muted"
                          title={rule.versionHash}
                        >
                          {rule.versionHashShort}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to="/app/admin/rules/$id" params={{ id: String(rule.id) }}>
                          <Button type="button" size="sm" variant="outline">
                            {canManage ? t('common.edit') : t('common.view')}
                          </Button>
                        </Link>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-muted">
                {t('admin.rules.pagination.showing', {
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
        </>
      )}
    </div>
  );
}
