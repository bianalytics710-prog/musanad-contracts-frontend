/**
 * /app/admin/email-templates/$id — Template edit page.
 */
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { EmailTemplateEditor } from '@/components/admin/EmailTemplateEditor';
import { adminNotificationTemplatesService } from '@/services/api/admin/notification-templates.service';
import { useAuthStore } from '@/store/auth.store';

export const Route = createFileRoute('/app/admin/email-templates/$id')({
  component: () => (
    <ErrorBoundary>
      <EmailTemplateEditView />
    </ErrorBoundary>
  ),
});

function EmailTemplateEditView() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const user = useAuthStore((s) => s.user);

  const hasPermission =
    user?.permissions.includes('notification.template.manage') ?? false;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['adminNotificationTemplates', Number(id)],
    queryFn: () => adminNotificationTemplatesService.getById(Number(id)),
    enabled: hasPermission && !!id,
    staleTime: 30_000,
  });

  if (!hasPermission) {
    return (
      <div className="mx-auto w-full max-w-[1200px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t('common.forbidden', {
              defaultValue: 'You do not have permission to access this page.',
            })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1200px] space-y-4 p-6"
    >
      <div className="flex items-center gap-2">
        <Link
          to="/app/admin/email-templates"
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('admin.emailTemplates.backToList', { defaultValue: 'Message templates' })}
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded bg-surface" aria-hidden />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-ink-muted">
            {t('admin.emailTemplates.notFound', { defaultValue: 'Template not found.' })}
          </p>
        </div>
      ) : data ? (
        <>
          <header>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {data.templateId}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                {data.channel}
              </span>
              <span className="text-sm text-ink-muted">
                {t('admin.emailTemplates.lastModifiedBy', {
                  defaultValue: 'Last edited by {{name}}',
                  name: data.lastModifiedByName ?? t('common.unknown', { defaultValue: 'Unknown' }),
                })}
              </span>
            </div>
          </header>

          <div className="rounded-lg border border-border bg-card p-6">
            <EmailTemplateEditor template={data} />
          </div>
        </>
      ) : null}
    </motion.div>
  );
}
