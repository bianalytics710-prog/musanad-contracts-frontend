/**
 * /app/risk-cases/$caseId — Risk Case detail (S-K-4..S-K-13 verbs).
 *
 * Tabs: Overview / Timeline / Evidence.
 * Action panel: Assign / Status / Escalate / Accept Risk / Snooze / Close.
 * Buttons are state-machine + permission aware.
 */
import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  UserPlus,
  ArrowUpRight,
  Hand,
  Pause,
  XCircle,
  CircleCheck,
  Paperclip,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { riskCaseService } from '@/services/api/risk-case.service';
import { formatDateTime } from '@/utils/datetime';
import {
  TERMINAL_STATUSES,
  CLOSABLE_STATUSES,
  ESCALATABLE_STATUSES,
  STRICT_TRANSITIONS,
} from '@/types/risk-case.types';
import { StatusBadge, PriorityBadge, SlaCountdown } from '@/components/risk-cases/Badges';
import { RiskCaseTimeline } from '@/components/risk-cases/RiskCaseTimeline';
import { RiskCaseEvidenceList } from '@/components/risk-cases/RiskCaseEvidenceList';
import { CommentInline } from '@/components/risk-cases/CommentInline';
import { AssignRiskCaseDialog } from '@/components/risk-cases/AssignRiskCaseDialog';
import { StatusTransitionDialog } from '@/components/risk-cases/StatusTransitionDialog';
import { EscalateDialog } from '@/components/risk-cases/EscalateDialog';
import { AcceptRiskDialog } from '@/components/risk-cases/AcceptRiskDialog';
import { SnoozeDialog } from '@/components/risk-cases/SnoozeDialog';
import { CloseDialog } from '@/components/risk-cases/CloseDialog';
import { AddEvidenceDialog } from '@/components/risk-cases/AddEvidenceDialog';

type Tab = 'overview' | 'timeline' | 'evidence';

export const Route = createFileRoute('/app/risk-cases/$caseId')({
  component: () => (
    <ErrorBoundary>
      <RiskCaseDetailView />
    </ErrorBoundary>
  ),
});

