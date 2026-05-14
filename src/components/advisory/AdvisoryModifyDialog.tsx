/**
 * AdvisoryModifyDialog — EN+AR text modification dialog.
 *
 * M16 / CR-H — T6 useFocusTrap + role="dialog", T8 zod form, T9 confirmation,
 * T3 i18n, T7 type-safe.
 */
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFocusTrap } from '@/components/common/useFocusTrap';
import { advisoryDraftsService } from '@/services/api/advisory-drafts.service';
import { translateApiError } from '@/lib/translate-api-error';
import type { AdvisoryDraft } from '@/types/advisory-drafts.types';

const modifySchema = z.object({
  finalTextEn: z.string().min(1, 'Required'),
  finalTextAr: z.string().min(1, 'Required'),
});

type ModifyFormData = z.infer<typeof modifySchema>;

interface Props {
  draft: AdvisoryDraft;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AdvisoryModifyDialog({ draft, isOpen, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, isOpen);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ModifyFormData>({
    resolver: zodResolver(modifySchema),
    defaultValues: {
      finalTextEn: draft.finalTextEn ?? draft.generatedTextEn,
      finalTextAr: draft.finalTextAr ?? draft.generatedTextAr,
    },
  });

  const modifyMutation = useMutation({
    mutationFn: (data: ModifyFormData) =>
      advisoryDraftsService.modify(draft.id, {
        finalTextEn: data.finalTextEn,
        finalTextAr: data.finalTextAr,
      }),
    onSuccess: () => {
      toast.success(t('legal.advisoryQueue.toast.modified'));
      void qc.invalidateQueries({ queryKey: ['advisoryDrafts'] });
      reset();
      onSuccess();
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'legal.advisoryQueue.errors.modifyFailed'));
    },
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      aria-modal="true"
      role="dialog"
      aria-label={t('legal.advisoryQueue.modifyDialog.title')}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-4xl rounded-xl border border-border bg-card shadow-xl"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-ink">
            {t('legal.advisoryQueue.modifyDialog.title')}
          </h2>
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
          onSubmit={handleSubmit((data) => modifyMutation.mutate(data))}
          noValidate
          className="p-6"
        >
          <p className="mb-4 text-sm text-ink-muted">
            {t('legal.advisoryQueue.modifyDialog.description')}
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label
                htmlFor="modifyFinalTextEn"
                className="mb-1 block text-sm font-medium text-ink"
              >
                {t('legal.advisoryQueue.bodyEn')}
              </label>
              <textarea
                id="modifyFinalTextEn"
                {...register('finalTextEn')}
                rows={18}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                aria-invalid={!!errors.finalTextEn}
              />
              {errors.finalTextEn && (
                <p className="mt-1 text-xs text-error">{errors.finalTextEn.message}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="modifyFinalTextAr"
                className="mb-1 block text-sm font-medium text-ink"
              >
                {t('legal.advisoryQueue.bodyAr')}
              </label>
              <textarea
                id="modifyFinalTextAr"
                {...register('finalTextAr')}
                dir="rtl"
                rows={18}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                aria-invalid={!!errors.finalTextAr}
              />
              {errors.finalTextAr && (
                <p className="mt-1 text-xs text-error">{errors.finalTextAr.message}</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={modifyMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={modifyMutation.isPending}>
              {modifyMutation.isPending ? t('common.saving') : t('legal.advisoryQueue.modifyDialog.submit')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
