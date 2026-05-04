/**
 * ApprovalChainPreview (S6 + S10) — visual chain display.
 *
 * Two operating modes (`mode` prop):
 *   - `preview`     : reads from RouteInitPreviewResponse (S6, no chain
 *                     persisted yet) — used in the Compose Wizard final
 *                     review step before the drafter clicks Submit.
 *   - `read-only`   : reads from ApprovalChainGetResponse (S10) — used
 *                     on the contract detail page after submission.
 *
 * Both modes render the same step list with role chips, parallel-group
 * indicators, escalation hints, and per-step status (read-only mode only).
 * The component is pure UI — no network calls; the parent feeds the data.
 *
 * AC mapping:
 *   AC-S6-01 / AC-S10-01 — ordered steps + per-step shape.
 *   AC-S6-05 — hasNoMatchingRule banner ("configure matrix first").
 *   AC-S10-05 — per-step decisions[] are surfaced as a small history badge.
 *
 * T1 / T2 / T7  — pure presentational; data extracted by parent useQuery.
 * T3            — every label uses t().
 * T4            — caller owns loading/empty/error frames; we render null
 *                 when steps are absent and the no-rule banner when so.
 * T5            — semantic tokens only (border / surface / muted / amber).
 * T6 / T11      — semantic <ol>/<li>; aria-label on list; ErrorBoundary at
 *                 route level.
 * T12           — formatDateTime on decided_at when shown.
 * T13           — decisionNote only displayed inside the per-step decision
 *                 history (small, on-screen) and never logged.
 */
import { ChevronRight, ShieldAlert, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/datetime";
import type {
  ApprovalChainGetResponse,
  ApprovalChainStepDetail,
  RouteInitPreviewResponse,
  RouteInitPreviewStep,
} from "@/types/entities/approval.types";

interface PreviewModeProps {
  mode: "preview";
  data: RouteInitPreviewResponse | null;
}

interface ReadOnlyModeProps {
  mode: "read-only";
  data: ApprovalChainGetResponse | null;
}

type Props = PreviewModeProps | ReadOnlyModeProps;

export function ApprovalChainPreview(props: Props) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");

  if (!props.data) return null;

  if (props.mode === "preview") {
    const { steps, hasNoMatchingRule, contractType, valueAed } = props.data;
    if (hasNoMatchingRule) {
      return (
        <div
          role="status"
          className="flex gap-2 rounded-md border border-amber/40 bg-amber-tint/40 p-3 text-xs text-amber-ink"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
          <div>
            <p className="font-medium">{t("approval.chain.noRuleTitle")}</p>
            <p className="mt-1">
              {t("approval.chain.noRuleBody", {
                contractType: t(`contractTypes.${contractType}`, {
                  defaultValue: contractType,
                }),
              })}
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <header className="flex items-center justify-between gap-3 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {t("approval.chain.stepsCount", { count: steps.length })}
          </span>
          <span className="font-mono">
            {t("approval.chain.previewValue", {
              value: valueAed.toLocaleString(),
            })}
          </span>
        </header>
        <ol
          aria-label={t("approval.chain.ariaList")}
          className="flex flex-col gap-2"
        >
          {steps.map((step, idx) => (
            <PreviewStepRow
              key={`${step.stepOrder}-${step.parallelGroup ?? "seq"}-${idx}`}
              step={step}
              isLast={idx === steps.length - 1}
              isAr={isAr}
            />
          ))}
        </ol>
      </div>
    );
  }

  // read-only mode
  const { chain, steps } = props.data;
  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" aria-hidden />
          {t("approval.chain.stepsCount", { count: steps.length })}
        </span>
        <span className="font-mono">
          {t("approval.chain.submittedAt", {
            when: formatDateTime(chain.submittedAt),
          })}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 font-medium",
            chainStatusBadge(chain.status),
          )}
        >
          {t(`approval.chain.status.${chain.status}`, {
            defaultValue: chain.status,
          })}
        </span>
      </header>
      <ol
        aria-label={t("approval.chain.ariaList")}
        className="flex flex-col gap-2"
      >
        {steps.map((step, idx) => (
          <ReadOnlyStepRow
            key={step.id}
            step={step}
            isCurrent={
              chain.status === "in_progress" &&
              step.stepOrder === chain.currentStepOrder
            }
            isAr={isAr}
            isLast={idx === steps.length - 1}
          />
        ))}
      </ol>
    </div>
  );
}

interface PreviewStepRowProps {
  step: RouteInitPreviewStep;
  isLast: boolean;
  isAr: boolean;
}

