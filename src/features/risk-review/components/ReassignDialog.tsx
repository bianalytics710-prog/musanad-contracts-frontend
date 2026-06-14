/**
 * ReassignDialog — Phase E.12.
 *
 * Executive override for Tier-1 risk cases. Locked decision E-Q5: any
 * active user in any role can be the new owner (full executive override,
 * no role matrix gating). The dropdown is grouped by role using the
 * pre-existing /risk-cases/assignable-users endpoint, which already
 * returns the full set of risk-eligible roles.
 *
 * The fn_risk_triage_reassign DB function (mig 651) enforces the
 * status='open' precondition + role-coherence (it updates assigned_role
 * to match the new user's role so the no-orphan invariant stays
 * satisfied). The dialog disables the Confirm button if the caller passes
 * `lockedReason` (e.g. "Receiver has already started") and shows a
 * read-only banner instead.
 */
import { useMemo, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { riskCaseService } from '@/services/api/risk-case.service';
import { riskReviewService } from '@/services/api/risk-review.service';
import type { AssignableUser } from '@/types/risk-case.types';

export interface ReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: number;
  caseTitle: string;
  currentAssigneeName: string | null;
  currentAssigneeId: string | null;
  /**
   * If provided, dialog renders a read-only banner instead of the dropdown.
   * Used when row.status !== 'open' (the receiver has already started
   * working on the case, so reassign locks).
   */
  lockedReason?: string | null;
  onSuccess?: () => void;
}

export function ReassignDialog({
  open,
  onOpenChange,
  caseId,
  caseTitle,
  currentAssigneeName,
  currentAssigneeId,
  lockedReason,
  onSuccess,
}: ReassignDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const usersQuery = useQuery({
    queryKey: ['risk-assignable-users'],
    queryFn: () => riskCaseService.assignableUsers(),
    staleTime: 60_000,
    enabled: open && !lockedReason,
  });

  // Group users by roleDisplay so the dropdown shows optgroups. We exclude
  // the current owner (no point reassigning to themselves).
  const grouped = useMemo(() => {
    const users: AssignableUser[] = usersQuery.data ?? [];
    const map = new Map<string, AssignableUser[]>();
    for (const u of users) {
      if (u.id === currentAssigneeId) continue;
      const arr = map.get(u.roleDisplay) ?? [];
      arr.push(u);
      map.set(u.roleDisplay, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [usersQuery.data, currentAssigneeId]);

  const reassign = useMutation({
    mutationFn: ({ newUserId }: { newUserId: number }) =>
      riskReviewService.reassign(caseId, newUserId),
    onSuccess: () => {
      toast.success(
        t('riskTriage.reassign.toast.success', {
          defaultValue: 'Risk case reassigned',
        }),
      );
      void queryClient.invalidateQueries({ queryKey: ['riskTriageTier1'] });
      void queryClient.invalidateQueries({ queryKey: ['adminRiskReview'] });
      void queryClient.invalidateQueries({ queryKey: ['riskCases'] });
      onSuccess?.();
      setSelectedUserId('');
      onOpenChange(false);
    },
    onError: (err) => {
      const msg = (err as Error)?.message ?? '';
      if (msg.toLowerCase().includes('reassign_locked')) {
        toast.error(
          t('riskTriage.reassign.toast.locked', {
            defaultValue: 'Receiver has already started — reassign locked.',
          }),
        );
      } else {
        toast.error(t('common.error', { defaultValue: 'Action failed' }));
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !reassign.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('riskTriage.reassign.title', { defaultValue: 'Reassign risk case' })}
          </DialogTitle>
          <DialogDescription>
            {lockedReason
              ? t('riskTriage.reassign.lockedDescription', {
                  defaultValue:
                    'This case can no longer be reassigned — the receiver has already started working on it.',
                })
              : t('riskTriage.reassign.description', {
                  defaultValue:
                    'Move this case to a different person. The new owner can be in any role — the case role will move with them.',
                })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-border bg-paper-2 p-3">
            <p className="text-xs text-ink-subtle">
              {t('riskTriage.reassign.caseLabel', { defaultValue: 'Case' })}
            </p>
            <p className="font-semibold text-ink">{caseTitle}</p>
            <p className="mt-1 text-xs text-ink-muted">
              {t('riskTriage.reassign.currentOwner', { defaultValue: 'Current owner:' })}{' '}
              <span className="text-ink">{currentAssigneeName ?? '—'}</span>
            </p>
          </div>

          {lockedReason ? (
            <div className="rounded-md border border-amber/40 bg-amber/10 p-3 text-xs text-ink">
              {lockedReason}
            </div>
          ) : (
            <div>
              <label
                htmlFor={`reassign-${caseId}`}
                className="mb-1 block text-xs font-medium text-ink-subtle"
              >
                {t('riskTriage.reassign.newOwnerLabel', { defaultValue: 'New owner' })}
              </label>
              <select
                id={`reassign-${caseId}`}
                value={selectedUserId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setSelectedUserId(e.target.value)
                }
                disabled={usersQuery.isLoading || reassign.isPending}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/60"
              >
                <option value="">
                  {usersQuery.isLoading
                    ? t('common.loading', { defaultValue: 'Loading…' })
                    : t('riskTriage.reassign.selectPlaceholder', {
                        defaultValue: 'Select a person…',
                      })}
                </option>
                {grouped.map(([roleDisplay, users]) => (
                  <optgroup key={roleDisplay} label={roleDisplay}>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-ink-subtle">
                {t('riskTriage.reassign.notifyHint', {
                  defaultValue:
                    'Both the previous and new owner will receive an in-app notification.',
                })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={reassign.isPending}
          >
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          {!lockedReason && (
            <Button
              type="button"
              onClick={() => {
                if (!selectedUserId) return;
                reassign.mutate({ newUserId: Number(selectedUserId) });
              }}
              disabled={!selectedUserId || reassign.isPending}
            >
              {reassign.isPending
                ? t('common.submitting', { defaultValue: 'Reassigning…' })
                : t('riskTriage.reassign.confirm', { defaultValue: 'Reassign' })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReassignDialog;
