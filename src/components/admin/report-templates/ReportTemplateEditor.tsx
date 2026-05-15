/**
 * ReportTemplateEditor — admin create/edit form for report_template.
 *
 * AC-SL8 / AC-SL9: required = templateId (create only) + displayNameEn +
 * reportKind + dataSource + assignedRoles non-empty. Scheduling block
 * appears when isScheduled toggled; cron + recipients required when on.
 *
 * templateId, tenantId, reportKind are immutable post-creation (per
 * api-contracts.json) — UI disables them in edit mode.
 */
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminReportTemplatesService } from '@/services/api/admin/report-templates.service';
import { translateApiError } from '@/lib/translate-api-error';
import {
  REPORT_DATA_SOURCE_SLUGS,
  REPORT_KINDS,
} from '@/types/report.types';
import type {
  ReportTemplate,
  ReportKind,
  CreateReportTemplateDto,
  UpdateReportTemplateDto,
} from '@/types/report.types';

const ROLE_OPTIONS = [
  'platform_admin',
  'Super Admin',
  'executive',
  'legal_counsel',
  'operations',
  'finance_treasury',
  'compliance_esg',
  'procurement_supplier_risk',
  'contract_drafter',
  'contract_approver',
  'contract_approver_2',
  'contract_recipient',
] as const;

