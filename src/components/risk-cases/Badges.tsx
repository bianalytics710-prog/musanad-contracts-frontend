/**
 * Risk Case visual badges — status + priority chips, used by list rows and
 * detail header. Uses semantic Tailwind tokens (var(--gold) etc. via classes)
 * — no raw hex codes per C13.
 */
import { useTranslation } from 'react-i18next';
import type { RiskCaseStatus, RiskCasePriority } from '@/types/risk-case.types';

const STATUS_TOKENS: Record<RiskCaseStatus, string> = {
  open: 'bg-info/10 text-info',
  in_review: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-error/10 text-error',
  escalated: 'bg-terracotta/10 text-terracotta',
  accept_risk: 'bg-gold/15 text-gold',
  snoozed: 'bg-muted text-ink-muted',
  closed: 'bg-muted text-ink-muted',
};

const PRIORITY_TOKENS: Record<RiskCasePriority, string> = {
  low: 'bg-sage/15 text-sage',
  medium: 'bg-info/10 text-info',
  high: 'bg-warning/10 text-warning',
  critical: 'bg-error/10 text-error',
};

export function StatusBadge({ status }: { status: RiskCaseStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_TOKENS[status] ?? 'bg-muted text-ink-muted'
      }`}
    >
      {t(`riskCases.statuses.${status}`, { defaultValue: status })}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: RiskCasePriority }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        PRIORITY_TOKENS[priority] ?? 'bg-muted text-ink-muted'
      }`}
    >
      {t(`riskCases.priorities.${priority}`, { defaultValue: priority })}
    </span>
  );
}

export function SlaCountdown({ seconds }: { seconds: number | null }) {
  const { t } = useTranslation();
  if (seconds === null) return <span className="text-xs text-ink-muted">—</span>;
  const overdue = seconds < 0;
  const abs = Math.abs(seconds);
  const hours = Math.floor(abs / 3600);
  const mins = Math.floor((abs % 3600) / 60);
  const tone = overdue ? 'text-error' : hours < 4 ? 'text-warning' : 'text-ink-muted';
  const text =
    hours >= 24
      ? t('riskCases.sla.days', { days: Math.floor(hours / 24) })
      : `${hours}h ${mins}m`;
  return (
    <span className={`text-xs font-medium ${tone}`} title={t('riskCases.sla.title')}>
      {overdue ? t('riskCases.sla.overdue', { duration: text }) : text}
    </span>
  );
}
