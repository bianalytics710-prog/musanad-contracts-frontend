/**
 * AcceptRiskDialog — S-K-11. Named-approver risk acceptance.
 *
 * Self-approval guard (FE-layer defense in depth, mirrors BE Self-approval
 * guard from be-impl-report selfChecks.selfApprovalGuardOnAcceptRisk):
 * submit disabled when approverUserId === currentUser.id.
 *
 * AC-SK11-03: justification >= 10 characters.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { riskCaseService } from '@/services/api/risk-case.service';
import { useAuthStore } from '@/store/auth.store';
import { translateApiError } from '@/lib/translate-api-error';

interface Props {
  open: boolean;
  onClose: () => void;
  caseId: number;
}

export function AcceptRiskDialog({ open, onClose, caseId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [approverUserId, setApproverUserId] = useState('');
  const [justification, setJustification] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const approverIdNum = Number(approverUserId);
  const isSelfApproval =
    !!currentUserId &&
    Number.isFinite(approverIdNum) &&
    approverIdNum === currentUserId;
  const justificationLen = justification.trim().length;
  const tooShort = justificationLen > 0 && justificationLen < 10;

  const mutation = useMutation({
    mutationFn: () =>
      riskCaseService.acceptRisk(caseId, {
        approverUserId: approverIdNum,
        justification: justification.trim(),
      }),
    onSuccess: () => {
      toast.success(t('riskCases.toasts.acceptedRisk'));
      void qc.invalidateQueries({ queryKey: ['riskCase', caseId] });
      void qc.invalidateQueries({ queryKey: ['riskCases'] });
      setApproverUserId('');
      setJustification('');
      setErr(null);
      onClose();
    },
    onError: (e: unknown) =>
      toast.error(translateApiError(e, t, 'riskCases.errors.acceptRiskFailed')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!approverIdNum || !Number.isInteger(approverIdNum) || approverIdNum <= 0) {
      setErr(t('riskCases.errors.approverUserIdRequired'));
      return;
    }
    if (isSelfApproval) {
      setErr(t('riskCases.errors.cannotSelfApprove'));
      return;
    }
    if (justificationLen < 10) {
      setErr(t('riskCases.errors.justificationTooShort'));
      return;
    }
    mutation.mutate();
  };

  const disabled = mutation.isPending || isSelfApproval || justificationLen < 10 || !approverIdNum;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('riskCases.acceptRisk.title')}</DialogTitle>
          <DialogDescription>{t('riskCases.acceptRisk.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="rc-ar-approver" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.fields.approverUserId')}
              <span className="text-error ms-1" aria-hidden="true">*</span>
            </label>
            <Input
              id="rc-ar-approver"
              type="number"
              inputMode="numeric"
              min={1}
              value={approverUserId}
              onChange={(e) => {
                setApproverUserId(e.target.value);
                setErr(null);
              }}
              placeholder={t('riskCases.fields.approverUserIdHint')}
              aria-invalid={isSelfApproval}
            />
            {isSelfApproval && (
              <p className="mt-1 text-xs text-error" role="alert">
                {t('riskCases.errors.cannotSelfApprove')}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="rc-ar-just" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.fields.justification')}
              <span className="text-error ms-1" aria-hidden="true">*</span>
            </label>
            <textarea
              id="rc-ar-just"
              value={justification}
              onChange={(e) => {
                setJustification(e.target.value);
                setErr(null);
              }}
              rows={5}
              maxLength={10_000}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              required
              aria-invalid={tooShort}
            />
            <p className={`mt-1 text-xs ${tooShort ? 'text-error' : 'text-ink-muted'}`}>
              {t('riskCases.fields.justificationCount', {
                count: justificationLen,
                min: 10,
              })}
            </p>
          </div>

          {err && (
            <p role="alert" className="text-sm text-error">
              {err}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={disabled}>
              {mutation.isPending ? t('common.saving') : t('riskCases.actions.acceptRisk')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
