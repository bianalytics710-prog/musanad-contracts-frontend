/**
 * AdvisoryDraftPreview — sectioned, customer-facing renderer.
 *
 * The generated draft text is a Mustache-rendered narrative. Wrapping it in
 * clearly labelled sections (Why / What / Affected clauses / Risk / Next
 * steps / Approval trail) turns an opaque text blob into a decision-ready
 * brief for the reviewing counsel — and a readable notice for the customer
 * when the advisory is dispatched.
 *
 * Important: internal jargon ("correlation engine", rule names, signal IDs)
 * is intentionally absent from the customer-visible copy. The reviewing
 * counsel can still see traceability metadata in the technical strip at the
 * top of the page, but the body copy is written for the recipient.
 */
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  FileText,
  Lightbulb,
  CalendarClock,
  CheckCircle2,
  Send,
  ClipboardList,
  Info,
} from 'lucide-react';
import { formatDateTime } from '@/utils/datetime';
import type { AdvisoryDraft, MatchedClause } from '@/types/advisory-drafts.types';

interface Props {
  draft: AdvisoryDraft;
}

const STATUS_TONE: Record<string, string> = {
  unapproved: 'bg-amber-tint/40 text-amber-ink',
  approved: 'bg-sage-tint text-sage-ink',
  rejected: 'bg-terracotta/10 text-terracotta',
  modified: 'bg-gold/10 text-ink',
};

const SEVERITY_TONE: Record<string, string> = {
  critical: 'bg-terracotta text-card',
  high: 'bg-terracotta/15 text-terracotta',
  medium: 'bg-amber-tint/40 text-amber-ink',
  low: 'bg-sage-tint text-sage-ink',
};

const DRAFT_TYPE_OVERRIDES: Record<string, string> = {
  cure_notice: 'Cure Notice',
  fm_invocation: 'Force Majeure Invocation',
  sanctions_hold: 'Sanctions Hold',
  esg_concern: 'ESG Concern',
  icv_rectification: 'ICV Rectification',
  insurance_renewal: 'Insurance Renewal',
  custom: 'Custom Advisory',
};

