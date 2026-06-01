/**
 * M15 / CR-G — Procurement supplier-risk dashboard.
 *
 * GET /api/v1/dashboards/procurement?windowDays=N
 * Permission: insights.procurement_supplier_risk
 * Roles: contract_drafter, contract_approver, platform_admin, Super Admin
 *
 * Sections:
 *   1. KPI strip (4 tiles) — total suppliers / at-risk / ICV non-compliant / financial distress
 *   2. Supplier Risk Scorecard table — top 20 worst-first
 *   3. ICV Compliance Tracker — top 15 non-compliant
 *   4. Backup Supplier Suggestions — top 5 distressed primaries × 3 alternatives
 *   5. Vendor Financial Health Summary — empty-state v1
 *
 * T1–T13 compliance. Auto-refresh 60s. RTL parity. Three data states.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from '@tanstack/react-router';
import { Users, ShieldCheck, TrendingUp, AlertTriangle, ArrowUpRight, PieChart as PieChartIcon, BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useProcurementDashboard } from '../hooks/useCrgDashboards';
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardFreshness,
  DashboardLoadingSkeleton,
  KpiTile,
  TimeRangeSelector,
  humanizeLabel,
  rangeFromWindowDays,
} from './dashboard-primitives';
import {
  ActivateAlternateVendorDialog,
  EscalateVendorPerformanceDialog,
  InitiateCureNoticeDialog,
  InitiateIcvRemediationDialog,
} from '@/features/procurement/components/ActionDialogs';
import { useAuthStore, selectUser, selectHasPermission } from '@/store/auth.store';
import { formatDateTime, formatDate, formatHijriDate } from '@/utils/datetime';
import type { DashboardRangeKey } from '@/types/entities/dashboards.types';
import type {
  SupplierScorecardRow,
  IcvComplianceRow,
  BackupSupplierGroup,
  ProcurementChartsData,
} from '@/types/entities/crg-dashboards.types';

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
    return `AED ${num.toFixed(0)}`;
  }
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-AE').format(n);
}

const tierColors: Record<string, string> = {
  high: 'bg-terracotta/20 text-terracotta border-terracotta/30',
  medium: 'bg-amber/20 text-amber border-amber/30',
  low: 'bg-sage/20 text-sage border-sage/30',
};

function RiskTierBadge({ tier }: { tier: string }) {
  // P6/P49: humanize tier slug (high/medium/low → High / Medium / Low)
  const cls = tierColors[tier.toLowerCase()] ?? 'bg-muted text-ink-muted border-border';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls}`}>
      {humanizeLabel(tier)}
    </span>
  );
}

const DEFAULT_WINDOW = 90;

export function ProcurementDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);
  // A22 (Aisha audit fix 2026-06-01) — Aisha (contract_approver) DOES have
  // risk.acknowledge per Annex D (used to accept-risk on her own approval
  // queue), so a pure permission gate isn't enough. The Cure Notice
  // initiator is conceptually a PROCUREMENT-write action — restrict the
  // section to roles whose primary workflow is procurement (procurement_
  // supplier_risk + legal_counsel for the cure-notice authoring path).
  // Aisha sees the read-only scorecard without the write CTA.
  const roleName = useAuthStore((s) => s.user?.role?.name);
  const canActOnProcurement = ['procurement_supplier_risk', 'legal_counsel', 'platform_admin', 'Super Admin'].includes(roleName ?? '');
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [range, setRange] = useState<DashboardRangeKey>(rangeFromWindowDays(DEFAULT_WINDOW));

  const { data, isLoading, isError, error, refetch } = useProcurementDashboard(windowDays);

  const nowISO = new Date().toISOString();

  // Action dialog state — only one dialog open at a time.
  const [activateDialog, setActivateDialog] = useState<{ partyId: string; vendorName?: string } | null>(null);
  const [escalateDialog, setEscalateDialog] = useState<{ partyId: string; vendorName?: string } | null>(null);
  const [cureDialog, setCureDialog] = useState<{ contractId: string; label?: string } | null>(null);
  const [icvDialog, setIcvDialog] = useState<{ contractId: string; label?: string } | null>(null);

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
            {user
              ? `${t('dashboards.common.welcome', { defaultValue: 'Welcome back' })}, ${user.firstName} · ${formatDate(nowISO)} · ${formatHijriDate(nowISO)}`
              : `${formatDate(nowISO)} · ${formatHijriDate(nowISO)}`}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t('dashboards.procurement.title')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted" suppressHydrationWarning>
            {/* A21 (Aisha audit fix) — `suppressHydrationWarning` tolerates
                the brief SSR-vs-client divergence while the i18n bundle on
                Node startup catches up; the user sees the up-to-date string
                on the very next paint and no error fires. */}
            {t('dashboards.procurement.subtitle', {
              defaultValue:
                'Supplier risk scores, ICV compliance, SLA breaches, vendor financial health, and backup alternates',
            })}
          </p>
          {data?.asOf && (
            <div className="mt-2">
              <DashboardFreshness asOf={data.asOf} />
            </div>
          )}
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
          fallbackKey="dashboards.procurement.errors.loadFailed"
        />
      ) : !data ? (
        <DashboardEmptyState />
      ) : (
        <>
          {/* KPI strip */}
          <section
            aria-label={t('dashboards.procurement.kpiGroupLabel')}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <KpiTile
              label={t('dashboards.procurement.kpis.totalSuppliers')}
              value={formatNumber(data.kpi.totalSupplierCount)}
            />
            <KpiTile
              label={t('dashboards.procurement.kpis.suppliersAtRisk')}
              value={formatNumber(data.kpi.supplierBreachesCount)}
              variant={data.kpi.supplierBreachesCount > 0 ? 'warning' : 'default'}
            />
            <KpiTile
              label={t('dashboards.procurement.kpis.icvNonCompliant')}
              value={formatNumber(data.kpi.icvNonCompliantCount)}
              variant={data.kpi.icvNonCompliantCount > 0 ? 'warning' : 'default'}
            />
            <KpiTile
              label={t('dashboards.procurement.kpis.financialDistress')}
              value={formatNumber(data.kpi.supplierFinancialDistressCount)}
              variant={data.kpi.supplierFinancialDistressCount > 0 ? 'risk' : 'default'}
            />
          </section>

          {/* P1: Charts row — concentration donut + tier distribution + SLA trend */}
          {data.chartsData && <ProcurementChartsSection charts={data.chartsData} />}

          {/* Supplier Risk Scorecard */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-gold" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">
                {t('dashboards.procurement.sections.supplierScorecard')}
              </h2>
            </div>
            <SupplierScorecardTable
              rows={data.supplierRiskScorecard}
              onActivateAlternate={(row) =>
                setActivateDialog({ partyId: row.counterpartyId, vendorName: row.counterpartyName })
              }
              onEscalate={(row) =>
                setEscalateDialog({ partyId: row.counterpartyId, vendorName: row.counterpartyName })
              }
            />
          </section>

          {/* ICV Compliance Tracker */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-sage" aria-hidden />
                <h2 className="text-sm font-semibold text-ink">
                  {t('dashboards.procurement.sections.icvCompliance')}
                </h2>
              </div>
              {data.icvComplianceTracker.some((r) => r.icvStatus === 'non_compliant') && (
                <button
                  type="button"
                  onClick={() => setIcvDialog({ contractId: '' })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-sage/50 bg-card px-3 py-1 text-xs font-medium text-sage hover:bg-sage/10"
                >
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  {t('procurement.actions.icvRemediation.shortLabel')}
                </button>
              )}
            </div>
            <IcvComplianceTrackerList rows={data.icvComplianceTracker} />
          </section>

          {/* Backup Supplier Suggestions */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sage" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">
                {t('dashboards.procurement.sections.backupSuppliers')}
              </h2>
            </div>
            <BackupSupplierSuggestionsList groups={data.backupSupplierSuggestions} />
          </section>

          {/* Vendor Financial Health — D&B mock data per brief Out-of-Scope */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">
                {t('dashboards.procurement.sections.financialHealth')}
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                {t('dashboards.procurement.financialHealth.sourceCaption')}
              </span>
            </div>
            {data.vendorFinancialHealthSummary.length === 0 ? (
              /* A23 (Aisha audit fix) — give the empty state a positive title
                 instead of falling back to "Nothing here yet". The signal
                 here is "no distress detected" which is the good state. */
              <DashboardEmptyState
                title={t('dashboards.procurement.empty.financialHealthOkTitle', {
                  defaultValue: 'No vendor distress signals',
                })}
                description={t('dashboards.procurement.empty.financialHealthV1')}
              />
            ) : (
              <ul className="space-y-2">
                {data.vendorFinancialHealthSummary.map((row) => (
                  <li key={`${row.counterpartyId}-${row.occurredAt}`} className="flex items-start gap-3 rounded-md border border-border/60 bg-surface p-3">
                    <span className="inline-flex rounded bg-terracotta/15 px-2 py-0.5 font-mono text-[10px] text-terracotta">
                      {row.signalKind}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{row.counterpartyName}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {row.signalHeadline} · {formatDateTime(row.occurredAt, { showTime: false })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* P19: Cure-notice trigger surfaces from the dedicated cureNoticeCandidates list
              (mig 412) — independent of the top-20 scorecard slice. Falls back to the in-scorecard
              SLA breach derivation when the BE doesn't return the new field. */}
          {(() => {
            // A22 (Aisha audit) — entire Cure Notice initiator section is
            // a write surface gated on risk.acknowledge. Hidden for actors
            // without it (e.g. Aisha Approver).
            if (!canActOnProcurement) return null;
            const candidates =
              data.cureNoticeCandidates && data.cureNoticeCandidates.length > 0
                ? data.cureNoticeCandidates
                : data.supplierRiskScorecard
                    .filter((r) => r.slaBreachCount180d > 0)
                    .map((r) => ({
                      counterpartyId: r.counterpartyId,
                      counterpartyName: r.counterpartyName,
                      slaBreachCount180d: r.slaBreachCount180d,
                    }));
            if (candidates.length === 0) return null;
            return (
              <section className="rounded-lg border border-amber/40 bg-amber/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber" aria-hidden />
                  <h2 className="text-sm font-semibold text-ink">
                    {t('dashboards.procurement.sections.cureNoticeAffordance')}
                  </h2>
                </div>
                <p className="mb-3 text-xs text-ink-muted">
                  {t('dashboards.procurement.sections.cureNoticeHelp')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {candidates.slice(0, 8).map((c) => (
                    <button
                      key={`cure-${c.counterpartyId}`}
                      type="button"
                      onClick={() =>
                        setCureDialog({
                          contractId: '',
                          label: c.counterpartyName,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber/50 bg-card px-3 py-1 text-xs font-medium text-ink hover:border-amber hover:bg-amber/10"
                    >
                      <ArrowUpRight className="h-3 w-3" aria-hidden />
                      {c.counterpartyName}
                      {c.slaBreachCount180d > 0 && (
                        <span className="ms-1 font-mono text-[10px] text-amber">
                          ×{c.slaBreachCount180d}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            );
          })()}
        </>
      )}

      <ActivateAlternateVendorDialog
        partyId={activateDialog?.partyId ?? null}
        vendorName={activateDialog?.vendorName}
        open={!!activateDialog}
        onClose={() => setActivateDialog(null)}
        // P20: hand the alternate-vendor list from the engine into the dialog
        suggestedAlternatives={(() => {
          if (!activateDialog?.partyId || !data?.backupSupplierSuggestions) return undefined;
          const match = data.backupSupplierSuggestions.find(
            (g) => g.primaryCounterpartyId === activateDialog.partyId
          );
          return match?.suggestedAlternatives.map((a) => ({
            counterpartyName: a.counterpartyName,
            riskScore: a.riskScore,
          }));
        })()}
      />
      <EscalateVendorPerformanceDialog
        partyId={escalateDialog?.partyId ?? null}
        vendorName={escalateDialog?.vendorName}
        open={!!escalateDialog}
        onClose={() => setEscalateDialog(null)}
      />
      <InitiateCureNoticeDialog
        contractId={cureDialog?.contractId ?? null}
        contractLabel={cureDialog?.label}
        open={!!cureDialog}
        onClose={() => setCureDialog(null)}
      />
      <InitiateIcvRemediationDialog
        contractId={icvDialog?.contractId ?? null}
        contractLabel={icvDialog?.label}
        open={!!icvDialog}
        onClose={() => setIcvDialog(null)}
      />
    </motion.div>
  );
}

type ScorecardSortKey = 'counterpartyName' | 'partyType' | 'compositeRiskScore' | 'riskTier' | 'activeContractCount' | 'slaBreachCount180d' | 'totalContractValueAed';
type SortDir = 'asc' | 'desc';

// P8 — keep the original ranking order (BE already sorts worst-first) by default;
// click a header to override. ArrowUpDown shows current direction.
function SortHeader({
  label, sortKey, currentKey, currentDir, onSort, align = 'start',
}: {
  label: string;
  sortKey: ScorecardSortKey;
  currentKey: ScorecardSortKey | null;
  currentDir: SortDir;
  onSort: (k: ScorecardSortKey) => void;
  align?: 'start' | 'end';
}) {
  const active = currentKey === sortKey;
  const arrow = !active ? '↕' : currentDir === 'asc' ? '↑' : '↓';
  const ariaSort: 'ascending' | 'descending' | 'none' = !active ? 'none' : currentDir === 'asc' ? 'ascending' : 'descending';
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`py-2 pe-3 font-medium ${align === 'end' ? 'text-right tabular-nums' : ''}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 ${active ? 'text-ink' : 'text-ink-subtle hover:text-ink'}`}
      >
        <span>{label}</span>
        <span aria-hidden className="font-mono text-[10px]">{arrow}</span>
      </button>
    </th>
  );
}

function SupplierScorecardTable({
  rows,
  onActivateAlternate,
  onEscalate,
}: {
  rows: SupplierScorecardRow[];
  onActivateAlternate: (row: SupplierScorecardRow) => void;
  onEscalate: (row: SupplierScorecardRow) => void;
}) {
  const { t } = useTranslation();
  // P8: client-side sort layered on the BE's default worst-first order.
  const [sortKey, setSortKey] = useState<ScorecardSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  // A24 (Aisha audit fix 2026-06-01) — 25-row client-side pagination.
  // Mirrors the pattern Dana's parties page received. Resets when sort
  // changes so the user always sees page 1 of the new ordering.
  const PAGE_SIZE_SCORECARD = 25;
  const [scPage, setScPage] = useState(1);
  if (rows.length === 0) {
    return <DashboardEmptyState description={t('dashboards.procurement.empty.noSuppliers')} />;
  }

  const tierOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sortedRows = sortKey
    ? [...rows].sort((a, b) => {
        const va: number | string | null = (() => {
          switch (sortKey) {
            case 'totalContractValueAed': return Number(a.totalContractValueAed) || 0;
            case 'riskTier':              return tierOrder[a.riskTier?.toLowerCase()] ?? 99;
            case 'compositeRiskScore':    return a.compositeRiskScore ?? Number.POSITIVE_INFINITY;
            case 'activeContractCount':   return a.activeContractCount;
            case 'slaBreachCount180d':    return a.slaBreachCount180d;
            case 'partyType':             return a.partyType ?? '';
            default:                      return a.counterpartyName ?? '';
          }
        })();
        const vb: number | string | null = (() => {
          switch (sortKey) {
            case 'totalContractValueAed': return Number(b.totalContractValueAed) || 0;
            case 'riskTier':              return tierOrder[b.riskTier?.toLowerCase()] ?? 99;
            case 'compositeRiskScore':    return b.compositeRiskScore ?? Number.POSITIVE_INFINITY;
            case 'activeContractCount':   return b.activeContractCount;
            case 'slaBreachCount180d':    return b.slaBreachCount180d;
            case 'partyType':             return b.partyType ?? '';
            default:                      return b.counterpartyName ?? '';
          }
        })();
        const cmp = typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb));
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : rows;

  function onSort(k: ScorecardSortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir('asc');
    }
    setScPage(1); // A24 — reset to first page when sort changes
  }

  // A24 — paginate sortedRows
  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE_SCORECARD));
  const safePage = Math.min(scPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE_SCORECARD;
  const pagedRows = sortedRows.slice(pageStart, pageStart + PAGE_SIZE_SCORECARD);

  return (
    <div className="space-y-3 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
            <SortHeader label={t('dashboards.procurement.table.supplier')} sortKey="counterpartyName" currentKey={sortKey} currentDir={sortDir} onSort={onSort} />
            <SortHeader label={t('dashboards.procurement.table.type')} sortKey="partyType" currentKey={sortKey} currentDir={sortDir} onSort={onSort} />
            <SortHeader label={t('dashboards.procurement.table.riskScore')} sortKey="compositeRiskScore" currentKey={sortKey} currentDir={sortDir} onSort={onSort} align="end" />
            <SortHeader label={t('dashboards.procurement.table.riskTier')} sortKey="riskTier" currentKey={sortKey} currentDir={sortDir} onSort={onSort} />
            <SortHeader label={t('dashboards.procurement.table.activeContracts')} sortKey="activeContractCount" currentKey={sortKey} currentDir={sortDir} onSort={onSort} align="end" />
            <SortHeader label={t('dashboards.procurement.table.slaBreaches')} sortKey="slaBreachCount180d" currentKey={sortKey} currentDir={sortDir} onSort={onSort} align="end" />
            <SortHeader label={t('dashboards.procurement.table.totalValue')} sortKey="totalContractValueAed" currentKey={sortKey} currentDir={sortDir} onSort={onSort} align="end" />
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.procurement.table.actions', { defaultValue: 'Actions' })}</th>
          </tr>
        </thead>
        <tbody>
          {pagedRows.map((row) => (
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
              <td className="py-2 pe-3">
                <span className="inline-flex rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-ink-muted">
                  {humanizeLabel(row.partyType)}
                </span>
              </td>
              {/* P10: right-align numeric columns */}
              <td className="py-2 pe-3 text-right font-mono tabular-nums text-ink">
                {row.compositeRiskScore ?? '—'}
              </td>
              <td className="py-2 pe-3">
                <RiskTierBadge tier={row.riskTier} />
              </td>
              <td className="py-2 pe-3 text-right font-mono tabular-nums text-ink">{row.activeContractCount}</td>
              <td className="py-2 pe-3 text-right font-mono tabular-nums text-ink">{row.slaBreachCount180d}</td>
              <td className="py-2 pe-3 text-right font-mono tabular-nums text-ink">
                {formatAedCompact(row.totalContractValueAed)}
              </td>
              <td className="py-2 pe-3">
                {/* P9: role=group + sr-only separator so the two action chips don't read
                    as one glued word in screen-reader / screenshot-export contexts. */}
                <div
                  role="group"
                  aria-label={t('procurement.actions.rowActionsLabel', {
                    defaultValue: 'Actions for {{vendor}}',
                    vendor: row.counterpartyName,
                  })}
                  className="flex items-center gap-1.5"
                >
                  <button
                    type="button"
                    onClick={() => onActivateAlternate(row)}
                    aria-label={t('procurement.actions.activateAlternate.title')}
                    className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-ink hover:border-gold hover:text-gold"
                  >
                    {t('procurement.actions.activateAlternate.shortLabel')}
                  </button>
                  <span aria-hidden className="text-[10px] text-ink-subtle">·</span>
                  <span className="sr-only"> | </span>
                  <button
                    type="button"
                    onClick={() => onEscalate(row)}
                    aria-label={t('procurement.actions.escalateVendor.title')}
                    className="rounded-full border border-amber/60 bg-card px-2 py-0.5 text-[10px] font-medium text-amber hover:bg-amber/10"
                  >
                    {t('procurement.actions.escalateVendor.shortLabel')}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* A24 (Aisha audit fix) — pagination strip. Hidden when only one page. */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-[11px] text-ink-muted">
            {t('dashboards.procurement.scorecard.pagingCaption', {
              defaultValue: `Showing ${pageStart + 1}-${Math.min(pageStart + PAGE_SIZE_SCORECARD, totalRows)} of ${totalRows}`,
              from: pageStart + 1,
              to: Math.min(pageStart + PAGE_SIZE_SCORECARD, totalRows),
              total: totalRows,
            })}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setScPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-ink hover:border-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('common.back', { defaultValue: 'Back' })}
            </button>
            <span className="font-mono text-[11px] text-ink-muted">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setScPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-ink hover:border-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('common.next', { defaultValue: 'Next' })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function IcvComplianceTrackerList({ rows }: { rows: IcvComplianceRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <DashboardEmptyState description={t('dashboards.procurement.empty.noIcvIssues')} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.procurement.table.supplier')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.procurement.table.icvStatus')}</th>
            <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.procurement.table.icvPct')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.procurement.table.lastChecked')}</th>
            <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.procurement.table.activeContracts')}</th>
            <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.procurement.table.contractValue')}</th>
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
              <td className="py-2 pe-3">
                {row.icvStatus ? (
                  <span className={`inline-flex rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${row.icvStatus === 'missing' || row.icvStatus === 'expired' || row.icvStatus === 'non_compliant' ? 'border-terracotta/30 bg-terracotta/10 text-terracotta' : row.icvStatus === 'compliant' || row.icvStatus === 'up_to_date' ? 'border-sage/30 bg-sage/10 text-sage' : row.icvStatus === 'expiring_within_90d' ? 'border-amber/30 bg-amber/10 text-amber' : 'border-border bg-muted text-ink-muted'}`}>
                    {humanizeLabel(row.icvStatus)}
                  </span>
                ) : (
                  <span className="text-ink-subtle">—</span>
                )}
              </td>
              <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                {row.icvPct != null ? `${row.icvPct.toFixed(1)}%` : '—'}
              </td>
              <td className="py-2 pe-3 text-xs text-ink-muted">
                {row.icvLastChecked ? formatDateTime(row.icvLastChecked, { showTime: false }) : '—'}
              </td>
              <td className="py-2 pe-3 font-mono tabular-nums text-ink">{row.activeContractCount}</td>
              <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                {formatAedCompact(row.contractValueAed)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BackupSupplierSuggestionsList({ groups }: { groups: BackupSupplierGroup[] }) {
  const { t } = useTranslation();
  if (groups.length === 0) {
    return <DashboardEmptyState description={t('dashboards.procurement.empty.noBackupSuggestions')} />;
  }
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.primaryCounterpartyId} className="rounded-md border border-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-ink">{group.primaryName}</p>
              <p className="text-xs text-ink-muted">
                {t('dashboards.procurement.backupSupplier.primaryRisk', {
                  score: group.primaryRiskScore ?? '—',
                })}
                {' · '}
                <span className="font-mono">{humanizeLabel(group.category)}</span>
              </p>
            </div>
            <RiskTierBadge tier={group.primaryRiskScore != null && group.primaryRiskScore < 50 ? 'high' : group.primaryRiskScore != null && group.primaryRiskScore < 75 ? 'medium' : 'low'} />
          </div>
          {group.suggestedAlternatives.length > 0 ? (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-ink-subtle">
                {t('dashboards.procurement.backupSupplier.alternatives')}
              </p>
              {group.suggestedAlternatives.map((alt) => (
                <div key={alt.counterpartyId} className="flex items-center gap-2 rounded bg-surface px-3 py-1.5">
                  <Link
                    to="/app/parties/$id"
                    params={{ id: alt.counterpartyId }}
                    className="flex-1 text-sm text-ink hover:text-gold hover:underline"
                  >
                    {alt.counterpartyName}
                  </Link>
                  <span className="font-mono text-xs text-ink-muted">
                    {t('dashboards.procurement.backupSupplier.score', { score: alt.riskScore ?? '—' })}
                  </span>
                  <span className="font-mono text-[10px] uppercase text-sage">{humanizeLabel(alt.cleanStatus)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">
              {t('dashboards.procurement.backupSupplier.noAlternatives')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// P1: Procurement charts — supplier concentration donut, tier distribution
// stacked bar, SLA breach trend line. Drives the "this looks like a procurement
// dashboard" remediation called out in MUSANAD_PARI_REVIEW.md P1.
// ───────────────────────────────────────────────────────────────────────────

const DONUT_COLORS = [
  'var(--gold)',
  'var(--sage)',
  'var(--terracotta)',
  'var(--amber)',
  'var(--ink-muted)',
  'var(--accent)',
  'var(--ink-subtle)',
  'var(--border)',
];

function ProcurementChartsSection({ charts }: { charts: ProcurementChartsData }) {
  const { t } = useTranslation();

  const tierData = [
    { tier: 'high',     count: charts.tierDistribution.high,     fill: 'var(--terracotta)' },
    { tier: 'medium',   count: charts.tierDistribution.medium,   fill: 'var(--amber)' },
    { tier: 'low',      count: charts.tierDistribution.low,      fill: 'var(--sage)' },
    { tier: 'unscored', count: charts.tierDistribution.unscored, fill: 'var(--ink-muted)' },
  ].map((d) => ({ ...d, tierLabel: humanizeLabel(d.tier) }));

  const concentrationData = charts.concentration.map((c) => ({
    name: c.counterpartyName,
    value: Number(c.totalValueAed),
    pct: c.sharePct ?? 0,
  }));

  // SLA trend is returned newest-first; flip for left-to-right chart
  const slaTrendData = [...charts.slaTrendWeeks26]
    .sort((a, b) => b.weeksAgo - a.weeksAgo)
    .map((p) => ({
      label: new Date(p.weekEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      breaches: p.breachCount,
    }));

  return (
    <section
      aria-label={t('dashboards.procurement.charts.sectionLabel', { defaultValue: 'Supplier risk distribution' })}
      className="grid gap-3 lg:grid-cols-3"
    >
      {/* Concentration donut */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-gold" aria-hidden />
          <h2 className="text-sm font-semibold text-ink">
            {t('dashboards.procurement.charts.concentrationTitle', { defaultValue: 'Supplier concentration — top counterparties by contract value' })}
          </h2>
        </div>
        {concentrationData.length === 0 ? (
          <DashboardEmptyState description={t('dashboards.procurement.charts.concentrationEmpty', { defaultValue: 'No supplier contract value to plot.' })} />
        ) : (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={concentrationData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {concentrationData.map((_, i) => (
                    <Cell key={`donut-${i}`} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name: string, props: any) =>
                    [`${formatAedCompact(value)} (${props.payload.pct.toFixed(1)}%)`, props.payload.name]
                  }
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '10px', lineHeight: '14px', paddingLeft: 8 }}
                  formatter={(v) => String(v).slice(0, 26)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Tier distribution bar */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-gold" aria-hidden />
          <h2 className="text-sm font-semibold text-ink">
            {t('dashboards.procurement.charts.tierDistributionTitle', { defaultValue: 'Supplier risk-tier distribution' })}
          </h2>
        </div>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={tierData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="tierLabel" tick={{ fontSize: 11, fill: "var(--ink-muted)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--ink-muted)" }} allowDecimals={false} />
              <Tooltip formatter={(v: number) => [v, t('dashboards.procurement.charts.suppliers', { defaultValue: 'Suppliers' })]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {tierData.map((d, i) => (
                  <Cell key={`tier-${i}`} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SLA breach 26-week trend */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <LineChartIcon className="h-4 w-4 text-gold" aria-hidden />
          <h2 className="text-sm font-semibold text-ink">
            {t('dashboards.procurement.charts.slaTrendTitle', { defaultValue: 'SLA breach trend — last 26 weeks' })}
          </h2>
        </div>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={slaTrendData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              {/* D49 — explicit tick.fill so Recharts doesn't default to
                  raw hex #666; uses the semantic var(--ink-muted) token. */}
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ink-muted)" }} interval={3} />
              <YAxis tick={{ fontSize: 11, fill: "var(--ink-muted)" }} allowDecimals={false} />
              <Tooltip formatter={(v: number) => [v, t('dashboards.procurement.charts.slaBreaches', { defaultValue: 'SLA breaches' })]} />
              <Line type="monotone" dataKey="breaches" stroke="var(--terracotta)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

export default ProcurementDashboard;
