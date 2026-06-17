/**
 * RiskReviewQueue (Phase B + Phase E, 2026-06-13) — Risk Triage surface.
 *
 * Two routes:
 *   /app/admin/risk-review   — Platform Admin's system view  (variant='admin')
 *   /app/exec/risk-triage    — Executive's primary triage door (variant='exec')
 *
 * Both require risk.review.manage. Phase E grows the surface into a 2-tab
 * strip:
 *
 *   - "Tier 2 — needs your judgement"  (Phase C, unchanged behaviour;
 *     promote with optional pinned assignee + dismiss-as-noise + bulk)
 *   - "Tier 1 — auto-routed"           (Phase E, new; per-row Reassign +
 *     Mark as noise + View. Reassign locks once row.status !== 'open'.)
 *
 * Confirm-risk modal upgrades:
 *   - Phase C: static "Will be assigned to: {role}" text.
 *   - Phase E: dropdown of actual people in the resolved role, defaulted
 *     to the lightest-load suggested user. Submit posts {assignedUserId}
 *     to /api/v1/risk-cases/:id/promote (fn_risk_review_promote 3-arg).
 */
import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, ShieldCheck, ShieldOff, UserCog, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminSettingsService } from '@/services/api/admin-settings.service';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import {
  riskReviewService,
  type RiskReviewRow,
  type RiskTriageTier1Row,
} from '@/services/api/risk-review.service';
import { riskCaseService } from '@/services/api/risk-case.service';
import type { AssignableUser } from '@/types/risk-case.types';
import { RiskTypePill } from '@/components/risk/RiskTypePill';
import { OriginBadge } from '@/components/risk/OriginBadge';
import { TriageCaseDrawer } from './TriageCaseDrawer';
import { formatAedCompact } from '@/features/dashboards/components/dashboard-primitives';
import { formatDateTime } from '@/utils/datetime';
import { cn } from '@/lib/utils';
import ReassignDialog from './ReassignDialog';

export interface RiskReviewQueueProps {
  variant?: 'admin' | 'exec';
}

type TabKey = 'tier2' | 'tier1';

