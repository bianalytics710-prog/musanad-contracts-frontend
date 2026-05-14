/**
 * /app/admin/advisory-templates/$id — Advisory Template editor page.
 *
 * M16 / CR-H — gated by advisory.template.manage
 * T1 service, T2 React Query, T3 i18n, T4 three data states, T5 tokens,
 * T6 a11y, T7 type-safe, T11 ErrorBoundary.
 * A7: apiClient only in service.
 * C14: Router Link for back nav.
 */
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { adminAdvisoryTemplatesService } from '@/services/api/admin/advisory-templates.service';
import { AdvisoryTemplateEditor } from '@/components/admin/AdvisoryTemplateEditor';

export const Route = createFileRoute('/app/admin/advisory-templates/$id')({
  component: () => (
    <ErrorBoundary>
      <AdminAdvisoryTemplateEditView />
    </ErrorBoundary>
  ),
});

function AdminAdvisoryTemplateEditView() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const canManage = useAuthStore(selectHasPermission('advisory.template.manage'));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['adminAdvisoryTemplates', Number(id)],
    queryFn: () => adminAdvisoryTemplatesService.getById(Number(id)),
    enabled: canManage && !!id && !isNaN(Number(id)),
    staleTime: 30_000,
  });

  if (!canManage) {
    return (
      <div className="mx-auto w-full max-w-[1200px] p-6">
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
      className="mx-auto w-full max-w-[1200px] space-y-6 p-6"
    >
      {/* Back link */}
      <div className="flex items-center gap-2">
        <Link
          to="/app/admin/advisory-templates"
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary rounded"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('admin.advisoryTemplates.backToList')}
        </Link>
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

      {/* Editor */}
      {!isLoading && !isError && data && (
        <>
          <div>
            <h1 className="text-2xl font-semibold text-ink">
              {t('admin.advisoryTemplates.editTitle')}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {data.templateId} — {t('admin.advisoryTemplates.fields.version')} v{data.version}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <AdvisoryTemplateEditor template={data} />
          </div>
        </>
      )}
    </motion.div>
  );
}
