/**
 * /app/admin/risk-routing — Phase B.3 routing-matrix admin (mig 549/550).
 *
 * Surfaces the rules that auto-route newly-created risk cases to the
 * correct role pool. Platform_admin can add, edit, or disable rules
 * without running a migration. Rules are evaluated first-match by
 * rule_order ASC inside fn_risk_case_classify_and_route — so reordering
 * matters.
 *
 * Gated by risk.routing.manage (granted to platform_admin + Super Admin).
 */
import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import {
  riskRoutingService,
  type RiskRoutingRule,
  type RoutingRuleInput,
} from '@/services/api/risk-routing.service';
import { RISK_TYPE_SLUGS } from '@/components/risk/RiskTypePill';

export const Route = createFileRoute('/app/admin/risk-routing')({
  component: () => (
    <ErrorBoundary>
      <RiskRoutingPage />
    </ErrorBoundary>
  ),
});

const CASE_TYPES = ['correlation_alert', 'sla_breach', 'manual', 'obligation_due', 'system'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const ROLES = [
  'compliance_esg',
  'legal_counsel',
  'finance_treasury',
  'procurement_supplier_risk',
  'operations',
  'contract_approver',
  'executive',
] as const;

const ROLE_DISPLAY: Record<string, string> = {
  compliance_esg: 'Compliance & ESG',
  legal_counsel: 'Legal Counsel',
  finance_treasury: 'Finance & Treasury',
  procurement_supplier_risk: 'Procurement & Supplier Risk',
  operations: 'Operations',
  contract_approver: 'Contract Approver',
  executive: 'Executive',
};

function emptyInput(): RoutingRuleInput {
  return {
    ruleOrder: 100,
    caseType: null,
    riskType: null,
    priorityMin: null,
    contractType: null,
    assignedRole: 'operations',
    slaHours: 24,
    materialityFloorAed: 1_000_000,
    confidenceFloor: 0.85,
    description: null,
    isActive: true,
  };
}

function RiskRoutingPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canManage = useAuthStore(selectHasPermission('risk.routing.manage'));

  const { data: rules = [], isLoading, isError } = useQuery({
    queryKey: ['adminRiskRouting'],
    queryFn: () => riskRoutingService.list(),
    enabled: canManage,
  });

  const [editing, setEditing] = useState<RiskRoutingRule | null>(null);
  const [creating, setCreating] = useState(false);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['adminRiskRouting'] });

  const createMutation = useMutation({
    mutationFn: (input: RoutingRuleInput) => riskRoutingService.create(input),
    onSuccess: () => {
      toast.success(t('riskRouting.toast.created', { defaultValue: 'Rule created' }));
      setCreating(false);
      invalidate();
    },
    onError: () => toast.error(t('common.error', { defaultValue: 'Action failed' })),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: RoutingRuleInput }) =>
      riskRoutingService.update(id, input),
    onSuccess: () => {
      toast.success(t('riskRouting.toast.updated', { defaultValue: 'Rule updated' }));
      setEditing(null);
      invalidate();
    },
    onError: () => toast.error(t('common.error', { defaultValue: 'Action failed' })),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => riskRoutingService.remove(id),
    onSuccess: () => {
      toast.success(t('riskRouting.toast.removed', { defaultValue: 'Rule disabled' }));
      invalidate();
    },
    onError: () => toast.error(t('common.error', { defaultValue: 'Action failed' })),
  });

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-amber/30 bg-amber/10 p-4">
          <p className="text-sm text-ink">
            {t('riskRouting.permissionRequired', {
              defaultValue:
                'You need the risk.routing.manage permission to view this page.',
            })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1200px] space-y-4 p-6"
    >
      <header className="flex items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {t('riskRouting.title', { defaultValue: 'Risk routing matrix' })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t('riskRouting.subtitle', {
              defaultValue:
                'Rules evaluated first-match by order. Each new risk case lands in the matching role queue with the rule\'s SLA.',
            })}
          </p>
        </div>
        <Button onClick={() => setCreating(true)} size="sm">
          <Plus className="me-1 h-4 w-4" aria-hidden="true" />
          {t('riskRouting.addRule', { defaultValue: 'Add rule' })}
        </Button>
      </header>

      {isLoading && <div className="h-32 animate-pulse rounded-md bg-muted" />}
      {isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {t('common.error', { defaultValue: 'Failed to load rules.' })}
        </div>
      )}

      {!isLoading && !isError && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface">
              <tr className="text-left">
                {[
                  'order',
                  'caseType',
                  'riskType',
                  'priorityMin',
                  'assignedRole',
                  'sla',
                  'materiality',
                  'confidence',
                  'status',
                  'actions',
                ].map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
                  >
                    {t(`riskRouting.col.${c}`, { defaultValue: c })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rules.map((r) => (
                <tr key={r.id} className={r.isActive ? '' : 'opacity-60'}>
                  <td className="px-3 py-2 font-mono text-xs">{r.ruleOrder}</td>
                  <td className="px-3 py-2 text-xs">{r.caseType ?? '*'}</td>
                  <td className="px-3 py-2 text-xs">{r.riskType ?? '*'}</td>
                  <td className="px-3 py-2 text-xs">{r.priorityMin ?? '*'}</td>
                  <td className="px-3 py-2 text-xs font-medium text-ink">
                    {ROLE_DISPLAY[r.assignedRole] ?? r.assignedRole}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.slaHours}h</td>
                  <td className="px-3 py-2 text-xs">
                    {r.materialityFloorAed != null
                      ? `AED ${(r.materialityFloorAed / 1_000_000).toFixed(1)}M`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.confidenceFloor != null ? r.confidenceFloor.toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.isActive
                      ? t('riskRouting.active', { defaultValue: 'Active' })
                      : t('riskRouting.disabled', { defaultValue: 'Disabled' })}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        className="rounded p-1 text-ink-muted hover:bg-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-gold/60"
                        aria-label={t('riskRouting.edit', { defaultValue: 'Edit rule' })}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      {r.isActive && (
                        <button
                          type="button"
                          onClick={() => removeMutation.mutate(r.id)}
                          disabled={removeMutation.isPending}
                          className="rounded p-1 text-ink-muted hover:bg-muted hover:text-destructive focus:outline-none focus:ring-2 focus:ring-destructive/60"
                          aria-label={t('riskRouting.disable', { defaultValue: 'Disable rule' })}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RuleDialog
        open={creating}
        initial={emptyInput()}
        title={t('riskRouting.createTitle', { defaultValue: 'Add routing rule' })}
        onClose={() => setCreating(false)}
        onSave={(input) => createMutation.mutate(input)}
        pending={createMutation.isPending}
      />
      <RuleDialog
        open={!!editing}
        initial={
          editing
            ? {
                ruleOrder: editing.ruleOrder,
                caseType: editing.caseType,
                riskType: editing.riskType,
                priorityMin: editing.priorityMin,
                contractType: editing.contractType,
                assignedRole: editing.assignedRole,
                slaHours: editing.slaHours,
                materialityFloorAed: editing.materialityFloorAed,
                confidenceFloor: editing.confidenceFloor,
                description: editing.description,
                isActive: editing.isActive,
              }
            : emptyInput()
        }
        title={t('riskRouting.editTitle', { defaultValue: 'Edit routing rule' })}
        onClose={() => setEditing(null)}
        onSave={(input) => editing && updateMutation.mutate({ id: editing.id, input })}
        pending={updateMutation.isPending}
      />
    </motion.div>
  );
}

function RuleDialog({
  open,
  initial,
  title,
  onClose,
  onSave,
  pending,
}: {
  open: boolean;
  initial: RoutingRuleInput;
  title: string;
  onClose: () => void;
  onSave: (input: RoutingRuleInput) => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<RoutingRuleInput>(initial);
  // Re-sync when initial changes (e.g. opening edit on a new row)
  useStateSync(form, initial, setForm, open);

  const update = <K extends keyof RoutingRuleInput>(k: K, v: RoutingRuleInput[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('riskRouting.col.order', { defaultValue: 'Rule order' })}>
            <Input
              type="number"
              value={form.ruleOrder}
              onChange={(e) => update('ruleOrder', Number(e.target.value))}
            />
          </Field>
          <Field label={t('riskRouting.col.assignedRole', { defaultValue: 'Assigned role' })}>
            <select
              value={form.assignedRole}
              onChange={(e) => update('assignedRole', e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_DISPLAY[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('riskRouting.col.caseType', { defaultValue: 'Case type' })}>
            <select
              value={form.caseType ?? ''}
              onChange={(e) => update('caseType', e.target.value || null)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
            >
              <option value="">{t('riskRouting.any', { defaultValue: '* (any)' })}</option>
              {CASE_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('riskRouting.col.riskType', { defaultValue: 'Risk type' })}>
            <select
              value={form.riskType ?? ''}
              onChange={(e) => update('riskType', e.target.value || null)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
            >
              <option value="">{t('riskRouting.any', { defaultValue: '* (any)' })}</option>
              {RISK_TYPE_SLUGS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('riskRouting.col.priorityMin', { defaultValue: 'Priority floor' })}>
            <select
              value={form.priorityMin ?? ''}
              onChange={(e) => update('priorityMin', e.target.value || null)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
            >
              <option value="">{t('riskRouting.any', { defaultValue: '* (any)' })}</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('riskRouting.col.sla', { defaultValue: 'SLA (hours)' })}>
            <Input
              type="number"
              value={form.slaHours}
              onChange={(e) => update('slaHours', Number(e.target.value))}
            />
          </Field>
          <Field label={t('riskRouting.col.materiality', { defaultValue: 'Materiality floor (AED)' })}>
            <Input
              type="number"
              value={form.materialityFloorAed ?? 0}
              onChange={(e) => update('materialityFloorAed', Number(e.target.value))}
            />
          </Field>
          <Field label={t('riskRouting.col.confidence', { defaultValue: 'Confidence floor' })}>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={form.confidenceFloor ?? 0.85}
              onChange={(e) => update('confidenceFloor', Number(e.target.value))}
            />
          </Field>
          <Field label={t('riskRouting.col.description', { defaultValue: 'Description' })} cols={2}>
            <Input
              value={form.description ?? ''}
              onChange={(e) => update('description', e.target.value || null)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button type="button" onClick={() => onSave(form)} disabled={pending}>
            {pending
              ? t('common.submitting', { defaultValue: 'Saving…' })
              : t('common.save', { defaultValue: 'Save' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  cols = 1,
  children,
}: {
  label: string;
  cols?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <label className={cols === 2 ? 'col-span-2' : undefined}>
      <span className="mb-1 block text-xs font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

// Tiny helper that re-syncs form state when the dialog's initial prop
// changes (e.g. opening an edit dialog on a different rule).
function useStateSync<T>(
  current: T,
  next: T,
  setState: (t: T) => void,
  isOpen: boolean,
) {
  // Re-sync only when the dialog (re)opens — avoids overwriting user
  // edits while the dialog is already open.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [openSnapshot, setOpenSnapshot] = useState(isOpen);
  if (isOpen !== openSnapshot) {
    setOpenSnapshot(isOpen);
    if (isOpen) setState(next);
  }
}
