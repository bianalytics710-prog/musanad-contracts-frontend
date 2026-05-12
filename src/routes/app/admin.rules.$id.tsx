/**
 * /app/admin/rules/$id — Correlation Rule Edit/View Page (CR-E, S12 + S13 + S21)
 *
 * Friendly form mode PRIMARY (HITL Q5); raw YAML escape hatch via Advanced tab.
 * Includes test-against-fixture panel (S21).
 *
 * A7: all HTTP via rulesService.
 * C12: all text via t().
 * C13: semantic tokens only.
 * C14: Router Link for internal nav.
 * D7: scope="col" on all <th>.
 * D6: htmlFor + id matched on form fields.
 * WCAG 2.1 AA.
 */
import { useState, useEffect } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, AlertTriangle, RefreshCw, ArrowLeft, Play, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { rulesService } from '@/services/api/rules.service';
import { formatDateTime } from '@/utils/datetime';
import type { CorrelationRule, UpdateCorrelationRuleDto, CorrelationRuleFixtureSummary, RuleTestAgainstFixtureResult } from '@/types/entities/rule.types';

// ─── Zustand store for in-progress rule editor state ─────────────────────────
import { create } from 'zustand';

interface RuleEditorState {
  ruleId: number | null;
  friendlyForm: Record<string, string>;
  matchYaml: string;
  produceYaml: string;
  setRuleId: (id: number) => void;
  setFriendlyForm: (form: Record<string, string>) => void;
  setMatchYaml: (yaml: string) => void;
  setProduceYaml: (yaml: string) => void;
  reset: () => void;
}

const useRuleEditorStore = create<RuleEditorState>((set) => ({
  ruleId: null,
  friendlyForm: {},
  matchYaml: '',
  produceYaml: '',
  setRuleId: (id) => set({ ruleId: id }),
  setFriendlyForm: (form) => set({ friendlyForm: form }),
  setMatchYaml: (yaml) => set({ matchYaml: yaml }),
  setProduceYaml: (yaml) => set({ produceYaml: yaml }),
  reset: () => set({ ruleId: null, friendlyForm: {}, matchYaml: '', produceYaml: '' }),
}));

// ─── Form schema ──────────────────────────────────────────────────────────────

const ruleFormSchema = z.object({
  name: z.string().min(1, 'Required').max(200),
  nameAr: z.string().min(1, 'Required').max(200),
  scenario: z.string().max(100).optional(),
  enabled: z.boolean(),
  matchYaml: z.string().min(1, 'Required'),
  produceYaml: z.string().min(1, 'Required'),
  metaOwner: z.string().max(200).optional(),
  metaRationale: z.string().max(2000).optional(),
});

type RuleFormData = z.infer<typeof ruleFormSchema>;

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/app/admin/rules/$id')({
  component: () => (
    <ErrorBoundary>
      <AdminRuleEditPage />
    </ErrorBoundary>
  ),
});

