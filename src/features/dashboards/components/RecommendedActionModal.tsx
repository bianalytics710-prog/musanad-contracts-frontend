/**
 * E-rev-Recommended-Actions modal — opens when an executive clicks "View"
 * on a Recommended Actions row. Shows:
 *
 *   • Action title + plain-language description
 *   • Why this came up (correlation reason + rule + AED at risk)
 *   • What to do — step-by-step
 *   • SLA badge + role chips
 *   • Assign-to-user dropdown (filtered to users whose role matches the
 *     action's assignedRoles)
 *   • "Assign & dispatch" button → toast + closes modal
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Zap, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { adminRolesService, adminUsersService } from "@/services/api/admin-users.service";
import type { RecommendedActionRow } from "@/types/entities/crg-dashboards.types";
import { formatAedCompact } from "./dashboard-primitives";

interface Props {
  open: boolean;
  row: RecommendedActionRow | null;
  onClose: () => void;
}

/** Plain-language "why this came up" + "what to do" derived from the action text. */
function deriveContext(action: string | null): { why: string; steps: string[] } {
  const a = (action ?? "").toLowerCase();
  if (a.includes("price review")) {
    return {
      why: "A pricing-trigger correlation has fired — the linked clause's escalation threshold has been breached or supplier index has moved beyond the agreed band.",
      steps: [
        "Open the linked contract and review the pricing clause + index reference.",
        "Verify the index movement vs the threshold using the upstream source (FTA / Central Bank rate / supplier filing).",
        "Notify the counterparty in writing within the SLA — template available under Advisory Queue.",
        "Update the contract pricing schedule + audit log; re-run the risk score after acceptance.",
      ],
    };
  }
  if (a.includes("counterparty") && (a.includes("compliance") || a.includes("sign-off"))) {
    return {
      why: "Counterparty risk profile has shifted (sanctions / ICV / ESG signal) — internal compliance sign-off is required before the next milestone or payment release.",
      steps: [
        "Pull the latest sanctions / ICV / ESG report on the counterparty.",
        "Route to Compliance & ESG for review and ADGM/DIFC clearance as applicable.",
        "Capture sign-off in the contract audit trail; reflect in the counterparty profile.",
        "Notify the contract drafter to proceed or pause downstream actions.",
      ],
    };
  }
  if (a.includes("correlation")) {
    return {
      why: "An active correlation between an external signal and one of this contract's clauses crystallises a Marginal Asset Risk (MaR) within scope.",
      steps: [
        "Open the contract Risk tab to review the contributing correlation and its MaR.",
        "Confirm whether the underlying signal still applies (acknowledge / dismiss with rationale).",
        "If actionable, draft an advisory note from the Advisory Templates library and route through approval.",
      ],
    };
  }
  if (a.includes("charter") || a.includes("alt-route") || a.includes("alt route")) {
    return {
      why: "A charter / shipping rule has flagged a route or charter party clause — likely a maritime event (weather, sanctions, or port disruption) intersecting an active voyage.",
      steps: [
        "Review charter party clauses for alt-route + force-majeure carve-outs.",
        "Confirm the operational impact with the Operations function.",
        "Activate alt-route notification to the counterparty if invocation conditions are met.",
        "Log the invocation event in the contract activity log for audit.",
      ],
    };
  }
  return {
    why: "This action was surfaced because a high-MaR correlation is currently active on the contract and a recommended response template exists for the situation.",
    steps: [
      "Open the linked contract and review the Risk tab.",
      "Confirm the correlation is still material; acknowledge or dismiss with rationale.",
      "If material, follow the assigned role's playbook and capture the outcome in the activity log.",
    ],
  };
}