function RiskCaseDetailView() {
  const { t } = useTranslation();
  const { caseId } = Route.useParams();
  const id = Number(caseId);

  const canEscalate = useAuthStore(selectHasPermission('risk.case.escalate'));
  const canAcceptRisk = useAuthStore(selectHasPermission('risk.case.accept_risk'));
  const canClose = useAuthStore(selectHasPermission('risk.case.close'));
  const canCreate = useAuthStore(selectHasPermission('risk.case.create'));

  const [tab, setTab] = useState<Tab>('overview');

  const [showAssign, setShowAssign] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const [showAcceptRisk, setShowAcceptRisk] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showAddEvidence, setShowAddEvidence] = useState(false);

  const { data: detail, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['riskCase', id],
    queryFn: () => riskCaseService.getById(id),
    enabled: Number.isFinite(id) && id > 0,
    staleTime: 15_000,
  });

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="mx-auto w-full max-w-[1200px] p-6">
        <div className="rounded-lg border border-error/30 bg-error/5 p-6 text-center">
          <p className="text-sm text-error">{t('riskCases.errors.invalidId')}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1200px] p-6">
        <div className="flex h-48 items-center justify-center">
          <svg className="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="mx-auto w-full max-w-[1200px] p-6">
        <div className="flex items-center gap-3 rounded-lg border border-error/30 bg-error/5 p-4" role="alert">
          <AlertTriangle className="h-5 w-5 text-error" aria-hidden="true" />
          <p className="text-sm text-error">{(error as Error)?.message ?? t('common.error')}</p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }

  const { riskCase, timeline, attachments, linkedCorrelation, linkedContract, linkedAdvisoryDrafts, slaCountdownSeconds } = detail;
  const isTerminal = TERMINAL_STATUSES.includes(riskCase.status) || riskCase.status === 'closed';
  const transitionsAvailable = (STRICT_TRANSITIONS[riskCase.status] ?? []).length > 0;
  const canEscalateNow = canEscalate && ESCALATABLE_STATUSES.includes(riskCase.status);
  const canCloseNow = canClose && CLOSABLE_STATUSES.includes(riskCase.status);
  const canSnoozeNow = !isTerminal && (canCreate || canEscalate);
  const canAcceptRiskNow = canAcceptRisk && !isTerminal;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1200px] space-y-6 p-6"
    >
      {/* Back link */}
      <div className="flex items-center gap-2">
        <Link
          to="/app/risk-cases"
          className="inline-flex items-center gap-1 rounded text-sm text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('riskCases.actions.backToList')}
        </Link>
      </div>

      {/* Header */}
      <header className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-ink">{riskCase.title}</h1>
              <StatusBadge status={riskCase.status} />
              <PriorityBadge priority={riskCase.priority} />
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              {t(`riskCases.caseTypes.${riskCase.caseType}`)} · #{riskCase.id}
              {' · '}
              {t('riskCases.detail.createdAt', { date: formatDateTime(riskCase.createdAt, { showTime: true }) })}
            </p>
          </div>
          <div className="text-end">
            <p className="text-xs text-ink-muted">{t('riskCases.detail.slaCountdown')}</p>
            <SlaCountdown seconds={slaCountdownSeconds} />
          </div>
        </div>

        {/* Closure banner — AC-SK13-05 */}
        {riskCase.status === 'closed' && (
          <div className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-ink-muted" role="status">
            {t('riskCases.detail.closureBanner', {
              outcome: t(`riskCases.outcomes.${riskCase.closureOutcome ?? 'no_action'}`),
              date: riskCase.closedAt ? formatDateTime(riskCase.closedAt, { showTime: true }) : '—',
            })}
          </div>
        )}
      </header>

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Tabs */}
          <div role="tablist" aria-label={t('riskCases.detail.tabsAria')} className="flex gap-2 border-b border-border">
            {(['overview', 'timeline', 'evidence'] as Tab[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                aria-controls={`rc-tab-${k}`}
                id={`rc-tab-btn-${k}`}
                onClick={() => setTab(k)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  tab === k
                    ? 'border-b-2 border-primary text-ink'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {t(`riskCases.detail.tabs.${k}`)}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <section
              id="rc-tab-overview"
              role="tabpanel"
              aria-labelledby="rc-tab-btn-overview"
              className="space-y-4"
            >
              <div className="rounded-lg border border-border bg-card p-4">
                <h2 className="mb-2 text-sm font-semibold text-ink">
                  {t('riskCases.detail.overview.body')}
                </h2>
                <p className="whitespace-pre-wrap text-sm text-ink">
                  {riskCase.body ?? <span className="text-ink-muted">—</span>}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-card p-4">
                  <h2 className="mb-2 text-sm font-semibold text-ink">
                    {t('riskCases.detail.overview.assignment')}
                  </h2>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-ink-muted">{t('riskCases.fields.assignedRole')}</dt>
                      <dd className="text-ink">
                        {riskCase.assignedRole ?? <span className="text-ink-muted">—</span>}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-muted">{t('riskCases.fields.assignedUserId')}</dt>
                      <dd className="text-ink">
                        {riskCase.assignedUserId ?? <span className="text-ink-muted">—</span>}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-muted">{t('riskCases.fields.dueAt')}</dt>
                      <dd className="text-ink">
                        {riskCase.dueAt
                          ? formatDateTime(riskCase.dueAt, { showTime: true })
                          : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <h2 className="mb-2 text-sm font-semibold text-ink">
                    {t('riskCases.detail.overview.linked')}
                  </h2>
                  <dl className="space-y-1 text-sm">
                    {linkedContract && (
                      <div className="flex justify-between">
                        <dt className="text-ink-muted">{t('riskCases.detail.overview.contract')}</dt>
                        <dd className="text-ink truncate ms-2" title={linkedContract.title}>
                          <Link
                            to="/app/contracts/$id"
                            params={{ id: String(linkedContract.id) }}
                            className="hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
                          >
                            {linkedContract.title}
                          </Link>
                        </dd>
                      </div>
                    )}
                    {linkedCorrelation && (
                      <div className="flex justify-between">
                        <dt className="text-ink-muted">{t('riskCases.detail.overview.correlation')}</dt>
                        <dd className="text-ink">
                          {linkedCorrelation.ruleId} (#{linkedCorrelation.id})
                        </dd>
                      </div>
                    )}
                    {linkedAdvisoryDrafts.length > 0 && (
                      <div>
                        <dt className="text-ink-muted">{t('riskCases.detail.overview.advisories')}</dt>
                        <dd className="mt-1 space-y-1">
                          {linkedAdvisoryDrafts.map((a) => (
                            <div key={a.id} className="text-xs text-ink">
                              {a.templateId} · {a.approvalStatus}
                            </div>
                          ))}
                        </dd>
                      </div>
                    )}
                    {!linkedContract && !linkedCorrelation && linkedAdvisoryDrafts.length === 0 && (
                      <p className="text-xs text-ink-muted">{t('riskCases.detail.overview.noLinks')}</p>
                    )}
                  </dl>
                </div>
              </div>

              <CommentInline caseId={riskCase.id} />
            </section>
          )}

          {tab === 'timeline' && (
            <section
              id="rc-tab-timeline"
              role="tabpanel"
              aria-labelledby="rc-tab-btn-timeline"
            >
              <RiskCaseTimeline events={timeline} />
            </section>
          )}

          {tab === 'evidence' && (
            <section
              id="rc-tab-evidence"
              role="tabpanel"
              aria-labelledby="rc-tab-btn-evidence"
              className="space-y-3"
            >
              {!isTerminal && (canCreate || canEscalate) && (
                <div className="flex justify-end">
                  <Button onClick={() => setShowAddEvidence(true)} size="sm">
                    <Paperclip className="me-1 h-4 w-4" aria-hidden="true" />
                    {t('riskCases.actions.uploadEvidence')}
                  </Button>
                </div>
              )}
              <RiskCaseEvidenceList caseId={riskCase.id} attachments={attachments} />
            </section>
          )}
        </div>

        {/* Action panel */}
        <aside className="space-y-2 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-ink">{t('riskCases.detail.actionsTitle')}</h2>

          {!isTerminal && (
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowAssign(true)}
            >
              <UserPlus className="me-2 h-4 w-4" aria-hidden="true" />
              {t('riskCases.actions.assign')}
            </Button>
          )}

          {transitionsAvailable && (
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowTransition(true)}
            >
              <CircleCheck className="me-2 h-4 w-4" aria-hidden="true" />
              {t('riskCases.actions.statusTransition')}
            </Button>
          )}

          {canEscalateNow && (
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowEscalate(true)}
            >
              <ArrowUpRight className="me-2 h-4 w-4" aria-hidden="true" />
              {t('riskCases.actions.escalate')}
            </Button>
          )}

          {canAcceptRiskNow && (
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowAcceptRisk(true)}
            >
              <Hand className="me-2 h-4 w-4" aria-hidden="true" />
              {t('riskCases.actions.acceptRisk')}
            </Button>
          )}

          {canSnoozeNow && (
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowSnooze(true)}
            >
              <Pause className="me-2 h-4 w-4" aria-hidden="true" />
              {t('riskCases.actions.snooze')}
            </Button>
          )}

          {canCloseNow && (
            <Button
              variant="ghost"
              className="w-full justify-start text-error hover:bg-error/10"
              onClick={() => setShowClose(true)}
            >
              <XCircle className="me-2 h-4 w-4" aria-hidden="true" />
              {t('riskCases.actions.close')}
            </Button>
          )}

          {isTerminal && (
            <p className="text-xs text-ink-muted">{t('riskCases.detail.terminal')}</p>
          )}
        </aside>
      </div>

      {/* Dialogs */}
      <AssignRiskCaseDialog
        open={showAssign}
        onClose={() => setShowAssign(false)}
        caseId={riskCase.id}
        currentRole={riskCase.assignedRole}
        currentUserId={riskCase.assignedUserId}
      />
      <StatusTransitionDialog
        open={showTransition}
        onClose={() => setShowTransition(false)}
        caseId={riskCase.id}
        currentStatus={riskCase.status}
      />
      <EscalateDialog
        open={showEscalate}
        onClose={() => setShowEscalate(false)}
        caseId={riskCase.id}
      />
      <AcceptRiskDialog
        open={showAcceptRisk}
        onClose={() => setShowAcceptRisk(false)}
        caseId={riskCase.id}
      />
      <SnoozeDialog
        open={showSnooze}
        onClose={() => setShowSnooze(false)}
        caseId={riskCase.id}
      />
      <CloseDialog
        open={showClose}
        onClose={() => setShowClose(false)}
        caseId={riskCase.id}
      />
      <AddEvidenceDialog
        open={showAddEvidence}
        onClose={() => setShowAddEvidence(false)}
        caseId={riskCase.id}
      />
    </motion.div>
  );
}
