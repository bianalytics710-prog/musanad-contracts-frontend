/**
 * AssignRiskCaseDialog — S-K-5.
 * AC-SK5-02: at least one of assignedRole / assignedUserId is required.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { riskCaseService } from '@/services/api/risk-case.service';
import { translateApiError } from '@/lib/translate-api-error';

const ASSIGN_ROLES = [
  'operations',
  'finance_treasury',
  'compliance_esg',
  'legal_counsel',
  'executive',
  'platform_admin',
  'contract_drafter',
  'contract_approver',
  'contract_approver_2',
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  caseId: number;
  currentRole: string | null;
  currentUserId: number | null;
}

export function AssignRiskCaseDialog({ open, onClose, caseId, currentRole, currentUserId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [role, setRole] = useState<string>(currentRole ?? '');
  const [userId, setUserId] = useState<string>(currentUserId?.toString() ?? '');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRole(currentRole ?? '');
      setUserId(currentUserId?.toString() ?? '');
      setErr(null);
    }
  }, [open, currentRole, currentUserId]);

  const mutation = useMutation({
    mutationFn: () =>
      riskCaseService.assign(caseId, {
        assignedRole: role || null,
        assignedUserId: userId ? Number(userId) : null,
      }),
    onSuccess: () => {
      toast.success(t('riskCases.toasts.assigned'));
      void qc.invalidateQueries({ queryKey: ['riskCase', caseId] });
      void qc.invalidateQueries({ queryKey: ['riskCases'] });
      onClose();
    },
    onError: (e: unknown) => toast.error(translateApiError(e, t, 'riskCases.errors.assignFailed')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role && !userId) {
      setErr(t('riskCases.errors.assignAtLeastOne'));
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('riskCases.assign.title')}</DialogTitle>
          <DialogDescription>{t('riskCases.assign.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="rc-assign-role" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.fields.assignedRole')}
            </label>
            <select
              id="rc-assign-role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setErr(null);
              }}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{t('riskCases.fields.noRole')}</option>
              {ASSIGN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`, { defaultValue: r })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rc-assign-user" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.fields.assignedUserId')}
            </label>
            <Input
              id="rc-assign-user"
              type="number"
              inputMode="numeric"
              min={1}
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setErr(null);
              }}
              placeholder={t('riskCases.fields.userIdHint')}
            />
            <p className="mt-1 text-xs text-ink-muted">{t('riskCases.fields.userIdNote')}</p>
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
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
