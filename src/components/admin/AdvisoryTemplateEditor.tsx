/**
 * AdvisoryTemplateEditor — EN/AR side-by-side editor with parameter chips.
 *
 * M16 / CR-H — T1 data via service, T2 React Query, T3 i18n, T5 tokens,
 * T6 a11y, T7 type-safe, T8 zod form, C13 no hex, C14 Router Link, D6 htmlFor.
 */
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminAdvisoryTemplatesService } from '@/services/api/admin/advisory-templates.service';
import { translateApiError } from '@/lib/translate-api-error';
import type { AdvisoryTemplate, DispatchChannel } from '@/types/admin/advisory-templates.types';
import { DISPATCH_CHANNELS } from '@/types/admin/advisory-templates.types';

const APPROVER_ROLES = adminAdvisoryTemplatesService.listApproverRoles();

const editorSchema = z.object({
  displayNameEn: z.string().min(1),
  displayNameAr: z.string().min(1),
  description: z.string().optional(),
  bodyTemplateEn: z.string().min(1),
  bodyTemplateAr: z.string().min(1),
  assignedApproverRole: z.string().min(1),
  dispatchChannels: z.array(z.enum(['email', 'teams_capture', 'slack_capture'])).min(1),
});

type EditorFormData = z.infer<typeof editorSchema>;

interface Props {
  template: AdvisoryTemplate;
}

