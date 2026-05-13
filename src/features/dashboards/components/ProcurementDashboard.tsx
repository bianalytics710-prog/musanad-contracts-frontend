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
import { Users, ShieldCheck, TrendingUp, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { useProcurementDashboard } from '../hooks/useCrgDashboards';
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardFreshness,
  DashboardLoadingSkeleton,
  KpiTile,
  TimeRangeSelector,
  rangeFromWindowDays,
} from './dashboard-primitives';
import {
  ActivateAlternateVendorDialog,
  EscalateVendorPerformanceDialog,
  InitiateCureNoticeDialog,
  InitiateIcvRemediationDialog,
} from '@/features/procurement/components/ActionDialogs';
import { useAuthStore, selectUser } from '@/store/auth.store';
import { formatDateTime, formatDate, formatHijriDate } from '@/utils/datetime';
import type { DashboardRangeKey } from '@/types/entities/dashboards.types';
import type {
  SupplierScorecardRow,
  IcvComplianceRow,
  BackupSupplierGroup,
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
  const cls = tierColors[tier.toLowerCase()] ?? 'bg-muted text-ink-muted border-border';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls}`}>
      {tier}
    </span>
  );
}

const DEFAULT_WINDOW = 90;

export function ProcurementDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);
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
          <p className="mt-1 text-sm text-ink-muted">
            {t('dashboards.procurement.subtitle')}
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
              <DashboardEmptyState
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

          {/* Cure-notice trigger affordance — surfaces when there are high-risk SLA breach signals. */}
          {data.supplierRiskScorecard.some((r) => r.slaBreachCount180d > 0) && (
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
                {data.supplierRiskScorecard
                  .filter((r) => r.slaBreachCount180d > 0)
                  .slice(0, 5)
                  .map((r) => (
                    <button
                      key={`cure-${r.counterpartyId}`}
                      type="button"
                      onClick={() =>
                        setCureDialog({
                          contractId: '', // user enters contract id in dialog
                          label: r.counterpartyName,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber/50 bg-card px-3 py-1 text-xs font-medium text-ink hover:border-amber hover:bg-amber/10"
                    >
                      <ArrowUpRight className="h-3 w-3" aria-hidden />
                      {r.counterpartyName}
                    </button>
                  ))}
              </div>
            </section>
          )}
        </>
      )}

      <ActivateAlternateVendorDialog
        partyId={activateDialog?.partyId ?? null}
        vendorName={activateDialog?.vendorName}
        open={!!activateDialog}
        onClose={() => setActivateDialog(null)}
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
  if (rows.length === 0) {
    return <DashboardEmptyState description={t('dashboards.procurement.empty.noSuppliers')} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.procurement.table.supplier')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.procurement.table.type')}</th>
            <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.procurement.table.riskScore')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.procurement.table.riskTier')}</th>
            <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.procurement.table.activeContracts')}</th>
            <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.procurement.table.slaBreaches')}</th>
            <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.procurement.table.totalValue')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.procurement.table.actions', { defaultValue: 'Actions' })}</th>
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
                <span className="inline-flex rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-ink-muted">
                  {row.partyType}
                </span>
              </td>
              <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                {row.compositeRiskScore ?? '—'}
              </td>
              <td className="py-2 pe-3">
                <RiskTierBadge tier={row.riskTier} />
              </td>
              <td className="py-2 pe-3 font-mono tabular-nums text-ink">{row.activeContractCount}</td>
              <td className="py-2 pe-3 font-mono tabular-nums text-ink">{row.slaBreachCount180d}</td>
              <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                {formatAedCompact(row.totalContractValueAed)}
              </td>
              <td className="py-2 pe-3">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => onActivateAlternate(row)}
                    aria-label={t('procurement.actions.activateAlternate.title')}
                    className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-ink hover:border-gold hover:text-gold"
                  >
                    {t('procurement.actions.activateAlternate.shortLabel')}
                  </button>
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
                  <span className={`inline-flex rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${row.icvStatus === 'non_compliant' ? 'border-terracotta/30 bg-terracotta/10 text-terracotta' : row.icvStatus === 'compliant' ? 'border-sage/30 bg-sage/10 text-sage' : 'border-border bg-muted text-ink-muted'}`}>
                    {row.icvStatus.replace('_', ' ')}
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
                <span className="font-mono">{group.category}</span>
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
                  <span className="font-mono text-[10px] uppercase text-sage">{alt.cleanStatus}</span>
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

export default ProcurementDashboard;