function humanize(slug: string | null | undefined): string {
  if (!slug) return '—';
  if (DRAFT_TYPE_OVERRIDES[slug]) return DRAFT_TYPE_OVERRIDES[slug];
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * Recommended next steps keyed off draft type. Concrete timeframes + actions
 * so a first-time reviewer doesn't have to derive the playbook from the body.
 */
function recommendedSteps(draftType: string): Array<{ title: string; detail: string }> {
  switch (draftType) {
    case 'cure_notice':
      return [
        { title: 'Approve the cure notice', detail: 'Once approved, dispatch the notice to the counterparty. Most cure clauses set a 14-30 day window — confirm the exact period before sending.' },
        { title: 'Track the cure deadline', detail: 'Add an obligation to the contract for the cure deadline so you get reminded before expiry.' },
        { title: 'Prepare escalation options', detail: 'If the counterparty fails to cure, the contract usually permits termination or step-in rights. Flag the relevant clauses now.' },
      ];
    case 'fm_invocation':
      return [
        { title: 'Verify the force majeure trigger', detail: 'Confirm the event meets the contractual FM definition (e.g. weather threshold, geopolitical event) and that notice is timely.' },
        { title: 'Send the FM notice on approval', detail: 'FM clauses typically require written notice within 7-14 days of the event. Dispatch immediately after approval.' },
        { title: 'Document mitigation', detail: 'FM does not relieve obligations forever — record the mitigation steps the affected party is taking.' },
      ];
    case 'sanctions_hold':
      return [
        { title: 'Pause all payments + deliveries', detail: 'Brief Finance and Operations to halt any flow to or from the listed counterparty until counsel clears.' },
        { title: 'Run an enhanced KYC check', detail: 'Re-screen the counterparty and any beneficial owners against the latest OFAC / UK HMT / EU lists.' },
        { title: 'Document the hold + dispatch the notice', detail: 'Record the hold rationale on the contract and dispatch the notice on approval so the counterparty knows the status.' },
      ];
    case 'esg_concern':
      return [
        { title: 'Confirm the underlying signal', detail: 'ESG advisories often originate from media monitoring. Validate the signal with a second source before dispatching.' },
        { title: 'Engage Compliance / ESG', detail: 'Loop in the Compliance & ESG team before sending — they may want to direct the language or attach reporting.' },
        { title: 'Dispatch and track remediation', detail: 'After approval and dispatch, open an obligation for the counterparty to confirm remediation steps within the agreed window.' },
      ];
    case 'icv_rectification':
      return [
        { title: 'Review the ICV scorecard', detail: "Cross-check the ICV finding against the contractor's current ADNOC ICV certificate before approving." },
        { title: 'Dispatch to procurement + contractor', detail: 'ICV rectifications usually loop Procurement in alongside the contractor — verify both addresses on dispatch.' },
        { title: 'Set a remediation deadline', detail: 'Open an obligation for the rectification deadline so it surfaces in the obligations module.' },
      ];
    case 'insurance_renewal':
      return [
        { title: 'Pull the renewal evidence', detail: 'Confirm the policy expiry date and any required limits/endorsements before approving the notice.' },
        { title: 'Dispatch ahead of expiry', detail: 'Aim to send the renewal notice 30-60 days before policy expiry so the counterparty has time to bind cover.' },
        { title: 'Open an obligation for the new certificate', detail: 'Track the receipt of the renewed certificate of insurance as an obligation on the contract.' },
      ];
    case 'custom':
    default:
      return [
        { title: 'Review the draft body for accuracy', detail: 'Custom advisories are not pre-templated for a specific scenario. Read the generated body carefully before approving.' },
        { title: 'Confirm the recipient + timing', detail: 'Verify the dispatch will go to the right counterparty contact on the right channel.' },
        { title: 'Open follow-up obligations if needed', detail: 'If the advisory expects a counterparty response, track it as an obligation so the deadline does not slip.' },
      ];
  }
}

/**
 * Customer-facing "why" explanation. We never say "correlation engine" or
 * "rule fired" — those are internal terms. We describe what *happened* and
 * why this contract is *materially* affected.
 */
function whyExplanation(
  draft: AdvisoryDraft,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  const parts: string[] = [];
  if (draft.matchedSignal?.title) {
    parts.push(
      t('legal.advisoryQueue.why.fromSignal', {
        title: draft.matchedSignal.title,
        defaultValue: `A material external event was identified: "${draft.matchedSignal.title}".`,
      }),
    );
  }
  if (draft.sourceCorrelation?.severity) {
    parts.push(
      t('legal.advisoryQueue.why.severity', {
        severity: draft.sourceCorrelation.severity,
        defaultValue: `Legal Affairs assessed the impact on this contract as ${draft.sourceCorrelation.severity}.`,
      }),
    );
  }
  if ((draft.matchedClauses?.length ?? 0) > 0) {
    const titles = (draft.matchedClauses ?? [])
      .slice(0, 2)
      .map((c) => c.clauseTitle ?? humanize(c.clauseType ?? ''))
      .filter(Boolean);
    if (titles.length > 0) {
      parts.push(
        t('legal.advisoryQueue.why.clauseImpact', {
          titles: titles.join(', '),
          defaultValue: `It materially affects the following contractual provision${titles.length > 1 ? 's' : ''}: ${titles.join(', ')}.`,
        }),
      );
    }
  }
  if (parts.length === 0) {
    return t('legal.advisoryQueue.why.fallback', {
      defaultValue:
        'This advisory has been prepared by ADNOC Legal Affairs in response to an external event affecting the contract. Review the draft body and the affected provisions before approving.',
    });
  }
  return parts.join(' ');
}

export function AdvisoryDraftPreview({ draft }: Props) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');

  const displayEn = draft.finalTextEn ?? draft.generatedTextEn;
  const displayAr = draft.finalTextAr ?? draft.generatedTextAr;
  const statusTone = STATUS_TONE[draft.approvalStatus] ?? 'bg-muted text-ink-muted';

  const draftType = draft.templateMeta?.draftType ?? 'custom';
  const steps = recommendedSteps(draftType);
  const why = whyExplanation(draft, t);

  // Contract reference for header — prefer contractNumber + title (customer-
  // visible identifiers). Never show the DB id to a customer.
  const contractRefLabel =
    [draft.contractNumber, isAr && draft.contractTitleAr ? draft.contractTitleAr : draft.contractTitleEn]
      .filter(Boolean)
      .join(' · ') || '—';

  return (
    <div className="space-y-6">
      {/* Status + timing strip */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${statusTone}`}
        >
          {t(`legal.advisoryQueue.status.${draft.approvalStatus}`)}
        </span>
        {draft.templateMeta && (
          <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[10px] tracking-wider text-ink-muted">
            {isAr ? draft.templateMeta.displayNameAr : draft.templateMeta.displayNameEn}
            {' · '}v{draft.templateMeta.version}
          </span>
        )}
        {draft.sourceCorrelation?.severity && (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
              SEVERITY_TONE[draft.sourceCorrelation.severity] ?? 'bg-muted text-ink-muted'
            }`}
          >
            {draft.sourceCorrelation.severity}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
          <CalendarClock className="h-3 w-3" />
          {t('legal.advisoryQueue.fields.generatedAt')}:{' '}
          {formatDateTime(draft.generatedAt, { showTime: true })}
        </span>
      </div>

      {/* Contract reference row — customer-facing. Number + title, never DB id. */}
      <div className="rounded-md border border-border/60 bg-surface/40 px-3 py-2 text-sm">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
          {t('legal.advisoryQueue.contractRef', { defaultValue: 'Contract' })}
        </p>
        <p className="mt-0.5 text-ink">{contractRefLabel}</p>
      </div>

      {/* Why — customer-facing context. */}
      <Section
        icon={<Lightbulb className="h-4 w-4 text-gold" />}
        title={t('legal.advisoryQueue.section.why', {
          defaultValue: 'Why this advisory has been prepared',
        })}
      >
        <p className="text-sm text-ink">{why}</p>
      </Section>

      {/* Rejection reason */}
      {draft.approvalStatus === 'rejected' && draft.rejectionReason && (
        <div
          className="flex items-start gap-3 rounded-lg border border-terracotta/30 bg-terracotta/5 p-4"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-terracotta" />
          <div>
            <p className="text-sm font-medium text-terracotta">
              {t('legal.advisoryQueue.fields.rejectionReason')}
            </p>
            <p className="mt-0.5 text-sm text-ink">{draft.rejectionReason}</p>
          </div>
        </div>
      )}

      {/* What — body. */}
      <Section
        icon={<FileText className="h-4 w-4 text-gold" />}
        title={t('legal.advisoryQueue.section.what', { defaultValue: 'What the advisory says' })}
        caption={t('legal.advisoryQueue.section.whatCaption', {
          defaultValue:
            'The bilingual notice that will be sent on dispatch. Use Modify to edit the final wording.',
        })}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <article className="rounded-md border border-border bg-surface/40 p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t('legal.advisoryQueue.bodyEn')}
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {displayEn ||
                t('legal.advisoryQueue.bodyMissing', { defaultValue: 'No content generated.' })}
            </p>
          </article>
          <article className="rounded-md border border-border bg-surface/40 p-4" dir="rtl">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t('legal.advisoryQueue.bodyAr')}
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {displayAr ||
                t('legal.advisoryQueue.bodyMissing', { defaultValue: 'No content generated.' })}
            </p>
          </article>
        </div>
      </Section>

      {/* Affected clauses — verbatim text quoted. */}
      <Section
        icon={<ClipboardList className="h-4 w-4 text-gold" />}
        title={t('legal.advisoryQueue.section.clauses', {
          defaultValue: 'Affected contract clauses',
        })}
        caption={t('legal.advisoryQueue.section.clausesCaption', {
          defaultValue:
            'Provisions from the contract that this advisory references. Snippets are quoted directly from the contract text.',
        })}
      >
        {(draft.matchedClauses?.length ?? 0) === 0 ? (
          // Explain why a customer-bound notice can legitimately have no
          // contract clauses linked (market-driven advisories like sanctions
          // and FM notices are triggered by external events first).
          <div className="rounded-md border border-amber/40 bg-amber-tint/30 p-3 text-xs text-amber-ink">
            <p className="flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>
                {t('legal.advisoryQueue.section.clausesEmptyExplain', {
                  defaultValue:
                    'No specific clause excerpts were attached when this advisory was prepared. That can happen when the advisory is driven by an external event (e.g. sanctions designation, force-majeure event) rather than a specific contractual breach. Review the draft body and confirm whether a contract clause should be cited before dispatch.',
                })}
              </span>
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {(draft.matchedClauses ?? []).map((c: MatchedClause) => (
              <li
                key={c.id}
                className="rounded-md border border-border/60 bg-surface/40 p-3 text-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold text-ink">
                    {c.clauseTitle ?? humanize(c.clauseType ?? '') ?? `Clause #${c.id}`}
                  </p>
                  {c.pageNo != null && (
                    <span className="font-mono text-[10px] text-ink-subtle">
                      p. {c.pageNo}
                    </span>
                  )}
                </div>
                {c.snippet && (
                  <blockquote className="mt-1 border-s-2 border-border ps-2 text-xs italic text-ink-muted">
                    {c.snippet.slice(0, 320)}
                    {c.snippet.length > 320 ? '…' : ''}
                  </blockquote>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Risk + source signal section removed per design feedback — the
          recipient of an advisory doesn't need to read internal-source
          tracing or a numeric score. Risk metadata lives on the contract
          page for reviewers who want it. */}

      {/* Recommended next steps */}
      <Section
        icon={<Lightbulb className="h-4 w-4 text-gold" />}
        title={t('legal.advisoryQueue.section.next', { defaultValue: 'Recommended next steps' })}
        caption={t('legal.advisoryQueue.section.nextCaption', {
          defaultValue: 'Playbook for a ' + humanize(draftType) + '. Review for fit before acting.',
        })}
      >
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gold/10 font-mono text-[11px] font-semibold text-ink">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{s.title}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* Approval + dispatch trail */}
      <Section
        icon={<CheckCircle2 className="h-4 w-4 text-gold" />}
        title={t('legal.advisoryQueue.section.trail', { defaultValue: 'Approval + dispatch trail' })}
      >
        <ul className="space-y-2 text-sm">
          <TrailRow
            icon={<FileText className="h-3.5 w-3.5 text-ink-muted" />}
            label={t('legal.advisoryQueue.trail.drafted', { defaultValue: 'Drafted' })}
            who={draft.createdByName ?? `User #${draft.createdBy}`}
            when={draft.generatedAt}
          />
          {draft.approvedAt && (
            <TrailRow
              icon={<CheckCircle2 className="h-3.5 w-3.5 text-sage-ink" />}
              label={
                draft.approvalStatus === 'rejected'
                  ? t('legal.advisoryQueue.trail.rejected', { defaultValue: 'Rejected' })
                  : t('legal.advisoryQueue.trail.approved', { defaultValue: 'Approved' })
              }
              who={draft.approvedByName ?? '—'}
              when={draft.approvedAt}
            />
          )}
          {draft.dispatchedAt && (
            <TrailRow
              icon={<Send className="h-3.5 w-3.5 text-gold" />}
              label={t('legal.advisoryQueue.trail.dispatched', { defaultValue: 'Dispatched' })}
              who={t('legal.advisoryQueue.trail.dispatchedToRecipients', {
                defaultValue: 'sent to recipients',
              })}
              when={draft.dispatchedAt}
            />
          )}
        </ul>
        {draft.contractId != null && (
          <p className="mt-3 text-xs text-ink-muted">
            <Link
              to="/app/contracts/$id"
              params={{ id: String(draft.contractId) }}
              className="text-gold hover:underline"
            >
              {t('legal.advisoryQueue.trail.openContract', {
                defaultValue: 'Open source contract →',
              })}
            </Link>
          </p>
        )}
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  caption,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <header className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
      </header>
      {caption && <p className="text-xs text-ink-subtle">{caption}</p>}
      <div>{children}</div>
    </section>
  );
}

function TrailRow({
  icon,
  label,
  who,
  when,
}: {
  icon: React.ReactNode;
  label: string;
  who: string;
  when: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-md border border-border/60 bg-surface/40 px-3 py-2">
      <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-card">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink">{label}</p>
        <p className="text-[11px] text-ink-muted">
          {who}
          {' · '}
          <span className="font-mono">{formatDateTime(when, { showTime: true })}</span>
        </p>
      </div>
    </li>
  );
}

