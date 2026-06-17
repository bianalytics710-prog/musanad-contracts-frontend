/**
 * ContractRiskTab — Risk tab on the contract detail page.
 *
 * 2026-06-17 (Option B) — reworked to show ONLY the contract's MANAGED risk
 * cases (Tier-1 auto-routed + Tier-2 confirmed). Raw scoring signals and the
 * engine score are intentionally NOT shown here: a contract should present
 * risks that have become real, owned cases — not un-triaged detections. Signals
 * still sitting in Risk Triage (or below the case threshold) do not appear until
 * confirmed. (The engine's automated score still exists and drives the executive
 * dashboards; it is just not the contract-level "risks" view.)
 *
 * Data via fn_risk_case_list filtered by contractId (status=open_all → excludes
 * triage-pending + closed). T3 i18n · T4 three states · T5 semantic tokens.
 */
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, ArrowUpRight, ShieldCheck, Eye } from 'lucide-react';
import { riskCaseService } from '@/services/api/risk-case.service';
import { RiskTypePill } from '@/components/risk/RiskTypePill';
import { OriginBadge } from '@/components/risk/OriginBadge';
import { StatusBadge, PriorityBadge, SlaCountdown } from '@/components/risk-cases/Badges';
import type { RiskCaseListItem } from '@/types/risk-case.types';

interface ContractRiskTabProps {
  contractId: number;
}

export function ContractRiskTab({ contractId }: ContractRiskTabProps) {
  const { t } = useTranslation();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['contractRiskCases', contractId],
    queryFn: () =>
      riskCaseService.list({ contractId, status: 'open_all', limit: 100, page: 1 }),
    enabled: Number.isFinite(contractId) && contractId > 0,
    staleTime: 30_000,
  });

  const cases: RiskCaseListItem[] = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center" role="status" aria-live="polite">
        <svg className="h-7 w-7 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-md border border-border px-2 py-1 text-xs text-ink hover:bg-muted"
        >
          {t('common.retry', { defaultValue: 'Retry' })}
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <ShieldCheck className="h-4 w-4 text-sage" aria-hidden="true" />
            {t('contracts.risk.title', { defaultValue: 'Managed risks' })}
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-ink-muted">
              {cases.length}
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {t('contracts.risk.subtitle', {
              defaultValue: 'Confirmed and auto-routed risk cases on this contract.',
            })}
          </p>
        </div>
      </header>

      {cases.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface/40 p-8 text-center">
          <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-sage" aria-hidden="true" />
          <p className="text-sm font-medium text-ink">
            {t('contracts.risk.emptyTitle', { defaultValue: 'No managed risks on this contract' })}
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink-muted">
            {t('contracts.risk.emptyBody', {
              defaultValue:
                'Signals still under review in Risk Triage are not shown here until an executive confirms them as a risk.',
            })}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {cases.map((rc) => (
            <li key={rc.id}>
              <Link
                to="/app/risk-cases/$caseId"
                params={{ caseId: String(rc.id) }}
                className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface/50 focus:bg-surface/50 focus:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <RiskTypePill type={rc.riskType} />
                    <OriginBadge origin={rc.riskOrigin} />
                    <PriorityBadge priority={rc.priority} />
                    <StatusBadge status={rc.status} />
                    {rc.isEscalated && (
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-amber/50 bg-amber/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber">
                        <ArrowUpRight className="h-2.5 w-2.5" aria-hidden="true" />
                        {t('riskCases.escalatedLabel', { defaultValue: 'Escalated' })}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm font-medium text-ink" title={rc.title}>
                    {rc.title}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {t('riskCases.columns.assignedTo', { defaultValue: 'Assigned to' })}:{' '}
                    {rc.assignedUserName ?? <span className="text-ink-subtle">—</span>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <SlaCountdown seconds={rc.slaCountdownSeconds} />
                  <span className="inline-flex items-center gap-1 text-[11px] text-gold">
                    <Eye className="h-3 w-3" aria-hidden="true" />
                    {t('riskCases.actions.view', { defaultValue: 'View' })}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
