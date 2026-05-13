/**
 * M15 / CR-G — Compliance & ESG persona dashboard.
 *
 * GET /api/v1/dashboards/compliance-esg?windowDays=N
 * Permission: insights.compliance_esg
 *
 * Sections:
 *   1. KPI strip (5 tiles) — direct sanctions / chain sanctions / audit rights expiring / reg updates / ESG correlations
 *   2. Sanctions Exposure list — direct + chain, with chainDepth badge
 *   3. Sub-Contractor Chain View — top 5 with chainDepth
 *   4. Audit Rights Tracker — top 15 by daysToExpiry ASC
 *   5. Regulatory Updates Monitor — last 30d
 *   6. ESG Correlations — empty-state v1
 *
 * T1–T13 compliance. Auto-refresh 60s. RTL parity. Three data states.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from '@tanstack/react-router';
import { Shield, AlertTriangle, BookOpen, Globe } from 'lucide-react';
import { useComplianceEsgDashboard } from '../hooks/useCrgDashboards';
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingSkeleton,
  KpiTile,
  TimeRangeSelector,
  rangeFromWindowDays,
} from './dashboard-primitives';
import { useAuthStore, selectUser } from '@/store/auth.store';
import { formatDateTime, formatDate, formatHijriDate } from '@/utils/datetime';
import type { DashboardRangeKey } from '@/types/entities/dashboards.types';
import type {
  SanctionsExposureRow,
  SubContractorChainRow,
  AuditRightsRow,
  RegulatoryUpdateRow,
  EsgCorrelationRow,
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

const DEFAULT_WINDOW = 30;

export function ComplianceEsgDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [range, setRange] = useState<DashboardRangeKey>(rangeFromWindowDays(DEFAULT_WINDOW));

  const { data, isLoading, isError, error, refetch } = useComplianceEsgDashboard(windowDays);

  const nowISO = new Date().toISOString();

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
              ? `${t('dashboards.common.welcome', { defaultValue: 'Welcome back' })}, ${user.firstName} ${user.lastName} · ${formatDate(nowISO)} · ${formatHijriDate(nowISO)}`
              : `${formatDate(nowISO)} · ${formatHijriDate(nowISO)}`}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t('dashboards.complianceEsg.title')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t('dashboards.complianceEsg.subtitle')}
          </p>
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
          fallbackKey="dashboards.complianceEsg.errors.loadFailed"
        />
      ) : !data ? (
        <DashboardEmptyState />
      ) : (
        <>
          {/* KPI strip */}
          <section
            aria-label={t('dashboards.complianceEsg.kpiGroupLabel')}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          >
            <KpiTile
              label={t('dashboards.complianceEsg.kpis.sanctionsDirect')}
              value={formatNumber(data.kpi.sanctionsExposureDirectCount)}
              variant={data.kpi.sanctionsExposureDirectCount > 0 ? 'risk' : 'default'}
            />
            <KpiTile
              label={t('dashboards.complianceEsg.kpis.sanctionsChain')}
              value={formatNumber(data.kpi.sanctionsExposureChainCount)}
              variant={data.kpi.sanctionsExposureChainCount > 0 ? 'warning' : 'default'}
            />
            <KpiTile
              label={t('dashboards.complianceEsg.kpis.auditRightsExpiring')}
              value={formatNumber(data.kpi.auditRightsExpiringCount)}
              variant={data.kpi.auditRightsExpiringCount > 0 ? 'warning' : 'default'}
            />
            <KpiTile
              label={t('dashboards.complianceEsg.kpis.regulatoryUpdates')}
              value={formatNumber(data.kpi.openRegulatoryUpdatesCount)}
            />
            <KpiTile
              label={t('dashboards.complianceEsg.kpis.esgCorrelations')}
              value={formatNumber(data.kpi.openEsgCorrelationsCount)}
            />
          </section>

          {/* Sanctions Exposure */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-terracotta" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">
                {t('dashboards.complianceEsg.sections.sanctionsExposure')}
              </h2>
            </div>
            <SanctionsExposureList rows={data.sanctionsExposureList} />
          </section>

          {/* Sub-Contractor Chain View */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-gold" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">
                {t('dashboards.complianceEsg.sections.subContractorChain')}
              </h2>
            </div>
            <SubContractorChainList rows={data.subContractorChainView} />
          </section>

          {/* Audit Rights Tracker */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-sage" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">
                {t('dashboards.complianceEsg.sections.auditRights')}
              </h2>
            </div>
            <AuditRightsTrackerList rows={data.auditRightsTracker} />
          </section>

          {/* Regulatory Updates Monitor */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-gold" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">
                {t('dashboards.complianceEsg.sections.regulatoryUpdates')}
              </h2>
            </div>
            <RegulatoryUpdatesList rows={data.regulatoryUpdatesMonitor} />
          </section>

          {/* ESG Correlations (empty-state v1) */}
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">
              {t('dashboards.complianceEsg.sections.esgCorrelations')}
            </h2>
            <EsgCorrelationsList rows={data.esgCorrelations} />
          </section>
        </>
      )}
    </motion.div>
  );
}

