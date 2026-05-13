/**
 * Unit-4 / R-PROC — Procurement persona action dialogs.
 *
 * Four dialogs:
 *   - ActivateAlternateVendorDialog — backup-supplier activation
 *   - EscalateVendorPerformanceDialog — escalate vendor to legal/exec/compliance/finance
 *   - InitiateCureNoticeDialog — record cure-notice intent (advisory drafter ships in CR-H)
 *   - InitiateIcvRemediationDialog — record ICV remediation intent; can forward to compliance
 *
 * Pattern mirrors src/features/operations/components/ActionDialogs.tsx (Unit-3).
 * Three data states. Zod + react-hook-form. useFocusTrap. i18n on every string.
 * onSuccess: toast + invalidate procurement dashboard query + close.
 */

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { translateApiError } from '@/lib/translate-api-error';
import { useFocusTrap } from '@/components/common/useFocusTrap';
import { personaActionsService } from '@/services/api/persona-actions.service';

// ─── Shared dialog shell ────────────────────────────────────────────────────

interface DialogShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

function DialogShell({ open, onClose, title, children }: DialogShellProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="proc-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        ref={ref}
        className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="proc-dialog-title" className="text-base font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded p-1 text-ink-muted hover:bg-muted hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Activate Alternate Vendor ──────────────────────────────────────────────

const activateAlternateSchema = z.object({
  alternateVendorName: z.string().trim().max(200).optional(),
  forContractId: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), { message: 'Must be a numeric contract id' }),
  note: z.string().trim().max(1000).optional(),
});
type ActivateAlternateForm = z.infer<typeof activateAlternateSchema>;

