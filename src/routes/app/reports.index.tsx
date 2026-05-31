/**
 * /app/reports — Report Library (S-L-1).
 *
 * Lists the templates visible to the caller (BE filters by role overlap).
 * Each template gets a Generate button → opens GenerateReportDialog → on
 * success navigates to /app/reports/runs/$runId for status polling.
 *
 * Empty state: AC-SL1-05 — 'No reports available for your role'.
 */
import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, FileBarChart, FileSpreadsheet, FileText, Play } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { reportService } from '@/services/api/report.service';
import { formatDateTime } from '@/utils/datetime';
import type {
  ReportTemplateUserListItem,
  ReportTemplateAdminListItem,
} from '@/types/report.types';
import { GenerateReportDialog } from '@/components/reports/GenerateReportDialog';

export const Route = createFileRoute('/app/reports/')({
  component: () => (
    <ErrorBoundary>
      <ReportLibraryView />
    </ErrorBoundary>
  ),
});

function ReportLibraryView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const [selected, setSelected] = useState<ReportTemplateUserListItem | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reportTemplates', 'userMode'],
    queryFn: () => reportService.listTemplates({ adminMode: false }),
    staleTime: 60_000,
  });

  // Narrow to user-mode list items (the admin-mode endpoint is consumed
  // separately by /app/admin/report-templates).
  const items = (data?.data ?? []) as Array<
    ReportTemplateUserListItem | ReportTemplateAdminListItem
  >;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] space-y-6 p-6"
    >
      <header>
        <h1 className="text-2xl font-semibold text-ink">{t('reports.library.title')}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t('reports.library.subtitle')}</p>
      </header>

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

      {!isLoading && !isError && items.length === 0 && (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card">
          <p className="text-sm text-ink-muted">{t('reports.library.empty')}</p>
        </div>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((tpl) => {
            const displayName = isAr && tpl.displayNameAr ? tpl.displayNameAr : tpl.displayNameEn;
            const KindIcon =
              tpl.reportKind === 'excel'
                ? FileSpreadsheet
                : tpl.reportKind === 'pdf'
                  ? FileText
                  : FileBarChart;
            return (
              <li
                key={tpl.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <KindIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                    {t(`reports.kinds.${tpl.reportKind}`)}
                  </span>
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-ink">{displayName}</h2>
                  {tpl.description && (
                    <p className="mt-1 text-xs text-ink-muted line-clamp-2" title={tpl.description}>
                      {tpl.description}
                    </p>
                  )}
                  {/* K38 fix — always render a freshness line so the operator
                      can tell a fresh vs stale report. "Never generated" when
                      lastRunAt is null. */}
                  <p className="mt-2 text-xs text-ink-muted">
                    {tpl.lastRunAt
                      ? t('reports.library.lastRun', {
                          date: formatDateTime(tpl.lastRunAt, { showTime: true }),
                          defaultValue: `Last generated ${formatDateTime(tpl.lastRunAt, { showTime: true })}`,
                        })
                      : t('reports.library.neverGenerated', { defaultValue: 'Never generated' })}
                  </p>
                  {/* K39 fix — surface cron schedule caption when present so
                      operators can tell auto-running reports from on-demand. */}
                  {(tpl as { cronSchedule?: string | null }).cronSchedule && (
                    <p className="mt-1 text-xs text-ink-subtle">
                      {t('reports.library.cronCaption', {
                        cron: (tpl as { cronSchedule?: string | null }).cronSchedule,
                        defaultValue: `Auto-generated on schedule ${(tpl as { cronSchedule?: string | null }).cronSchedule}`,
                      })}
                    </p>
                  )}
                </div>
                <Button size="sm" onClick={() => setSelected(tpl)}>
                  <Play className="me-1 h-3.5 w-3.5" aria-hidden="true" />
                  {t('reports.actions.generate')}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <GenerateReportDialog
          open={!!selected}
          onClose={() => setSelected(null)}
          template={selected}
        />
      )}
    </motion.div>
  );
}