// Minimal 5-field cron validator (lenient — BE node-cron is the source of truth).
function looksLikeCron(value: string): boolean {
  const fields = value.trim().split(/\s+/);
  return fields.length === 5 && fields.every((f) => /^[*\d,\-/?LW#]+$/.test(f));
}

interface Props {
  initial: ReportTemplate | null; // null => create mode
}

export function ReportTemplateEditor({ initial }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isEdit = !!initial;

  const [templateId, setTemplateId] = useState(initial?.templateId ?? '');
  const [displayNameEn, setDisplayNameEn] = useState(initial?.displayNameEn ?? '');
  const [displayNameAr, setDisplayNameAr] = useState(initial?.displayNameAr ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [reportKind, setReportKind] = useState<ReportKind>(initial?.reportKind ?? 'pdf');
  const [dataSource, setDataSource] = useState<string>(
    initial?.dataSource ?? REPORT_DATA_SOURCE_SLUGS[0],
  );
  const [assignedRoles, setAssignedRoles] = useState<string[]>(initial?.assignedRoles ?? []);
  const [isScheduled, setIsScheduled] = useState(initial?.isScheduled ?? false);
  const [scheduleCron, setScheduleCron] = useState(initial?.scheduleCron ?? '');
  const [scheduleRecipientsRaw, setScheduleRecipientsRaw] = useState(
    (initial?.scheduleRecipients ?? []).join(', '),
  );
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);

  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setTemplateId(initial.templateId);
      setDisplayNameEn(initial.displayNameEn);
      setDisplayNameAr(initial.displayNameAr ?? '');
      setDescription(initial.description ?? '');
      setReportKind(initial.reportKind);
      setDataSource(initial.dataSource);
      setAssignedRoles(initial.assignedRoles);
      setIsScheduled(initial.isScheduled);
      setScheduleCron(initial.scheduleCron ?? '');
      setScheduleRecipientsRaw((initial.scheduleRecipients ?? []).join(', '));
      setEnabled(initial.enabled);
    }
  }, [initial]);

  const recipients = useMemo(
    () =>
      scheduleRecipientsRaw
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [scheduleRecipientsRaw],
  );

  const createMutation = useMutation({
    mutationFn: (payload: CreateReportTemplateDto) =>
      adminReportTemplatesService.create(payload),
    onSuccess: (created) => {
      toast.success(t('admin.reportTemplates.toasts.created'));
      void qc.invalidateQueries({ queryKey: ['adminReportTemplates'] });
      void navigate({
        to: '/app/admin/report-templates/$templateId',
        params: { templateId: String(created.id) },
      });
    },
    onError: (e: unknown) =>
      toast.error(translateApiError(e, t, 'admin.reportTemplates.errors.createFailed')),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateReportTemplateDto) => {
      if (!initial) throw new Error('cannot_update_without_initial');
      return adminReportTemplatesService.update(initial.id, payload);
    },
    onSuccess: () => {
      toast.success(t('admin.reportTemplates.toasts.updated'));
      void qc.invalidateQueries({ queryKey: ['adminReportTemplates'] });
    },
    onError: (e: unknown) =>
      toast.error(translateApiError(e, t, 'admin.reportTemplates.errors.updateFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!initial) throw new Error('cannot_delete_without_initial');
      return adminReportTemplatesService.delete(initial.id);
    },
    onSuccess: () => {
      toast.success(t('admin.reportTemplates.toasts.deleted'));
      void qc.invalidateQueries({ queryKey: ['adminReportTemplates'] });
      void navigate({ to: '/app/admin/report-templates' });
    },
    onError: (e: unknown) =>
      toast.error(translateApiError(e, t, 'admin.reportTemplates.errors.deleteFailed')),
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const toggleRole = (role: string) => {
    setAssignedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!displayNameEn.trim()) {
      setErr(t('admin.reportTemplates.errors.displayNameRequired'));
      return;
    }
    if (assignedRoles.length === 0) {
      setErr(t('admin.reportTemplates.errors.rolesRequired'));
      return;
    }
    if (!isEdit && !/^[a-z0-9_]+$/.test(templateId.trim())) {
      setErr(t('admin.reportTemplates.errors.templateIdInvalid'));
      return;
    }
    if (isScheduled) {
      if (!scheduleCron.trim() || !looksLikeCron(scheduleCron.trim())) {
        setErr(t('admin.reportTemplates.errors.cronInvalid'));
        return;
      }
      if (recipients.length === 0) {
        setErr(t('admin.reportTemplates.errors.recipientsRequired'));
        return;
      }
    }

    if (isEdit) {
      const payload: UpdateReportTemplateDto = {
        displayNameEn: displayNameEn.trim(),
        displayNameAr: displayNameAr.trim() || null,
        description: description.trim() || null,
        dataSource,
        assignedRoles,
        isScheduled,
        scheduleCron: isScheduled ? scheduleCron.trim() : null,
        scheduleRecipients: isScheduled ? recipients : null,
        enabled,
      };
      updateMutation.mutate(payload);
    } else {
      const payload: CreateReportTemplateDto = {
        templateId: templateId.trim(),
        displayNameEn: displayNameEn.trim(),
        displayNameAr: displayNameAr.trim() || null,
        description: description.trim() || null,
        reportKind,
        dataSource,
        assignedRoles,
        isScheduled,
        scheduleCron: isScheduled ? scheduleCron.trim() : null,
        scheduleRecipients: isScheduled ? recipients : null,
      };
      createMutation.mutate(payload);
    }
  };

  const busy = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rt-template-id" className="mb-1 block text-sm font-medium text-ink">
            {t('admin.reportTemplates.fields.templateId')}
            <span className="text-error ms-1" aria-hidden="true">*</span>
          </label>
          <Input
            id="rt-template-id"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            disabled={isEdit}
            maxLength={200}
            pattern="[a-z0-9_]+"
            placeholder={t('admin.reportTemplates.fields.templateIdHint')}
            required={!isEdit}
          />
          <p className="mt-1 text-xs text-ink-muted">
            {isEdit
              ? t('admin.reportTemplates.fields.templateIdImmutable')
              : t('admin.reportTemplates.fields.templateIdHint')}
          </p>
        </div>

        <div>
          <label htmlFor="rt-report-kind" className="mb-1 block text-sm font-medium text-ink">
            {t('admin.reportTemplates.fields.reportKind')}
            <span className="text-error ms-1" aria-hidden="true">*</span>
          </label>
          <select
            id="rt-report-kind"
            value={reportKind}
            onChange={(e) => setReportKind(e.target.value as ReportKind)}
            disabled={isEdit}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            required
          >
            {REPORT_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`reports.kinds.${k}`)}
              </option>
            ))}
          </select>
          {isEdit && (
            <p className="mt-1 text-xs text-ink-muted">
              {t('admin.reportTemplates.fields.reportKindImmutable')}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rt-display-en" className="mb-1 block text-sm font-medium text-ink">
            {t('admin.reportTemplates.fields.displayNameEn')}
            <span className="text-error ms-1" aria-hidden="true">*</span>
          </label>
          <Input
            id="rt-display-en"
            value={displayNameEn}
            onChange={(e) => setDisplayNameEn(e.target.value)}
            maxLength={500}
            required
          />
        </div>
        <div>
          <label htmlFor="rt-display-ar" className="mb-1 block text-sm font-medium text-ink">
            {t('admin.reportTemplates.fields.displayNameAr')}
          </label>
          <Input
            id="rt-display-ar"
            value={displayNameAr}
            onChange={(e) => setDisplayNameAr(e.target.value)}
            maxLength={500}
            dir="rtl"
          />
        </div>
      </div>

      <div>
        <label htmlFor="rt-description" className="mb-1 block text-sm font-medium text-ink">
          {t('admin.reportTemplates.fields.description')}
        </label>
        <textarea
          id="rt-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={5000}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label htmlFor="rt-data-source" className="mb-1 block text-sm font-medium text-ink">
          {t('admin.reportTemplates.fields.dataSource')}
          <span className="text-error ms-1" aria-hidden="true">*</span>
        </label>
        <select
          id="rt-data-source"
          value={dataSource}
          onChange={(e) => setDataSource(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          required
        >
          {REPORT_DATA_SOURCE_SLUGS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-muted">
          {t('admin.reportTemplates.fields.dataSourceHint')}
        </p>
      </div>

      <fieldset className="rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium text-ink">
          {t('admin.reportTemplates.fields.assignedRoles')}
          <span className="text-error ms-1" aria-hidden="true">*</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ROLE_OPTIONS.map((r) => {
            const id = `rt-role-${r}`;
            const checked = assignedRoles.includes(r);
            return (
              <label
                key={r}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 text-sm text-ink"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleRole(r)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                {t(`roles.${r}`, { defaultValue: r })}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium text-ink">
          {t('admin.reportTemplates.fields.scheduling')}
        </legend>
        <label htmlFor="rt-is-scheduled" className="flex items-center gap-2 text-sm text-ink">
          <input
            id="rt-is-scheduled"
            type="checkbox"
            checked={isScheduled}
            onChange={(e) => setIsScheduled(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          {t('admin.reportTemplates.fields.isScheduled')}
        </label>

        {isScheduled && (
          <div className="mt-3 space-y-3">
            <div>
              <label htmlFor="rt-cron" className="mb-1 block text-sm font-medium text-ink">
                {t('admin.reportTemplates.fields.scheduleCron')}
                <span className="text-error ms-1" aria-hidden="true">*</span>
              </label>
              <Input
                id="rt-cron"
                value={scheduleCron}
                onChange={(e) => setScheduleCron(e.target.value)}
                placeholder="0 9 * * 1"
                maxLength={200}
                required={isScheduled}
                aria-describedby="rt-cron-hint"
              />
              <p id="rt-cron-hint" className="mt-1 text-xs text-ink-muted">
                {t('admin.reportTemplates.fields.cronHint')}
              </p>
            </div>
            <div>
              <label htmlFor="rt-recipients" className="mb-1 block text-sm font-medium text-ink">
                {t('admin.reportTemplates.fields.scheduleRecipients')}
                <span className="text-error ms-1" aria-hidden="true">*</span>
              </label>
              <textarea
                id="rt-recipients"
                value={scheduleRecipientsRaw}
                onChange={(e) => setScheduleRecipientsRaw(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={t('admin.reportTemplates.fields.recipientsHint')}
                required={isScheduled}
              />
            </div>
          </div>
        )}
      </fieldset>

      {isEdit && (
        <label htmlFor="rt-enabled" className="flex items-center gap-2 text-sm text-ink">
          <input
            id="rt-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          {t('admin.reportTemplates.fields.enabled')}
        </label>
      )}

      {err && (
        <p role="alert" className="text-sm text-error">
          {err}
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <div>
          {isEdit && !showDeleteConfirm && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-error hover:bg-error/10"
            >
              <Trash2 className="me-1 h-4 w-4" aria-hidden="true" />
              {t('admin.reportTemplates.actions.delete')}
            </Button>
          )}
          {isEdit && showDeleteConfirm && (
            <div className="flex items-center gap-2 rounded-md border border-error/30 bg-error/5 p-2">
              <span className="text-sm text-error">
                {t('admin.reportTemplates.actions.confirmDelete', {
                  name: displayNameEn,
                })}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteMutation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="bg-error text-white hover:bg-error/90"
              >
                {deleteMutation.isPending ? t('common.deleting') : t('common.delete')}
              </Button>
            </div>
          )}
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? t('common.saving') : isEdit ? t('common.save') : t('common.create')}
        </Button>
      </div>
    </form>
  );
}