function PreviewStepRow({ step, isLast, isAr }: PreviewStepRowProps) {
  const { t } = useTranslation();
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 sm:flex-row sm:items-center sm:gap-3">
      <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-background font-mono text-[11px] font-medium text-ink-muted">
        {step.stepOrder}
      </span>
      <RoleChip role={step.approverRole} />
      {step.parallelGroup !== null && (
        <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-ink">
          {t("approval.chain.parallelBadge")}
        </span>
      )}
      {!step.isRequired && (
        <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-ink-muted">
          {t("approval.chain.optional")}
        </span>
      )}
      {step.escalationRole && step.escalationAfterHours && (
        <span className="ms-auto text-[11px] text-ink-subtle">
          {t("approval.chain.escalation", {
            role: t(`roles.${step.escalationRole}`, {
              defaultValue: step.escalationRole,
            }),
            hours: step.escalationAfterHours,
          })}
        </span>
      )}
      {!isLast && (
        <ChevronRight
          className={cn(
            "hidden h-3.5 w-3.5 flex-shrink-0 text-ink-subtle sm:block",
            isAr && "rotate-180",
          )}
          aria-hidden
        />
      )}
    </li>
  );
}

interface ReadOnlyStepRowProps {
  step: ApprovalChainStepDetail;
  isCurrent: boolean;
  isAr: boolean;
  isLast: boolean;
}

function ReadOnlyStepRow({ step, isCurrent, isLast, isAr }: ReadOnlyStepRowProps) {
  const { t } = useTranslation();
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-md border p-3",
        isCurrent
          ? "border-primary bg-primary/5"
          : "border-border bg-surface",
      )}
      aria-current={isCurrent ? "step" : undefined}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-background font-mono text-[11px] font-medium text-ink-muted">
          {step.stepOrder}
        </span>
        <RoleChip role={step.approverRole} />
        {step.parallelGroup !== null && (
          <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-ink">
            {t("approval.chain.parallelBadge")}
          </span>
        )}
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
            stepStatusBadge(step.status),
          )}
        >
          {t(`approval.chain.stepStatus.${step.status}`, {
            defaultValue: step.status,
          })}
        </span>
        {step.approverUser && (
          <span className="text-[11px] text-ink-muted">
            {step.approverUser.firstName} {step.approverUser.lastName}
          </span>
        )}
        {step.delegatedTo && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-ink-muted">
            {t("approval.chain.delegatedTo", {
              name: `${step.delegatedTo.firstName} ${step.delegatedTo.lastName}`,
            })}
          </span>
        )}
        {step.reassignedTo && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-ink-muted">
            {t("approval.chain.reassignedTo", {
              name: `${step.reassignedTo.firstName} ${step.reassignedTo.lastName}`,
            })}
          </span>
        )}
        {!isLast && (
          <ChevronRight
            className={cn(
              "ms-auto hidden h-3.5 w-3.5 text-ink-subtle sm:block",
              isAr && "rotate-180",
            )}
            aria-hidden
          />
        )}
      </div>
      {step.decisions.length > 0 && (
        <ul className="ms-9 flex flex-col gap-1 text-[11px] text-ink-subtle">
          {step.decisions.map((d) => (
            <li key={d.id} className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium text-ink-muted">
                {t(`approval.chain.decision.${d.decision}`, {
                  defaultValue: d.decision,
                })}
              </span>
              <span>
                {t("approval.chain.decidedBy", {
                  name: `${d.decidedBy.firstName} ${d.decidedBy.lastName}`,
                  when: formatDateTime(d.decidedAt),
                })}
              </span>
              {d.decisionNote && (
                <span className="ms-2 italic" title={d.decisionNote}>
                  {/* T13 — note shown small for the actor; never logged. */}
                  {truncate(d.decisionNote, 80)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function RoleChip({ role }: { role: string }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex h-6 items-center rounded-md border border-border bg-background px-2.5 text-[11px] font-medium text-ink">
      {t(`roles.${role}`, { defaultValue: role })}
    </span>
  );
}

function chainStatusBadge(status: string): string {
  switch (status) {
    case "in_progress":
      return "bg-primary/10 text-primary";
    case "approved":
      return "bg-success/10 text-success";
    case "rejected":
      return "bg-destructive/10 text-destructive";
    case "resubmission_requested":
      return "bg-warning/10 text-warning";
    case "cancelled":
      return "bg-surface text-ink-muted";
    default:
      return "bg-surface text-ink-muted";
  }
}

function stepStatusBadge(status: string): string {
  switch (status) {
    case "approved":
      return "bg-success/10 text-success";
    case "rejected":
      return "bg-destructive/10 text-destructive";
    case "pending":
      return "bg-primary/10 text-primary";
    case "resubmission_requested":
      return "bg-warning/10 text-warning";
    case "skipped":
      return "bg-surface text-ink-subtle";
    default:
      return "bg-surface text-ink-muted";
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

export default ApprovalChainPreview;
