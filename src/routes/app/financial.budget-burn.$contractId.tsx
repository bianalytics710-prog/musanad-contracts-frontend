/**
 * /app/financial/budget-burn/:contractId — Contract detail view.
 *
 * CR-N — M21 Financial Intelligence. Primary persona: finance_treasury.
 * CR-R — Tabbed refactor + 4 recharts visualisations + shared chart components.
 *
 * Tabs (useState, NOT nested routes — URLs preserved per demo runbook):
 *   1. Overview            — KPI strip + variance alert + contract header
 *   2. Period × Category   — stacked-bar chart + drill-down tables
 *   3. Variance & Clauses  — variance alert + CorrelatedClausesSection
 *   4. Projection          — year-end projection card + projection gauge
 *   5. Trends              — cumulative-burn line + day-rate trend line
 *
 * Charts:
 *   #1 Cumulative-burn LINE chart             (Trends tab)
 *   #2 Period × cost-category STACKED BAR     (Period × Category tab)
 *   #3 Year-end projection GAUGE (PieChart)   (Projection tab)
 *   #4 Monthly day-rate trend LINE chart      (Trends tab)
 *
 * Standards: A7, C13, C14, D6, D7, T3, T4, T10, T11, T12, WCAG AA, RTL logical classes.
 */
import { useState, useMemo, useRef } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  RefreshCcw,
  FileEdit,
  TrendingUp,
  TrendingDown,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  ReferenceLine,
  ReferenceDot,
  Label,
  ResponsiveContainer,
} from 'recharts';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { ChartCard, SemanticTooltip } from '@/components/charts';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { financialBudgetBurnService } from '@/services/api/financial-budget-burn.service';
import { translateApiError } from '@/lib/translate-api-error';
import { cn } from '@/lib/utils';
import type {
  BudgetBurnByPeriod,
  BudgetBurnByCategory,
  VarianceBreach,
  CorrelatedClauseRef,
  LdClauseRef,
  BudgetYearEndProjection,
  ProjectionConfidence,
  CumulativeBurnRow,
  MonthlyActualRow,
} from '@/types/entities/budget-burn.types';

export const Route = createFileRoute(
  '/app/financial/budget-burn/$contractId',
)({
  component: () => (
    <ErrorBoundary>
      <BudgetBurnDetailView />
    </ErrorBoundary>
  ),
});

// ─────────────────────────────────────────────────────────────
// Tab identifiers
// ─────────────────────────────────────────────────────────────
type TabId = 'overview' | 'periodCategory' | 'varianceClauses' | 'projection' | 'trends';

// ─────────────────────────────────────────────────────────────
// AED formatter — parse string→float, full and compact (C13: no raw hex)
// ─────────────────────────────────────────────────────────────
function formatAedFull(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '—';
  const n = parseFloat(raw);
  if (isNaN(n)) return '—';
  try {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `AED ${n.toFixed(0)}`;
  }
}