function AdminRuleEditPage() {
  const { id } = Route.useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isAr = i18n.language?.startsWith('ar');
  const isNew = id === 'new';
  const ruleId = isNew ? null : parseInt(id, 10);

  const canRead = useAuthStore(selectHasPermission('rule.read'));
  const canManage = useAuthStore(selectHasPermission('rule.manage'));

  const [activeTab, setActiveTab] = useState<'friendly' | 'yaml'>('friendly');
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testFixtureId, setTestFixtureId] = useState('');
  const [testResult, setTestResult] = useState<RuleTestAgainstFixtureResult | null>(null);

  const editorStore = useRuleEditorStore();
  const qc = useQueryClient();

  const { data: rule, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['adminRule', ruleId],
    queryFn: () => rulesService.getById(ruleId!),
    enabled: !isNew && ruleId !== null && canRead,
    staleTime: 30_000,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isDirty } } = useForm<RuleFormData>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      name: '',
      nameAr: '',
      scenario: '',
      enabled: true,
      matchYaml: '',
      produceYaml: '',
      metaOwner: '',
      metaRationale: '',
    },
  });

  // Sync form when rule loads
  useEffect(() => {
    if (rule) {
      reset({
        name: rule.name,
        nameAr: rule.nameAr,
        scenario: rule.scenario ?? '',
        enabled: rule.enabled,
        matchYaml: editorStore.ruleId === rule.id && editorStore.matchYaml
          ? editorStore.matchYaml
          : rule.matchYaml,
        produceYaml: editorStore.ruleId === rule.id && editorStore.produceYaml
          ? editorStore.produceYaml
          : rule.produceYaml,
        metaOwner: rule.meta?.owner ?? '',
        metaRationale: rule.meta?.rationale ?? '',
      });
      editorStore.setRuleId(rule.id);
    }
  }, [rule]);

  // Sync YAML changes to store (to preserve on tab switch)
  const matchYaml = watch('matchYaml');
  const produceYaml = watch('produceYaml');
  useEffect(() => { editorStore.setMatchYaml(matchYaml); }, [matchYaml]);
  useEffect(() => { editorStore.setProduceYaml(produceYaml); }, [produceYaml]);

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateCorrelationRuleDto) =>
      isNew ? Promise.reject(new Error('Create not yet wired')) : rulesService.update(ruleId!, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['adminRules'] });
      void qc.invalidateQueries({ queryKey: ['adminRule', ruleId] });
      toast.success(t('admin.rules.saveSuccess'));
      editorStore.reset();
    },
    onError: (err: Error) => {
      toast.error(err.message || t('common.error'));
    },
  });

  const testMutation = useMutation({
    mutationFn: () =>
      rulesService.testAgainstFixture(ruleId!, { fixtureId: testFixtureId || undefined }),
    onSuccess: (result) => {
      setTestResult(result);
      toast.success(result.passed ? t('admin.rules.testPassed') : t('admin.rules.testFailed'));
    },
    onError: (err: Error) => {
      toast.error(err.message || t('common.error'));
    },
  });

  const onSubmit = (data: RuleFormData) => {
    saveMutation.mutate({
      name: data.name,
      nameAr: data.nameAr,
      scenario: data.scenario || undefined,
      enabled: data.enabled,
      matchYaml: data.matchYaml,
      produceYaml: data.produceYaml,
      meta: {
        owner: data.metaOwner || undefined,
        rationale: data.metaRationale || undefined,
        lastReviewed: new Date().toISOString().split('T')[0],
      },
    });
  };

  if (!canRead) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-8 text-center">
        <p className="text-ink-muted">{t('common.accessDenied')}</p>
      </div>
    );
  }

  if (!isNew && isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-muted" />
      </div>
    );
  }

  if (!isNew && isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-ink-muted">{error instanceof Error ? error.message : t('common.error')}</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="me-2 h-4 w-4" />
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const ruleName = isAr ? (rule?.nameAr ?? rule?.name) : rule?.name;

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link to="/app/admin/rules" className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('admin.rules.backToList')}
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {isNew ? t('admin.rules.newTitle') : (ruleName ?? t('admin.rules.editTitle'))}
          </h1>
          {!isNew && rule && (
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
              <span>
                {t('admin.rules.versionHash')}:{' '}
                <code className="font-mono" title={rule.versionHash}>
                  {rule.versionHash.substring(0, 8)}
                </code>
              </span>
              {rule.lastReviewedByName && (
                <span>
                  {t('admin.rules.lastReviewedBy')}: {rule.lastReviewedByName}
                  {rule.lastReviewedAt ? ` · ${formatDateTime(rule.lastReviewedAt)}` : ''}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {!isNew && canManage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTestPanelOpen((v) => !v)}
            >
              <Play className="me-2 h-3.5 w-3.5" />
              {t('admin.rules.testButton')}
            </Button>
          )}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 border-b border-border" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'friendly'}
          onClick={() => setActiveTab('friendly')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'friendly'
              ? 'border-b-2 border-ink text-ink'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {t('admin.rules.tab.friendly')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'yaml'}
          onClick={() => setActiveTab('yaml')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'yaml'
              ? 'border-b-2 border-ink text-ink'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {t('admin.rules.tab.yaml')}
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* Friendly form fields */}
        {activeTab === 'friendly' && (
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Name EN */}
            <div>
              <label htmlFor="rule-name" className="mb-1.5 block text-sm font-medium text-ink">
                {t('admin.rules.fields.name')} *
              </label>
              <input
                id="rule-name"
                type="text"
                {...register('name')}
                disabled={!canManage}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Name AR */}
            <div>
              <label htmlFor="rule-name-ar" className="mb-1.5 block text-sm font-medium text-ink">
                {t('admin.rules.fields.nameAr')} *
              </label>
              <input
                id="rule-name-ar"
                type="text"
                dir="rtl"
                {...register('nameAr')}
                disabled={!canManage}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
              {errors.nameAr && (
                <p className="mt-1 text-xs text-destructive">{errors.nameAr.message}</p>
              )}
            </div>

            {/* Scenario */}
            <div>
              <label htmlFor="rule-scenario" className="mb-1.5 block text-sm font-medium text-ink">
                {t('admin.rules.fields.scenario')}
              </label>
              <input
                id="rule-scenario"
                type="text"
                {...register('scenario')}
                disabled={!canManage}
                placeholder={t('admin.rules.fields.scenarioPlaceholder')}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
            </div>

            {/* Enabled */}
            <div className="flex items-center gap-3">
              <input
                id="rule-enabled"
                type="checkbox"
                {...register('enabled')}
                disabled={!canManage}
                className="h-4 w-4 rounded border-border focus:ring-ring"
              />
              <label htmlFor="rule-enabled" className="text-sm font-medium text-ink">
                {t('admin.rules.fields.enabled')}
              </label>
            </div>

            {/* Meta Owner */}
            <div>
              <label htmlFor="rule-meta-owner" className="mb-1.5 block text-sm font-medium text-ink">
                {t('admin.rules.fields.metaOwner')}
              </label>
              <input
                id="rule-meta-owner"
                type="text"
                {...register('metaOwner')}
                disabled={!canManage}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
            </div>

            {/* Meta Rationale */}
            <div className="sm:col-span-2">
              <label htmlFor="rule-meta-rationale" className="mb-1.5 block text-sm font-medium text-ink">
                {t('admin.rules.fields.metaRationale')}
              </label>
              <textarea
                id="rule-meta-rationale"
                {...register('metaRationale')}
                rows={3}
                disabled={!canManage}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
            </div>
          </div>
        )}

        {/* YAML escape hatch */}
        {activeTab === 'yaml' && (
          <div className="space-y-5">
            <div>
              <label htmlFor="rule-match-yaml" className="mb-1.5 block text-sm font-medium text-ink">
                {t('admin.rules.fields.matchYaml')} *
              </label>
              <textarea
                id="rule-match-yaml"
                {...register('matchYaml')}
                rows={12}
                disabled={!canManage}
                className="w-full rounded-md border border-border bg-surface font-mono px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                placeholder={t('admin.rules.fields.matchYamlPlaceholder')}
              />
              {errors.matchYaml && (
                <p className="mt-1 text-xs text-destructive">{errors.matchYaml.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="rule-produce-yaml" className="mb-1.5 block text-sm font-medium text-ink">
                {t('admin.rules.fields.produceYaml')} *
              </label>
              <textarea
                id="rule-produce-yaml"
                {...register('produceYaml')}
                rows={12}
                disabled={!canManage}
                className="w-full rounded-md border border-border bg-surface font-mono px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                placeholder={t('admin.rules.fields.produceYamlPlaceholder')}
              />
              {errors.produceYaml && (
                <p className="mt-1 text-xs text-destructive">{errors.produceYaml.message}</p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {canManage && (
          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Link to="/app/admin/rules">
              <Button type="button" variant="ghost" disabled={saveMutation.isPending}>
                {t('common.cancel')}
              </Button>
            </Link>
            <Button type="submit" disabled={saveMutation.isPending || (!isDirty && !isNew)}>
              {saveMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </div>
        )}
      </form>

      {/* Test-against-fixture panel */}
      {!isNew && testPanelOpen && rule && (
        <TestAgainstFixturePanel
          ruleId={ruleId!}
          fixtures={rule.fixtures ?? []}
          testFixtureId={testFixtureId}
          setTestFixtureId={setTestFixtureId}
          testResult={testResult}
          isLoading={testMutation.isPending}
          onTest={() => testMutation.mutate()}
          t={t}
        />
      )}
    </div>
  );
}

// ─── Test-against-fixture panel ───────────────────────────────────────────────

interface TestPanelProps {
  ruleId: number;
  fixtures: CorrelationRuleFixtureSummary[];
  testFixtureId: string;
  setTestFixtureId: (id: string) => void;
  testResult: RuleTestAgainstFixtureResult | null;
  isLoading: boolean;
  onTest: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function TestAgainstFixturePanel({
  fixtures,
  testFixtureId,
  setTestFixtureId,
  testResult,
  isLoading,
  onTest,
  t,
}: TestPanelProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <h3 className="text-base font-semibold text-ink">{t('admin.rules.testPanel.title')}</h3>
      <p className="text-sm text-ink-muted">{t('admin.rules.testPanel.subtitle')}</p>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="fixture-select" className="mb-1 block text-xs font-medium text-ink">
            {t('admin.rules.testPanel.fixtureLabel')}
          </label>
          <select
            id="fixture-select"
            value={testFixtureId}
            onChange={(e) => setTestFixtureId(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">{t('admin.rules.testPanel.fixtureAll')}</option>
            {fixtures.map((f) => (
              <option key={f.id} value={String(f.id)}>
                {f.fixtureId} — {f.description}
                {f.expectedMatch ? ` (${t('admin.rules.testPanel.positive')})` : ` (${t('admin.rules.testPanel.negative')})`}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" size="sm" onClick={onTest} disabled={isLoading}>
          {isLoading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Play className="me-2 h-4 w-4" />}
          {t('admin.rules.testPanel.runButton')}
        </Button>
      </div>

      {/* Result */}
      {testResult && (
        <div className={`rounded-md border p-4 ${testResult.passed ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
          <div className="flex items-center gap-2">
            {testResult.passed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <span className={`font-semibold text-sm ${testResult.passed ? 'text-emerald-700' : 'text-red-700'}`}>
              {testResult.passed ? t('admin.rules.testPanel.pass') : t('admin.rules.testPanel.fail')}
            </span>
            {testResult.durationMs != null && (
              <span className="text-xs text-ink-muted">
                {testResult.durationMs}ms
              </span>
            )}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-ink-muted mb-1">{t('admin.rules.testPanel.expected')}</p>
              <p className="text-sm font-medium text-ink">
                {testResult.expectedMatch ? t('admin.rules.testPanel.match') : t('admin.rules.testPanel.noMatch')}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted mb-1">{t('admin.rules.testPanel.actual')}</p>
              <p className="text-sm font-medium text-ink">
                {testResult.actualMatch ? t('admin.rules.testPanel.match') : t('admin.rules.testPanel.noMatch')}
              </p>
            </div>
          </div>

          {testResult.matchReason && (
            <div className="mt-3">
              <p className="text-xs font-medium text-ink-muted mb-1">{t('admin.rules.testPanel.matchReason')}</p>
              <p className="text-sm text-ink">{testResult.matchReason}</p>
            </div>
          )}

          {testResult.diffNotes && testResult.diffNotes.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-ink-muted mb-1">{t('admin.rules.testPanel.diffNotes')}</p>
              <ul className="list-disc list-inside space-y-1">
                {testResult.diffNotes.map((note, i) => (
                  <li key={i} className="text-sm text-ink-muted">{note}</li>
                ))}
              </ul>
            </div>
          )}

          {testResult.matchEvidence && Object.keys(testResult.matchEvidence).length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-ink-muted mb-1">{t('admin.rules.testPanel.evidence')}</p>
              <pre className="overflow-x-auto rounded bg-surface/80 p-2 text-xs text-ink-muted">
                {JSON.stringify(testResult.matchEvidence, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
