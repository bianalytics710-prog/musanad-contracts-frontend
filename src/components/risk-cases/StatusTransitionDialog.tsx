/**
 * StatusTransitionDialog — strict-matrix transitions (S-K-9).
 *
 * Only valid transitions per current status are offered. HITL Q3=strict
 * mirrors the BE fn_risk_case_status_transition matrix (P0001 on violation).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { riskCaseService } from '@/services/api/risk-case.service';
import { translateApiError } from '@/lib/translate-api-error';
import { STRICT_TRANSITIONS } from '@/types/risk-case.types';
import type { RiskCaseStatus, RiskCaseTransitionStatus } from '@/types/risk-case.types';

interface Props {
  open: boolean;
  onClose: () => void;
  caseId: number;
  currentStatus: RiskCaseStatus;
}

export function StatusTransitionDialog({ open, onClose, caseId, currentStatus }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const valid = STRICT_TRANSITIONS[currentStatus] ?? [];

  const [toStatus, setToStatus] = useState<RiskCaseTransitionStatus | ''>(
    (valid[0] as RiskCaseTransitionStatus) ?? '',
  );
  const [decisionNote, setDecisionNote] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      if (!toStatus) throw new Error('toStatus_required');
      return riskCaseService.statusTransition(caseId, {
        toStatus,
        decisionNote: decisionNote.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success(t('riskCases.toasts.statusUpdated'));
      void qc.invalidateQueries({ queryKey: ['riskCase', caseId] });
      void qc.invalidateQueries({ queryKey: ['riskCases'] });
      setDecisionNote('');
      onClose();
    },
    onError: (err: unknown) =>
      toast.error(translateApiError(err, t, 'riskCases.errors.statusUpdateFailed')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!toStatus) {
      toast.error(t('riskCases.errors.toStatusRequired'));
      return;
    }
    mutation.mutate();
  };

  if (valid.length === 0) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('riskCases.transition.title')}</DialogTitle>
            <DialogDescription>{t('riskCases.transition.noneAvailable')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-2">
            <Button onClick={onClose}>{t('common.close')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('riskCases.transition.title')}</DialogTitle>
          <DialogDescription>
            {t('riskCases.transition.description', {
              status: t(`riskCases.statuses.${currentStatus}`),
            })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="rc-transition-to" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.fields.toStatus')}
            </label>
            <select
              id="rc-transition-to"
              value={toStatus}
              onChange={(e) => setToStatus(e.target.value as RiskCaseTransitionStatus)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              {valid.map((s) => (
                <option key={s} value={s}>
                  {t(`riskCases.statuses.${s}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rc-transition-note" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.fields.decisionNote')}
            </label>
            <textarea
              id="rc-transition-note"
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              rows={3}
              maxLength={5000}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('riskCases.fields.decisionNoteHint')}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.saving') : t('common.confirm')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