export function AdvisoryTemplateEditor({ template }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const formRef = useRef<HTMLFormElement | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditorFormData>({
    resolver: zodResolver(editorSchema),
    defaultValues: {
      displayNameEn: template.displayNameEn,
      displayNameAr: template.displayNameAr,
      description: template.description ?? '',
      bodyTemplateEn: template.bodyTemplateEn,
      bodyTemplateAr: template.bodyTemplateAr,
      assignedApproverRole: template.assignedApproverRole,
      dispatchChannels: template.dispatchChannels,
    },
  });

  const selectedChannels = watch('dispatchChannels');

  const saveMutation = useMutation({
    mutationFn: (data: EditorFormData) =>
      adminAdvisoryTemplatesService.update(template.id, {
        displayNameEn: data.displayNameEn,
        displayNameAr: data.displayNameAr,
        description: data.description || undefined,
        bodyTemplateEn: data.bodyTemplateEn,
        bodyTemplateAr: data.bodyTemplateAr,
        assignedApproverRole: data.assignedApproverRole,
        dispatchChannels: data.dispatchChannels,
      }),
    onSuccess: () => {
      toast.success(t('admin.advisoryTemplates.toast.saved'));
      void qc.invalidateQueries({ queryKey: ['adminAdvisoryTemplates'] });
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'admin.advisoryTemplates.errors.saveFailed'));
    },
  });

  const paramKeys = Object.keys(template.parameterSchema ?? {});

  function toggleChannel(channel: DispatchChannel) {
    const current = selectedChannels ?? [];
    if (current.includes(channel)) {
      setValue('dispatchChannels', current.filter((c) => c !== channel), { shouldValidate: true });
    } else {
      setValue('dispatchChannels', [...current, channel], { shouldValidate: true });
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit((data) => saveMutation.mutate(data))}
      noValidate
      className="space-y-6"
    >
      {/* Meta row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="displayNameEn"
            className="mb-1 block text-sm font-medium text-ink"
          >
            {t('admin.advisoryTemplates.fields.displayNameEn')}
          </label>
          <Input
            id="displayNameEn"
            {...register('displayNameEn')}
            aria-invalid={!!errors.displayNameEn}
          />
          {errors.displayNameEn && (
            <p className="mt-1 text-xs text-error">{errors.displayNameEn.message}</p>
          )}
        </div>
        <div>
          <label
            htmlFor="displayNameAr"
            className="mb-1 block text-sm font-medium text-ink"
          >
            {t('admin.advisoryTemplates.fields.displayNameAr')}
          </label>
          <Input
            id="displayNameAr"
            {...register('displayNameAr')}
            dir="rtl"
            aria-invalid={!!errors.displayNameAr}
          />
          {errors.displayNameAr && (
            <p className="mt-1 text-xs text-error">{errors.displayNameAr.message}</p>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-ink">
          {t('admin.advisoryTemplates.fields.description')}
        </label>
        <Input id="description" {...register('description')} />
      </div>

      {/* Read-only meta chips */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="text-sm text-ink-muted">
          <span className="font-medium text-ink">{t('admin.advisoryTemplates.fields.draftType')}:</span>{' '}
          <span className="rounded bg-muted px-2 py-0.5 text-xs text-ink">{template.draftType}</span>
        </div>
        <div className="text-sm text-ink-muted">
          <span className="font-medium text-ink">{t('admin.advisoryTemplates.fields.version')}:</span>{' '}
          <span className="text-ink">v{template.version}</span>
        </div>
        <div className="text-sm text-ink-muted">
          <span className="font-medium text-ink">{t('admin.advisoryTemplates.fields.templateId')}:</span>{' '}
          <span className="font-mono text-xs text-ink">{template.templateId}</span>
        </div>
      </div>

      {/* Parameter chips (read-only) */}
      {paramKeys.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink">
            {t('admin.advisoryTemplates.fields.parameters')}
          </p>
          <div className="flex flex-wrap gap-2">
            {paramKeys.map((key) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-0.5 text-xs text-ink"
              >
                <Tag className="h-3 w-3 text-ink-muted" aria-hidden="true" />
                {`{{${key}}}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Approver role */}
      <div>
        <label htmlFor="assignedApproverRole" className="mb-1 block text-sm font-medium text-ink">
          {t('admin.advisoryTemplates.fields.assignedApproverRole')}
        </label>
        <select
          id="assignedApproverRole"
          {...register('assignedApproverRole')}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          aria-invalid={!!errors.assignedApproverRole}
        >
          {APPROVER_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        {errors.assignedApproverRole && (
          <p className="mt-1 text-xs text-error">{errors.assignedApproverRole.message}</p>
        )}
      </div>

      {/* Dispatch channels */}
      <div>
        <p className="mb-2 text-sm font-medium text-ink">
          {t('admin.advisoryTemplates.fields.dispatchChannels')}
        </p>
        <div className="flex flex-wrap gap-3">
          {DISPATCH_CHANNELS.map((ch) => {
            const checked = (selectedChannels ?? []).includes(ch);
            return (
              <label
                key={ch}
                htmlFor={`channel-${ch}`}
                className="flex cursor-pointer items-center gap-2 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  id={`channel-${ch}`}
                  checked={checked}
                  onChange={() => toggleChannel(ch)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                {t(`admin.advisoryTemplates.channels.${ch}`)}
              </label>
            );
          })}
        </div>
        {errors.dispatchChannels && (
          <p className="mt-1 text-xs text-error">
            {t('admin.advisoryTemplates.errors.channelsRequired')}
          </p>
        )}
      </div>

      {/* Body templates — EN/AR side-by-side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <label htmlFor="bodyTemplateEn" className="mb-1 block text-sm font-medium text-ink">
            {t('admin.advisoryTemplates.fields.bodyTemplateEn')}
          </label>
          <textarea
            id="bodyTemplateEn"
            {...register('bodyTemplateEn')}
            rows={16}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary"
            aria-invalid={!!errors.bodyTemplateEn}
          />
          {errors.bodyTemplateEn && (
            <p className="mt-1 text-xs text-error">{errors.bodyTemplateEn.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="bodyTemplateAr" className="mb-1 block text-sm font-medium text-ink">
            {t('admin.advisoryTemplates.fields.bodyTemplateAr')}
          </label>
          <textarea
            id="bodyTemplateAr"
            {...register('bodyTemplateAr')}
            dir="rtl"
            rows={16}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary"
            aria-invalid={!!errors.bodyTemplateAr}
          />
          {errors.bodyTemplateAr && (
            <p className="mt-1 text-xs text-error">{errors.bodyTemplateAr.message}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t('common.saving')}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Save className="h-4 w-4" aria-hidden="true" />
              {t('common.save')}
            </span>
          )}
        </Button>
      </div>
    </form>
  );
}
