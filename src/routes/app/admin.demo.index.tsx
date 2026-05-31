/**
 * /app/admin/demo — Demo Control Panel (M17-M18 / CR-I+CR-J).
 *
 * Gated by demo.scenario.trigger permission.
 * T1 services, T2 React Query, T3 i18n, T4 three data states,
 * T5 semantic tokens (no raw hex), T6 a11y, T7 type safety (no any),
 * T8 zod resolver on reset form, T9 destructive confirmation,
 * T10 useDebounce on runs filter, T11 ErrorBoundary, T12 formatDateTime.
 * A7: apiClient only in service layer.
 * C13: no raw hex.
 * C14: Router Link for internal nav.
 * D6: htmlFor + id on inputs.
 * D7: scope="col" on table headers.
 */

import { useState, useRef, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  FlaskConical,
  AlertTriangle,
  Clock,
  Activity,
  History,
  RefreshCw,
  Play,
  Thermometer,
  CheckCircle2,
  XCircle,
  Timer,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { adminDemoHarnessService } from '@/services/api/admin/demo-harness.service';
import { useFocusTrap } from '@/components/common/useFocusTrap';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/utils/datetime';
import type { DemoScenarioListItem, DemoSubsystemHealth } from '@/types/admin/demo-harness.types';

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/app/admin/demo/')({
  component: () => (
    <ErrorBoundary>
      <AdminDemoControlPanel />
    </ErrorBoundary>
  ),
});

// ─── Reset form Zod schema ────────────────────────────────────────────────────

function buildResetSchema(todayLabel: string) {
  const expected = `RESET_DEMO_${todayLabel}`;
  return z.object({
    confirmToken: z
      .string()
      .min(1)
      .refine((v) => v === expected, { message: `Must be exactly: ${expected}` }),
  });
}

type ResetFormValues = { confirmToken: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SCENARIO_IDS = [
  'hormuz',
  'ofac_sanctions',
  'brent_review',
  'epc_sla',
  'renewal',
  'cyclone',
  'icv_shortfall',
  'esg_subcontractor',
] as const;

type ScenarioId = (typeof SCENARIO_IDS)[number];

function statusColor(status: 'ok' | 'degraded' | 'down'): string {
  if (status === 'ok') return 'text-success bg-success/10 border-success/30';
  if (status === 'degraded') return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-error bg-error/10 border-error/30';
}

function runBadgeClass(success: boolean): string {
  return success
    ? 'bg-success/10 text-success border border-success/30'
    : 'bg-error/10 text-error border border-error/30';
}

function tierBadge(tier: number): string {
  return tier === 1
    ? 'bg-primary/10 text-primary border border-primary/20'
    : 'bg-secondary/10 text-secondary border border-secondary/20';
}

// ─── Main component ───────────────────────────────────────────────────────────

function AdminDemoControlPanel() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const canTrigger = useAuthStore(selectHasPermission('demo.scenario.trigger'));
  const canReset = useAuthStore(selectHasPermission('demo.reset'));
  const canTimeFreeze = useAuthStore(selectHasPermission('demo.time_freeze.manage'));
  const canHealth = useAuthStore(selectHasPermission('demo.health_check.read'));

  if (!canTrigger) {
    return (
      <div className="mx-auto w-full max-w-[1400px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">{t('common.accessDenied')}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] space-y-8 p-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <FlaskConical className="h-6 w-6 text-primary" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold text-ink">{t('admin.demo.title')}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{t('admin.demo.subtitle')}</p>
        </div>
      </div>

      {/* Scenario Cards */}
      <section aria-labelledby="demo-scenarios-heading">
        <h2 id="demo-scenarios-heading" className="mb-4 text-lg font-semibold text-ink">
          {t('admin.demo.scenarioCards.sectionTitle')}
        </h2>
        <ScenarioCardsGrid isAr={isAr} />
      </section>

      {/* Health Check + Time Freeze side-by-side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {canHealth && (
          <section aria-labelledby="demo-health-heading">
            <h2 id="demo-health-heading" className="mb-4 text-lg font-semibold text-ink">
              {t('admin.demo.healthCheck.sectionTitle')}
            </h2>
            <HealthCheckPanel />
          </section>
        )}
        {canTimeFreeze && (
          <section aria-labelledby="demo-time-freeze-heading">
            <h2 id="demo-time-freeze-heading" className="mb-4 text-lg font-semibold text-ink">
              {t('admin.demo.timeFreeze.sectionTitle')}
            </h2>
            <TimeFreezePanel />
          </section>
        )}
      </div>

      {/* Reset section */}
      {canReset && (
        <section aria-labelledby="demo-reset-heading">
          <h2 id="demo-reset-heading" className="mb-4 text-lg font-semibold text-ink">
            {t('admin.demo.reset.sectionTitle')}
          </h2>
          <ResetSection />
        </section>
      )}

      {/* Scenario Runs Feed */}
      <section aria-labelledby="demo-runs-heading">
        <h2 id="demo-runs-heading" className="mb-4 text-lg font-semibold text-ink">
          {t('admin.demo.runs.sectionTitle')}
        </h2>
        <ScenarioRunsFeed />
      </section>
    </motion.div>
  );
}