export function RecommendedActionModal({ open, row, onClose }: Props) {
  const { t } = useTranslation();
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // E-rev-C-5: fetch roles + ALL active users once (cached). Filtering happens
  // client-side so opening the modal never blocks on serial network calls,
  // and the dropdown is populated instantly on second open.
  const rolesQuery = useQuery({
    queryKey: ["admin-roles-for-action-modal"],
    queryFn: () => adminRolesService.list(),
    staleTime: 10 * 60_000,
  });
  const allUsersQuery = useQuery({
    queryKey: ["admin-all-users-for-action-modal"],
    queryFn: () => adminUsersService.list({ limit: 100 }),
    staleTime: 5 * 60_000,
  });

  const filteredUsers = useMemo(() => {
    if (!row || !rolesQuery.data || !allUsersQuery.data) return [];
    const wanted = new Set(row.assignedRoles.map((r) => r.toLowerCase()));
    return allUsersQuery.data.data.filter(
      (u) => u.isActive && wanted.has((u.role?.name ?? "").toLowerCase()),
    );
  }, [row, rolesQuery.data, allUsersQuery.data]);

  const usersLoading = rolesQuery.isLoading || allUsersQuery.isLoading;

  // E-rev-D-2: triage — when the modal opens, pre-select the first matching
  // user as the system's recommended assignee. The executive can change it
  // before dispatching. Reset selection if the row changes.
  useEffect(() => {
    if (open && filteredUsers.length > 0) {
      setSelectedUserId(String(filteredUsers[0].id));
    } else {
      setSelectedUserId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row?.correlationId, filteredUsers.length]);

  const suggestedUser = filteredUsers[0] ?? null;

  const ctx = useMemo(() => deriveContext(row?.action ?? null), [row]);

  const onAssign = () => {
    if (!row) return;
    const u = filteredUsers.find((x) => String(x.id) === selectedUserId);
    const target = u ? `${u.firstName} ${u.lastName}`.trim() || u.email : "(unassigned)";
    toast.success(
      t("dashboards.executive.recommendedActionsModal.assigned", {
        defaultValue: "Action assigned to {{user}} and dispatched.",
        user: target,
      }),
    );
    onClose();
    setSelectedUserId("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-[680px]">
        <DialogHeader className="border-b border-border/60 bg-card px-6 py-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber" aria-hidden />
            <DialogTitle>
              {row?.action ?? t("dashboards.executive.recommendedActionsModal.untitled", { defaultValue: "Recommended action" })}
            </DialogTitle>
          </div>
          <DialogDescription>
            {t("dashboards.executive.recommendedActionsModal.description", {
              defaultValue:
                "What the action means, why it surfaced, and the steps to close it. Assign to a teammate to dispatch.",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 overflow-y-auto px-6 py-4">
          {/* Meta strip */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {row?.assignedRoles.map((r) => (
              <span key={r} className="inline-flex rounded bg-gold/15 px-2 py-0.5 font-mono text-[11px] text-ink">
                {r}
              </span>
            ))}
            {row?.slaHours != null && (
              <span className="inline-flex items-center rounded bg-amber/15 px-2 py-0.5 font-mono text-[11px] text-amber">
                SLA · {row.slaHours}h
              </span>
            )}
            {row?.marAed && (
              <span className="ml-auto font-mono text-sm font-semibold text-ink">
                {formatAedCompact(Number(row.marAed))}{" "}
                <span className="text-[11px] font-normal text-ink-subtle">
                  {t("dashboards.executive.recommendedActionsModal.atRisk", { defaultValue: "at risk" })}
                </span>
              </span>
            )}
          </div>

          {/* Assign (moved up for visibility — pre-selected to the suggested user) */}
          <section className="rounded-md border border-gold/30 bg-gold/5 p-3">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                {t("dashboards.executive.recommendedActionsModal.assignTitle", { defaultValue: "Assign to" })}
              </h3>
              {suggestedUser && (
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t("dashboards.executive.recommendedActionsModal.suggestedLabel", { defaultValue: "Suggested" })}
                </span>
              )}
            </div>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
            >
              <option value="">
                {usersLoading
                  ? t("dashboards.executive.recommendedActionsModal.loadingUsers", { defaultValue: "Loading users…" })
                  : t("dashboards.executive.recommendedActionsModal.selectUser", { defaultValue: "Select a teammate…" })}
              </option>
              {filteredUsers.map((u) => {
                const display = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email;
                return (
                  <option key={u.id} value={String(u.id)}>
                    {display} · {u.role.name}
                  </option>
                );
              })}
            </select>
            {suggestedUser && (
              <p className="mt-1.5 text-[11px] text-ink-subtle">
                {t("dashboards.executive.recommendedActionsModal.suggestedHint", {
                  defaultValue:
                    "We've pre-selected {{name}} based on the action's target role. Change it if a different teammate should own this.",
                  name: `${suggestedUser.firstName ?? ""} ${suggestedUser.lastName ?? ""}`.trim() || suggestedUser.email,
                })}
              </p>
            )}
            {!usersLoading && filteredUsers.length === 0 && (
              <p className="mt-1 text-[11px] text-ink-subtle">
                {t("dashboards.executive.recommendedActionsModal.noUsers", {
                  defaultValue: "No active users in the target role(s). Invite one from the Admin page.",
                })}
              </p>
            )}
          </section>

          {/* Why this came up */}
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              {t("dashboards.executive.recommendedActionsModal.whyTitle", { defaultValue: "Why this came up" })}
            </h3>
            <p className="text-sm leading-6 text-ink-muted">{ctx.why}</p>
          </section>

          {/* What to do */}
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              {t("dashboards.executive.recommendedActionsModal.stepsTitle", { defaultValue: "What to do" })}
            </h3>
            <ol className="ml-5 list-decimal space-y-1 text-sm text-ink">
              {ctx.steps.map((s, i) => (
                <li key={i} className="leading-6">{s}</li>
              ))}
            </ol>
          </section>

          {/* Contract link */}
          {row?.contractId && (
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                {t("dashboards.executive.recommendedActionsModal.linkedContract", { defaultValue: "Linked contract" })}
              </h3>
              <Link
                to="/app/contracts/$id"
                params={{ id: row.contractId }}
                className="inline-flex items-center gap-1.5 text-sm text-gold hover:underline"
              >
                {t("dashboards.executive.recommendedActionsModal.openContract", { defaultValue: "Open contract" })}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            </section>
          )}
        </div>

        <DialogFooter className="border-t border-border/60 bg-card px-6 py-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button type="button" onClick={onAssign} disabled={!selectedUserId}>
            {t("dashboards.executive.recommendedActionsModal.assignDispatch", { defaultValue: "Assign & dispatch" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
