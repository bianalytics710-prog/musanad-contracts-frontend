/**
 * /app/compliance/regulatory-cascade/:runId — Run detail view.
 *
 * CR-M — Labor-Law Cascade detail: contractor-by-contractor remediation
 * table with ICV-impact section.
 * CR-T — Visual upgrade: aggregate KPI strip + headcount-band donut +
 * penalty-by-emirate horizontal bar + ICV-by-emirate stacked horizontal bar +
 * virtualized remediation table + search + 4 filter chips.
 *
 * Standards: A7, C13, C14, D6, D7, T3–T4, T10, T11, T12, WCAG AA.
 */
import { useState, useMemo, useRef } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, FileEdit, RefreshCcw, Search, X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ChartCard, SemanticTooltip } from '@/components/charts';
import { humanizeLabel } from '@/features/dashboards/components/dashboard-primitives';
import { ScrollbarReservedHeader, PercentColgroup } from '@/components/patterns';

// 8 columns, must sum to 100. Used by BOTH the head table and every
// per-row body table to keep columns in lockstep regardless of scrollbar.
const CASCADE_DETAIL_COL_WIDTHS = [22, 11, 13, 12, 13, 9, 13, 7] as const;
import { formatAedCompact } from '@/features/dashboards/components/dashboard-primitives';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { regulatoryCascadeService } from '@/services/api/regulatory-cascade.service';
import { translateApiError } from '@/lib/translate-api-error';
import { formatDateTime } from '@/utils/datetime';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import type {
  RegulatoryCascadeItemDetail,
  RemediationStatus,
  HeadcountBand,
} from '@/types/entities/regulatory-cascade.types';
import { REMEDIATION_STATUSES } from '@/types/entities/regulatory-cascade.types';

export const Route = createFileRoute(
  '/app/compliance/regulatory-cascade/$runId',
)({
  component: () => (
    <ErrorBoundary>
      <CascadeRunDetailView />
    </ErrorBoundary>
  ),
});

// ─────────────────────────────────────────────────────────────
// Semantic colour maps — no raw hex (C13)
// ─────────────────────────────────────────────────────────────
const REMEDIATION_COLORS: Record<RemediationStatus, string> = {
  pending:     'bg-warning/10 text-warning border-warning/30',
  in_progress: 'bg-info/10 text-info border-info/30',
  amended:     'bg-success/10 text-success border-success/30',
  dismissed:   'bg-muted text-ink-muted border-border',
  resolved:    'bg-success/20 text-success border-success/40',
};

const BAND_COLORS: Record<HeadcountBand, string> = {
  '<20':   'bg-muted text-ink-muted border-border',
  '20-49': 'bg-gold/10 text-ink border-gold/30',
  '50+':   'bg-terracotta/10 text-terracotta border-terracotta/30',
};

// ─────────────────────────────────────────────────────────────
// Chart colour tokens (semantic — no raw oklch literals)
// ─────────────────────────────────────────────────────────────
const DONUT_COLORS: Record<HeadcountBand, string> = {
  '<20':   'var(--color-ink-muted)',
  '20-49': 'var(--color-chart-1)',
  '50+':   'var(--color-chart-4)',
};

function formatAedRange(min: number, max: number): string {
  if (min === max) return formatAedCompact(min);
  return `${formatAedCompact(min)} – ${formatAedCompact(max)}`;
}

