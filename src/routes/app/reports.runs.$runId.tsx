/**
 * /app/reports/runs/$runId — Report run viewer (S-L-4 / S-L-5).
 *
 * Polls the run every 3s while pending/generating. When complete and the
 * signedUrl is present, surfaces a Download button that opens in a new tab.
 * The signedUrl has TTL 60s — we display the expiry countdown.
 */
import { useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Download, XCircle } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { reportService } from '@/services/api/report.service';
import { formatDateTime } from '@/utils/datetime';
import type { ReportRunStatus } from '@/types/report.types';

const STATUS_ICON: Record<ReportRunStatus, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  generating: Clock,
  complete: CheckCircle2,
  failed: XCircle,
};

const STATUS_TONE: Record<ReportRunStatus, string> = {
  pending: 'text-ink-muted',
  generating: 'text-info',
  complete: 'text-success',
  failed: 'text-error',
};

export const Route = createFileRoute('/app/reports/runs/$runId')({
  component: () => (
    <ErrorBoundary>
      <ReportRunView />
    </ErrorBoundary>
  ),
});

function ReportRunView() {
  const { t } = useTranslation();
  const { runId } = Route.useParams();
  const id = Number(runId);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reportRun', id],
    queryFn: () => reportService.getRunById(id),
    enabled: Number.isFinite(id) && id > 0,
    refetchInterval: (q) => {
      const r = q.state.data as { status?: ReportRunStatus } | undefined;
      if (!r) return 3000;
      return r.status === 'pending' || r.status === 'generating' ? 3000 : false;
    },
  });

  const StatusIcon = useMemo(() => (data ? STATUS_ICON[data.status] : Clock), [data]);

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="mx-auto w-full max-w-[900px] p-6">
        <div className="rounded-lg border border-error/30 bg-error/5 p-6 text-center">
          <p className="text-sm text-error">{t('reports.errors.invalidRunId')}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[900px] space-y-6 p-6"
    >
      <div className="flex items-center gap-2">
        <Link
          to="/app/reports"
          className="inline-flex items-center gap-1 rounded text-sm text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('reports.actions.backToLibrary')}
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold text-ink">
          {t('reports.run.title', { id })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">{t('reports.run.subtitle')}</p>
      </header>

      {isLoading && !data && (
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

      {data && (
        <div className="space-y-4">
          {/* Status panel */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <StatusIcon className={`h-6 w-6 ${STATUS_TONE[data.status]}`} aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {t(`reports.statuses.${data.status}`)}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {t('reports.run.format')}: {t(`reports.formats.${data.format}`)}
                  </p>
                </div>
              </div>

              {data.status === 'complete' && data.signedUrl && (
                <Button
                  onClick={() => window.open(data.signedUrl, '_blank', 'noopener,noreferrer')}
                  aria-label={t('reports.actions.download')}
                >
                  <Download className="me-1 h-4 w-4" aria-hidden="true" />
                  {t('reports.actions.download')}
                </Button>
              )}
            </div>

            {data.signedUrlExpiresAt && data.status === 'complete' && (
              <p className="mt-2 text-xs text-ink-muted">
                {t('reports.run.urlExpiresAt', {
                  date: formatDateTime(data.signedUrlExpiresAt, { showTime: true }),
                })}
              </p>
            )}

            {data.status === 'failed' && data.errorMessage && (
              <div
                className="mt-3 rounded-md border border-error/30 bg-error/5 p-3 text-xs text-error"
                role="alert"
              >
                {data.errorMessage}
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold text-ink">
              {t('reports.run.metaTitle')}
            </h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between">
                <dt className="text-ink-muted">{t('reports.run.startedAt')}</dt>
                <dd className="text-ink">
                  {data.startedAt ? formatDateTime(data.startedAt, { showTime: true }) : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">{t('reports.run.completedAt')}</dt>
                <dd className="text-ink">
                  {data.completedAt ? formatDateTime(data.completedAt, { showTime: true }) : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">{t('reports.run.outputSize')}</dt>
                <dd className="text-ink">
                  {data.outputSizeBytes !== null && data.outputSizeBytes !== undefined
                    ? `${(data.outputSizeBytes / 1024).toFixed(1)} KB`
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">{t('reports.run.runId')}</dt>
                <dd className="text-ink">#{data.runId}</dd>
              </div>
            </dl>
          </div>

          {/* Source-traceability placeholder section (AC-SL16-03 surface;
              actual lineage is rendered inside the generated PDF/Excel by
              the BE renderer per ReportDataMeta.sourceTraceability). */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold text-ink">
              {t('reports.run.sourceTraceabilityTitle')}
            </h2>
            <p className="text-xs text-ink-muted">
              {t('reports.run.sourceTraceabilityHint')}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