export function ActivateAlternateVendorDialog({
  partyId,
  vendorName,
  open,
  onClose,
}: {
  partyId: string | null;
  vendorName?: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { register, handleSubmit, formState, reset } = useForm<ActivateAlternateForm>({
    resolver: zodResolver(activateAlternateSchema),
    defaultValues: { alternateVendorName: '', forContractId: '', note: '' },
  });
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);
  const m = useMutation({
    mutationFn: async (input: ActivateAlternateForm) => {
      if (!partyId) throw new Error('missing partyId');
      return personaActionsService.activateAlternateVendor(partyId, {
        alternateVendorName: input.alternateVendorName?.trim() || undefined,
        forContractId: input.forContractId ? Number(input.forContractId) : undefined,
        note: input.note?.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success(t('procurement.actions.activateAlternate.success'));
      void qc.invalidateQueries({ queryKey: ['dashboards-crg', 'procurement'] });
      onClose();
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={t('procurement.actions.activateAlternate.title')}
    >
      <p className="mb-3 text-xs text-ink-muted">
        {vendorName
          ? t('procurement.actions.activateAlternate.subtitleNamed', { vendor: vendorName })
          : t('procurement.actions.activateAlternate.subtitle')}
      </p>
      <form onSubmit={handleSubmit((v) => m.mutate(v))} className="space-y-3">
        <div>
          <label
            htmlFor="proc-alt-vendor-name"
            className="mb-1 block text-xs font-medium text-ink"
          >
            {t('procurement.actions.activateAlternate.alternateVendorLabel')}
          </label>
          <input
            id="proc-alt-vendor-name"
            type="text"
            {...register('alternateVendorName')}
            aria-invalid={!!formState.errors.alternateVendorName}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:border-gold focus-visible:outline-none"
          />
        </div>
        <div>
          <label htmlFor="proc-alt-contract" className="mb-1 block text-xs font-medium text-ink">
            {t('procurement.actions.activateAlternate.forContractLabel')}
          </label>
          <input
            id="proc-alt-contract"
            type="text"
            {...register('forContractId')}
            aria-invalid={!!formState.errors.forContractId}
            placeholder="123"
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:border-gold focus-visible:outline-none"
          />
          {formState.errors.forContractId && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {formState.errors.forContractId.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="proc-alt-note" className="mb-1 block text-xs font-medium text-ink">
            {t('procurement.actions.activateAlternate.noteLabel')}
          </label>
          <textarea
            id="proc-alt-note"
            rows={3}
            {...register('note')}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:border-gold focus-visible:outline-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={m.isPending}
            className="bg-gold text-ink hover:bg-gold-hover"
          >
            {m.isPending
              ? t('common.submitting')
              : t('procurement.actions.activateAlternate.submit')}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

// ─── Escalate Vendor Performance ────────────────────────────────────────────

const escalateVendorSchema = z.object({
  reason: z.string().trim().min(1, 'Required').max(1000),
  toRole: z.enum(['legal', 'executive', 'compliance', 'finance_treasury']).optional(),
});
type EscalateVendorForm = z.infer<typeof escalateVendorSchema>;

export function EscalateVendorPerformanceDialog({
  partyId,
  vendorName,
  open,
  onClose,
}: {
  partyId: string | null;
  vendorName?: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { register, handleSubmit, formState, reset } = useForm<EscalateVendorForm>({
    resolver: zodResolver(escalateVendorSchema),
    defaultValues: { reason: '', toRole: undefined },
  });
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);
  const m = useMutation({
    mutationFn: async (input: EscalateVendorForm) => {
      if (!partyId) throw new Error('missing partyId');
      return personaActionsService.escalateVendorPerformance(partyId, {
        reason: input.reason,
        ...(input.toRole ? { toRole: input.toRole } : {}),
      });
    },
    onSuccess: () => {
      toast.success(t('procurement.actions.escalateVendor.success'));
      void qc.invalidateQueries({ queryKey: ['dashboards-crg', 'procurement'] });
      onClose();
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={t('procurement.actions.escalateVendor.title')}
    >
      <p className="mb-3 text-xs text-ink-muted">
        {vendorName
          ? t('procurement.actions.escalateVendor.subtitleNamed', { vendor: vendorName })
          : t('procurement.actions.escalateVendor.subtitle')}
      </p>
      <form onSubmit={handleSubmit((v) => m.mutate(v))} className="space-y-3">
        <div>
          <label htmlFor="proc-esc-reason" className="mb-1 block text-xs font-medium text-ink">
            {t('procurement.actions.escalateVendor.reasonLabel')}
          </label>
          <textarea
            id="proc-esc-reason"
            rows={3}
            {...register('reason')}
            aria-invalid={!!formState.errors.reason}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:border-gold focus-visible:outline-none"
          />
          {formState.errors.reason && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {formState.errors.reason.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="proc-esc-role" className="mb-1 block text-xs font-medium text-ink">
            {t('procurement.actions.escalateVendor.toRoleLabel')}
          </label>
          <select
            id="proc-esc-role"
            {...register('toRole')}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:border-gold focus-visible:outline-none"
          >
            <option value="">{t('procurement.actions.escalateVendor.toRoleAny')}</option>
            <option value="legal">{t('procurement.actions.escalateVendor.toRoleLegal')}</option>
            <option value="executive">{t('procurement.actions.escalateVendor.toRoleExecutive')}</option>
            <option value="compliance">{t('procurement.actions.escalateVendor.toRoleCompliance')}</option>
            <option value="finance_treasury">{t('procurement.actions.escalateVendor.toRoleFinanceTreasury')}</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={m.isPending}
            className="bg-amber text-ink hover:bg-amber/90"
          >
            {m.isPending ? t('common.submitting') : t('procurement.actions.escalateVendor.submit')}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

// ─── Initiate Cure Notice (stub until CR-H ships) ───────────────────────────

const cureNoticeSchema = z.object({
  contractIdInput: z
    .string()
    .trim()
    .min(1, 'Required')
    .refine((v) => /^\d+$/.test(v), { message: 'Must be a numeric contract id' }),
  breachDescription: z.string().trim().min(1, 'Required').max(2000),
  curePeriodDays: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || (Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) <= 365), {
      message: 'Must be 1–365',
    }),
  note: z.string().trim().max(1000).optional(),
});
type CureNoticeForm = z.infer<typeof cureNoticeSchema>;

export function InitiateCureNoticeDialog({
  contractId,
  contractLabel,
  open,
  onClose,
}: {
  /** Pre-filled contract id; empty string allowed → user enters in form. */
  contractId: string | null;
  contractLabel?: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { register, handleSubmit, formState, reset } = useForm<CureNoticeForm>({
    resolver: zodResolver(cureNoticeSchema),
    defaultValues: {
      contractIdInput: contractId ?? '',
      breachDescription: '',
      curePeriodDays: '30',
      note: '',
    },
  });
  useEffect(() => {
    if (open) {
      reset({
        contractIdInput: contractId ?? '',
        breachDescription: '',
        curePeriodDays: '30',
        note: '',
      });
    }
  }, [open, contractId, reset]);
  const m = useMutation({
    mutationFn: async (input: CureNoticeForm) => {
      return personaActionsService.recordCureNoticeIntent(input.contractIdInput, {
        breachDescription: input.breachDescription,
        curePeriodDays: input.curePeriodDays ? Number(input.curePeriodDays) : undefined,
        note: input.note?.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success(t('procurement.actions.cureNotice.success'));
      void qc.invalidateQueries({ queryKey: ['dashboards-crg', 'procurement'] });
      onClose();
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={t('procurement.actions.cureNotice.title')}
    >
      <p className="mb-3 text-xs text-ink-muted">
        {contractLabel
          ? t('procurement.actions.cureNotice.subtitleNamed', { contract: contractLabel })
          : t('procurement.actions.cureNotice.subtitle')}
      </p>
      <div className="mb-3 rounded-md border border-amber/40 bg-amber/10 p-2 text-xs text-amber">
        {t('procurement.actions.cureNotice.stubNotice')}
      </div>
      <form onSubmit={handleSubmit((v) => m.mutate(v))} className="space-y-3">
        <div>
          <label htmlFor="proc-cure-contract" className="mb-1 block text-xs font-medium text-ink">
            {t('procurement.actions.cureNotice.contractIdLabel')}
          </label>
          <input
            id="proc-cure-contract"
            type="text"
            {...register('contractIdInput')}
            aria-invalid={!!formState.errors.contractIdInput}
            placeholder="5"
            className="w-32 rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:border-gold focus-visible:outline-none"
          />
          {formState.errors.contractIdInput && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {formState.errors.contractIdInput.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="proc-cure-breach" className="mb-1 block text-xs font-medium text-ink">
            {t('procurement.actions.cureNotice.breachLabel')}
          </label>
          <textarea
            id="proc-cure-breach"
            rows={3}
            {...register('breachDescription')}
            aria-invalid={!!formState.errors.breachDescription}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:border-gold focus-visible:outline-none"
          />
          {formState.errors.breachDescription && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {formState.errors.breachDescription.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="proc-cure-days" className="mb-1 block text-xs font-medium text-ink">
            {t('procurement.actions.cureNotice.curePeriodLabel')}
          </label>
          <input
            id="proc-cure-days"
            type="number"
            min={1}
            max={365}
            {...register('curePeriodDays')}
            aria-invalid={!!formState.errors.curePeriodDays}
            className="w-32 rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:border-gold focus-visible:outline-none"
          />
          {formState.errors.curePeriodDays && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {formState.errors.curePeriodDays.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="proc-cure-note" className="mb-1 block text-xs font-medium text-ink">
            {t('procurement.actions.cureNotice.noteLabel')}
          </label>
          <textarea
            id="proc-cure-note"
            rows={2}
            {...register('note')}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:border-gold focus-visible:outline-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={m.isPending}
            className="bg-terracotta text-white hover:bg-terracotta/90"
          >
            {m.isPending ? t('common.submitting') : t('procurement.actions.cureNotice.submit')}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

// ─── Initiate ICV Remediation ───────────────────────────────────────────────

const icvRemediationSchema = z.object({
  contractIdInput: z
    .string()
    .trim()
    .min(1, 'Required')
    .refine((v) => /^\d+$/.test(v), { message: 'Must be a numeric contract id' }),
  shortfallDescription: z.string().trim().min(1, 'Required').max(1000),
  proposedRemediationSteps: z.string().trim().max(2000).optional(),
  forwardToCompliance: z.boolean().optional(),
});
type IcvRemediationForm = z.infer<typeof icvRemediationSchema>;

export function InitiateIcvRemediationDialog({
  contractId,
  contractLabel,
  open,
  onClose,
}: {
  /** Pre-filled contract id; empty string allowed → user enters in form. */
  contractId: string | null;
  contractLabel?: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { register, handleSubmit, formState, reset } = useForm<IcvRemediationForm>({
    resolver: zodResolver(icvRemediationSchema),
    defaultValues: {
      contractIdInput: contractId ?? '',
      shortfallDescription: '',
      proposedRemediationSteps: '',
      forwardToCompliance: true,
    },
  });
  useEffect(() => {
    if (open) {
      reset({
        contractIdInput: contractId ?? '',
        shortfallDescription: '',
        proposedRemediationSteps: '',
        forwardToCompliance: true,
      });
    }
  }, [open, contractId, reset]);
  const m = useMutation({
    mutationFn: async (input: IcvRemediationForm) => {
      return personaActionsService.initiateIcvRemediation(input.contractIdInput, {
        shortfallDescription: input.shortfallDescription,
        proposedRemediationSteps: input.proposedRemediationSteps?.trim() || undefined,
        forwardToCompliance: input.forwardToCompliance,
      });
    },
    onSuccess: () => {
      toast.success(t('procurement.actions.icvRemediation.success'));
      void qc.invalidateQueries({ queryKey: ['dashboards-crg', 'procurement'] });
      onClose();
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={t('procurement.actions.icvRemediation.title')}
    >
      <p className="mb-3 text-xs text-ink-muted">
        {contractLabel
          ? t('procurement.actions.icvRemediation.subtitleNamed', { contract: contractLabel })
          : t('procurement.actions.icvRemediation.subtitle')}
      </p>
      <form onSubmit={handleSubmit((v) => m.mutate(v))} className="space-y-3">
        <div>
          <label htmlFor="proc-icv-contract" className="mb-1 block text-xs font-medium text-ink">
            {t('procurement.actions.icvRemediation.contractIdLabel')}
          </label>
          <input
            id="proc-icv-contract"
            type="text"
            {...register('contractIdInput')}
            aria-invalid={!!formState.errors.contractIdInput}
            placeholder="5"
            className="w-32 rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:border-gold focus-visible:outline-none"
          />
          {formState.errors.contractIdInput && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {formState.errors.contractIdInput.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="proc-icv-short" className="mb-1 block text-xs font-medium text-ink">
            {t('procurement.actions.icvRemediation.shortfallLabel')}
          </label>
          <textarea
            id="proc-icv-short"
            rows={3}
            {...register('shortfallDescription')}
            aria-invalid={!!formState.errors.shortfallDescription}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:border-gold focus-visible:outline-none"
          />
          {formState.errors.shortfallDescription && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {formState.errors.shortfallDescription.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="proc-icv-steps" className="mb-1 block text-xs font-medium text-ink">
            {t('procurement.actions.icvRemediation.stepsLabel')}
          </label>
          <textarea
            id="proc-icv-steps"
            rows={3}
            {...register('proposedRemediationSteps')}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:border-gold focus-visible:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-ink">
          <input
            type="checkbox"
            {...register('forwardToCompliance')}
            className="rounded border-border"
          />
          {t('procurement.actions.icvRemediation.forwardToCompliance')}
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={m.isPending}
            className="bg-gold text-ink hover:bg-gold-hover"
          >
            {m.isPending
              ? t('common.submitting')
              : t('procurement.actions.icvRemediation.submit')}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
