/**
 * EmailTemplateEditor — EN/AR side-by-side template editor + preview render.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminNotificationTemplatesService } from '@/services/api/admin/notification-templates.service';
import { translateApiError } from '@/lib/translate-api-error';
import { toast } from 'sonner';
import type {
  NotificationTemplate,
  NotificationTemplateRenderResult,
} from '@/types/admin/notification-templates.types';

interface Props {
  template: NotificationTemplate;
}

export function EmailTemplateEditor({ template }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [subjectEn, setSubjectEn] = useState(template.subjectEn ?? '');
  const [subjectAr, setSubjectAr] = useState(template.subjectAr ?? '');
  const [bodyEn, setBodyEn] = useState(template.bodyEn);
  const [bodyAr, setBodyAr] = useState(template.bodyAr);
  const [previewResult, setPreviewResult] = useState<NotificationTemplateRenderResult | null>(
    null,
  );
  const [previewLocale, setPreviewLocale] = useState<'en' | 'ar'>('en');

  const saveMutation = useMutation({
    mutationFn: () =>
      adminNotificationTemplatesService.update(template.id, {
        subjectEn: subjectEn || null,
        subjectAr: subjectAr || null,
        bodyEn,
        bodyAr,
      }),
    onSuccess: () => {
      toast.success(
        t('admin.emailTemplates.toast.saved', { defaultValue: 'Template saved.' }),
      );
      void queryClient.invalidateQueries({
        queryKey: ['adminNotificationTemplates'],
      });
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'admin.emailTemplates.errors.saveFailed'));
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => {
      // Build sample params from schema
      const sampleParams: Record<string, string> = {};
      for (const key of Object.keys(template.parameterSchema)) {
        sampleParams[key] = `[${key}]`;
      }
      return adminNotificationTemplatesService.render({
        templateId: template.templateId,
        channel: template.channel,
        locale: previewLocale,
        parameters: sampleParams,
      });
    },
    onSuccess: (data) => {
      setPreviewResult(data);
    },
    onError: (err: unknown) => {
      toast.error(
        translateApiError(err, t, 'admin.emailTemplates.errors.previewFailed'),
      );
    },
  });

  const paramKeys = Object.keys(template.parameterSchema);

  return (
    <div className="space-y-6">
      {/* Parameter chips */}
      {paramKeys.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-subtle">
            {t('admin.emailTemplates.params', { defaultValue: 'Parameters' })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {paramKeys.map((key) => (
              <span
                key={key}
                className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] text-ink-muted"
              >
                {'{{'}
                {key}
                {'}}'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Subject EN/AR */}
      {template.channel === 'email' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="template-subject-en"
              className="block text-sm font-medium text-ink"
            >
              {t('admin.emailTemplates.fields.subjectEn', {
                defaultValue: 'Subject (English)',
              })}
            </label>
            <Input
              id="template-subject-en"
              value={subjectEn}
              onChange={(e) => setSubjectEn(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="template-subject-ar"
              className="block text-sm font-medium text-ink"
            >
              {t('admin.emailTemplates.fields.subjectAr', {
                defaultValue: 'Subject (Arabic)',
              })}
            </label>
            <Input
              id="template-subject-ar"
              dir="rtl"
              value={subjectAr}
              onChange={(e) => setSubjectAr(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Body EN/AR */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="template-body-en"
            className="block text-sm font-medium text-ink"
          >
            {t('admin.emailTemplates.fields.bodyEn', { defaultValue: 'Body (English)' })}
          </label>
          <textarea
            id="template-body-en"
            rows={12}
            value={bodyEn}
            onChange={(e) => setBodyEn(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm text-ink focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="template-body-ar"
            className="block text-sm font-medium text-ink"
          >
            {t('admin.emailTemplates.fields.bodyAr', { defaultValue: 'Body (Arabic)' })}
          </label>
          <textarea
            id="template-body-ar"
            dir="rtl"
            rows={12}
            value={bodyAr}
            onChange={(e) => setBodyAr(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm text-ink focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t('common.saving', { defaultValue: 'Saving…' })}
            </>
          ) : (
            t('common.save', { defaultValue: 'Save' })
          )}
        </Button>

        <div className="flex items-center gap-2">
          <select
            value={previewLocale}
            onChange={(e) => setPreviewLocale(e.target.value as 'en' | 'ar')}
            className="rounded-md border border-border bg-card px-2 py-2 text-sm text-ink"
            aria-label={t('admin.emailTemplates.previewLocaleLabel', {
              defaultValue: 'Preview locale',
            })}
          >
            <option value="en">English</option>
            <option value="ar">Arabic</option>
          </select>
          <Button
            variant="outline"
            onClick={() => previewMutation.mutate()}
            disabled={previewMutation.isPending}
          >
            {previewMutation.isPending ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="me-2 h-4 w-4" />
            )}
            {t('admin.emailTemplates.previewButton', { defaultValue: 'Preview render' })}
          </Button>
        </div>
      </div>

      {/* Preview result */}
      {previewResult && (
        <div className="rounded-lg border border-border bg-surface/50 p-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-subtle">
            {t('admin.emailTemplates.previewTitle', {
              defaultValue: 'Rendered preview (sample values)',
            })}
          </p>
          {previewResult.subject && (
            <div>
              <p className="text-xs text-ink-subtle">
                {t('admin.emailTemplates.previewSubject', { defaultValue: 'Subject' })}
              </p>
              <p className="text-sm font-medium text-ink">{previewResult.subject}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-ink-subtle">
              {t('admin.emailTemplates.previewBody', { defaultValue: 'Body' })}
            </p>
            <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-ink">
              {previewResult.body}
            </pre>
          </div>
          {previewResult.missingParameters.length > 0 && (
            <p className="text-xs text-gold">
              {t('admin.emailTemplates.previewMissing', {
                defaultValue: 'Missing params: {{params}}',
                params: previewResult.missingParameters.join(', '),
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
