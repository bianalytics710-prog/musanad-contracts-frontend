/**
 * /app/admin/report-templates/$templateId — editor (S-L-7..S-L-10).
 *
 * Path param: $templateId can be either a numeric id (edit mode) or the
 * literal 'new' (create mode). The actual templateId slug for create mode
 * is supplied via the form.
 */
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { adminReportTemplatesService } from '@/services/api/admin/report-templates.service';
import { ReportTemplateEditor } from '@/components/admin/report-templates/ReportTemplateEditor';

export const Route = createFileRoute('/app/admin/report-templates/$templateId')({
  component: () => (
    <ErrorBoundary>
      <AdminReportTemplateEditView />
    </ErrorBoundary>
  ),
});

function AdminReportTemplateEditView() {
  const { t } = useTranslation();
  const { templateId } = Route.useParams();
  const canManage = useAuthStore(selectHasPermission('report.template.manage'));

  const isCreate = templateId === 'new';
  const numericId = isCreate ? null : Number(templateId);
  const idValid = isCreate || (Number.isFinite(numericId as number) && (numericId as number) > 0);

  const {
    data: initial,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['adminReportTemplate', numericId],
    queryFn: () => adminReportTemplatesService.getById(numericId as number),
    enabled: canManage && !isCreate && Number.isFinite(numericId as number) && (numericId as number) > 0,
    staleTime: 30_000,
  });

  if (!canManage) {
    return (
      <div className="mx-auto w-full max-w-[1000px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">{t('common.accessDenied')}</p>
        </div>
      </div>
    );
  }

  if (!idValid) {
    return (
      <div className="mx-auto w-full max-w-[1000px] p-6">
        <div className="rounded-lg border border-error/30 bg-error/5 p-6 text-center">
          <p className="text-sm text-error">{t('admin.reportTemplates.errors.invalidId')}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1000px] space-y-6 p-6"
    >
      <div className="flex items-center gap-2">
        <Link
          to="/app/admin/report-templates"
          className="inline-flex items-center gap-1 rounded text-sm text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('admin.reportTemplates.actions.backToList')}
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold text-ink">
          {isCreate
            ? t('admin.reportTemplates.create.title')
            : t('admin.reportTemplates.edit.title')}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {isCreate
            ? t('admin.reportTemplates.create.subtitle')
            : t('admin.reportTemplates.edit.subtitle')}
        </p>
      </header>

      {!isCreate && isLoading && (
        <div className="flex h-48 items-center justify-center">
          <svg className="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      )}

      {!isCreate && isError && (
        <div className="flex items-center gap-3 rounded-lg border border-error/30 bg-error/5 p-4" role="alert">
          <AlertTriangle className="h-5 w-5 text-error" aria-hidden="true" />
          <p className="text-sm text-error">{(error as Error)?.message ?? t('common.error')}</p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {(isCreate || initial) && (
        <div className="rounded-lg border border-border bg-card p-6">
          <ReportTemplateEditor initial={isCreate ? null : initial ?? null} />
        </div>
      )}
    </motion.div>
  );
}
