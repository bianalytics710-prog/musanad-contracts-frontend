/**
 * RiskCaseTimeline — vertical event chronology.
 *
 * AC-SK4-05: empty state when only the 'created' event exists. We instead
 * render the single 'created' event clearly as the case origination row,
 * and surface the empty-state copy only when the timeline is truly empty
 * (defensive — server always emits at least the 'created' event).
 */
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  CircleCheck,
  CircleDot,
  MessageSquare,
  Paperclip,
  AlertTriangle,
  Hand,
  Pause,
  XCircle,
  ArrowUpRight,
  UserPlus,
  RotateCcw,
} from 'lucide-react';
import { formatDateTime } from '@/utils/datetime';
import type { RiskCaseEvent, RiskCaseEventType } from '@/types/risk-case.types';

const EVENT_ICONS: Record<RiskCaseEventType, React.ComponentType<{ className?: string }>> = {
  created: CircleDot,
  assigned: UserPlus,
  status_changed: CircleCheck,
  comment_added: MessageSquare,
  evidence_uploaded: Paperclip,
  escalated: ArrowUpRight,
  accepted_risk: Hand,
  snoozed: Pause,
  closed: XCircle,
  reopened: RotateCcw,
};

function eventSummary(event: RiskCaseEvent, t: TFunction): string {
  const payload = event.payload ?? {};
  switch (event.eventType) {
    case 'created':
      return t('riskCases.timeline.events.created');
    case 'assigned': {
      const to = (payload as { to?: { role?: string | null; userId?: number | null } }).to;
      return t('riskCases.timeline.events.assigned', {
        role: to?.role ?? '—',
        userId: to?.userId ?? '—',
      });
    }
    case 'status_changed': {
      const from = (payload as { from?: string }).from ?? '—';
      const to = (payload as { to?: string }).to ?? '—';
      return t('riskCases.timeline.events.statusChanged', { from, to });
    }
    case 'comment_added':
      return t('riskCases.timeline.events.comment');
    case 'evidence_uploaded': {
      const fileName = (payload as { fileName?: string }).fileName ?? '—';
      return t('riskCases.timeline.events.evidence', { fileName });
    }
    case 'escalated': {
      const role = (payload as { newAssignedRole?: string }).newAssignedRole ?? '—';
      return t('riskCases.timeline.events.escalated', { role });
    }
    case 'accepted_risk':
      return t('riskCases.timeline.events.acceptedRisk');
    case 'snoozed':
      return t('riskCases.timeline.events.snoozed');
    case 'closed': {
      const outcome = (payload as { outcome?: string }).outcome ?? '—';
      return t('riskCases.timeline.events.closed', { outcome });
    }
    case 'reopened':
      return t('riskCases.timeline.events.reopened');
    default:
      return event.eventType;
  }
}

interface Props {
  events: RiskCaseEvent[];
}

export function RiskCaseTimeline({ events }: Props) {
  const { t } = useTranslation();

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm text-ink-muted">{t('riskCases.timeline.empty')}</p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-3 ps-6 before:absolute before:inset-y-2 before:start-2 before:w-px before:bg-border">
      {events.map((event) => {
        const Icon = EVENT_ICONS[event.eventType] ?? AlertTriangle;
        return (
          <li key={event.id} className="relative">
            <span
              className="absolute -start-6 mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-card ring-1 ring-border"
              aria-hidden="true"
            >
              <Icon className="h-3 w-3 text-ink-muted" />
            </span>
            <div className="rounded-md border border-border bg-card px-3 py-2">
              <p className="text-sm text-ink">{eventSummary(event, t)}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {event.actorName ?? t('riskCases.timeline.system')}
                {' · '}
                {formatDateTime(event.occurredAt, { showTime: true })}
              </p>
              {event.eventType === 'comment_added' && typeof event.payload?.comment === 'string' && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
                  {String(event.payload.comment)}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
