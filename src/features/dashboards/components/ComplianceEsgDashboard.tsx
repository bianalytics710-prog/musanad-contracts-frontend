/**
 * M15 / CR-G — Compliance & ESG persona dashboard.
 * CR-M additive: Regulatory Cascade tile added after ESG Correlations section.
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
 *   7. ICV Certificate Summary (R-CES H3)
 *   8. [CR-M] Regulatory Cascade tile — links to /app/compliance/regulatory-cascade
 *
 * T1–T13 compliance. Auto-refresh 60s. RTL parity. Three data states.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from '@tanstack/react-router';
import { Shield, AlertTriangle, BookOpen, Globe, FileCheck } from 'lucide-react';
import { useComplianceEsgDashboard } from '../hooks/useCrgDashboards';
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardFreshness,
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
  AuditRightsRow,
  RegulatoryUpdateRow,
  EsgCorrelationRow,
  IcvCertificateSummaryData,
} from '@/types/entities/crg-dashboards.types';
import {
  RaiseFlagDialog,
  InitiateSupplierAuditDialog,
  RecommendHoldDialog,
  RecommendTerminationDialog,
} from '@/features/compliance-esg/components/ActionDialogs';
import { SanctionsChainIndentedHierarchy } from '@/features/compliance-esg/components/SanctionsChainIndentedHierarchy';
import { IcvCertificateSummarySection } from '@/features/compliance-esg/components/IcvCertificateSummarySection';
import { IcvCertificateUploadDialog } from '@/features/compliance-esg/components/IcvCertificateUploadDialog';
// E-rev-E — RegulatoryCascadeTile import removed; module dropped from sidebar + dashboard for demo focus.
// import { RegulatoryCascadeTile } from '@/features/compliance-esg/components/RegulatoryCascadeTile';

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

  // ICV upload dialog state
  const [icvUploadContractId, setIcvUploadContractId] = useState<string | null>(null);
  const [icvUploadOpen, setIcvUploadOpen] = useState(false);

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
            {t('dashboards.complianceEsg.title')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t('dashboards.complianceEsg.subtitle')}
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
          fallbackKey="dashboards.complianceEsg.errors.loadFailed"
        />
      ) : !data ? (
        <DashboardEmptyState />
      ) : (
        <>
          {/* K5 fix — scope caption clarifies that 4 of 5 KPIs are snapshot
              counts; only the Regulatory Updates KPI honors the date window.
              Without this caption the user clicks pills expecting all KPIs
              to move and gets confused (audit pattern from Eman E2 + BUG-013). */}
          <p className="text-xs text-ink-subtle">
            {t('dashboards.complianceEsg.windowScopeCaption', {
              defaultValue: 'Snapshot KPIs — only “Regulatory updates” honors the date window. Other tiles reflect current state.',
            })}
          </p>

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

          {/* Sub-Contractor Chain View — indented hierarchy (C4 + H4) */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-gold" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">
                {t('dashboards.complianceEsg.sections.subContractorChain')}
              </h2>
            </div>
            <SanctionsChainIndentedHierarchy rows={data.subContractorChainView} />
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

          {/* ESG Correlations — real content when data.length > 0 (H6) */}
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">
              {t('dashboards.complianceEsg.sections.esgCorrelations')}
            </h2>
            <EsgCorrelationsList rows={data.esgCorrelations} />
          </section>

          {/* ICV Certificate Summary (H3) */}
          {data.icvCertificateSummary && (
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-gold" aria-hidden />
                <h2 className="text-sm font-semibold text-ink">
                  {t('dashboards.complianceEsg.sections.icvCertificateSummary')}
                </h2>
              </div>
              <IcvCertificateSummarySection
                data={data.icvCertificateSummary}
                onUpload={(contractId) => {
                  setIcvUploadContractId(contractId);
                  setIcvUploadOpen(true);
                }}
              />
            </section>
          )}
        </>
      )}

      {/* E-rev-E — Regulatory Cascade tile hidden along with the sidebar
          entry; module dropped from the demo to keep scope tight. Component
          + route stay in the codebase. */}
      {/* <RegulatoryCascadeTile /> */}

      <IcvCertificateUploadDialog
        contractId={icvUploadContractId}
        open={icvUploadOpen}
        onClose={() => {
          setIcvUploadOpen(false);
          setIcvUploadContractId(null);
        }}
      />
    </motion.div>
  );
}

function SanctionsExposureList({ rows }: { rows: SanctionsExposureRow[] }) {
  const { t } = useTranslation();
  const [raiseFlagContractId, setRaiseFlagContractId] = useState<string | null>(null);
  const [raiseFlagOpen, setRaiseFlagOpen] = useState(false);
  const [auditContractId, setAuditContractId] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [holdContractId, setHoldContractId] = useState<string | null>(null);
  const [holdOpen, setHoldOpen] = useState(false);
  const [terminationContractId, setTerminationContractId] = useState<string | null>(null);
  const [terminationOpen, setTerminationOpen] = useState(false);

  if (rows.length === 0) {
    return <DashboardEmptyState description={t('dashboards.complianceEsg.empty.noSanctions')} />;
  }
  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
              <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.complianceEsg.table.contract')}</th>
              <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.complianceEsg.table.counterparty')}</th>
              <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.complianceEsg.table.sanctionsStatus')}</th>
              <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.complianceEsg.table.exposureKind')}</th>
              <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.complianceEsg.table.marAed')}</th>
              <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.complianceEsg.table.actions')}</th>
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
                {/* C3 per-row actions */}
                <td className="py-2 pe-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => { setRaiseFlagContractId(row.contractId); setRaiseFlagOpen(true); }}
                      className="rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-ink hover:border-terracotta/60 hover:bg-terracotta/10"
                      aria-label={t('compliance.actions.raiseFlag.title')}
                    >
                      {t('compliance.actions.raiseFlag.shortLabel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuditContractId(row.contractId); setAuditOpen(true); }}
                      className="rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-ink hover:border-gold/60 hover:bg-gold/10"
                      aria-label={t('compliance.actions.supplierAudit.title')}
                    >
                      {t('compliance.actions.supplierAudit.shortLabel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setHoldContractId(row.contractId); setHoldOpen(true); }}
                      className="rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-ink hover:border-amber/60 hover:bg-amber/10"
                      aria-label={t('compliance.actions.recommendHold.title')}
                    >
                      {t('compliance.actions.recommendHold.shortLabel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTerminationContractId(row.contractId); setTerminationOpen(true); }}
                      className="rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-terracotta hover:border-terracotta/60 hover:bg-terracotta/10"
                      aria-label={t('compliance.actions.recommendTermination.title')}
                    >
                      {t('compliance.actions.recommendTermination.shortLabel')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RaiseFlagDialog
        contractId={raiseFlagContractId}
        open={raiseFlagOpen}
        onClose={() => { setRaiseFlagOpen(false); setRaiseFlagContractId(null); }}
      />
      <InitiateSupplierAuditDialog
        contractId={auditContractId}
        open={auditOpen}
        onClose={() => { setAuditOpen(false); setAuditContractId(null); }}
      />
      <RecommendHoldDialog
        contractId={holdContractId}
        open={holdOpen}
        onClose={() => { setHoldOpen(false); setHoldContractId(null); }}
      />
      <RecommendTerminationDialog
        contractId={terminationContractId}
        open={terminationOpen}
        onClose={() => { setTerminationOpen(false); setTerminationContractId(null); }}
      />
    </>
  );
}

// SubContractorChainList replaced by SanctionsChainIndentedHierarchy (R-CES C4 / AD-6)

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