function formatAedCompact(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '—';
  const n = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (isNaN(n)) return '—';
  try {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  } catch {
    if (n >= 1_000_000_000) return `AED ${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
    return `AED ${n.toFixed(0)}`;
  }
}

// ─────────────────────────────────────────────────────────────
// Confidence badge colours (C13 — semantic tokens only)
// ─────────────────────────────────────────────────────────────
const CONFIDENCE_COLORS: Record<ProjectionConfidence, string> = {
  high:              'bg-success/10 text-success border-success/30',
  medium:            'bg-warning/10 text-warning border-warning/30',
  low:               'bg-amber/10 text-amber border-amber/30',
  insufficient_data: 'bg-muted text-ink-muted border-border',
};

// ─────────────────────────────────────────────────────────────
// Chart color tokens — oklch(var(--chart-N)) per CR-R spec
// ─────────────────────────────────────────────────────────────
const C1 = 'var(--chart-1)'; // gold
const C2 = 'var(--chart-2)'; // sage
const C3 = 'var(--chart-3)'; // slate
const C4 = 'var(--chart-4)'; // terracotta
// ink-muted for dashed reference line
const INK_MUTED = 'var(--ink-muted)';

// Contracted day-rate ceiling: AED 730k/rig/day × 2 rigs × 30 days = AED 43,800,000/month.
// Source: HERO-001 LD clause parameters from contract_clause_extracted.
// This constant is used when the LD clause params are not accessible via the FE payload.
const CONTRACTED_DAILY_RATE_CEILING_AED = 43_800_000;

// ─────────────────────────────────────────────────────────────
// Main detail view
// ─────────────────────────────────────────────────────────────
function BudgetBurnDetailView() {
  const { t, i18n } = useTranslation();
  // F28 / F79 — read locale once at top of component so the bilingual
  // title conditional render below is hook-stable across rendering paths.
  const isAr = i18n.language?.startsWith('ar') ?? false;
  const { contractId } = Route.useParams();
  const numericContractId = Number(contractId);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  // For Period × Category bar click → reveal table for that period
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const periodRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const canRead        = useAuthStore(selectHasPermission('finance.budget.read'));
  const canDraftNotice = useAuthStore(selectHasPermission('advisory.draft.review'));

  // Burn compute (periods + monthly actuals + cumulative)
  const burnQuery = useQuery({
    queryKey: ['budget-burn-compute', numericContractId],
    queryFn: () => financialBudgetBurnService.getBurnCompute(numericContractId),
    enabled: canRead && !isNaN(numericContractId),
    staleTime: 30_000,
  });

  // Variance (breaches + clause refs + eligibility)
  const varianceQuery = useQuery({
    queryKey: ['budget-burn-variance', numericContractId],
    queryFn: () => financialBudgetBurnService.getVariance(numericContractId),
    enabled: canRead && !isNaN(numericContractId),
    staleTime: 30_000,
  });

  // Year-end projection
  const projectionQuery = useQuery({
    queryKey: ['budget-burn-projection', numericContractId],
    queryFn: () => financialBudgetBurnService.getProjection(numericContractId),
    enabled: canRead && !isNaN(numericContractId),
    staleTime: 30_000,
  });

  const burn       = burnQuery.data;
  const variance   = varianceQuery.data;
  const projection = projectionQuery.data;

  const isLoading = burnQuery.isLoading || varianceQuery.isLoading || projectionQuery.isLoading;
  const isError   = burnQuery.isError || varianceQuery.isError || projectionQuery.isError;
  const anyError  = burnQuery.error ?? varianceQuery.error ?? projectionQuery.error;

  if (!canRead) {
    return (
      <div className="mx-auto w-full max-w-[1400px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">{t('common.accessDenied')}</p>
        </div>
      </div>
    );
  }

  // Tab definitions
  const TABS: { id: TabId; labelKey: string }[] = [
    { id: 'overview',        labelKey: 'budgetBurn.detail.tabs.overview' },
    { id: 'periodCategory',  labelKey: 'budgetBurn.detail.tabs.periodCategory' },
    { id: 'varianceClauses', labelKey: 'budgetBurn.detail.tabs.varianceClauses' },
    { id: 'projection',      labelKey: 'budgetBurn.detail.tabs.projection' },
    { id: 'trends',          labelKey: 'budgetBurn.detail.tabs.trends' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] space-y-6 p-6"
    >
      {/* Back nav (C14: Router Link) */}
      <div>
        <Link
          to="/app/financial/budget-burn"
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary rounded"
          aria-label={t('financial.budgetBurn.detail.backToPortfolio')}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('financial.budgetBurn.detail.backToPortfolio')}
        </Link>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4" aria-busy="true">
          <div className="h-8 w-64 animate-pulse rounded bg-surface" aria-hidden="true" />
          <div className="h-48 animate-pulse rounded-lg bg-surface" aria-hidden="true" />
          <div className="h-32 animate-pulse rounded-lg bg-surface" aria-hidden="true" />
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div
          className="flex items-center gap-3 rounded-lg border border-error/30 bg-error/5 p-4"
          role="alert"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-error" aria-hidden="true" />
          <p className="text-sm text-error">
            {translateApiError(anyError, t, 'financial.budgetBurn.errors.fetchFailed')}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void burnQuery.refetch();
              void varianceQuery.refetch();
              void projectionQuery.refetch();
            }}
          >
            <RefreshCcw className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('common.retry')}
          </Button>
        </div>
      )}

      {/* Content */}
      {!isLoading && !isError && burn && (
        <>
          {/* Contract header (always visible)
              F28 / F79 — locale-conditional title: show AR title when actor language is AR,
              else show EN. Never both. Avoids bilingual duplication clutter.
              F39 — Draft Cure Notice CTA is also rendered (greyed/disabled) for non-legal
              finance personas so the demo workflow ("Layla drafts cure notice") is
              structurally visible from Fatima's HERO-001 detail. */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">
                {burn.contractNumber}
              </h1>
              {/* Localised contract title — only one renders based on language. */}
              {(isAr && burn.titleAr) ? (
                <p className="mt-0.5 text-sm text-ink-muted" dir="rtl">
                  {burn.titleAr}
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-ink-muted">{burn.titleEn}</p>
              )}
            </div>
            {/* Draft cure notice — show greyed/disabled for non-legal personas when
                eligibility flag is set, so the workflow is structurally visible. */}
            {variance?.cureNoticeEligible && (
              canDraftNotice
                ? <DraftCureNoticeButton contractId={numericContractId} />
                : <DraftCureNoticeButtonDisabled />
            )}
          </div>

          {/* Tab strip */}
          <div
            role="tablist"
            aria-label={t('budgetBurn.detail.tabs.ariaLabel', { defaultValue: 'Budget burn tabs' })}
            className="flex flex-wrap gap-1 border-b border-border pb-0"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`tab-panel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'rounded-t-md border border-b-0 px-4 py-2 text-sm font-medium transition',
                  activeTab === tab.id
                    ? 'border-border bg-card text-ink'
                    : 'border-transparent bg-transparent text-ink-muted hover:text-ink',
                )}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>

          {/* ─── TAB 1: Overview ────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div
              id="tab-panel-overview"
              role="tabpanel"
              aria-labelledby="tab-overview"
              className="space-y-5"
            >
              {/* Summary KPI strip */}
              <section
                aria-label={t('financial.budgetBurn.detail.summaryLabel')}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
              >
                <KpiTile
                  label={t('financial.budgetBurn.detail.kpis.totalBudget')}
                  value={formatAedCompact(burn.totalBudgetedAed)}
                />
                <KpiTile
                  label={t('financial.budgetBurn.detail.kpis.totalActual')}
                  value={formatAedCompact(burn.totalActualAed)}
                />
                <KpiTile
                  label={t('financial.budgetBurn.detail.kpis.variance')}
                  value={formatAedCompact(burn.totalVarianceAed)}
                  variant={parseFloat(burn.totalVarianceAed) > 0 ? 'risk' : 'success'}
                />
                <KpiTile
                  label={t('financial.budgetBurn.detail.kpis.variancePct')}
                  value={`${burn.totalVariancePct >= 0 ? '+' : ''}${burn.totalVariancePct.toFixed(1)}%`}
                  variant={burn.totalVariancePct > 0 ? 'risk' : 'success'}
                />
                <KpiTile
                  label={t('financial.budgetBurn.detail.kpis.pctConsumed')}
                  value={`${burn.burnRatePct.toFixed(1)}%`}
                  variant={burn.burnRatePct >= 100 ? 'risk' : burn.burnRatePct >= 80 ? 'warning' : 'default'}
                />
                <KpiTile
                  label={t('financial.budgetBurn.detail.kpis.remaining')}
                  value={formatAedCompact(burn.remainingBudgetAed)}
                  variant={parseFloat(burn.remainingBudgetAed) < 0 ? 'risk' : 'default'}
                />
              </section>

              {/* Variance alert (when present) */}
              {variance && variance.breachCount > 0 && (
                <VarianceAlertBanner
                  variance={variance.breaches}
                  maxPct={variance.maxVariancePct}
                />
              )}

              {/* Latest computed note */}
              {projection && (
                <p className="text-right text-[11px] text-ink-subtle">
                  {t('financial.budgetBurn.detail.projection.fiscalYear', {
                    year: projection.fiscalYear,
                    asOf: projection.asOfPeriod,
                  })}
                </p>
              )}
            </div>
          )}

          {/* ─── TAB 2: Period × Category ────────────────────────────── */}
          {activeTab === 'periodCategory' && (
            <div
              id="tab-panel-periodCategory"
              role="tabpanel"
              aria-labelledby="tab-periodCategory"
              className="space-y-5"
            >
              {/* Chart #2 — Stacked bar */}
              <PeriodCategoryStackedBar
                byPeriod={burn.byPeriod}
                onBarClick={(periodLabel) => {
                  setExpandedPeriod(periodLabel);
                  setTimeout(() => {
                    periodRefs.current[periodLabel]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
              />

              {/* Drill-down tables */}
              <section>
                <h2 className="mb-3 text-sm font-semibold text-ink">
                  {t('financial.budgetBurn.detail.periodTable.heading')}
                </h2>
                {burn.byPeriod.length === 0 ? (
                  <div className="rounded-lg border border-border bg-card p-8 text-center">
                    <p className="text-sm text-ink-muted">
                      {t('financial.budgetBurn.detail.periodTable.empty')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {burn.byPeriod.map((period) => (
                      <div
                        key={period.periodLabel}
                        ref={(el) => { periodRefs.current[period.periodLabel] = el; }}
                      >
                        <PeriodBlock
                          period={period}
                          expanded={expandedPeriod === period.periodLabel}
                          onToggle={() =>
                            setExpandedPeriod((prev) =>
                              prev === period.periodLabel ? null : period.periodLabel,
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ─── TAB 3: Variance & Clauses ───────────────────────────── */}
          {activeTab === 'varianceClauses' && (
            <div
              id="tab-panel-varianceClauses"
              role="tabpanel"
              aria-labelledby="tab-varianceClauses"
              className="space-y-5"
            >
              {/* Variance alert (repeated here for context) */}
              {variance && variance.breachCount > 0 && (
                <VarianceAlertBanner
                  variance={variance.breaches}
                  maxPct={variance.maxVariancePct}
                />
              )}

              {/* Correlated clause refs */}
              {variance && (
                <CorrelatedClausesSection
                  curePeriod={variance.correlatedClauses.curePeriod}
                  liquidatedDamages={variance.correlatedClauses.liquidatedDamages}
                />
              )}
            </div>
          )}

          {/* ─── TAB 4: Projection ──────────────────────────────────── */}
          {activeTab === 'projection' && (
            <div
              id="tab-panel-projection"
              role="tabpanel"
              aria-labelledby="tab-projection"
              className="space-y-5"
            >
              {projection && (
                <>
                  {/* Existing projection card */}
                  <YearEndProjectionCard projection={projection} />

                  {/* Chart #3 — Projection gauge */}
                  <ProjectionGaugeChart projection={projection} />
                </>
              )}
              {!projection && (
                <div className="rounded-lg border border-border bg-card p-8 text-center">
                  <p className="text-sm text-ink-muted">
                    {t('common.charts.empty', { defaultValue: 'No projection data available.' })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ─── TAB 5: Trends ──────────────────────────────────────── */}
          {activeTab === 'trends' && (
            <div
              id="tab-panel-trends"
              role="tabpanel"
              aria-labelledby="tab-trends"
              className="space-y-5"
            >
              {/* Chart #1 — Cumulative burn line */}
              <CumulativeBurnChart rows={burn.cumulativeBurn} />

              {/* Chart #4 — Day-rate trend line */}
              <DayRateTrendChart monthlyActuals={burn.monthlyActuals} byPeriod={burn.byPeriod} />
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// KpiTile
// ─────────────────────────────────────────────────────────────
function KpiTile({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: string;
  variant?: 'default' | 'risk' | 'warning' | 'success';
}) {
  const containerClass =
    variant === 'risk'    ? 'border-terracotta/30 bg-terracotta/5' :
    variant === 'warning' ? 'border-warning/30 bg-warning/5' :
    variant === 'success' ? 'border-success/30 bg-success/5' :
                            'border-border bg-card';

  const valueClass =
    variant === 'risk'    ? 'text-terracotta' :
    variant === 'warning' ? 'text-warning' :
    variant === 'success' ? 'text-success' :
                            'text-ink';

  return (
    <div className={`rounded-lg border p-4 ${containerClass}`}>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VarianceAlertBanner
// ─────────────────────────────────────────────────────────────
function VarianceAlertBanner({
  variance,
  maxPct,
}: {
  variance: VarianceBreach[];
  maxPct: number;
}) {
  const { t } = useTranslation();

  const worst = [...variance].sort((a, b) => b.variancePct - a.variancePct)[0];
  if (!worst) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-terracotta/30 bg-terracotta/5 p-4"
      role="alert"
      aria-live="assertive"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-terracotta">
          {t('financial.budgetBurn.varianceAlert.title')}
        </p>
        <p className="mt-0.5 text-xs text-ink">
          {t('financial.budgetBurn.varianceAlert.body', {
            category: t(`financial.budgetBurn.costCategory.${worst.costCategory}`),
            period: worst.periodLabel,
            pct: worst.variancePct.toFixed(1),
          })}
        </p>
        {variance.length > 1 && (
          <p className="mt-1 text-xs text-ink-muted">
            {t('financial.budgetBurn.varianceAlert.totalBreaches', {
              count: variance.length,
              maxPct: maxPct.toFixed(1),
            })}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Chart #2 — Period × Cost-Category Stacked Bar
// ─────────────────────────────────────────────────────────────
function PeriodCategoryStackedBar({
  byPeriod,
  onBarClick,
}: {
  byPeriod: BudgetBurnByPeriod[];
  onBarClick: (periodLabel: string) => void;
}) {
  const { t } = useTranslation();

  // Flatten byPeriod into chart-ready rows
  // Each row: { periodLabel, day_rate, manpower, equipment, milestone }
  type FlatRow = {
    periodLabel: string;
    day_rate: number;
    manpower: number;
    equipment: number;
    milestone: number;
  };

  const chartData = useMemo<FlatRow[]>(() => {
    return byPeriod.map((p) => {
      const row: FlatRow = {
        periodLabel: p.periodLabel,
        day_rate: 0,
        manpower: 0,
        equipment: 0,
        milestone: 0,
      };
      for (const cat of p.byCategory) {
        const val = parseFloat(cat.actualAed);
        if (!isNaN(val)) {
          if (cat.costCategory === 'day_rate') row.day_rate = val;
          else if (cat.costCategory === 'manpower') row.manpower = val;
          else if (cat.costCategory === 'equipment') row.equipment = val;
          else if (cat.costCategory === 'milestone') row.milestone = val;
        }
      }
      return row;
    });
  }, [byPeriod]);

  const isEmpty = chartData.length === 0;

  const BARS: { key: keyof Omit<FlatRow, 'periodLabel'>; color: string; labelKey: string }[] = [
    { key: 'day_rate',  color: C1, labelKey: 'financial.budgetBurn.costCategory.day_rate' },
    { key: 'manpower',  color: C2, labelKey: 'financial.budgetBurn.costCategory.manpower' },
    { key: 'equipment', color: C3, labelKey: 'financial.budgetBurn.costCategory.equipment' },
    { key: 'milestone', color: C4, labelKey: 'financial.budgetBurn.costCategory.milestone' },
  ];

  return (
    <ChartCard
      title={t('budgetBurn.charts.periodCategory.title')}
      subtitle={t('budgetBurn.charts.periodCategory.subtitle')}
      height={360}
      loading={false}
      empty={isEmpty}
      emptyLabel={t('common.charts.empty')}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
          onClick={(data) => {
            if (data?.activeLabel) onBarClick(String(data.activeLabel));
          }}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid strokeDasharray="2 4" opacity={0.3} />
          <XAxis dataKey="periodLabel" fontSize={10} />
          <YAxis fontSize={10} tickFormatter={(v: number) => formatAedCompact(v)} />
          <SemanticTooltip currencyHint="aed" />
          {/* F35 — wrap each legend item in a <span> with marginRight so the
              item labels render with visible spacing AND innerText extraction
              preserves the separator. */}
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value: string) => (
              <span style={{ marginRight: 12, color: 'var(--ink-muted)' }}>
                {t(
                  BARS.find((b) => b.key === value)?.labelKey ?? value,
                  { defaultValue: value }
                )}
              </span>
            )}
          />
          {BARS.map((b) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              stackId="actual"
              fill={b.color}
              name={b.key}
              radius={b.key === 'milestone' ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────────────────────
// PeriodBlock (collapsible drill-down table)
// ─────────────────────────────────────────────────────────────
function PeriodBlock({
  period,
  expanded,
  onToggle,
}: {
  period: BudgetBurnByPeriod;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const variancePct = period.variancePct ?? 0;
  const isOver = variancePct > 0;

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Period header + toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <span className="text-xs font-semibold text-ink">{period.periodLabel}</span>
        <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
          <span className="text-ink-muted">
            {t('financial.budgetBurn.detail.periodTable.budget')}{' '}
            <span className="text-ink">{formatAedCompact(period.budgetAed)}</span>
          </span>
          <span className="text-ink-muted">
            {t('financial.budgetBurn.detail.periodTable.actual')}{' '}
            <span className="text-ink">{formatAedCompact(period.actualAed)}</span>
          </span>
          <span className={isOver ? 'text-terracotta' : 'text-success'}>
            {isOver ? '+' : ''}{variancePct.toFixed(1)}%
          </span>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="ms-2 flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-ink-muted hover:text-ink"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" aria-hidden="true" />
                {t('budgetBurn.detail.tabs.hideTable', { defaultValue: 'Hide table' })}
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
                {t('budgetBurn.detail.tabs.showTable', { defaultValue: 'Show table' })}
              </>
            )}
          </button>
        </div>
      </div>

      {expanded && period.byCategory.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-surface/50">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-ink-muted">
                  {t('financial.budgetBurn.columns.category')}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                  {t('financial.budgetBurn.columns.budget')}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                  {t('financial.budgetBurn.columns.actual')}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                  {t('financial.budgetBurn.columns.variance')}
                </th>
                <th scope="col" className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-ink-muted">
                  {t('financial.budgetBurn.detail.periodTable.burnBar')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {period.byCategory.map((cat) => (
                <CategoryRow key={cat.costCategory} cat={cat} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CategoryRow({ cat }: { cat: BudgetBurnByCategory }) {
  const { t } = useTranslation();
  const variancePct = cat.variancePct ?? 0;
  const isOver = variancePct > 0;
  const budget = parseFloat(cat.budgetAed);
  const actual = parseFloat(cat.actualAed);
  const burnPct = budget > 0 ? Math.min(120, (actual / budget) * 100) : 0;

  return (
    <tr className={`transition-colors hover:bg-surface/50 ${cat.overThreshold ? 'bg-terracotta/3' : ''}`}>
      <td className="px-4 py-2 font-medium text-ink">
        {t(`financial.budgetBurn.costCategory.${cat.costCategory}`)}
        {cat.overThreshold && (
          <AlertTriangle
            className="ms-1.5 inline h-3 w-3 text-terracotta"
            aria-label={t('financial.budgetBurn.varianceFlag.overThreshold')}
          />
        )}
      </td>
      <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
        {formatAedFull(cat.budgetAed)}
      </td>
      <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
        {formatAedFull(cat.actualAed)}
      </td>
      <td className={`px-4 py-2 text-right font-mono tabular-nums ${isOver ? 'text-terracotta' : 'text-success'}`}>
        {isOver ? '+' : ''}{variancePct.toFixed(1)}%
      </td>
      <td className="px-4 py-2">
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface">
          <div
            className={`h-full rounded-full ${burnPct >= 100 ? 'bg-terracotta' : burnPct >= 80 ? 'bg-warning' : 'bg-success'}`}
            style={{ width: `${Math.min(100, burnPct)}%` }}
            role="presentation"
            aria-label={t('financial.budgetBurn.detail.periodTable.burnBarAriaLabel', {
              pct: burnPct.toFixed(0),
            })}
          />
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// CorrelatedClausesSection
// ─────────────────────────────────────────────────────────────
function CorrelatedClausesSection({
  curePeriod,
  liquidatedDamages,
}: {
  curePeriod: CorrelatedClauseRef[];
  liquidatedDamages: LdClauseRef[];
}) {
  const { t } = useTranslation();
  const hasAny = curePeriod.length > 0 || liquidatedDamages.length > 0;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-ink">
        {t('financial.budgetBurn.detail.correlatedClauses.heading')}
      </h2>
      {!hasAny ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-xs text-ink-muted">
            {t('financial.budgetBurn.detail.correlatedClauses.noClausesFound')}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {curePeriod.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              {/* F32 — drop `uppercase` so "CURE PERIOD" → "Cure period". */}
              <p className="mb-2 text-xs font-semibold tracking-wider text-ink-muted">
                {t('financial.budgetBurn.detail.correlatedClauses.curePeriod')}
              </p>
              {curePeriod.map((ref) => (
                <div key={ref.clauseId} className="mb-2 flex items-start gap-2 text-xs">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-ink">
                      {t('financial.budgetBurn.detail.correlatedClauses.clauseId', {
                        id: ref.clauseId,
                        page: ref.pageNo,
                      })}
                    </p>
                    {ref.curePeriodDays !== null && (
                      <p className="text-ink-muted">
                        {t('financial.budgetBurn.detail.correlatedClauses.curePeriodDays', {
                          days: ref.curePeriodDays,
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {liquidatedDamages.length > 0 && (
            <div className="rounded-lg border border-terracotta/20 bg-terracotta/5 p-4">
              {/* F32 — drop `uppercase` so "LIQUIDATED DAMAGES" → "Liquidated damages". */}
              <p className="mb-2 text-xs font-semibold tracking-wider text-terracotta">
                {t('financial.budgetBurn.detail.correlatedClauses.liquidatedDamages')}
              </p>
              {liquidatedDamages.map((ref) => (
                <div key={ref.clauseId} className="mb-2 flex items-start gap-2 text-xs">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terracotta" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-ink">
                      {t('financial.budgetBurn.detail.correlatedClauses.clauseId', {
                        id: ref.clauseId,
                        page: ref.pageNo,
                      })}
                    </p>
                    {ref.ldRate !== null && (
                      <p className="text-ink-muted">
                        {t('financial.budgetBurn.detail.correlatedClauses.ldRate', {
                          rate: formatAedCompact(ref.ldRate),
                        })}
                      </p>
                    )}
                    {ref.ldCap !== null && (
                      <p className="text-ink-muted">
                        {t('financial.budgetBurn.detail.correlatedClauses.ldCap', {
                          cap: formatAedCompact(ref.ldCap),
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// YearEndProjectionCard (preserved from CR-N)
// ─────────────────────────────────────────────────────────────
function YearEndProjectionCard({ projection }: { projection: BudgetYearEndProjection }) {
  const { t } = useTranslation();
  const isInsufficient = projection.confidenceNote === 'insufficient_data';
  const isOverBudget   = projection.isProjectedOverBudget === true;

  const confidenceClass = CONFIDENCE_COLORS[projection.confidenceNote];

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-ink">
        {t('financial.budgetBurn.detail.projection.heading')}
      </h2>
      <div className={`rounded-lg border p-5 ${isOverBudget ? 'border-terracotta/30 bg-terracotta/5' : 'border-border bg-card'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-ink-muted">
              {t('financial.budgetBurn.detail.projection.fiscalYear', {
                year: projection.fiscalYear,
                asOf: projection.asOfPeriod,
              })}
            </p>
            <div className="mt-1 flex items-center gap-2">
              {isOverBudget ? (
                <TrendingUp className="h-5 w-5 text-terracotta" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-5 w-5 text-success" aria-hidden="true" />
              )}
              <p className={`text-2xl font-bold tabular-nums ${isOverBudget ? 'text-terracotta' : 'text-success'}`}>
                {isInsufficient
                  ? t('financial.budgetBurn.detail.projection.insufficient')
                  : formatAedCompact(projection.projectedOverUnderAed)}
              </p>
              {!isInsufficient && projection.projectedOverUnderPct !== null && (
                <span className={`text-sm font-medium ${isOverBudget ? 'text-terracotta' : 'text-success'}`}>
                  ({isOverBudget ? '+' : ''}{projection.projectedOverUnderPct.toFixed(1)}%)
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-ink-muted">
              {isOverBudget
                ? t('financial.budgetBurn.detail.projection.projectedOverBudget')
                : t('financial.budgetBurn.detail.projection.projectedUnderBudget')}
            </p>
          </div>

          <div className="text-right">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${confidenceClass}`}
            >
              {t(`financial.budgetBurn.detail.projection.confidence.${projection.confidenceNote}`)}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div>
            <p className="text-ink-muted">{t('financial.budgetBurn.detail.projection.allocatedFy')}</p>
            <p className="mt-0.5 font-mono font-semibold tabular-nums text-ink">
              {formatAedCompact(projection.allocatedFyAed)}
            </p>
          </div>
          <div>
            <p className="text-ink-muted">{t('financial.budgetBurn.detail.projection.actualToDate')}</p>
            <p className="mt-0.5 font-mono font-semibold tabular-nums text-ink">
              {formatAedCompact(projection.actualToDateAed)}
            </p>
          </div>
          <div>
            <p className="text-ink-muted">{t('financial.budgetBurn.detail.projection.runRate')}</p>
            <p className="mt-0.5 font-mono font-semibold tabular-nums text-ink">
              {formatAedCompact(projection.runRatePerMonthAed)}
              <span className="text-ink-muted">/mo</span>
            </p>
          </div>
          <div>
            <p className="text-ink-muted">{t('financial.budgetBurn.detail.projection.monthsRemaining')}</p>
            <p className="mt-0.5 font-semibold text-ink">{projection.monthsRemaining}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Chart #3 — Year-end Projection Gauge (PieChart as arc)
// ─────────────────────────────────────────────────────────────
function ProjectionGaugeChart({ projection }: { projection: BudgetYearEndProjection }) {
  const { t } = useTranslation();

  const allocatedFy = parseFloat(projection.allocatedFyAed);
  const projectedSpend =
    projection.projectedYearEndAed !== null
      ? parseFloat(projection.projectedYearEndAed)
      : null;

  const insufficient = projection.confidenceNote === 'insufficient_data' || projectedSpend === null || isNaN(allocatedFy) || allocatedFy <= 0;

  // consumedPct: (projectedSpend / allocatedFy) * 100, capped at 200 for display
  const consumedPct = insufficient
    ? 0
    : Math.min(200, (projectedSpend! / allocatedFy) * 100);

  // Gauge is a half-circle from 180° to 0° (left to right).
  // We map consumedPct (0–100 → 180°, 100–200 → 0°) to the arc end angle.
  const gaugeAngle = Math.min(180, (consumedPct / 100) * 180);

  // Color: sage if ≤80%, amber 80–100%, terracotta >100%
  const gaugeColor =
    consumedPct > 100
      ? 'var(--terracotta)'
      : consumedPct >= 80
        ? 'var(--amber)'
        : 'var(--sage)';

  // Recharts PieChart — two cells: filled arc + remainder
  const filled = { value: consumedPct > 100 ? 100 : consumedPct, fill: gaugeColor };
  const remaining = {
    value: consumedPct > 100 ? 0 : 100 - consumedPct,
    fill: 'var(--border)',
  };

  const chartData = [filled, remaining];

  const confidenceClass = CONFIDENCE_COLORS[projection.confidenceNote];

  return (
    <ChartCard
      title={t('budgetBurn.charts.projectionGauge.title')}
      subtitle={t('budgetBurn.charts.projectionGauge.subtitle')}
      height={240}
      empty={insufficient}
      emptyLabel={t('common.charts.empty')}
    >
      <div className="flex flex-col items-center justify-center gap-3" style={{ height: 240 }}>
        <div style={{ height: 180, width: '100%', maxWidth: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="100%"
                startAngle={180}
                endAngle={0}
                innerRadius={60}
                outerRadius={90}
                paddingAngle={0}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
                {/* Center label via custom SVG */}
                <Label
                  content={({ viewBox }) => {
                    const vb = viewBox as { cx?: number; cy?: number };
                    const cx = vb?.cx ?? 160;
                    const cy = vb?.cy ?? 120;
                    return (
                      <text textAnchor="middle">
                        <tspan
                          x={cx}
                          y={cy - 16}
                          fontSize={28}
                          fontWeight={700}
                          fontFamily="monospace"
                          fill="currentColor"
                        >
                          {insufficient ? '—' : `${consumedPct.toFixed(1)}%`}
                        </tspan>
                        <tspan
                          x={cx}
                          y={cy + 8}
                          fontSize={11}
                          fill="var(--ink-muted)"
                        >
                          {t('budgetBurn.charts.projectionGauge.ofFY', { defaultValue: 'of FY budget' })}
                        </tspan>
                      </text>
                    );
                  }}
                />
              </Pie>
              <SemanticTooltip currencyHint="pct" />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Confidence badge */}
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${confidenceClass}`}
        >
          {t(`financial.budgetBurn.detail.projection.confidence.${projection.confidenceNote}`)}
        </span>
      </div>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────────────────────
// Chart #1 — Cumulative Burn Line Chart
// ─────────────────────────────────────────────────────────────
function CumulativeBurnChart({ rows }: { rows: CumulativeBurnRow[] }) {
  const { t } = useTranslation();

  // CR-N crash lesson: money fields are strings — parseFloat in a memo
  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        periodLabel: r.periodLabel,
        cumulativeActualAed: parseFloat(r.cumulativeActualAed) || 0,
        cumulativeBudgetAed: parseFloat(r.cumulativeBudgetAed) || 0,
      })),
    [rows],
  );

  const isEmpty = chartData.length === 0;

  return (
    <ChartCard
      title={t('budgetBurn.charts.cumulativeBurn.title')}
      subtitle={t('budgetBurn.charts.cumulativeBurn.subtitle')}
      height={320}
      empty={isEmpty}
      emptyLabel={t('common.charts.empty')}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="2 4" opacity={0.3} />
          <XAxis dataKey="periodLabel" fontSize={10} />
          <YAxis fontSize={10} tickFormatter={(v: number) => formatAedCompact(v)} />
          <SemanticTooltip
            currencyHint="aed"
            formatter={(value, name) => {
              const formatted = formatAedCompact(typeof value === 'string' ? parseFloat(value) : Number(value));
              const label =
                name === 'cumulativeActualAed'
                  ? t('budgetBurn.charts.cumulativeBurn.actual')
                  : t('budgetBurn.charts.cumulativeBurn.budgetEnvelope');
              return [formatted, label];
            }}
          />
          {/* F38 — wrap each legend item in span with explicit spacing. */}
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value: string) => (
              <span style={{ marginRight: 12, color: 'var(--ink-muted)' }}>
                {value === 'cumulativeActualAed'
                  ? t('budgetBurn.charts.cumulativeBurn.actual')
                  : t('budgetBurn.charts.cumulativeBurn.budgetEnvelope')}
              </span>
            )}
          />
          <Line
            type="monotone"
            dataKey="cumulativeActualAed"
            stroke={C1}
            strokeWidth={2}
            dot={{ r: 3, fill: C1 }}
            activeDot={{ r: 5 }}
            name="cumulativeActualAed"
          />
          <Line
            type="monotone"
            dataKey="cumulativeBudgetAed"
            stroke={INK_MUTED}
            strokeWidth={2}
            strokeDasharray="6 6"
            dot={false}
            name="cumulativeBudgetAed"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────────────────────
// Chart #4 — Monthly Day-Rate Trend Line Chart
// ─────────────────────────────────────────────────────────────
function DayRateTrendChart({
  monthlyActuals,
  byPeriod,
}: {
  monthlyActuals: MonthlyActualRow[];
  byPeriod: BudgetBurnByPeriod[];
}) {
  const { t } = useTranslation();

  // Filter to day_rate only and parse to numeric
  const chartData = useMemo(() => {
    return monthlyActuals
      .filter((r) => r.costCategory === 'day_rate')
      .map((r) => ({
        periodLabel: r.periodLabel,
        actualAmountAed: parseFloat(r.actualAed) || 0,
      }));
  }, [monthlyActuals]);

  // Planned day-rate per month: average of all periods' day_rate budget / 3
  // (quarterly periods divided by 3 months, or monthly direct)
  const plannedDayRateAed = useMemo(() => {
    const rates: number[] = [];
    for (const p of byPeriod) {
      for (const cat of p.byCategory) {
        if (cat.costCategory === 'day_rate') {
          const val = parseFloat(cat.budgetAed);
          if (!isNaN(val) && val > 0) rates.push(val);
        }
      }
    }
    if (rates.length === 0) return null;
    // byPeriod is quarterly (CR-N seed pattern). Divide each quarter's day-rate
    // budget by 3 to get the monthly-equivalent threshold that aligns with the
    // monthly actuals plotted on this chart.
    return rates.reduce((s, v) => s + v, 0) / rates.length / 3;
  }, [byPeriod]);

  const isEmpty = chartData.length === 0;

  // Breach month: identify the period where actual exceeds planned by ≥5%
  const breachPoint = useMemo(() => {
    if (!plannedDayRateAed) return null;
    return chartData.find((r) => r.actualAmountAed > plannedDayRateAed * 1.05) ?? null;
  }, [chartData, plannedDayRateAed]);

  return (
    <ChartCard
      title={t('budgetBurn.charts.dayRateTrend.title')}
      subtitle={t('budgetBurn.charts.dayRateTrend.subtitle')}
      height={320}
      empty={isEmpty}
      emptyLabel={t('common.charts.empty')}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="2 4" opacity={0.3} />
          <XAxis dataKey="periodLabel" fontSize={10} />
          <YAxis fontSize={10} tickFormatter={(v: number) => formatAedCompact(v)} />
          <SemanticTooltip
            currencyHint="aed"
            formatter={(value) => {
              const formatted = formatAedCompact(typeof value === 'string' ? parseFloat(value) : Number(value));
              return [formatted, t('budgetBurn.charts.dayRateTrend.actual')];
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ fontSize: 11 }}
            formatter={() => t('budgetBurn.charts.dayRateTrend.actual')}
          />
          <Line
            type="monotone"
            dataKey="actualAmountAed"
            stroke={C1}
            strokeWidth={2}
            dot={{ r: 3, fill: C1 }}
            activeDot={{ r: 5 }}
            name="actualAmountAed"
          />

          {/* ReferenceLine (a): planned day-rate threshold */}
          {plannedDayRateAed !== null && (
            <ReferenceLine
              y={plannedDayRateAed}
              stroke={C2}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={
                <Label
                  value={t('budgetBurn.charts.dayRateTrend.referenceLines.planned')}
                  position="insideTopRight"
                  fontSize={10}
                  fill="var(--sage)"
                />
              }
            />
          )}

          {/* ReferenceLine (b): contracted day-rate ceiling
              Source: HERO-001 LD clause — AED 730k/rig/day × 2 rigs × 30 days = AED 43.8M/month.
              This constant is used as a fallback when LD clause params are not in the FE payload.
          */}
          <ReferenceLine
            y={CONTRACTED_DAILY_RATE_CEILING_AED}
            stroke="var(--terracotta)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={
              <Label
                value={t('budgetBurn.charts.dayRateTrend.referenceLines.contractedCeiling')}
                position="insideTopRight"
                fontSize={10}
                fill="var(--terracotta)"
              />
            }
          />

          {/* ReferenceDot for breach month */}
          {breachPoint && (
            <ReferenceDot
              x={breachPoint.periodLabel}
              y={breachPoint.actualAmountAed}
              r={6}
              fill="var(--terracotta)"
              stroke="var(--card)"
              strokeWidth={2}
              label={
                <Label
                  value={t('budgetBurn.charts.dayRateTrend.breachLabel', { defaultValue: '+8% breach' })}
                  position="top"
                  fontSize={10}
                  fill="var(--terracotta)"
                />
              }
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// F39 — Greyed-disabled cure-notice CTA shown to non-legal personas (Fatima) so
// the demo handoff to Layla Counsel is structurally visible on HERO-001 detail.
function DraftCureNoticeButtonDisabled() {
  const { t } = useTranslation();
  return (
    <Button
      variant="outline"
      disabled
      title={t('financial.budgetBurn.detail.draftCureNotice.legalOnlyTooltip', {
        defaultValue: 'Legal Counsel only — handoff to Layla Counsel queue.',
      })}
      aria-label={t('financial.budgetBurn.detail.draftCureNotice.ariaLabel')}
    >
      <FileEdit className="me-2 h-4 w-4" aria-hidden="true" />
      {t('financial.budgetBurn.detail.draftCureNotice.button')}
    </Button>
  );
}

// ─────────────────────────────────────────────────────────────
// DraftCureNoticeButton — gated advisory.draft.review
// ─────────────────────────────────────────────────────────────
function DraftCureNoticeButton({ contractId }: { contractId: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      financialBudgetBurnService.draftCureNotice(contractId, {}),
    onSuccess: (res) => {
      toast.success(
        t('financial.budgetBurn.detail.draftCureNotice.successToast', {
          draftId: res.draftId,
          defaultValue: 'Cure notice draft #{{draftId}} created.',
        }),
      );
      void queryClient.invalidateQueries({ queryKey: ['budget-burn-variance', contractId] });
    },
    onError: (err: unknown) => {
      toast.error(
        translateApiError(err, t, 'financial.budgetBurn.detail.draftCureNotice.errorToast'),
      );
    },
  });

  return (
    <Button
      variant="outline"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      aria-label={t('financial.budgetBurn.detail.draftCureNotice.ariaLabel')}
    >
      <FileEdit className="me-2 h-4 w-4" aria-hidden="true" />
      {mutation.isPending
        ? t('common.saving')
        : t('financial.budgetBurn.detail.draftCureNotice.button')}
    </Button>
  );
}