// ─── Scenario Cards Grid ─────────────────────────────────────────────────────

function ScenarioCardsGrid({ isAr }: { isAr: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [inFlightId, setInFlightId] = useState<string | null>(null);
  const [lastRunMap, setLastRunMap] = useState<Record<string, { success: boolean; elapsedMs: number } | null>>({});

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'demo', 'scenarios'],
    queryFn: () => adminDemoHarnessService.listScenarios(true),
    staleTime: 30_000,
  });

  const triggerMutation = useMutation({
    mutationFn: (scenarioId: string) => adminDemoHarnessService.triggerScenario(scenarioId),
    onMutate: (scenarioId) => {
      setInFlightId(scenarioId);
    },
    onSettled: (result, _err, scenarioId) => {
      setInFlightId(null);
      if (result) {
        setLastRunMap((prev) => ({
          ...prev,
          [scenarioId]: { success: result.success, elapsedMs: result.elapsedMs },
        }));
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'demo', 'scenarios'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'demo', 'runs'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center" aria-busy="true">
        <svg className="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-error/30 bg-error/5 p-4" role="alert">
        <AlertTriangle className="h-5 w-5 text-error" aria-hidden="true" />
        <p className="text-sm text-error">{(error as Error)?.message ?? t('common.error')}</p>
        <Button variant="ghost" size="sm" onClick={() => void refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const scenarios = data ?? [];

  if (scenarios.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-card">
        <p className="text-sm text-ink-muted">{t('admin.demo.scenarioCards.empty')}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {scenarios.map((scenario) => (
        <ScenarioCard
          key={scenario.id}
          scenario={scenario}
          isAr={isAr}
          isInFlight={inFlightId === scenario.scenarioId}
          isDisabled={inFlightId !== null && inFlightId !== scenario.scenarioId}
          localResult={lastRunMap[scenario.scenarioId] ?? null}
          onTrigger={() => triggerMutation.mutate(scenario.scenarioId)}
        />
      ))}
    </div>
  );
}

// ─── Single Scenario Card ─────────────────────────────────────────────────────

interface ScenarioCardProps {
  scenario: DemoScenarioListItem;
  isAr: boolean;
  isInFlight: boolean;
  isDisabled: boolean;
  localResult: { success: boolean; elapsedMs: number } | null;
  onTrigger: () => void;
}

function ScenarioCard({ scenario, isAr, isInFlight, isDisabled, localResult, onTrigger }: ScenarioCardProps) {
  const { t } = useTranslation();
  const displayName = isAr ? scenario.displayNameAr : scenario.displayNameEn;

  // Determine status badge
  let statusNode: React.ReactNode;
  if (isInFlight) {
    statusNode = (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
        <Timer className="h-3 w-3 animate-pulse" aria-hidden="true" />
        {t('admin.demo.scenarioCards.status.running')}
      </span>
    );
  } else if (localResult !== null) {
    statusNode = localResult.success ? (
      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs text-success">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        {t('admin.demo.scenarioCards.status.success')}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full border border-error/30 bg-error/10 px-2 py-0.5 text-xs text-error">
        <XCircle className="h-3 w-3" aria-hidden="true" />
        {t('admin.demo.scenarioCards.status.failed')}
      </span>
    );
  } else if (scenario.lastRun) {
    statusNode = scenario.lastRun.success ? (
      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs text-success">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        {t('admin.demo.scenarioCards.status.success')}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full border border-error/30 bg-error/10 px-2 py-0.5 text-xs text-error">
        <XCircle className="h-3 w-3" aria-hidden="true" />
        {t('admin.demo.scenarioCards.status.failed')}
      </span>
    );
  } else {
    statusNode = (
      <span className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-ink-muted">
        {t('admin.demo.scenarioCards.status.neverRun')}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-ink leading-snug">{displayName}</span>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${tierBadge(scenario.tier)}`}>
          {t('admin.demo.scenarioCards.tier', { tier: scenario.tier })}
        </span>
      </div>

      <div>{statusNode}</div>

      {scenario.lastRun && !isInFlight && (
        <p className="text-xs text-ink-muted">
          {t('admin.demo.scenarioCards.lastRun')}{' '}
          {formatDateTime(scenario.lastRun.triggeredAt)}
        </p>
      )}

      <Button
        size="sm"
        variant="default"
        onClick={onTrigger}
        disabled={isDisabled || isInFlight || !scenario.isActive}
        aria-label={t('admin.demo.scenarioCards.triggerAriaLabel', { name: displayName })}
        className="mt-auto w-full"
      >
        {isInFlight ? (
          <>
            <svg className="mr-2 h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {t('admin.demo.scenarioCards.running')}
          </>
        ) : (
          <>
            <Play className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            {t('admin.demo.scenarioCards.trigger')}
          </>
        )}
      </Button>
    </div>
  );
}

// ─── Health Check Panel ───────────────────────────────────────────────────────

function HealthCheckPanel() {
  const { t } = useTranslation();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'demo', 'health'],
    queryFn: () => adminDemoHarnessService.healthCheck(),
    staleTime: 60_000,
  });

  const overallStatus = data?.overallStatus ?? 'ok';

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-ink-muted" aria-hidden="true" />
          <span className="text-sm font-medium text-ink">
            {t('admin.demo.healthCheck.overall')}{' '}
            <span className={`ml-1 inline-flex rounded-full border px-2 py-0.5 text-xs ${statusColor(overallStatus as 'ok' | 'degraded' | 'down')}`}>
              {t(`admin.demo.healthCheck.status.${overallStatus}`)}
            </span>
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label={t('admin.demo.healthCheck.refresh')}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span className="sr-only">{t('admin.demo.healthCheck.refresh')}</span>
        </Button>
      </div>

      {isLoading && (
        <div className="flex h-32 items-center justify-center" aria-busy="true">
          <svg className="h-6 w-6 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-3" role="alert">
          <p className="text-sm text-error">{(error as Error)?.message ?? t('common.error')}</p>
        </div>
      )}

      {!isLoading && !isError && data && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {/* BUG-012 fix (QA Phase 3 autonomous run 2026-05-31): the
              fn_pre_demo_health_check response can return the same subsystem
              name twice (e.g. storage / openai / smtp surface in both env
              probe + capability probe blocks). Using sub.name alone produced
              "two children with the same key" React warnings. Include array
              index for guaranteed uniqueness. */}
          {data.subsystems.map((sub, idx) => (
            <SubsystemTile key={`${sub.name}-${idx}`} subsystem={sub} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubsystemTile({ subsystem }: { subsystem: DemoSubsystemHealth }) {
  const { t } = useTranslation();
  const subsystemKey = subsystem.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

  return (
    <div
      className={`flex flex-col gap-1 rounded-lg border p-3 text-sm ${statusColor(subsystem.status)}`}
      title={subsystem.remediation ?? undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">
          {t(`admin.demo.healthCheck.subsystems.${subsystemKey}`, { defaultValue: subsystem.name })}
        </span>
        <span className="text-xs font-semibold uppercase">
          {t(`admin.demo.healthCheck.status.${subsystem.status}`)}
        </span>
      </div>
      {subsystem.lastChecked && (
        <span className="text-xs opacity-70">
          {t('admin.demo.healthCheck.lastChecked')} {formatDateTime(subsystem.lastChecked)}
        </span>
      )}
      {subsystem.remediation && subsystem.status !== 'ok' && (
        <span className="text-xs opacity-80 mt-0.5">{subsystem.remediation}</span>
      )}
    </div>
  );
}

// ─── Time Freeze Panel ────────────────────────────────────────────────────────

function TimeFreezePanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [targetValue, setTargetValue] = useState('');

  const { data: freezeState, isLoading } = useQuery({
    queryKey: ['admin', 'demo', 'time-freeze'],
    queryFn: () => adminDemoHarnessService.getCurrentFrozenTime(),
    staleTime: 10_000,
  });

  const freezeMutation = useMutation({
    mutationFn: (ts: string) => adminDemoHarnessService.setTimeFreeze(ts),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'demo', 'time-freeze'] });
      setTargetValue('');
    },
  });

  const unfreezeMutation = useMutation({
    mutationFn: () => adminDemoHarnessService.unfreezeTime(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'demo', 'time-freeze'] });
    },
  });

  const isFrozen = Boolean(freezeState?.frozenAt);
  const isBusy = freezeMutation.isPending || unfreezeMutation.isPending;

  // DEFECT-CRIJ-FE-3 fix: also read from DOM on submit. React 19 controlled-input
  // doesn't pick up programmatic .value = ... assignment from automation tools;
  // reading DOM at submit time keeps real-user typing AND automated test flows
  // both functional.
  const handleFreeze = () => {
    const domInput = document.getElementById('demo-time-freeze-picker') as HTMLInputElement | null;
    const value = targetValue || domInput?.value || '';
    if (!value) return;
    const ts = new Date(value).toISOString();
    freezeMutation.mutate(ts);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-ink-muted" aria-hidden="true" />
        <span className="text-sm font-medium text-ink">{t('admin.demo.timeFreeze.label')}</span>
      </div>

      {isLoading ? (
        <div className="h-8 animate-pulse rounded bg-muted" />
      ) : (
        <>
          {isFrozen && freezeState?.frozenAt && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-700">
                {t('admin.demo.timeFreeze.currentlyFrozen')}
              </p>
              <p className="mt-1 font-mono text-xs text-amber-600">
                fn_demo_now() = {formatDateTime(freezeState.frozenAt)}
              </p>
            </div>
          )}

          {!isFrozen && (
            <p className="mb-4 text-sm text-ink-muted">{t('admin.demo.timeFreeze.notFrozen')}</p>
          )}

          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="demo-time-freeze-picker" className="mb-1 block text-xs font-medium text-ink-muted">
                {t('admin.demo.timeFreeze.targetLabel')}
              </label>
              <input
                id="demo-time-freeze-picker"
                type="datetime-local"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={t('admin.demo.timeFreeze.targetLabel')}
              />
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={handleFreeze}
                disabled={isBusy}
                className="flex-1"
              >
                <Thermometer className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                {t('admin.demo.timeFreeze.freeze')}
              </Button>
              {isFrozen && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => unfreezeMutation.mutate()}
                  disabled={isBusy}
                  className="flex-1"
                >
                  {t('admin.demo.timeFreeze.unfreeze')}
                </Button>
              )}
            </div>

            {(freezeMutation.isError || unfreezeMutation.isError) && (
              <div className="rounded-lg border border-error/30 bg-error/5 p-2" role="alert">
                <p className="text-xs text-error">
                  {((freezeMutation.error ?? unfreezeMutation.error) as Error)?.message ?? t('common.error')}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Reset Section ────────────────────────────────────────────────────────────

function ResetSection() {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const todayLabel = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  return (
    <div className="rounded-xl border border-error/30 bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-error" aria-hidden="true" />
        <span className="font-medium text-ink">{t('admin.demo.reset.description')}</span>
      </div>
      <p className="mb-4 text-sm text-ink-muted">{t('admin.demo.reset.warning')}</p>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setIsModalOpen(true)}
      >
        {t('admin.demo.reset.button')}
      </Button>

      {isModalOpen && (
        <ResetConfirmModal
          todayLabel={todayLabel}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Reset Confirm Modal ──────────────────────────────────────────────────────

function ResetConfirmModal({ todayLabel, onClose }: { todayLabel: string; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  const expected = `RESET_DEMO_${todayLabel}`;
  const schema = buildResetSchema(todayLabel);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  const confirmValue = watch('confirmToken', '');

  const resetMutation = useMutation({
    mutationFn: ({ confirmToken }: ResetFormValues) =>
      adminDemoHarnessService.resetDemo(confirmToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'demo'] });
      onClose();
    },
  });

  const onSubmit = (values: ResetFormValues) => {
    resetMutation.mutate(values);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-error" aria-hidden="true" />
          <h2 id="reset-modal-title" className="text-lg font-semibold text-ink">
            {t('admin.demo.reset.modal.title')}
          </h2>
        </div>

        <p className="mb-4 text-sm text-ink-muted">
          {t('admin.demo.reset.modal.body', { token: expected })}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="reset-confirm-token" className="mb-1 block text-xs font-medium text-ink-muted">
              {t('admin.demo.reset.modal.inputLabel', { expected })}
            </label>
            <Input
              id="reset-confirm-token"
              type="text"
              placeholder={expected}
              autoComplete="off"
              aria-describedby={errors.confirmToken ? 'reset-token-error' : undefined}
              {...register('confirmToken')}
            />
            {errors.confirmToken && (
              <p id="reset-token-error" className="mt-1 text-xs text-error" role="alert">
                {errors.confirmToken.message}
              </p>
            )}
          </div>

          {resetMutation.isError && (
            <div className="rounded-lg border border-error/30 bg-error/5 p-3" role="alert">
              <p className="text-sm text-error">
                {(resetMutation.error as Error)?.message ?? t('common.error')}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={resetMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!isValid || resetMutation.isPending || confirmValue !== expected}
            >
              {resetMutation.isPending ? (
                <>
                  <svg className="mr-2 h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('admin.demo.reset.modal.resetting')}
                </>
              ) : (
                t('admin.demo.reset.modal.confirm')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Scenario Runs Feed ───────────────────────────────────────────────────────

function ScenarioRunsFeed() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [scenarioFilter, setScenarioFilter] = useState('');
  const [successFilter, setSuccessFilter] = useState<'all' | 'true' | 'false'>('all');

  const debouncedScenario = useDebounce(scenarioFilter, 300);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'demo', 'runs', { page, scenarioId: debouncedScenario, success: successFilter }],
    queryFn: () =>
      adminDemoHarnessService.listRuns({
        page,
        pageSize: 10,
        scenarioId: debouncedScenario || undefined,
        success: successFilter === 'all' ? undefined : successFilter === 'true',
      }),
    staleTime: 10_000,
  });

  const runs = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 border-b border-border p-4">
        <div className="relative min-w-[180px]">
          <label htmlFor="runs-scenario-filter" className="sr-only">
            {t('admin.demo.runs.filterByScenario')}
          </label>
          <Input
            id="runs-scenario-filter"
            type="text"
            value={scenarioFilter}
            onChange={(e) => { setScenarioFilter(e.target.value); setPage(1); }}
            placeholder={t('admin.demo.runs.filterByScenario')}
            className="text-sm"
          />
        </div>

        <div>
          <label htmlFor="runs-success-filter" className="sr-only">
            {t('admin.demo.runs.filterBySuccess')}
          </label>
          <select
            id="runs-success-filter"
            value={successFilter}
            onChange={(e) => { setSuccessFilter(e.target.value as 'all' | 'true' | 'false'); setPage(1); }}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">{t('admin.demo.runs.allOutcomes')}</option>
            <option value="true">{t('admin.demo.runs.successOnly')}</option>
            <option value="false">{t('admin.demo.runs.failedOnly')}</option>
          </select>
        </div>

        <Button variant="ghost" size="sm" onClick={() => void refetch()} aria-label={t('common.refresh')}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex h-32 items-center justify-center" aria-busy="true">
          <svg className="h-6 w-6 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="m-4 flex items-center gap-3 rounded-lg border border-error/30 bg-error/5 p-4" role="alert">
          <AlertTriangle className="h-5 w-5 text-error" aria-hidden="true" />
          <p className="text-sm text-error">{(error as Error)?.message ?? t('common.error')}</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && (
        <>
          {runs.length === 0 ? (
            <div className="flex h-24 items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <History className="h-4 w-4" aria-hidden="true" />
                {t('admin.demo.runs.empty')}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.demo.runs.columns.scenario')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.demo.runs.columns.triggeredBy')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.demo.runs.columns.triggeredAt')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.demo.runs.columns.elapsed')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.demo.runs.columns.outcome')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {runs.map((run) => (
                    <tr key={run.id} className="transition-colors hover:bg-surface/50">
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted">{run.scenarioId}</td>
                      <td className="px-4 py-3 text-ink">{run.triggeredByName ?? String(run.triggeredBy)}</td>
                      <td className="px-4 py-3 text-xs text-ink-muted">{formatDateTime(run.triggeredAt)}</td>
                      <td className="px-4 py-3 text-xs text-ink-muted">
                        {run.elapsedMs !== null ? `${run.elapsedMs}ms` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${runBadgeClass(run.success)}`}>
                          {run.success
                            ? t('admin.demo.runs.success')
                            : t('admin.demo.runs.failed')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-ink-muted">
                {t('common.pagination.showing', { count: runs.length, total: pagination.total })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label={t('common.pagination.prev')}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className="text-sm text-ink">{page} / {pagination.totalPages}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  aria-label={t('common.pagination.next')}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
