/**
 * EscalateRiskCaseDialog — S-K-10. Manual escalate to next role per matrix.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { riskCaseService } from '@/services/api/risk-case.service';
import { translateApiError } from '@/lib/translate-api-error';

interface Props {
  open: boolean;
  onClose: () => void;
  caseId: number;
}

export function EscalateDialog({ open, onClose, caseId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      riskCaseService.escalate(caseId, { reason: reason.trim() || null }),
    onSuccess: (res) => {
      toast.success(
        t('riskCases.toasts.escalatedTo', { role: res.newAssignedRole }),
      );
      void qc.invalidateQueries({ queryKey: ['riskCase', caseId] });
      void qc.invalidateQueries({ queryKey: ['riskCases'] });
      setReason('');
      onClose();
    },
    onError: (err: unknown) =>
      toast.error(translateApiError(err, t, 'riskCases.errors.escalateFailed')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('riskCases.escalate.title')}</DialogTitle>
          <DialogDescription>{t('riskCases.escalate.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="rc-esc-reason" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.fields.escalationReason')}
            </label>
            <textarea
              id="rc-esc-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={5000}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('riskCases.fields.escalationReasonHint')}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.saving') : t('riskCases.actions.escalate')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
