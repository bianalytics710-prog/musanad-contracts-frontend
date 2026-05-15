/**
 * CloseDialog — S-K-13. Close case with explicit outcome.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { riskCaseService } from '@/services/api/risk-case.service';
import { translateApiError } from '@/lib/translate-api-error';
import { RISK_CASE_CLOSURE_OUTCOMES } from '@/types/risk-case.types';
import type { RiskCaseClosureOutcome } from '@/types/risk-case.types';

interface Props {
  open: boolean;
  onClose: () => void;
  caseId: number;
}

export function CloseDialog({ open, onClose, caseId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState<RiskCaseClosureOutcome>('mitigated');
  const [closureNote, setClosureNote] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      riskCaseService.close(caseId, {
        outcome,
        closureNote: closureNote.trim() || null,
      }),
    onSuccess: () => {
      toast.success(t('riskCases.toasts.closed'));
      void qc.invalidateQueries({ queryKey: ['riskCase', caseId] });
      void qc.invalidateQueries({ queryKey: ['riskCases'] });
      setClosureNote('');
      onClose();
    },
    onError: (e: unknown) => toast.error(translateApiError(e, t, 'riskCases.errors.closeFailed')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('riskCases.close.title')}</DialogTitle>
          <DialogDescription>{t('riskCases.close.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="rc-close-outcome" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.fields.closureOutcome')}
              <span className="text-error ms-1" aria-hidden="true">*</span>
            </label>
            <select
              id="rc-close-outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as RiskCaseClosureOutcome)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              {RISK_CASE_CLOSURE_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {t(`riskCases.outcomes.${o}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rc-close-note" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.fields.closureNote')}
            </label>
            <textarea
              id="rc-close-note"
              value={closureNote}
              onChange={(e) => setClosureNote(e.target.value)}
              rows={3}
              maxLength={5000}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.saving') : t('riskCases.actions.close')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
