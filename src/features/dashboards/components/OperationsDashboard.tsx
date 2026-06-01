/**
 * M15 / CR-G — Operations & SLA persona dashboard.
 *
 * GET /api/v1/dashboards/operations?windowDays=N
 * Permission: insights.operations
 *
 * Sections:
 *   1. KPI strip (4 tiles) — open SLA breaches / delivery delays / penalty exposure / vendors with breaches
 *   2. SLA Breaches list — top 8 by marAed DESC
 *   3. Delivery Delay Tracker — top 8 by signalCount180d DESC
 *   4. Penalty Exposure BarChart — by contract
 *   5. Recent Ops Events feed — top 15 newest-first
 *   6. Vendor Performance Scorecards — top 8 worst-first
 *
 * T1–T13 compliance. Auto-refresh 60s (HITL Q3). RTL parity. Three data states.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Clock, MoreHorizontal, TrendingDown } from 'lucide-react';
import { useOperationsDashboard } from '../hooks/useCrgDashboards';
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardFreshness,
  DashboardLoadingSkeleton,
  KpiTile,
  TimeRangeSelector,
  rangeFromWindowDays,
  humanizeLabel,
} from './dashboard-primitives';
import { useAuthStore, selectUser } from '@/store/auth.store';
import { formatDateTime, formatDate, formatHijriDate } from '@/utils/datetime';
import type { DashboardRangeKey } from '@/types/entities/dashboards.types';
import type {
  SlaBreachRow,
  DeliveryDelayRow,
  PenaltyExposureRow,
  OpsEventRow,
  VendorScorecardRow,
} from '@/types/entities/crg-dashboards.types';
import {
  AcknowledgeEventDialog,
  LinkRemedyDialog,
  EscalateEventDialog,
} from '@/features/operations/components/ActionDialogs';

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatAedCompact(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return '—';
  try {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  } catch {
    if (num >= 1_000_000) return `AED ${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `AED ${(num / 1_000).toFixed(1)}K`;
    return `AED ${num.toFixed(0)}`;
  }
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-AE').format(n);
}

// ─── Severity badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const colorMap: Record<string, string> = {
    critical: 'bg-terracotta/20 text-terracotta border-terracotta/30',
    high: 'bg-amber/20 text-amber border-amber/30',
    medium: 'bg-gold/20 text-ink border-gold/30',
    low: 'bg-sage/20 text-sage border-sage/30',
  };
  const cls = colorMap[severity.toLowerCase()] ?? 'bg-muted text-ink-muted border-border';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls}`}>
      {severity}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

// L1: default to last_7d for Operations (SLA breaches need same-week visibility)
const DEFAULT_WINDOW = 7;

export function OperationsDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [range, setRange] = useState<DashboardRangeKey>(rangeFromWindowDays(DEFAULT_WINDOW));

  const { data, isLoading, isError, error, refetch } = useOperationsDashboard(windowDays);

  const nowISO = new Date().toISOString();

  // L2: welcome line first-name only
  const welcomeName = user ? user.firstName : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6 p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-ink-subtle">
            {welcomeName
              ? `${t('dashboards.common.welcome', { defaultValue: 'Welcome back' })}, ${welcomeName} · ${formatDate(nowISO)} · ${formatHijriDate(nowISO)}`
              : `${formatDate(nowISO)} · ${formatHijriDate(nowISO)}`}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t('dashboards.operations.title')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t('dashboards.operations.subtitle')}
          </p>
          {data?.asOf && <DashboardFreshness asOf={data.asOf} className="mt-1" />}
        </div>
        <TimeRangeSelector
          range={range}
          windowDays={windowDays}
          minWindowDays={7}
          onChange={({ range: r, windowDays: d }) => {
            setRange(r);
            setWindowDays(d);
          }}
        />
      </header>

      {isLoading && !data ? (
        <DashboardLoadingSkeleton rows={2} />
      ) : isError ? (
        <DashboardErrorState
          error={error}
          onRetry={() => void refetch()}
          fallbackKey="dashboards.operations.errors.loadFailed"
        />
      ) : !data ? (
        <DashboardEmptyState />
      ) : (
        <>
          {/* KPI strip */}
          <section
            aria-label={t('dashboards.operations.kpiGroupLabel')}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <KpiTile
              label={t('dashboards.operations.kpis.openSlaBreaches')}
              value={formatNumber(data.kpi.openSlaBreaches)}
              // O8: suppress redundant "AED 0" helper when count is 0.
              helper={data.kpi.openSlaBreaches > 0 ? formatAedCompact(data.kpi.openSlaBreachesMarAed) : undefined}
              variant={data.kpi.openSlaBreaches > 0 ? 'risk' : 'default'}
            />
            <KpiTile
              label={t('dashboards.operations.kpis.deliveryDelays')}
              value={formatNumber(data.kpi.deliveryDelaysCount)}
              variant={data.kpi.deliveryDelaysCount > 0 ? 'warning' : 'default'}
            />
            <KpiTile
              label={t('dashboards.operations.kpis.penaltyExposure')}
              value={formatAedCompact(data.kpi.contractPenaltyExposureAed)}
              variant={Number(data.kpi.contractPenaltyExposureAed) > 0 ? 'risk' : 'default'}
            />
            <KpiTile
              label={t('dashboards.operations.kpis.vendorsWithBreaches')}
              value={formatNumber(data.kpi.vendorsWithBreaches)}
              variant={data.kpi.vendorsWithBreaches > 0 ? 'warning' : 'default'}
            />
          </section>

          {/* SLA Breaches list */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-terracotta" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">
                {t('dashboards.operations.sections.slaBreaches')}
              </h2>
            </div>
            <SlaBreachesList rows={data.slaBreachesList} />
          </section>

          {/* Delivery Delay Tracker */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">
                {t('dashboards.operations.sections.deliveryDelays')}
              </h2>
            </div>
            <DeliveryDelayList rows={data.deliveryDelayTracker} />
          </section>

          {/* Penalty Exposure BarChart */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-terracotta" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">
                {t('dashboards.operations.sections.penaltyExposure')}
              </h2>
            </div>
            <PenaltyExposureChart rows={data.penaltyExposureByContract} />
          </section>

          {/* Ops Events feed */}
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">
              {t('dashboards.operations.sections.opsEvents')}
            </h2>
            <OpsEventsFeed rows={data.opsEventsFeed} />
          </section>

          {/* Vendor Scorecards */}
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">
              {t('dashboards.operations.sections.vendorScorecards')}
            </h2>
            <VendorScorecardTable rows={data.vendorScorecards} />
          </section>
        </>
      )}
    </motion.div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SlaBreachesList({ rows }: { rows: SlaBreachRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <DashboardEmptyState description={t('dashboards.operations.empty.noSlaBreaches')} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.operations.table.contract')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.operations.table.counterparty')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.operations.table.breachKind')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.operations.table.severity')}</th>
            <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.operations.table.marAed')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.operations.table.occurredAt')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.signalId} className="border-t border-border/60">
              <td className="py-2 pe-3">
                <Link
                  to="/app/contracts/$id"
                  params={{ id: row.contractId }}
                  className="font-mono text-xs text-gold hover:underline"
                >
                  {row.contractNumber}
                </Link>
              </td>
              <td className="py-2 pe-3 text-ink">{row.counterpartyName}</td>
              <td className="py-2 pe-3">
                <span className="inline-flex rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-ink-muted">
                  {humanizeLabel(row.breachKind)}
                </span>
              </td>
              <td className="py-2 pe-3">
                <SeverityBadge severity={row.severity} />
              </td>
              <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                {formatAedCompact(row.marAed)}
              </td>
              <td className="py-2 pe-3 text-xs text-ink-subtle">
                {formatDateTime(row.occurredAt, { showTime: false })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeliveryDelayList({ rows }: { rows: DeliveryDelayRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <DashboardEmptyState description={t('dashboards.operations.empty.noDelays')} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.operations.table.contract')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.operations.table.counterparty')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.operations.table.lastMilestone')}</th>
            <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.operations.table.delayDays')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.operations.table.severity')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.contractId} className="border-t border-border/60">
              <td className="py-2 pe-3">
                <Link
                  to="/app/contracts/$id"
                  params={{ id: row.contractId }}
                  className="font-mono text-xs text-gold hover:underline"
                >
                  {row.contractNumber}
                </Link>
              </td>
              <td className="py-2 pe-3 text-ink">{row.counterpartyName}</td>
              {/* O5: row.lastDelayedMilestone from BE is currently the correlation match_reason
                  (a rule trigger description). Truncate + de-emphasise so it reads as a contextual
                  trigger note, not a milestone name. Title attr exposes full text on hover. */}
              <td className="py-2 pe-3 text-xs text-ink-muted" title={row.lastDelayedMilestone ?? undefined}>
                {row.lastDelayedMilestone
                  ? (row.lastDelayedMilestone.length > 60
                      ? row.lastDelayedMilestone.slice(0, 60) + '…'
                      : row.lastDelayedMilestone)
                  : '—'}
              </td>
              <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                {row.delayDays != null ? `${row.delayDays}d` : '—'}
              </td>
              <td className="py-2 pe-3">
                <SeverityBadge severity={row.severity} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PenaltyExposureChart({ rows }: { rows: PenaltyExposureRow[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (rows.length === 0) {
    return <DashboardEmptyState description={t('dashboards.operations.empty.noPenalty')} />;
  }
  const chartData = rows.map((r) => ({
    name: r.contractNumber,
    exposure: Number(r.exposureAed),
    contractId: r.contractId,
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 4, right: 32, left: 4, bottom: 4 }}
          onClick={(chartState) => {
            // M2: click bar → navigate to contract detail (risk tab)
            const payload = chartState?.activePayload?.[0]?.payload as typeof chartData[0] | undefined;
            if (payload?.contractId) {
              void navigate({ to: "/app/contracts/$id", params: { id: String(payload.contractId) } });
            }
          }}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: 'var(--ink-muted)' }}
            tickFormatter={(v: number) => formatAedCompact(v)}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 10, fill: 'var(--ink-muted)' }}
          />
          <Tooltip
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
            formatter={(v: number) => [formatAedCompact(v), t('dashboards.operations.chart.exposure')]}
          />
          <Bar
            dataKey="exposure"
            fill="var(--terracotta)"
            radius={[0, 4, 4, 0]}
            style={{ cursor: 'pointer' }}
            aria-label={t('dashboards.operations.chart.barAriaLabel')}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function OpsEventsFeed({ rows }: { rows: OpsEventRow[] }) {
  const { t } = useTranslation();
  const [acknowledgeId, setAcknowledgeId] = useState<string | null>(null);
  const [acknowledgeOpen, setAcknowledgeOpen] = useState(false);
  const [linkRemedyId, setLinkRemedyId] = useState<string | null>(null);
  const [linkRemedyOpen, setLinkRemedyOpen] = useState(false);
  const [escalateId, setEscalateId] = useState<string | null>(null);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [openMenuIdx, setOpenMenuIdx] = useState<number | null>(null);

  if (rows.length === 0) {
    return <DashboardEmptyState description={t('dashboards.operations.empty.noEvents')} />;
  }

  // correlationId is approximated from sourceRef or contractId+eventType;
  // OpsEventRow doesn't carry a correlationId natively — use sourceRef as proxy.
  // If sourceRef is null, fall back to contractId (BE enforces idempotency on acknowledge).
  function getCorrelationId(row: OpsEventRow): string {
    return row.sourceRef ?? row.contractId;
  }

  return (
    <>
      <ul className="space-y-2" aria-label={t('dashboards.operations.sections.opsEvents')}>
        {rows.map((row, idx) => (
          <li
            key={`${row.contractId}-${idx}`}
            className="relative flex items-start gap-3 rounded-md border border-border/60 bg-surface p-3"
          >
            <SeverityBadge severity={row.severity} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">{row.headline}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {row.counterpartyName} · {formatDateTime(row.occurredAt, { showTime: false })}
              </p>
            </div>
            {/* O4: row.eventType is a rule_id slug (e.g. rule.sla.day_rate_breach).
                Humanize via humanizeLabel so the chip reads as a human label.
                The full rule_id stays in the title attr for power-user inspection. */}
            <Link
              to="/app/contracts/$id"
              params={{ id: row.contractId }}
              className="shrink-0 font-mono text-[10px] text-gold hover:underline"
              title={row.eventType}
            >
              {humanizeLabel(
                row.eventType
                  ?.replace(/^rule\./, '')
                  .replace(/\./g, ' '),
              )}
            </Link>
            {/* Row actions menu (H5) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenuIdx(openMenuIdx === idx ? null : idx)}
                className="rounded-md p-1 text-ink-muted hover:bg-surface"
                aria-label={t('dashboards.operations.actions.menuAriaLabel')}
                aria-expanded={openMenuIdx === idx}
                aria-haspopup="menu"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {openMenuIdx === idx && (
                <div
                  role="menu"
                  className="absolute end-0 top-7 z-20 min-w-[160px] rounded-md border border-border bg-card shadow-lg"
                  onBlur={() => setOpenMenuIdx(null)}
                >
                  <button
                    role="menuitem"
                    type="button"
                    className="w-full rounded-t-md px-4 py-2 text-left text-sm text-ink hover:bg-muted"
                    onClick={() => {
                      setAcknowledgeId(getCorrelationId(row));
                      setAcknowledgeOpen(true);
                      setOpenMenuIdx(null);
                    }}
                  >
                    {t('ops.actions.acknowledge.title')}
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    className="w-full px-4 py-2 text-left text-sm text-ink hover:bg-muted"
                    onClick={() => {
                      setLinkRemedyId(getCorrelationId(row));
                      setLinkRemedyOpen(true);
                      setOpenMenuIdx(null);
                    }}
                  >
                    {t('ops.actions.linkRemedy.title')}
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    className="w-full rounded-b-md px-4 py-2 text-left text-sm text-ink hover:bg-muted"
                    onClick={() => {
                      setEscalateId(getCorrelationId(row));
                      setEscalateOpen(true);
                      setOpenMenuIdx(null);
                    }}
                  >
                    {t('ops.actions.escalate.title')}
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <AcknowledgeEventDialog
        correlationId={acknowledgeId}
        open={acknowledgeOpen}
        onClose={() => {
          setAcknowledgeOpen(false);
          setAcknowledgeId(null);
        }}
      />
      <LinkRemedyDialog
        correlationId={linkRemedyId}
        open={linkRemedyOpen}
        onClose={() => {
          setLinkRemedyOpen(false);
          setLinkRemedyId(null);
        }}
      />
      <EscalateEventDialog
        correlationId={escalateId}
        open={escalateOpen}
        onClose={() => {
          setEscalateOpen(false);
          setEscalateId(null);
        }}
      />
    </>
  );
}

function VendorScorecardTable({ rows }: { rows: VendorScorecardRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <DashboardEmptyState description={t('dashboards.operations.empty.noVendors')} />;
  }
  const tierColors: Record<string, string> = {
    high: 'text-terracotta',
    medium: 'text-amber',
    low: 'text-sage',
  };
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.operations.table.vendor')}</th>
            <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.operations.table.riskScore')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.operations.table.performanceTier')}</th>
            <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.operations.table.slaBreaches180d')}</th>
            <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.operations.table.deliveryDelays180d')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.counterpartyId} className="border-t border-border/60">
              <td className="py-2 pe-3">
                <Link
                  to="/app/parties/$id"
                  params={{ id: row.counterpartyId }}
                  className="text-sm text-ink hover:text-gold hover:underline"
                >
                  {row.counterpartyName}
                </Link>
              </td>
              <td className="py-2 pe-3 font-mono tabular-nums text-ink">{row.riskScore}</td>
              <td className="py-2 pe-3">
                <span className={`font-medium ${tierColors[row.performanceTier] ?? 'text-ink-muted'}`}>
                  {t(`dashboards.common.tier.${row.performanceTier}`)}
                </span>
              </td>
              <td className="py-2 pe-3 font-mono tabular-nums text-ink">{row.slaBreachCount180d}</td>
              <td className="py-2 pe-3 font-mono tabular-nums text-ink">{row.deliveryDelayCount180d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default OperationsDashboard;