// ─────────────────────────────────────────────────────────────
// Main detail view
// ─────────────────────────────────────────────────────────────
function CascadeRunDetailView() {
  const { t } = useTranslation();
  const { runId } = Route.useParams();
  const numericRunId = Number(runId);

  const canRead       = useAuthStore(selectHasPermission('regulatory.cascade.read'));
  const canRun        = useAuthStore(selectHasPermission('regulatory.cascade.run'));
  const canDraftAmend = useAuthStore(selectHasPermission('advisory.draft.review'));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['regulatory-cascade-detail', numericRunId],
    queryFn: () => regulatoryCascadeService.getById(numericRunId),
    enabled: canRead && !isNaN(numericRunId),
    staleTime: 30_000,
  });

  const run = data;

  if (!canRead) {
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
      className="mx-auto w-full max-w-[1400px] space-y-6 p-6"
    >
      {/* Back nav */}
      <div>
        <Link
          to="/app/compliance/regulatory-cascade"
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary rounded"
          aria-label={t('regulatory.cascade.detail.backToList')}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('regulatory.cascade.detail.backToList')}
        </Link>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4" aria-busy="true">
          <div className="h-8 w-64 animate-pulse rounded bg-surface" aria-hidden="true" />
          <div className="h-48 animate-pulse rounded-lg bg-surface" aria-hidden="true" />
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
            {translateApiError(error, t, 'regulatory.cascade.errors.fetchFailed')}
          </p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            <RefreshCcw className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('common.retry')}
          </Button>
        </div>
      )}

      {/* Content */}
      {!isLoading && !isError && run && (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">
                {run.regulationRef ?? t('regulatory.cascade.detail.unnamedRun')}
              </h1>
              <p className="mt-1 text-xs text-ink-muted">
                {t('regulatory.cascade.detail.runAt')}
                {' '}
                {formatDateTime(run.runAt, { showTime: true })}
                {run.createdByName ? ` · ${run.createdByName}` : ''}
              </p>
            </div>
          </div>

          {/* Original summary strip */}
          <section
            aria-label={t('regulatory.cascade.detail.summaryLabel')}
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            <SummaryTile
              label={t('regulatory.cascade.detail.summary.affectedContractors')}
              value={String(run.affectedContractorCount)}
            />
            <SummaryTile
              label={t('regulatory.cascade.detail.summary.nonCompliant')}
              value={String(run.summary.totals.nonCompliantCount)}
              variant="warning"
            />
            <SummaryTile
              label={t('regulatory.cascade.detail.summary.penaltyMin')}
              value={formatAedRange(run.totalPenaltyMinAed, run.totalPenaltyMinAed)}
            />
            <SummaryTile
              label={t('regulatory.cascade.detail.summary.penaltyMax')}
              value={formatAedRange(run.totalPenaltyMaxAed, run.totalPenaltyMaxAed)}
              variant="risk"
            />
          </section>

          {/* ── CR-T: Charts + virtualized table ──────────────────── */}
          <CascadeChartsAndTable
            items={run.items}
            canRead={canRead}
            canRun={canRun}
            canDraftAmend={canDraftAmend}
          />

          {/* ICV Impact section */}
          <IcvImpactSection items={run.items} />
        </>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// CascadeChartsAndTable — CR-T additions
// Aggregate KPI strip + 3 charts + virtualized table + search + 4 filter chips
// ─────────────────────────────────────────────────────────────
function CascadeChartsAndTable({
  items,
  canRead,
  canRun,
  canDraftAmend,
}: {
  items: RegulatoryCascadeItemDetail[];
  canRead: boolean;
  canRun: boolean;
  canDraftAmend: boolean;
}) {
  const { t } = useTranslation();

  // ── Search + filter state ──────────────────────────────────
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounce(searchRaw, 300);
  const [nonCompliantOnly, setNonCompliantOnly] = useState(false);
  const [selectedEmirate, setSelectedEmirate] = useState('');
  const [selectedBand, setSelectedBand] = useState('');
  const [selectedRemStatus, setSelectedRemStatus] = useState('');
  const [showEmiratePicker, setShowEmiratePicker] = useState(false);
  const [showBandPicker, setShowBandPicker] = useState(false);
  const [showRemStatusPicker, setShowRemStatusPicker] = useState(false);

  const total = items.length;

  // ── Aggregate KPI computations ─────────────────────────────
  const kpi = useMemo(() => {
    if (total === 0) {
      return { penaltyMin: 0, penaltyMax: 0, nonCompliantPct: 0, icvAtRiskPct: 0, remediatedPct: 0 };
    }
    const penaltyMin = items.reduce((s, i) => s + (i.penaltyExposureMinAed ?? 0), 0);
    const penaltyMax = items.reduce((s, i) => s + (i.penaltyExposureMaxAed ?? 0), 0);
    const nonCompliant = items.filter((i) => i.isCompliant === false).length;
    const icvAtRisk = items.filter((i) => i.icvAttachmentCount === 0 && i.isCompliant === false).length;
    const remediated = items.filter(
      (i) => i.remediationStatus === 'resolved' || i.remediationStatus === 'amended',
    ).length;
    return {
      penaltyMin,
      penaltyMax,
      nonCompliantPct: (nonCompliant / total) * 100,
      icvAtRiskPct: (icvAtRisk / total) * 100,
      remediatedPct: (remediated / total) * 100,
    };
  }, [items, total]);

  // ── Headcount donut data ───────────────────────────────────
  const donutData = useMemo(() => {
    const counts: Partial<Record<HeadcountBand, number>> = {};
    for (const item of items) {
      counts[item.headcountBand] = (counts[item.headcountBand] ?? 0) + 1;
    }
    const bands: HeadcountBand[] = ['<20', '20-49', '50+'];
    return bands
      .filter((b) => (counts[b] ?? 0) > 0)
      .map((b) => ({
        band: b,
        count: counts[b] ?? 0,
        label: t(`regulatory.cascade.charts.headcountDonut.segments.${b === '<20' ? 'lt20' : b === '20-49' ? 'b20to49' : 'gt50'}`),
      }));
  }, [items, t]);

  // ── Penalty by emirate data (sorted DESC) ─────────────────
  const penaltyByEmirate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      const em = item.emirate ?? 'Unknown';
      map[em] = (map[em] ?? 0) + (item.penaltyExposureMaxAed ?? 0);
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([emirate, totalPenaltyAed]) => ({ emirate, totalPenaltyAed }));
  }, [items]);

  // ── ICV by emirate stacked data ────────────────────────────
  const icvByEmirate = useMemo(() => {
    const map: Record<string, { compliant: number; atRisk: number; nonRated: number }> = {};
    for (const item of items) {
      const em = item.emirate ?? 'Unknown';
      if (!map[em]) map[em] = { compliant: 0, atRisk: 0, nonRated: 0 };
      if (item.icvAttachmentCount > 0 && item.isCompliant === true) {
        map[em].compliant += 1;
      } else if (item.isCompliant === false) {
        map[em].atRisk += 1;
      } else {
        // icvAttachmentCount === 0 AND isCompliant !== false
        map[em].nonRated += 1;
      }
    }
    return Object.entries(map)
      .map(([emirate, v]) => ({ emirate, ...v }))
      .sort((a, b) => (b.compliant + b.atRisk + b.nonRated) - (a.compliant + a.atRisk + a.nonRated));
  }, [items]);

  // ── Emirates list for filter chip ─────────────────────────
  const emirateOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.emirate) set.add(item.emirate);
    }
    return Array.from(set).sort();
  }, [items]);

  // ── Default sort: penaltyExposureMaxAed DESC ───────────────
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (b.penaltyExposureMaxAed ?? 0) - (a.penaltyExposureMaxAed ?? 0)),
    [items],
  );

  // ── Apply filters ─────────────────────────────────────────
  const filteredItems = useMemo(() => {
    let rows = sortedItems;

    if (search) {
      const lower = search.toLowerCase();
      rows = rows.filter(
        (i) =>
          i.contractorNameEn.toLowerCase().includes(lower) ||
          (i.contractorNameAr ?? '').toLowerCase().includes(lower) ||
          (i.emirate ?? '').toLowerCase().includes(lower),
      );
    }

    if (nonCompliantOnly) {
      rows = rows.filter((i) => i.isCompliant === false || i.remediationStatus !== 'resolved');
    }

    if (selectedEmirate) {
      rows = rows.filter((i) => i.emirate === selectedEmirate);
    }

    if (selectedBand) {
      rows = rows.filter((i) => i.headcountBand === selectedBand);
    }

    if (selectedRemStatus) {
      rows = rows.filter((i) => i.remediationStatus === selectedRemStatus);
    }

    return rows;
  }, [sortedItems, search, nonCompliantOnly, selectedEmirate, selectedBand, selectedRemStatus]);

  // ── Virtualization ─────────────────────────────────────────
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  // ── Chart cell colours by rank ────────────────────────────
  function penaltyBarColor(index: number): string {
    if (index === 0) return 'var(--color-chart-4)';
    if (index <= 2) return 'var(--color-chart-1)';
    return 'var(--color-chart-2)';
  }

  return (
    <>
      {/* ── Aggregate KPI strip ────────────────────────────────── */}
      <section
        aria-label={t('regulatory.cascade.kpiStrip.totalContractors')}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        <SummaryTile
          label={t('regulatory.cascade.kpiStrip.totalContractors')}
          value={String(total)}
        />
        <SummaryTile
          label={t('regulatory.cascade.kpiStrip.penaltyRange')}
          value={formatAedRange(kpi.penaltyMin, kpi.penaltyMax)}
          variant="risk"
        />
        <SummaryTile
          label={t('regulatory.cascade.kpiStrip.pctNonCompliant')}
          value={`${kpi.nonCompliantPct.toFixed(1)}%`}
          variant="warning"
        />
        <SummaryTile
          label={t('regulatory.cascade.kpiStrip.pctIcvAtRisk')}
          value={`${kpi.icvAtRiskPct.toFixed(1)}%`}
          variant="risk"
        />
        <SummaryTile
          label={t('regulatory.cascade.kpiStrip.pctRemediated')}
          value={`${kpi.remediatedPct.toFixed(1)}%`}
        />
      </section>

      {/* ── 2-column: donut + penalty bar ─────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Headcount-band donut */}
        <ChartCard
          title={t('regulatory.cascade.charts.headcountDonut.title')}
          subtitle={t('regulatory.cascade.charts.headcountDonut.subtitle')}
          height={240}
          empty={donutData.length === 0}
          emptyLabel={t('common.charts.empty', { defaultValue: 'No data' })}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                dataKey="count"
                nameKey="label"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {donutData.map((entry) => (
                  <Cell
                    key={entry.band}
                    fill={DONUT_COLORS[entry.band as HeadcountBand] ?? 'var(--color-chart-3)'}
                  />
                ))}
              </Pie>
              <SemanticTooltip
                currencyHint="pct"
                formatter={(value, _name, props) => {
                  const count = typeof value === 'number' ? value : Number(value);
                  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                  const label = (props as { payload?: { label?: string } }).payload?.label ?? '';
                  return [`${count} (${pct}%)`, label];
                }}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                formatter={(value) => (
                  <span className="text-xs text-ink-muted">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Penalty by emirate horizontal bar */}
        <ChartCard
          title={t('regulatory.cascade.charts.penaltyByEmirate.title')}
          subtitle={t('regulatory.cascade.charts.penaltyByEmirate.subtitle')}
          height={240}
          empty={penaltyByEmirate.length === 0}
          emptyLabel={t('common.charts.empty', { defaultValue: 'No data' })}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={penaltyByEmirate}
              layout="vertical"
              margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
            >
              <CartesianGrid strokeDasharray="2 4" horizontal={false} opacity={0.3} />
              {/* Humanize emirate slug ("abu_dhabi" → "Abu Dhabi") in the
                  Y-axis tick so the chart reads like the rest of the app. */}
              <YAxis
                dataKey="emirate"
                type="category"
                width={140}
                fontSize={10}
                tick={{ fill: 'var(--color-ink-muted)' }}
                tickFormatter={(v: string) => humanizeLabel(v)}
              />
              <XAxis
                type="number"
                fontSize={10}
                tickFormatter={(v: number) => formatAedCompact(v)}
              />
              <SemanticTooltip currencyHint="aed" />
              <Bar dataKey="totalPenaltyAed" radius={[0, 3, 3, 0]}>
                {penaltyByEmirate.map((_entry, index) => (
                  <Cell key={`penalty-cell-${index}`} fill={penaltyBarColor(index)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── ICV by emirate stacked bar (full width) ────────────── */}
      <ChartCard
        title={t('regulatory.cascade.charts.icvByEmirate.title')}
        subtitle={t('regulatory.cascade.charts.icvByEmirate.subtitle')}
        height={280}
        empty={icvByEmirate.length === 0}
        emptyLabel={t('common.charts.empty', { defaultValue: 'No data' })}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={icvByEmirate}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
          >
            <CartesianGrid strokeDasharray="2 4" horizontal={false} opacity={0.3} />
            <YAxis
              dataKey="emirate"
              type="category"
              width={140}
              fontSize={10}
              tick={{ fill: 'var(--color-ink-muted)' }}
              tickFormatter={(v: string) => humanizeLabel(v)}
            />
            <XAxis type="number" fontSize={10} />
            <Legend verticalAlign="top" height={28} formatter={(value: string) => (
              <span className="text-xs text-ink-muted">{value}</span>
            )} />
            <SemanticTooltip
              currencyHint="pct"
              formatter={(value, name) => {
                const n = typeof value === 'number' ? value : Number(value);
                const key = name === 'compliant'
                  ? 'regulatory.cascade.charts.icvByEmirate.series.compliant'
                  : name === 'atRisk'
                    ? 'regulatory.cascade.charts.icvByEmirate.series.atRisk'
                    : 'regulatory.cascade.charts.icvByEmirate.series.nonRated';
                return [String(n), key];
              }}
            />
            <Bar
              dataKey="compliant"
              name={t('regulatory.cascade.charts.icvByEmirate.series.compliant')}
              stackId="a"
              fill="var(--color-chart-2)"
            />
            <Bar
              dataKey="atRisk"
              name={t('regulatory.cascade.charts.icvByEmirate.series.atRisk')}
              stackId="a"
              fill="var(--color-chart-4)"
            />
            <Bar
              dataKey="nonRated"
              name={t('regulatory.cascade.charts.icvByEmirate.series.nonRated')}
              stackId="a"
              fill="var(--color-ink-muted)"
              radius={[0, 3, 3, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Search + 4 filter chips ────────────────────────────── */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative w-full max-w-sm">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            type="search"
            id="cascade-search"
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            placeholder={t('regulatory.cascade.filters.searchPlaceholder')}
            className="h-9 w-full rounded-md border border-border bg-card ps-9 pe-3 text-sm text-ink placeholder:text-ink-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            aria-label={t('regulatory.cascade.filters.searchPlaceholder')}
          />
          {searchRaw && (
            <button
              type="button"
              onClick={() => setSearchRaw('')}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
              aria-label={t('common.clearSearch', { defaultValue: 'Clear search' })}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Non-compliant only */}
          <button
            type="button"
            onClick={() => setNonCompliantOnly((v) => !v)}
            aria-pressed={nonCompliantOnly}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition',
              nonCompliantOnly
                ? 'border-terracotta bg-terracotta/10 text-terracotta'
                : 'border-border bg-card text-ink-muted hover:border-gold/60 hover:text-ink',
            )}
          >
            {t('regulatory.cascade.filters.nonCompliantOnly')}
          </button>

          {/* By emirate */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowEmiratePicker((v) => !v);
                setShowBandPicker(false);
                setShowRemStatusPicker(false);
              }}
              aria-haspopup="listbox"
              aria-expanded={showEmiratePicker}
              className={cn(
                'flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition',
                selectedEmirate
                  ? 'border-gold bg-gold/10 text-ink'
                  : 'border-border bg-card text-ink-muted hover:border-gold/60 hover:text-ink',
              )}
            >
              {selectedEmirate
                ? `${t('regulatory.cascade.filters.byEmirate')}: ${selectedEmirate}`
                : t('regulatory.cascade.filters.byEmirate')}
              {selectedEmirate ? (
                <X
                  className="h-3 w-3"
                  aria-hidden="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEmirate('');
                  }}
                />
              ) : (
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              )}
            </button>
            {showEmiratePicker && (
              <div
                role="listbox"
                aria-label={t('regulatory.cascade.filters.byEmirate')}
                className="absolute start-0 top-9 z-10 min-w-[160px] rounded-lg border border-border bg-card shadow-md"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedEmirate === ''}
                  onClick={() => { setSelectedEmirate(''); setShowEmiratePicker(false); }}
                  className="block w-full px-3 py-2 text-start text-xs text-ink-muted hover:bg-surface"
                >
                  {t('common.all', { defaultValue: 'All' })}
                </button>
                {emirateOptions.map((em) => (
                  <button
                    key={em}
                    type="button"
                    role="option"
                    aria-selected={selectedEmirate === em}
                    onClick={() => { setSelectedEmirate(em); setShowEmiratePicker(false); }}
                    className={cn(
                      'block w-full px-3 py-2 text-start text-xs hover:bg-surface',
                      selectedEmirate === em ? 'font-semibold text-ink' : 'text-ink-muted',
                    )}
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* By headcount band */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowBandPicker((v) => !v);
                setShowEmiratePicker(false);
                setShowRemStatusPicker(false);
              }}
              aria-haspopup="listbox"
              aria-expanded={showBandPicker}
              className={cn(
                'flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition',
                selectedBand
                  ? 'border-gold bg-gold/10 text-ink'
                  : 'border-border bg-card text-ink-muted hover:border-gold/60 hover:text-ink',
              )}
            >
              {selectedBand
                ? `${t('regulatory.cascade.filters.byBand')}: ${selectedBand}`
                : t('regulatory.cascade.filters.byBand')}
              {selectedBand ? (
                <X
                  className="h-3 w-3"
                  aria-hidden="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBand('');
                  }}
                />
              ) : (
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              )}
            </button>
            {showBandPicker && (
              <div
                role="listbox"
                aria-label={t('regulatory.cascade.filters.byBand')}
                className="absolute start-0 top-9 z-10 min-w-[120px] rounded-lg border border-border bg-card shadow-md"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedBand === ''}
                  onClick={() => { setSelectedBand(''); setShowBandPicker(false); }}
                  className="block w-full px-3 py-2 text-start text-xs text-ink-muted hover:bg-surface"
                >
                  {t('common.all', { defaultValue: 'All' })}
                </button>
                {(['<20', '20-49', '50+'] as HeadcountBand[]).map((band) => (
                  <button
                    key={band}
                    type="button"
                    role="option"
                    aria-selected={selectedBand === band}
                    onClick={() => { setSelectedBand(band); setShowBandPicker(false); }}
                    className={cn(
                      'block w-full px-3 py-2 text-start text-xs hover:bg-surface',
                      selectedBand === band ? 'font-semibold text-ink' : 'text-ink-muted',
                    )}
                  >
                    {band}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* By remediation status */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowRemStatusPicker((v) => !v);
                setShowEmiratePicker(false);
                setShowBandPicker(false);
              }}
              aria-haspopup="listbox"
              aria-expanded={showRemStatusPicker}
              className={cn(
                'flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition',
                selectedRemStatus
                  ? 'border-gold bg-gold/10 text-ink'
                  : 'border-border bg-card text-ink-muted hover:border-gold/60 hover:text-ink',
              )}
            >
              {selectedRemStatus
                ? `${t('regulatory.cascade.filters.byRemediationStatus')}: ${t(`regulatory.cascade.remediationStatus.${selectedRemStatus}`)}`
                : t('regulatory.cascade.filters.byRemediationStatus')}
              {selectedRemStatus ? (
                <X
                  className="h-3 w-3"
                  aria-hidden="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRemStatus('');
                  }}
                />
              ) : (
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              )}
            </button>
            {showRemStatusPicker && (
              <div
                role="listbox"
                aria-label={t('regulatory.cascade.filters.byRemediationStatus')}
                className="absolute start-0 top-9 z-10 min-w-[180px] rounded-lg border border-border bg-card shadow-md"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedRemStatus === ''}
                  onClick={() => { setSelectedRemStatus(''); setShowRemStatusPicker(false); }}
                  className="block w-full px-3 py-2 text-start text-xs text-ink-muted hover:bg-surface"
                >
                  {t('common.all', { defaultValue: 'All' })}
                </button>
                {REMEDIATION_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="option"
                    aria-selected={selectedRemStatus === s}
                    onClick={() => { setSelectedRemStatus(s); setShowRemStatusPicker(false); }}
                    className={cn(
                      'block w-full px-3 py-2 text-start text-xs hover:bg-surface',
                      selectedRemStatus === s ? 'font-semibold text-ink' : 'text-ink-muted',
                    )}
                  >
                    {t(`regulatory.cascade.remediationStatus.${s}`)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active filter count */}
          {(nonCompliantOnly || selectedEmirate || selectedBand || selectedRemStatus || search) && (
            <span className="text-xs text-ink-muted">
              {filteredItems.length} / {items.length}
            </span>
          )}
        </div>
      </div>

      {/* ── Remediation table (virtualized) ────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">
          {t('regulatory.cascade.detail.remediationTable.heading')}
        </h2>
        {filteredItems.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-sm text-ink-muted">
              {search || nonCompliantOnly || selectedEmirate || selectedBand || selectedRemStatus
                ? t('common.noResults', { defaultValue: 'No rows match the current filters.' })
                : t('regulatory.cascade.detail.remediationTable.empty')}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border shadow-sm">
            {/* Column widths shared by head + body tables; see
                components/patterns/FixedColumnsTable.tsx. */}
            <ScrollbarReservedHeader>
            <table className="w-full table-fixed text-sm">
              <PercentColgroup widths={CASCADE_DETAIL_COL_WIDTHS} />
              <thead className="bg-surface">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {t('regulatory.cascade.detail.columns.contractor')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {t('regulatory.cascade.detail.columns.emirate')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {t('regulatory.cascade.detail.columns.headcountBand')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {t('regulatory.cascade.detail.columns.affectedClauses')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                    {t('regulatory.cascade.detail.columns.penaltyExposure')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                    {t('regulatory.cascade.detail.columns.icvAttachments')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {t('regulatory.cascade.detail.columns.remediationStatus')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {t('common.action', { defaultValue: 'Action' })}
                  </th>
                </tr>
              </thead>
            </table>
            </ScrollbarReservedHeader>

            {/* Virtualized body — overflow-y-scroll so scrollbar gutter is
                always reserved, matching the head's pr-[17px]. */}
            <div
              ref={parentRef}
              className="h-[600px] overflow-y-scroll"
            >
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const item = filteredItems[virtualRow.index];
                  if (!item) return null;
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <table className="w-full table-fixed text-sm">
                        <PercentColgroup widths={CASCADE_DETAIL_COL_WIDTHS} />
                        <tbody>
                          <CascadeItemRow
                            item={item}
                            canRead={canRead}
                            canRun={canRun}
                            canDraftAmend={canDraftAmend}
                          />
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Row count footer */}
            <div className="border-t border-border px-4 py-2 text-xs text-ink-muted">
              {filteredItems.length} / {items.length}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// SummaryTile — KPI tile for run header
// ─────────────────────────────────────────────────────────────
function SummaryTile({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: string;
  variant?: 'default' | 'warning' | 'risk';
}) {
  const variantClass =
    variant === 'risk'
      ? 'border-terracotta/30 bg-terracotta/5'
      : variant === 'warning'
        ? 'border-warning/30 bg-warning/5'
        : 'border-border bg-card';

  const valueClass =
    variant === 'risk'
      ? 'text-terracotta'
      : variant === 'warning'
        ? 'text-warning'
        : 'text-ink';

  return (
    <div className={`rounded-lg border p-4 ${variantClass}`}>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CascadeItemRow — per-contractor row with inline status + actions
// ─────────────────────────────────────────────────────────────
function CascadeItemRow({
  item,
  canRead,
  canRun,
  canDraftAmend,
}: {
  item: RegulatoryCascadeItemDetail;
  canRead: boolean;
  canRun: boolean;
  canDraftAmend: boolean;
}) {
  const { t, i18n: i18nForRow } = useTranslation();
  const isAr = i18nForRow.language?.startsWith('ar');
  const queryClient = useQueryClient();
  const [statusNote, setStatusNote] = useState('');
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<RemediationStatus>(
    item.remediationStatus,
  );

  const setStatusMutation = useMutation({
    mutationFn: (payload: { status: RemediationStatus; note?: string }) =>
      regulatoryCascadeService.setItemStatus(item.id, {
        status: payload.status,
        note: payload.note ?? null,
      }),
    onSuccess: () => {
      toast.success(t('regulatory.cascade.toast.statusUpdated'));
      void queryClient.invalidateQueries({ queryKey: ['regulatory-cascade-detail'] });
      setShowStatusForm(false);
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'regulatory.cascade.errors.statusUpdateFailed'));
    },
  });

  const draftMutation = useMutation({
    mutationFn: () =>
      regulatoryCascadeService.draftAmendment(item.id, {}),
    onSuccess: (res) => {
      toast.success(
        t('regulatory.cascade.toast.draftCreated', {
          draftId: res.draftId,
          defaultValue: 'Amendment draft #{{draftId}} created.',
        }),
      );
      void queryClient.invalidateQueries({ queryKey: ['regulatory-cascade-detail'] });
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'regulatory.cascade.errors.draftFailed'));
    },
  });

  const bandClass =
    BAND_COLORS[item.headcountBand] ?? 'bg-muted text-ink-muted border-border';
  const statusClass =
    REMEDIATION_COLORS[item.remediationStatus] ??
    'bg-muted text-ink-muted border-border';

  // Suppress unused variable warning — canRun used for future run action
  void canRun;

  return (
    <>
      <tr className="transition-colors hover:bg-surface/50">
        <td className="px-4 py-3">
          {/* Re-audit fix — show one language only based on actor's locale. */}
          <p className="font-medium text-ink">
            {isAr && item.contractorNameAr ? item.contractorNameAr : item.contractorNameEn}
          </p>
        </td>
        <td className="px-4 py-3 text-xs text-ink-muted">
          {/* Re-audit fix — humanize emirate slug ("abu_dhabi" → "Abu Dhabi"). */}
          {item.emirate ? humanizeLabel(item.emirate) : '—'}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider ${bandClass}`}
          >
            {item.headcountBand}
          </span>
        </td>
        <td className="px-4 py-3">
          {item.affectedClauseCount > 0 ? (
            <span className="inline-flex items-center rounded-full bg-ink/10 px-2 py-0.5 text-xs font-medium text-ink">
              {t('regulatory.cascade.detail.clauseCount', {
                count: item.affectedClauseCount,
              })}
            </span>
          ) : (
            <span className="text-xs text-ink-muted">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right font-mono tabular-nums text-sm text-ink">
          {formatAedRange(item.penaltyExposureMinAed, item.penaltyExposureMaxAed)}
        </td>
        <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
          {item.icvAttachmentCount}
        </td>
        <td className="px-4 py-3">
          {/* Re-audit fix — drop uppercase class so "PENDING" reads "Pending". */}
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider ${statusClass}`}
          >
            {t(`regulatory.cascade.remediationStatus.${item.remediationStatus}`)}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {canRead && (
              <button
                type="button"
                onClick={() => setShowStatusForm((v) => !v)}
                className="rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-ink hover:border-gold/60 hover:bg-gold/10 focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={t('regulatory.cascade.detail.actions.updateStatus')}
              >
                {t('regulatory.cascade.detail.actions.updateStatus')}
              </button>
            )}
            {canDraftAmend && item.advisoryDraftId === null && (
              <button
                type="button"
                disabled={
                  draftMutation.isPending ||
                  item.affectedContractIds.length === 0
                }
                onClick={() => draftMutation.mutate()}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-ink hover:border-primary/60 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                aria-label={t('regulatory.cascade.detail.actions.draftAmendment')}
              >
                <FileEdit className="h-3 w-3" aria-hidden="true" />
                {draftMutation.isPending
                  ? t('common.saving')
                  : t('regulatory.cascade.detail.actions.draftAmendment')}
              </button>
            )}
            {item.advisoryDraftId !== null && (
              <span className="rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] text-success">
                {t('regulatory.cascade.detail.draftLinked')}
              </span>
            )}
          </div>
        </td>
      </tr>

      {/* Inline status update form */}
      {showStatusForm && (
        <tr className="bg-surface/60">
          <td colSpan={8} className="px-4 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label
                  htmlFor={`status-select-${item.id}`}
                  className="text-xs font-medium text-ink-muted"
                >
                  {t('regulatory.cascade.detail.statusForm.newStatus')}
                </Label>
                <select
                  id={`status-select-${item.id}`}
                  value={selectedStatus}
                  onChange={(e) =>
                    setSelectedStatus(e.target.value as RemediationStatus)
                  }
                  className="h-8 rounded-md border border-border bg-card px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {REMEDIATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`regulatory.cascade.remediationStatus.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[220px] flex-1 space-y-1">
                <Label
                  htmlFor={`status-note-${item.id}`}
                  className="text-xs font-medium text-ink-muted"
                >
                  {t('regulatory.cascade.detail.statusForm.note')}
                </Label>
                <input
                  id={`status-note-${item.id}`}
                  type="text"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder={t(
                    'regulatory.cascade.detail.statusForm.notePlaceholder',
                  )}
                  className="h-8 w-full rounded-md border border-border bg-card px-2 text-sm text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={setStatusMutation.isPending}
                  onClick={() =>
                    setStatusMutation.mutate({
                      status: selectedStatus,
                      note: statusNote || undefined,
                    })
                  }
                >
                  {t('common.save')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowStatusForm(false)}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// IcvImpactSection — affected contractors' ICV attachments
// ─────────────────────────────────────────────────────────────
function IcvImpactSection({
  items,
}: {
  items: RegulatoryCascadeItemDetail[];
}) {
  const { t } = useTranslation();

  const withIcv = items.filter((i) => i.icvAttachmentCount > 0);

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-ink">
        {t('regulatory.cascade.detail.icvImpact.heading')}
      </h2>
      <p className="mb-4 text-xs text-ink-muted">
        {t('regulatory.cascade.detail.icvImpact.description')}
      </p>
      {withIcv.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-ink-muted">
            {t('regulatory.cascade.detail.icvImpact.empty')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-surface">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {t('regulatory.cascade.detail.icvImpact.columns.contractor')}
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {t('regulatory.cascade.detail.icvImpact.columns.emirate')}
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                  {t('regulatory.cascade.detail.icvImpact.columns.icvCerts')}
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                  {t('regulatory.cascade.detail.icvImpact.columns.emiratisationGap')}
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {t('regulatory.cascade.detail.icvImpact.columns.tenderEffect')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {withIcv.map((item) => (
                <tr
                  key={item.id}
                  className="transition-colors hover:bg-surface/50"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">
                      {item.contractorNameEn}
                    </p>
                    {item.contractorNameAr && (
                      <p className="text-xs text-ink-muted" dir="rtl">
                        {item.contractorNameAr}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-muted">
                    {item.emirate ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                    {item.icvAttachmentCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                    {item.emiratisationGap}
                  </td>
                  <td className="px-4 py-3">
                    {item.isCompliant ? (
                      <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                        {t('regulatory.cascade.detail.icvImpact.tenderEffect.compliant')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                        {t('regulatory.cascade.detail.icvImpact.tenderEffect.atRisk')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