export function RiskReviewQueue({ variant = 'admin' }: RiskReviewQueueProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canManage = useAuthStore(selectHasPermission('risk.review.manage'));

  const [activeTab, setActiveTab] = useState<TabKey>('tier2');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState<RiskReviewRow | null>(null);
  const [reassigning, setReassigning] = useState<RiskTriageTier1Row | null>(null);
  // 691 — triage item being viewed in the in-context drawer (null = closed).
  const [viewing, setViewing] = useState<RiskReviewRow | null>(null);
  // Tier-2 confirm dropdown selection. Reset whenever `confirming` flips.
  const [pickedAssigneeId, setPickedAssigneeId] = useState<string>('');

  // Tier 2 — existing Phase C list. Always loaded so the badge counts stay
  // accurate even when the user is on the Tier 1 tab.
  const tier2Query = useQuery({
    queryKey: ['adminRiskReview', 25],
    queryFn: () => riskReviewService.list(25),
    staleTime: 30_000,
    enabled: canManage,
  });

  // Tier 1 — Phase E.3 oversight list. Loaded eagerly (like Tier 2) so the
  // tab's count badge is accurate on first paint, not only after a click.
  const tier1Query = useQuery({
    queryKey: ['riskTriageTier1', 50],
    queryFn: () => riskReviewService.tier1List(50),
    staleTime: 30_000,
    enabled: canManage,
  });

  // Phase D — pull the 3 Risk Triage SLA thresholds for per-row aging badges.
  const settingsQuery = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminSettingsService.list(),
    staleTime: 5 * 60_000,
    enabled: canManage,
  });
  const thresholds = useMemo(() => {
    const lookup = new Map<string, unknown>();
    for (const s of settingsQuery.data?.settings ?? []) {
      lookup.set(s.key, s.value);
    }
    const parseInt = (v: unknown, fallback: number): number => {
      const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
    };
    return {
      amberHours: parseInt(lookup.get('tier2AmberHours'), 72),
      redHours: parseInt(lookup.get('tier2RedHours'), 168),
      autoEscalateDays: parseInt(lookup.get('tier2AutoEscalateDays'), 14),
    };
  }, [settingsQuery.data]);

  // Phase E.1 — lightest-load suggestion for the row's resolved role.
  // Used only to compute the default selection + flag the suggested
  // user with a "(suggested)" badge in the dropdown.
  const suggestQuery = useQuery({
    queryKey: ['riskTriageAssigneeSuggest', confirming?.preview_role],
    queryFn: () => riskReviewService.assigneeSuggest(confirming!.preview_role!),
    staleTime: 60_000,
    enabled: !!confirming?.preview_role,
  });

  // mig 665 — the dropdown now spans all active users (any role), so
  // pull the assignable-users list and group them by role. The
  // suggestQuery above still drives the default selection + suggested
  // badge for the routed role.
  const allUsersQuery = useQuery({
    queryKey: ['riskTriageAllUsers'],
    queryFn: () => riskCaseService.assignableUsers(),
    staleTime: 60_000,
    enabled: confirming !== null,
  });

  const suggestedUserId = useMemo(() => {
    const rows = suggestQuery.data?.rows ?? [];
    const suggested = rows.find((r) => r.suggested);
    return suggested?.id ?? rows[0]?.id ?? '';
  }, [suggestQuery.data]);

  const groupedUsers = useMemo(() => {
    const users: AssignableUser[] = allUsersQuery.data ?? [];
    const map = new Map<string, AssignableUser[]>();
    for (const u of users) {
      const arr = map.get(u.roleDisplay) ?? [];
      arr.push(u);
      map.set(u.roleDisplay, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [allUsersQuery.data]);

  if (pickedAssigneeId === '' && suggestedUserId) {
    // Initialise on first render after suggestion data arrives.
    setPickedAssigneeId(suggestedUserId);
  }

  const tier2Rows: RiskReviewRow[] = useMemo(
    () => tier2Query.data?.rows ?? [],
    [tier2Query.data],
  );
  const tier1Rows: RiskTriageTier1Row[] = useMemo(
    () => tier1Query.data?.rows ?? [],
    [tier1Query.data],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['adminRiskReview'] });
    void queryClient.invalidateQueries({ queryKey: ['riskTriageTier1'] });
    void queryClient.invalidateQueries({ queryKey: ['riskCases'] });
    void queryClient.invalidateQueries({ queryKey: ['riskTriageSummary'] });
  };

  const promoteOne = useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: number | null }) =>
      riskReviewService.promote(id, userId),
    onSuccess: () => {
      toast.success(t('riskReview.toast.promoted', { defaultValue: 'Risk confirmed and routed' }));
      invalidate();
    },
    onError: () => toast.error(t('common.error', { defaultValue: 'Action failed' })),
  });

  const dismissOne = useMutation({
    mutationFn: (id: number) => riskReviewService.dismiss(id),
    onSuccess: () => {
      toast.success(t('riskReview.toast.dismissed', { defaultValue: 'Marked as noise' }));
      invalidate();
    },
    onError: () => toast.error(t('common.error', { defaultValue: 'Action failed' })),
  });

  const bulk = useMutation({
    mutationFn: ({ action, ids }: { action: 'promote' | 'dismiss'; ids: number[] }) =>
      riskReviewService.bulk(action, ids),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.action === 'promote'
          ? t('riskReview.toast.bulkPromoted', {
              defaultValue: '{{n}} risks confirmed',
              n: vars.ids.length,
            })
          : t('riskReview.toast.bulkDismissed', {
              defaultValue: '{{n}} marked as noise',
              n: vars.ids.length,
            }),
      );
      setSelected(new Set());
      invalidate();
    },
    onError: () => toast.error(t('common.error', { defaultValue: 'Action failed' })),
  });

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-amber/30 bg-amber/10 p-4">
          <p className="text-sm text-ink">
            {t('riskReview.permissionRequired', {
              defaultValue: 'You need the risk.review.manage permission to view this page.',
            })}
          </p>
        </div>
      </div>
    );
  }

  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAllVisible = () =>
    setSelected(new Set(tier2Rows.map((r) => Number(r.id))));
  const clearSelection = () => setSelected(new Set());

  // Header copy varies per variant. Body never does.
  const titleKey   = variant === 'exec' ? 'riskTriage.title'    : 'riskReview.adminTitle';
  const titleDef   = variant === 'exec' ? 'Risk Triage'         : 'Risk review';
  const subtitleKey =
    variant === 'exec' ? 'riskTriage.subtitle' : 'riskReview.adminSubtitle';
  const subtitleDef =
    variant === 'exec'
      ? 'Borderline alerts the engine routed here for your judgement, plus auto-routed Tier-1 cases for oversight. Switch between tabs to triage Tier-2 or override Tier-1 assignments.'
      : 'Borderline alerts the engine routed here for manual judgement (Tier-2), plus auto-routed Tier-1 cases for oversight. Switch between tabs to triage or reassign.';

  const tier2Count = tier2Rows.length;
  const tier1Count = tier1Rows.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1200px] space-y-4 p-6"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {t(titleKey, { defaultValue: titleDef })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t(subtitleKey, { defaultValue: subtitleDef })}
          </p>
        </div>
      </header>

      {/* Phase E — Tab strip. ARIA: tablist + tab + tabpanel. */}
      <div
        role="tablist"
        aria-label={t('riskTriage.tablistAria', { defaultValue: 'Risk Triage tier' })}
        className="flex flex-wrap gap-1 border-b border-border"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'tier2'}
          aria-controls="risk-triage-tier2-panel"
          id="risk-triage-tier2-tab"
          onClick={() => setActiveTab('tier2')}
          className={cn(
            'rounded-t-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gold/60',
            activeTab === 'tier2'
              ? 'border-b-2 border-gold text-ink'
              : 'text-ink-muted hover:text-ink',
          )}
        >
          {t('riskTriage.tab.tier2', { defaultValue: 'Tier 2 — needs your judgement' })}
          <span className="ml-2 rounded-full bg-amber/20 px-2 py-0.5 text-[10px] text-ink">
            {tier2Count}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'tier1'}
          aria-controls="risk-triage-tier1-panel"
          id="risk-triage-tier1-tab"
          onClick={() => setActiveTab('tier1')}
          className={cn(
            'rounded-t-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gold/60',
            activeTab === 'tier1'
              ? 'border-b-2 border-gold text-ink'
              : 'text-ink-muted hover:text-ink',
          )}
        >
          {t('riskTriage.tab.tier1', { defaultValue: 'Tier 1 — auto-routed' })}
          <span className="ml-2 rounded-full bg-sage/20 px-2 py-0.5 text-[10px] text-ink">
            {tier1Count}
          </span>
        </button>
      </div>

      {activeTab === 'tier2' && (
        <div
          role="tabpanel"
          id="risk-triage-tier2-panel"
          aria-labelledby="risk-triage-tier2-tab"
          className="space-y-4"
        >
          {tier2Rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={selected.size === tier2Rows.length ? clearSelection : selectAllVisible}
                className="rounded text-gold hover:underline focus:outline-none focus:ring-2 focus:ring-gold/60"
              >
                {selected.size === tier2Rows.length
                  ? t('riskReview.clearSelection', { defaultValue: 'Clear selection' })
                  : t('riskReview.selectAll', { defaultValue: 'Select all' })}
              </button>
              {selected.size > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => bulk.mutate({ action: 'promote', ids: [...selected] })}
                    disabled={bulk.isPending}
                    className="inline-flex items-center gap-1 rounded-md border border-sage/40 bg-sage/10 px-2 py-1 text-sage hover:bg-sage/20 focus:outline-none focus:ring-2 focus:ring-sage/60 disabled:opacity-50"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('riskReview.bulkConfirm', { defaultValue: 'Confirm {{n}}', n: selected.size })}
                  </button>
                  <button
                    type="button"
                    onClick={() => bulk.mutate({ action: 'dismiss', ids: [...selected] })}
                    disabled={bulk.isPending}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-ink-muted hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-gold/60 disabled:opacity-50"
                  >
                    <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('riskReview.bulkDismiss', { defaultValue: 'Mark {{n}} as noise', n: selected.size })}
                  </button>
                </>
              )}
            </div>
          )}

          {tier2Query.isLoading && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          )}

          {tier2Query.isError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {(tier2Query.error as Error)?.message ??
                t('common.error', { defaultValue: 'Failed to load Risk Review.' })}
            </div>
          )}

          {!tier2Query.isLoading && !tier2Query.isError && tier2Rows.length === 0 && (
            <p className="rounded-lg border border-border bg-card py-8 text-center text-sm text-ink-muted">
              {t('riskReview.empty', {
                defaultValue:
                  'No borderline alerts pending review. The engine routed everything with high confidence.',
              })}
            </p>
          )}

          {!tier2Query.isLoading && !tier2Query.isError && tier2Rows.length > 0 && (
            <Tier2List
              rows={tier2Rows}
              selected={selected}
              toggleOne={toggleOne}
              thresholds={thresholds}
              onConfirm={(row) => {
                setConfirming(row);
                setPickedAssigneeId('');
              }}
              onDismiss={(id) => dismissOne.mutate(id)}
              onView={(row) => setViewing(row)}
              dismissDisabled={dismissOne.isPending}
            />
          )}
        </div>
      )}

      {activeTab === 'tier1' && (
        <div
          role="tabpanel"
          id="risk-triage-tier1-panel"
          aria-labelledby="risk-triage-tier1-tab"
          className="space-y-4"
        >
          {tier1Query.isLoading && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          )}

          {tier1Query.isError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {(tier1Query.error as Error)?.message ??
                t('common.error', { defaultValue: 'Failed to load Tier-1 oversight.' })}
            </div>
          )}

          {!tier1Query.isLoading && !tier1Query.isError && tier1Rows.length === 0 && (
            <p className="rounded-lg border border-border bg-card py-8 text-center text-sm text-ink-muted">
              {t('riskTriage.tier1.empty', {
                defaultValue: 'No Tier-1 cases currently open. Auto-routed cases will appear here.',
              })}
            </p>
          )}

          {!tier1Query.isLoading && !tier1Query.isError && tier1Rows.length > 0 && (
            <Tier1List
              rows={tier1Rows}
              onReassign={(row) => setReassigning(row)}
              onDismiss={(id) => dismissOne.mutate(id)}
              dismissDisabled={dismissOne.isPending}
            />
          )}
        </div>
      )}

      {/* Confirm-risk modal (Tier-2 only) — Phase E.11 dropdown */}
      <Dialog
        open={confirming !== null}
        onOpenChange={(o) => {
          if (!o) {
            setConfirming(null);
            setPickedAssigneeId('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('riskReview.confirmModal.title', { defaultValue: 'Confirm risk assignment' })}
            </DialogTitle>
            <DialogDescription>
              {t('riskReview.confirmModal.body', {
                defaultValue:
                  'Pick the person to own this case. The dropdown defaults to the lightest-loaded user in the role the routing matrix resolved.',
              })}
            </DialogDescription>
          </DialogHeader>

          {confirming && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <RiskTypePill type={confirming.risk_type} />
                <span className="text-xs text-ink-subtle">
                  {t('riskReview.confidence', {
                    defaultValue: 'Confidence {{c}}',
                    c: (confirming.confidence * 100).toFixed(0) + '%',
                  })}
                </span>
              </div>
              <div className="rounded-md border border-border bg-paper-2 p-3">
                <p className="mb-1 text-xs text-ink-subtle">
                  {t('riskReview.confirmModal.targetRole', { defaultValue: 'Target role:' })}
                </p>
                <p className="text-base font-semibold text-ink">
                  {confirming.preview_role_display ??
                    t('riskReview.confirmModal.noMatch', { defaultValue: 'Operations (catch-all rule)' })}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {t('riskReview.confirmModal.sla', {
                    defaultValue: 'SLA: {{h}} hours',
                    h: confirming.preview_sla_hours ?? 24,
                  })}
                </p>
              </div>

              {confirming.preview_role && (
                <div>
                  <label
                    htmlFor="assignee-picker"
                    className="mb-1 block text-xs font-medium text-ink-subtle"
                  >
                    {t('riskReview.confirmModal.assigneeLabel', { defaultValue: 'Assign to' })}
                  </label>
                  <select
                    id="assignee-picker"
                    value={pickedAssigneeId}
                    onChange={(e) => setPickedAssigneeId(e.target.value)}
                    disabled={allUsersQuery.isLoading || promoteOne.isPending}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/60"
                  >
                    {allUsersQuery.isLoading && (
                      <option value="">{t('common.loading', { defaultValue: 'Loading…' })}</option>
                    )}
                    {/* mig 665 — dropdown now spans all active users grouped
                        by role. Default selection remains the lightest-load
                        user in the routed role (suggestQuery). */}
                    {!allUsersQuery.isLoading && groupedUsers.map(([roleDisplay, users]) => (
                      <optgroup key={roleDisplay} label={roleDisplay}>
                        {users.map((u) => {
                          const isSuggested = u.id === suggestedUserId;
                          return (
                            <option key={u.id} value={u.id}>
                              {u.name || u.email}
                              {isSuggested ? ' · ' + t('riskReview.confirmModal.suggestedTag', {
                                defaultValue: 'suggested (lightest load)',
                              }) : ''}
                            </option>
                          );
                        })}
                      </optgroup>
                    ))}
                    {!allUsersQuery.isLoading && groupedUsers.length === 0 && (
                      <option value="">
                        {t('riskReview.confirmModal.noPeople', {
                          defaultValue: 'No active users available to assign',
                        })}
                      </option>
                    )}
                  </select>
                  <p className="mt-1 text-[11px] text-ink-subtle">
                    {t('riskReview.confirmModal.dropdownHintAnyRole', {
                      defaultValue:
                        'Default is the lightest-loaded person in the routed role. Open the dropdown to pick someone from any role.',
                    })}
                  </p>
                </div>
              )}

              {confirming.contract_number && (
                <p className="text-xs text-ink-muted">
                  {t('riskReview.confirmModal.contract', { defaultValue: 'Contract:' })}{' '}
                  <span className="font-mono text-ink">{confirming.contract_number}</span>
                  {confirming.counterparty_name && (
                    <>
                      {' · '}
                      {confirming.counterparty_name}
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setConfirming(null);
                setPickedAssigneeId('');
              }}
              disabled={promoteOne.isPending}
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!confirming || !pickedAssigneeId) return;
                promoteOne.mutate(
                  { id: Number(confirming.id), userId: Number(pickedAssigneeId) },
                  {
                    onSuccess: () => {
                      setConfirming(null);
                      setPickedAssigneeId('');
                    },
                  },
                );
              }}
              /* Clean-workflow rule: Assign must pin a person. Block the
                 click when the dropdown is empty (loading, no candidates,
                 or user hasn't picked yet). The DB layer (mig 660) also
                 enforces this as defence in depth. */
              disabled={promoteOne.isPending || !pickedAssigneeId}
              title={
                !pickedAssigneeId
                  ? t('riskReview.confirmModal.pickPersonHint', {
                      defaultValue: 'Pick a person from the dropdown to enable Assign.',
                    })
                  : undefined
              }
            >
              {promoteOne.isPending
                ? t('common.submitting', { defaultValue: 'Assigning…' })
                : t('riskReview.confirmModal.assign', { defaultValue: 'Assign' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign dialog (Tier-1 only) */}
      {reassigning && (
        <ReassignDialog
          open={reassigning !== null}
          onOpenChange={(o) => !o && setReassigning(null)}
          caseId={Number(reassigning.id)}
          caseTitle={reassigning.title}
          currentAssigneeName={reassigning.assigned_user_name}
          currentAssigneeId={reassigning.assigned_user_id}
          lockedReason={
            reassigning.status !== 'open'
              ? t('riskTriage.reassign.lockTooltip', {
                  defaultValue: 'Receiver has already started — reassign locked.',
                })
              : null
          }
        />
      )}

      {/* 691 — in-context triage detail drawer (replaces nav to Risk Cases). */}
      <TriageCaseDrawer
        row={viewing}
        onClose={() => setViewing(null)}
        onConfirm={(row) => {
          setConfirming(row);
          setPickedAssigneeId('');
        }}
        onDismiss={(id) => dismissOne.mutate(id)}
        dismissDisabled={dismissOne.isPending}
      />
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tier 2 list row component — preserves Phase B/C/D rendering verbatim.
// ────────────────────────────────────────────────────────────────────────────
interface Tier2ListProps {
  rows: RiskReviewRow[];
  selected: Set<number>;
  toggleOne: (id: number) => void;
  thresholds: { amberHours: number; redHours: number; autoEscalateDays: number };
  onConfirm: (row: RiskReviewRow) => void;
  onDismiss: (id: number) => void;
  onView: (row: RiskReviewRow) => void;
  dismissDisabled: boolean;
}

function Tier2List({
  rows,
  selected,
  toggleOne,
  thresholds,
  onConfirm,
  onDismiss,
  onView,
  dismissDisabled,
}: Tier2ListProps) {
  const { t } = useTranslation();
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {rows.map((row) => {
        const id = Number(row.id);
        const isSelected = selected.has(id);
        const createdMs = Date.parse(row.created_at);
        const ageHours = Number.isFinite(createdMs)
          ? Math.max(0, Math.floor((Date.now() - createdMs) / 3_600_000))
          : null;
        const ageDays = ageHours != null ? Math.floor(ageHours / 24) : null;
        const isAuto = ageDays != null && ageDays >= thresholds.autoEscalateDays;
        const isRed   = ageHours != null && ageHours >= thresholds.redHours;
        const isAmber = !isRed && ageHours != null && ageHours >= thresholds.amberHours;
        const ageBadgeClass = isRed
          ? 'bg-[var(--terracotta)]/15 text-[var(--terracotta)] border-[var(--terracotta)]/40'
          : isAmber
          ? 'bg-[var(--gold)]/15 text-foreground border-[var(--gold)]/40'
          : 'bg-muted text-muted-foreground border-transparent';
        const ageLabel = ageHours == null
          ? null
          : ageHours < 24
          ? t('riskReview.ageHours', { defaultValue: 'Age {{h}}h', h: ageHours })
          : t('riskReview.ageDays', { defaultValue: 'Age {{d}}d', d: ageDays });

        return (
          <li
            key={row.id}
            className={cn(
              'flex items-start gap-3 p-3 transition-colors',
              isSelected ? 'bg-gold/5' : 'hover:bg-surface/50',
            )}
          >
            <input
              id={`risk-review-row-${row.id}`}
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleOne(id)}
              aria-label={t('riskReview.selectRowAria', { defaultValue: 'Select this case' })}
              className="mt-1 h-4 w-4 rounded border-border accent-primary"
            />
            <div className="flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <RiskTypePill type={row.risk_type} />
                <OriginBadge origin={row.risk_origin} />
                <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber">
                  {t('riskReview.tier2Badge', { defaultValue: 'Tier 2 · Review' })}
                </span>
                {ageLabel && (
                  <span className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                    ageBadgeClass,
                  )}>
                    {ageLabel}
                  </span>
                )}
                {isAuto && (
                  <span className="rounded-full bg-[var(--terracotta)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--terracotta)]">
                    {t('riskReview.autoEscalated', { defaultValue: 'Auto-escalated' })}
                  </span>
                )}
              </div>
              <p className="mb-1 text-sm font-medium text-ink">{row.title}</p>
              {row.description && <p className="mb-2 text-sm text-ink-muted">{row.description}</p>}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-subtle">
                {row.contract_id && row.contract_number && (
                  <Link
                    to="/app/contracts/$id"
                    params={{ id: row.contract_id }}
                    className="font-mono text-gold hover:underline focus:outline-none focus:ring-2 focus:ring-gold/60 rounded"
                  >
                    {row.contract_number}
                  </Link>
                )}
                {row.counterparty_name && <span>{row.counterparty_name}</span>}
                {row.value_aed && (
                  <span>
                    {t('riskReview.value', {
                      defaultValue: 'Value {{v}}',
                      v: formatAedCompact(Number(row.value_aed)),
                    })}
                  </span>
                )}
                <span>
                  {t('riskReview.confidence', {
                    defaultValue: 'Confidence {{c}}',
                    c: (row.confidence * 100).toFixed(0) + '%',
                  })}
                </span>
                <span>
                  {t('riskReview.occurredAt', {
                    defaultValue: 'received {{when}}',
                    when: formatDateTime(row.created_at),
                  })}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onConfirm(row)}
                className="inline-flex items-center gap-1 rounded-md border border-sage/40 bg-sage/10 px-2 py-1 text-xs text-sage hover:bg-sage/20 focus:outline-none focus:ring-2 focus:ring-sage/60 disabled:opacity-50"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t('riskReview.confirmRisk', { defaultValue: 'Confirm risk' })}
              </button>
              <button
                type="button"
                onClick={() => onDismiss(id)}
                disabled={dismissDisabled}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs text-ink-muted hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-gold/60 disabled:opacity-50"
              >
                <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                {t('riskReview.markNoise', { defaultValue: 'Mark as noise' })}
              </button>
              {/* 691 — View opens an in-context drawer (Confirm/Noise inside),
                  no longer navigates into the Risk Cases module. */}
              <button
                type="button"
                onClick={() => onView(row)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-ink-muted hover:bg-muted focus:outline-none focus:ring-2 focus:ring-gold/60"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                {t('riskReview.viewDetail', { defaultValue: 'View' })}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tier 1 list row component — Phase E.3.
// ────────────────────────────────────────────────────────────────────────────
interface Tier1ListProps {
  rows: RiskTriageTier1Row[];
  onReassign: (row: RiskTriageTier1Row) => void;
  onDismiss: (id: number) => void;
  dismissDisabled: boolean;
}

function Tier1List({ rows, onReassign, onDismiss, dismissDisabled }: Tier1ListProps) {
  const { t } = useTranslation();
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {rows.map((row) => {
        const id = Number(row.id);
        const reassignLocked = row.status !== 'open';
        return (
          <li key={row.id} className="flex items-start gap-3 p-3 transition-colors hover:bg-surface/50">
            <div className="flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <RiskTypePill type={row.risk_type} />
                <OriginBadge origin={row.risk_origin} />
                <span className="rounded-full bg-sage/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sage">
                  {t('riskTriage.tier1.badge', { defaultValue: 'Tier 1 · Auto-routed' })}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {row.status}
                </span>
                {reassignLocked && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--terracotta)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--terracotta)]"
                    title={t('riskTriage.reassign.lockTooltip', {
                      defaultValue: 'Receiver has already started — reassign locked.',
                    })}
                  >
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    {t('riskTriage.tier1.reassignLocked', { defaultValue: 'Reassign locked' })}
                  </span>
                )}
              </div>
              <p className="mb-1 text-sm font-medium text-ink">{row.title}</p>
              {row.description && <p className="mb-2 text-sm text-ink-muted">{row.description}</p>}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-subtle">
                {row.contract_id && row.contract_number && (
                  <Link
                    to="/app/contracts/$id"
                    params={{ id: row.contract_id }}
                    className="font-mono text-gold hover:underline focus:outline-none focus:ring-2 focus:ring-gold/60 rounded"
                  >
                    {row.contract_number}
                  </Link>
                )}
                {row.counterparty_name && <span>{row.counterparty_name}</span>}
                {row.value_aed && (
                  <span>
                    {t('riskReview.value', {
                      defaultValue: 'Value {{v}}',
                      v: formatAedCompact(Number(row.value_aed)),
                    })}
                  </span>
                )}
                <span>
                  {t('riskTriage.tier1.owner', {
                    defaultValue: 'Owner: {{name}}',
                    name: row.assigned_user_name ?? row.assigned_role,
                  })}
                </span>
                <span>
                  {t('riskReview.occurredAt', {
                    defaultValue: 'received {{when}}',
                    when: formatDateTime(row.created_at),
                  })}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onReassign(row)}
                disabled={reassignLocked}
                className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-2 py-1 text-xs text-ink hover:bg-gold/20 focus:outline-none focus:ring-2 focus:ring-gold/60 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  reassignLocked
                    ? t('riskTriage.reassign.lockTooltip', {
                        defaultValue: 'Receiver has already started — reassign locked.',
                      })
                    : undefined
                }
              >
                <UserCog className="h-3.5 w-3.5" aria-hidden="true" />
                {t('riskTriage.tier1.reassign', { defaultValue: 'Reassign' })}
              </button>
              <button
                type="button"
                onClick={() => onDismiss(id)}
                disabled={dismissDisabled}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs text-ink-muted hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-gold/60 disabled:opacity-50"
              >
                <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                {t('riskReview.markNoise', { defaultValue: 'Mark as noise' })}
              </button>
              {row.contract_id && (
                <Link
                  to="/app/risk-cases/$caseId"
                  params={{ caseId: row.id }}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-ink-muted hover:bg-muted focus:outline-none focus:ring-2 focus:ring-gold/60"
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('riskReview.viewDetail', { defaultValue: 'View' })}
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default RiskReviewQueue;
