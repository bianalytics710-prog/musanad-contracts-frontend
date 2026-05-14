/**
 * AdvisoryRejectDialog — rejection reason dialog with mandatory ≥10 char reason.
 *
 * M16 / CR-H — T6 useFocusTrap + role="dialog", T8 zod form, T9 destructive confirmation,
 * T3 i18n, T7 type-safe.
 */
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFocusTrap } from '@/components/common/useFocusTrap';
import { advisoryDraftsService } from '@/services/api/advisory-drafts.service';
import { translateApiError } from '@/lib/translate-api-error';

const rejectSchema = z.object({
  rejectionReason: z
    .string()
    .min(10, 'Rejection reason must be at least 10 characters'),
});

type RejectFormData = z.infer<typeof rejectSchema>;

interface Props {
  draftId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AdvisoryRejectDialog({ draftId, isOpen, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, isOpen);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<RejectFormData>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { rejectionReason: '' },
  });

  const rejectMutation = useMutation({
    mutationFn: (data: RejectFormData) =>
      advisoryDraftsService.reject(draftId, { rejectionReason: data.rejectionReason }),
    onSuccess: () => {
      toast.success(t('legal.advisoryQueue.toast.rejected'));
      void qc.invalidateQueries({ queryKey: ['advisoryDrafts'] });
      reset();
      onSuccess();
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'legal.advisoryQueue.errors.rejectFailed'));
    },
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      aria-modal="true"
      role="dialog"
      aria-label={t('legal.advisoryQueue.rejectDialog.title')}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-error" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-ink">
              {t('legal.advisoryQueue.rejectDialog.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-muted hover:bg-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit((data) => rejectMutation.mutate(data))}
          noValidate
          className="p-6 space-y-4"
        >
          <p className="text-sm text-ink-muted">
            {t('legal.advisoryQueue.rejectDialog.description')}
          </p>
          <div>
            <label
              htmlFor="rejectionReason"
              className="mb-1 block text-sm font-medium text-ink"
            >
              {t('legal.advisoryQueue.rejectDialog.reasonLabel')}
              <span className="ml-1 text-error" aria-hidden="true">*</span>
            </label>
            <textarea
              id="rejectionReason"
              {...register('rejectionReason')}
              rows={5}
              placeholder={t('legal.advisoryQueue.rejectDialog.reasonPlaceholder')}
              aria-invalid={!!errors.rejectionReason}
              aria-describedby={errors.rejectionReason ? 'rejectionReasonError' : undefined}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {errors.rejectionReason && (
              <p id="rejectionReasonError" className="mt-1 text-xs text-error" role="alert">
                {errors.rejectionReason.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={rejectMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending
                ? t('common.saving')
                : t('legal.advisoryQueue.rejectDialog.submit')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
