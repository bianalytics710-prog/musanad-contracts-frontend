/**
 * CreateRiskCaseDialog — manual risk case creation (S-K-2; reworked 2026-06-17).
 *
 * Captures: Contract (typeahead — type a contract number, pick from suggestions),
 * Risk type, Priority, Assigned to (persona), Due date. On save the case is
 * created with case_type='manual' (Origin = Manual) + status='open'; the chosen
 * risk type is stored in metadata.riskType and the due date becomes sla_hours.
 * Counterparty is resolved server-side from the contract.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { riskCaseService } from '@/services/api/risk-case.service';
import { chatMentionsService } from '@/services/api/chat-mentions.service';
import { useDebounce } from '@/hooks/useDebounce';
import { translateApiError } from '@/lib/translate-api-error';
import { RISK_CASE_PRIORITIES } from '@/types/risk-case.types';
import { RISK_TYPE_SLUGS } from '@/components/risk/RiskTypePill';
import type { CreateRiskCaseDto, RiskCasePriority } from '@/types/risk-case.types';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultContractId?: number | null;
}

interface ContractPick {
  id: number;
  label: string;
}

export function CreateRiskCaseDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [contract, setContract] = useState<ContractPick | null>(null);
  const [contractQuery, setContractQuery] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [riskType, setRiskType] = useState<string>('');
  const [priority, setPriority] = useState<RiskCasePriority>('medium');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const blurTimer = useRef<number | null>(null);

  const debouncedQuery = useDebounce(contractQuery, 250);

  // Contract typeahead — only fires once the user has typed 2+ chars and hasn't
  // already locked in a selection that matches the box.
  const { data: contractResults } = useQuery({
    queryKey: ['contractTypeahead', debouncedQuery],
    queryFn: () => chatMentionsService.searchContracts(debouncedQuery, 8),
    enabled: open && debouncedQuery.trim().length >= 2 && contract?.label !== contractQuery,
    staleTime: 30_000,
  });

  // Assignable personas for the "Assigned to" dropdown.
  const { data: assignableUsers = [] } = useQuery({
    queryKey: ['assignableUsers'],
    queryFn: () => riskCaseService.assignableUsers(),
    enabled: open,
    staleTime: 60_000,
  });

  const reset = () => {
    setContract(null);
    setContractQuery('');
    setShowSuggest(false);
    setRiskType('');
    setPriority('medium');
    setAssigneeId('');
    setDueDate('');
    setErr(null);
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateRiskCaseDto) => riskCaseService.create(payload),
    onSuccess: () => {
      toast.success(t('riskCases.toasts.created'));
      void qc.invalidateQueries({ queryKey: ['riskCases'] });
      reset();
      onClose();
    },
    onError: (e: unknown) => toast.error(translateApiError(e, t, 'riskCases.errors.createFailed')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!contract) {
      setErr(t('riskCases.create.errContract', { defaultValue: 'Select a contract.' }));
      return;
    }
    if (!riskType) {
      setErr(t('riskCases.create.errRiskType', { defaultValue: 'Select a risk type.' }));
      return;
    }
    const assignee = assignableUsers.find((u) => u.id === assigneeId);
    if (!assignee) {
      setErr(t('riskCases.create.errAssignee', { defaultValue: 'Select who this is assigned to.' }));
      return;
    }
    if (!dueDate) {
      setErr(t('riskCases.create.errDueDate', { defaultValue: 'Pick a due date.' }));
      return;
    }
    // Due date → sla_hours (whole hours from now, min 1). Past dates rejected.
    const slaHours = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 3_600_000);
    if (!Number.isFinite(slaHours) || slaHours < 1) {
      setErr(t('riskCases.create.errDueFuture', { defaultValue: 'Due date must be in the future.' }));
      return;
    }

    const riskTypeLabel = t(`riskTypes.${riskType}`, { defaultValue: riskType });
    const payload: CreateRiskCaseDto = {
      contractId: contract.id,
      priority,
      // Auto-title from the risk type + contract so the row reads cleanly.
      title: `${riskTypeLabel} — ${contract.label}`.slice(0, 500),
      assignedRole: assignee.roleName,
      assignedUserId: Number(assignee.id),
      slaHours,
      metadata: { riskType },
    };
    createMutation.mutate(payload);
  };

  const suggestions = contractResults?.results ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t('riskCases.create.title')}</DialogTitle>
          <DialogDescription>{t('riskCases.create.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Contract typeahead */}
          <div className="relative">
            <label htmlFor="rc-create-contract" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.fields.contract', { defaultValue: 'Contract' })}
              <span className="text-error ms-1" aria-hidden="true">*</span>
            </label>
            <Input
              id="rc-create-contract"
              value={contractQuery}
              autoComplete="off"
              placeholder={t('riskCases.create.contractPlaceholder', {
                defaultValue: 'Type a contract number…',
              })}
              onChange={(e) => {
                setContractQuery(e.target.value);
                setContract(null);
                setShowSuggest(true);
              }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => {
                blurTimer.current = window.setTimeout(() => setShowSuggest(false), 150);
              }}
            />
            {showSuggest && suggestions.length > 0 && !contract && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                {suggestions.map((s) => (
                  <li key={s.id ?? s.label}>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-start text-sm hover:bg-surface focus:bg-surface focus:outline-none"
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => {
                        if (s.id == null) return;
                        setContract({ id: s.id, label: s.label });
                        setContractQuery(s.label);
                        setShowSuggest(false);
                        if (blurTimer.current) window.clearTimeout(blurTimer.current);
                      }}
                    >
                      <span className="font-medium text-ink">{s.label}</span>
                      {s.subLabel && <span className="ms-2 text-xs text-ink-muted">{s.subLabel}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {contract && (
              <p className="mt-1 text-xs text-sage">
                {t('riskCases.create.contractSelected', { defaultValue: 'Selected: {{label}}', label: contract.label })}
              </p>
            )}
          </div>

          {/* Risk type */}
          <div>
            <label htmlFor="rc-create-risktype" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.columns.riskType', { defaultValue: 'Risk type' })}
              <span className="text-error ms-1" aria-hidden="true">*</span>
            </label>
            <select
              id="rc-create-risktype"
              value={riskType}
              onChange={(e) => setRiskType(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{t('riskCases.filters.allRiskTypes', { defaultValue: 'Select…' })}</option>
              {RISK_TYPE_SLUGS.map((slug) => (
                <option key={slug} value={slug}>
                  {t(`riskTypes.${slug}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label htmlFor="rc-create-priority" className="mb-1 block text-sm font-medium text-ink">
                {t('riskCases.fields.priority')}
                <span className="text-error ms-1" aria-hidden="true">*</span>
              </label>
              <select
                id="rc-create-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as RiskCasePriority)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {RISK_CASE_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`riskCases.priorities.${p}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Due date */}
            <div>
              <label htmlFor="rc-create-due" className="mb-1 block text-sm font-medium text-ink">
                {t('riskCases.fields.dueAt', { defaultValue: 'Due date' })}
                <span className="text-error ms-1" aria-hidden="true">*</span>
              </label>
              <Input
                id="rc-create-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Assigned to (persona) */}
          <div>
            <label htmlFor="rc-create-assignee" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.columns.assignedTo', { defaultValue: 'Assigned to' })}
              <span className="text-error ms-1" aria-hidden="true">*</span>
            </label>
            <select
              id="rc-create-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{t('riskCases.create.selectAssignee', { defaultValue: 'Select a person…' })}</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.roleDisplay}
                </option>
              ))}
            </select>
          </div>

          {err && <p className="text-xs text-error">{err}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset();
                onClose();
              }}
              disabled={createMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? t('common.creating') : t('common.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