function SanctionsExposureList({ rows }: { rows: SanctionsExposureRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <DashboardEmptyState description={t('dashboards.complianceEsg.empty.noSanctions')} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.complianceEsg.table.contract')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.complianceEsg.table.counterparty')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.complianceEsg.table.sanctionsStatus')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.complianceEsg.table.exposureKind')}</th>
            <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.complianceEsg.table.marAed')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.contractId}-${row.counterpartyId}`} className="border-t border-border/60">
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
                <span className="inline-flex rounded bg-terracotta/15 px-2 py-0.5 font-mono text-[10px] text-terracotta">
                  {row.sanctionsStatus}
                </span>
              </td>
              <td className="py-2 pe-3">
                <span className={`inline-flex rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${row.exposureKind === 'direct' ? 'border-terracotta/30 bg-terracotta/10 text-terracotta' : 'border-amber/30 bg-amber/10 text-amber'}`}>
                  {row.exposureKind}
                  {row.chainTruncated && (
                    <span className="ms-1 text-ink-subtle" title={t('dashboards.complianceEsg.chainTruncated')}>
                      *
                    </span>
                  )}
                </span>
              </td>
              <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                {formatAedCompact(row.marAed)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubContractorChainList({ rows }: { rows: SubContractorChainRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <DashboardEmptyState description={t('dashboards.complianceEsg.empty.noChains')} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.complianceEsg.table.chainRoot')}</th>
            <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.complianceEsg.table.depthReached')}</th>
            <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.complianceEsg.table.sanctionedNodes')}</th>
            <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.complianceEsg.table.affectedContracts')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.chainRootCounterpartyId} className="border-t border-border/60">
              <td className="py-2 pe-3">
                <Link
                  to="/app/parties/$id"
                  params={{ id: row.chainRootCounterpartyId }}
                  className="text-sm text-ink hover:text-gold hover:underline"
                >
                  {row.chainRootName}
                </Link>
                {row.chainTruncated && (
                  <span className="ms-2 font-mono text-[10px] text-ink-subtle" title={t('dashboards.complianceEsg.chainTruncated')}>
                    ({t('dashboards.complianceEsg.truncated')})
                  </span>
                )}
              </td>
              <td className="py-2 pe-3 font-mono tabular-nums text-ink">{row.depthReached}</td>
              <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                <span className={row.sanctionedNodesCount > 0 ? 'text-terracotta font-medium' : 'text-sage'}>
                  {row.sanctionedNodesCount}
                </span>
              </td>
              <td className="py-2 pe-3 font-mono tabular-nums text-ink">{row.affectedContractsCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditRightsTrackerList({ rows }: { rows: AuditRightsRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <DashboardEmptyState description={t('dashboards.complianceEsg.empty.noAuditRights')} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.complianceEsg.table.contract')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.complianceEsg.table.counterparty')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.complianceEsg.table.expiresOn')}</th>
            <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.complianceEsg.table.daysToExpiry')}</th>
            <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.complianceEsg.table.severity')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.contractId}-${row.expiresOnIso}`} className="border-t border-border/60">
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
              <td className="py-2 pe-3 text-xs text-ink-muted">
                {formatDateTime(row.expiresOnIso, { showTime: false })}
              </td>
              <td className="py-2 pe-3 font-mono tabular-nums text-ink">{row.daysToExpiry}d</td>
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

function RegulatoryUpdatesList({ rows }: { rows: RegulatoryUpdateRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <DashboardEmptyState description={t('dashboards.complianceEsg.empty.noRegulatoryUpdates')} />
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.regulatoryUpdateId} className="flex items-start gap-3 rounded-md border border-border/60 bg-surface p-3">
          <SeverityBadge severity={row.severity} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{row.headline}</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {row.regulatorName} · {formatDateTime(row.occurredAt, { showTime: false })}
              {row.affectedContractsCount > 0 &&
                ` · ${row.affectedContractsCount} ${t('dashboards.complianceEsg.affectedContracts')}`}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EsgCorrelationsList({ rows }: { rows: EsgCorrelationRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <DashboardEmptyState description={t('dashboards.complianceEsg.empty.noEsgCorrelations')} />
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.correlationId} className="flex items-start gap-3 rounded-md border border-border/60 bg-surface p-3">
          <SeverityBadge severity={row.severity} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">{row.headline}</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {row.counterpartyName} · {formatDateTime(row.occurredAt, { showTime: false })}
            </p>
          </div>
          <span className="font-mono text-[10px] text-ink-muted">
            {formatAedCompact(row.marAed)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default ComplianceEsgDashboard;
