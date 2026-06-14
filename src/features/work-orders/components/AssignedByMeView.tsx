/**
 * M21 mig 638/639 — Executive "Assigned Work" view.
 *
 * The inverse of MyWorkPage: instead of "items assigned TO me" this lists
 * items the executive ROUTED TO others. Same Stage derivation, same
 * pagination chrome, same toolbar — but the FROM column becomes OWNER and
 * the row's primary affordance becomes a row-action menu (View · Nudge ·
 * Reassign · Cancel) instead of a Compose/Continue button.
 *
 * Data:
 *   - useAssignedByMeWorkOrders  → fn_work_order_list_assigned_by_user
 *   - useOwnerOptions            → owner dropdown source
 *   - useNudgeWorkOrder          → POST /:id/nudge
 *   - useReassignWorkOrder       → POST /:id/reassign
 *   - useCancelWorkOrder         → POST /:id/cancel
 *
 * The Stage logic + STAGE_TONE map are copied from MyWorkPage on purpose:
 * the two views share visual language so an exec who occasionally drafts
 * never wonders why the same row reads differently in two places.
 */
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreVertical,
  Plus,
  Search,
  Send,
  UserCog,
  X,
} from "lucide-react";
import {
  useAssignableDrafters,
  useAssignedByMeWorkOrders,
  useCancelWorkOrder,
  useNudgeWorkOrder,
  useOwnerOptions,
  useReassignWorkOrder,
} from "../hooks/useWorkOrders";
import type {
  AssignedByMeRow,
  WorkOrderType,
} from "@/services/api/work-orders.service";
import {
  riskReviewService,
  type RiskAssignedByMeRow,
} from "@/services/api/risk-review.service";
import { humanizeLabel } from "@/features/dashboards/components/dashboard-primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─── Stage derivation (copied verbatim from MyWorkPage) ───────────────────
type Stage =
  | "not_started"
  | "draft_in_progress"
  | "awaiting_approval"
  | "returned"
  | "completed"
  | "cancelled";

const STAGE_TONE: Record<Stage, string> = {
  not_started: "bg-[var(--gold)]/15 text-foreground border-[var(--gold)]/40",
  draft_in_progress: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  awaiting_approval: "bg-[var(--sage)]/15 text-[var(--sage)] border-[var(--sage)]/40",
  returned: "bg-[var(--terracotta)]/15 text-[var(--terracotta)] border-[var(--terracotta)]/40",
  completed: "bg-muted text-muted-foreground border-transparent",
  cancelled: "bg-muted/50 text-muted-foreground/60 border-transparent",
};

function deriveStage(wo: AssignedByMeRow): Stage {
  if (wo.manualStage) return wo.manualStage as Stage;
  if (wo.status === "cancelled") return "cancelled";
  if (wo.status === "completed") return "completed";
  if (!wo.targetContractId) {
    return wo.status === "in_progress" ? "draft_in_progress" : "not_started";
  }
  switch (wo.targetContractStatus) {
    case "draft":
      return "draft_in_progress";
    case "in_approval":
      return "awaiting_approval";
    case "resubmission_requested":
      return "returned";
    case "approved":
    case "signed":
    case "active":
      return "completed";
    default:
      return "draft_in_progress";
  }
}

function humaniseStage(stage: Stage): string {
  switch (stage) {
    case "not_started":
      return "Not started";
    case "draft_in_progress":
      return "Draft in progress";
    case "awaiting_approval":
      return "Awaiting approval";
    case "returned":
      return "Returned for changes";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

// ─── Date formatting (yyyy-MM-dd) ────────────────────────────────────────
function formatCreatedDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleDateString("en-CA");
}

// ─── Stale rule ──────────────────────────────────────────────────────────
// Open rows older than 14 days get a subtle warning chip + row tint so the
// exec spots stuck work without having to dig. No KPI tile by user request.
const STALE_DAYS = 14;
function isStale(wo: AssignedByMeRow): boolean {
  if (wo.status === "completed" || wo.status === "cancelled") return false;
  if (deriveStage(wo) !== "not_started") return false;
  const ms = Date.parse(wo.createdAt);
  if (!Number.isFinite(ms)) return false;
  const days = (Date.now() - ms) / (1000 * 60 * 60 * 24);
  return days >= STALE_DAYS;
}

// ─── Toolbar dropdown helper (same as MyWorkPage) ────────────────────────
function FilterSelect<T extends string | number>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  ariaLabel: string;
}) {
  return (
    <select
      value={String(value)}
      onChange={(e) => onChange(e.target.value as unknown as T)}
      aria-label={ariaLabel}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const PAGE_SIZE = 20;

// ─── Merged row model — risk cases + work orders in one table ────────────
// Discriminated union; kind picks which side the row comes from. The
// `stage` field is normalised so the existing STAGE_TONE / humaniseStage
// helpers work for both. The Type column reads from kind directly for
// risk rows (Risk Assigned / Risk Reassigned) and from wo.workOrderType
// for work-order rows. `createdAt` is the unified sort key — wo.createdAt
// for work-orders, risk row.action_at (timestamp of promote/reassign).
type MergedRow =
  | { kind: "work_order"; id: string; createdAt: string; wo: AssignedByMeRow; stage: Stage; stale: boolean }
  | { kind: "risk_promoted" | "risk_reassigned"; id: string; createdAt: string; rc: RiskAssignedByMeRow; stage: Stage };

/** Map risk_case.status → the existing AssignedByMeView Stage taxonomy. */
function riskStatusToStage(status: string): Stage {
  switch (status) {
    case "open":         return "not_started";
    case "in_review":    return "draft_in_progress";
    case "snoozed":      return "returned";
    case "closed":
    case "accept_risk":  return "completed";
    default:             return "not_started";
  }
}

/** Extended type-filter union: work-order types + the two risk kinds. */
type AssignedTypeFilter = "all" | WorkOrderType | "risk_assigned" | "risk_reassigned";

// ─── Main view ───────────────────────────────────────────────────────────
export function AssignedByMeView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AssignedTypeFilter>("all");
  const [stageFilter, setStageFilter] = useState<"all" | Stage>("all");
  const [ownerFilter, setOwnerFilter] = useState<"all" | string>("all");
  const [sort, setSort] = useState<"createdDesc" | "createdAsc">("createdDesc");
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever any filter changes.
  useEffect(() => {
    setPage(1);
  }, [typeFilter, ownerFilter, stageFilter, search]);

  // Fetch work-orders without server-side type/owner filtering — both now
  // happen client-side after the merge, so the query stays stable and just
  // re-paginates instead of refetching per dropdown change. Eman has ~16
  // work-orders today; limit=200 is generous headroom.
  const listQuery = useAssignedByMeWorkOrders({
    status: ["open", "in_progress", "completed"],
    type: undefined,
    ownerId: undefined,
    limit: 200,
    page: 1,
  });
  // Risk-cases the actor promoted / reassigned / created. Same envelope shape
  // as risk-review list endpoints; this is the data that powered the old
  // standalone section that lived below the table.
  const riskQuery = useQuery({
    queryKey: ["riskCasesAssignedByMe", 50],
    queryFn: () => riskReviewService.assignedByMe(50),
    staleTime: 30_000,
  });
  const ownerOptionsQuery = useOwnerOptions();

  // Action menu state
  const [actionRowId, setActionRowId] = useState<number | null>(null);
  const [nudgeTarget, setNudgeTarget] = useState<AssignedByMeRow | null>(null);
  const [reassignTarget, setReassignTarget] = useState<AssignedByMeRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AssignedByMeRow | null>(null);

  const woRows = listQuery.data?.data ?? [];
  const rcRows = riskQuery.data?.rows ?? [];

  // Merge both sources into a discriminated union. Risk rows use action_at
  // as their createdAt so freshly-routed cases sit alongside fresh
  // work-orders in the sort order.
  const merged: MergedRow[] = useMemo(() => {
    const wo: MergedRow[] = woRows.map((row) => ({
      kind: "work_order",
      id: `wo-${row.id}`,
      createdAt: row.createdAt,
      wo: row,
      stage: deriveStage(row),
      stale: isStale(row),
    }));
    const rc: MergedRow[] = rcRows.map((row) => ({
      kind: row.action_kind === "reassigned" ? "risk_reassigned" : "risk_promoted",
      id: `rc-${row.id}`,
      createdAt: row.action_at,
      rc: row,
      stage: riskStatusToStage(row.status),
    }));
    return [...wo, ...rc];
  }, [woRows, rcRows]);

  // Apply all four filters client-side.
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return merged.filter((row) => {
      // ── Type filter
      if (typeFilter !== "all") {
        if (typeFilter === "risk_assigned") {
          if (row.kind !== "risk_promoted") return false;
        } else if (typeFilter === "risk_reassigned") {
          if (row.kind !== "risk_reassigned") return false;
        } else {
          // work_order type
          if (row.kind !== "work_order") return false;
          if (row.wo.workOrderType !== typeFilter) return false;
        }
      }
      // ── Stage filter (normalised on both sides via the Stage union)
      if (stageFilter !== "all" && row.stage !== stageFilter) return false;
      // ── Owner filter (drafter id; risk rows compare via assigned_user_id)
      if (ownerFilter !== "all") {
        const ownerId = Number(ownerFilter);
        if (row.kind === "work_order") {
          if (Number((row.wo as unknown as { assignedToUserId?: number }).assignedToUserId) !== ownerId) return false;
        } else {
          if (Number(row.rc.assigned_user_id) !== ownerId) return false;
        }
      }
      // ── Search
      if (needle) {
        const hay = row.kind === "work_order"
          ? [
              row.wo.counterpartyName,
              row.wo.sourceContractNumber,
              row.wo.targetContractNumber,
              row.wo.sourceContractTitleEn,
              row.wo.targetContractTitleEn,
              row.wo.assignedToName,
              (row.wo.payload?.instructionNote as string | undefined) ?? null,
            ].filter(Boolean).join(" ").toLowerCase()
          : [
              row.rc.title,
              row.rc.contract_number,
              row.rc.counterparty_name,
              row.rc.assigned_user_name,
              row.rc.assigned_role,
            ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [merged, search, typeFilter, stageFilter, ownerFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const aMs = Date.parse(a.createdAt);
      const bMs = Date.parse(b.createdAt);
      return sort === "createdDesc" ? bMs - aMs : aMs - bMs;
    });
    return copy;
  }, [filtered, sort]);

  // ── Client-side pagination on the merged + filtered + sorted list.
  const pageSize = PAGE_SIZE;
  const totalCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageRows = useMemo(
    () => sorted.slice((page - 1) * pageSize, page * pageSize),
    [sorted, page, pageSize],
  );

  // ─── Dropdown options ─────────────────────────────────────────────────
  const stageOptions: Array<{ value: "all" | Stage; label: string }> = [
    { value: "all", label: t("assignedWork.filters.allStages", { defaultValue: "All stages" }) },
    { value: "not_started", label: t("myWork.stages.notStarted", { defaultValue: "Not started" }) },
    { value: "draft_in_progress", label: t("myWork.stages.draftInProgress", { defaultValue: "Draft in progress" }) },
    { value: "awaiting_approval", label: t("myWork.stages.awaitingApproval", { defaultValue: "Awaiting approval" }) },
    { value: "returned", label: t("myWork.stages.returned", { defaultValue: "Returned for changes" }) },
    { value: "completed", label: t("myWork.stages.completed", { defaultValue: "Completed" }) },
  ];

  const typeOptions: Array<{ value: AssignedTypeFilter; label: string }> = [
    { value: "all", label: t("assignedWork.filters.allTypes", { defaultValue: "All types" }) },
    { value: "risk_assigned", label: t("assignedWork.types.risk_assigned", { defaultValue: "Risk Assigned" }) },
    { value: "risk_reassigned", label: t("assignedWork.types.risk_reassigned", { defaultValue: "Risk Reassigned" }) },
    { value: "contract_draft_request", label: t("myWork.types.contract_draft_request", { defaultValue: "Draft request" }) },
    { value: "contract_returned", label: t("myWork.types.contract_returned", { defaultValue: "Returned" }) },
    { value: "comment_response", label: t("myWork.types.comment_response", { defaultValue: "Comment" }) },
  ];

  const ownerSelectOptions: Array<{ value: string; label: string }> = [
    { value: "all", label: t("assignedWork.filters.allOwners", { defaultValue: "All owners" }) },
    ...(ownerOptionsQuery.data ?? []).map((o) => ({
      value: String(o.id),
      label: o.label,
    })),
  ];

  // ─── Empty state ──────────────────────────────────────────────────────
  const isEmptyTotal = !listQuery.isLoading && !riskQuery.isLoading && merged.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("assignedWork.title", { defaultValue: "Assigned Work" })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("assignedWork.subtitle", {
              defaultValue:
                "Track everything you've routed to your team — from request through signature.",
            })}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("assignedWork.searchPlaceholder", {
                defaultValue: "Search counterparty, contract number, owner…",
              })}
              className="ps-7"
            />
          </div>
          <FilterSelect
            value={typeFilter}
            onChange={setTypeFilter}
            options={typeOptions}
            ariaLabel={t("assignedWork.filters.typeLabel", {
              defaultValue: "Filter by type",
            })}
          />
          <FilterSelect
            value={stageFilter}
            onChange={setStageFilter}
            options={stageOptions}
            ariaLabel={t("assignedWork.filters.stageLabel", {
              defaultValue: "Filter by stage",
            })}
          />
          <FilterSelect
            value={ownerFilter}
            onChange={setOwnerFilter}
            options={ownerSelectOptions}
            ariaLabel={t("assignedWork.filters.ownerLabel", {
              defaultValue: "Filter by owner",
            })}
          />
        </div>
      </Card>

      {/* Table — matches Contracts list visual system: bg-surface header with
          font-mono uppercase column labels + border-b row separators. */}
      <Card>
        <CardContent className="p-0">
          {(listQuery.isLoading || riskQuery.isLoading) ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : listQuery.isError ? (
            <p className="p-6 text-sm text-[var(--terracotta)]">
              {t("assignedWork.loadError", {
                defaultValue: "Couldn't load your assignments. Try again.",
              })}
            </p>
          ) : isEmptyTotal ? (
            <EmptyState />
          ) : sorted.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-muted-foreground">
                {t("assignedWork.emptyFiltered", {
                  defaultValue: "No work orders match these filters.",
                })}
              </p>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface">
                <tr className="text-left">
                  <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                    {t("myWork.columns.request", { defaultValue: "Request" })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                    {t("myWork.columns.type", { defaultValue: "Type" })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                    {t("assignedWork.columns.owner", { defaultValue: "Owner" })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                    {t("myWork.columns.stage", { defaultValue: "Stage" })}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle cursor-pointer select-none"
                    onClick={() =>
                      setSort((s) => (s === "createdDesc" ? "createdAsc" : "createdDesc"))
                    }
                    aria-sort={sort === "createdDesc" ? "descending" : "ascending"}
                  >
                    {t("myWork.columns.created", { defaultValue: "Created" })}
                    <span className="ms-1 text-[10px] text-ink-subtle/60">
                      {sort === "createdDesc" ? "↓" : "↑"}
                    </span>
                  </th>
                  <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle text-center">
                    {t("myWork.columns.action", { defaultValue: "Action" })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const stageLabel = t(`myWork.stages.${row.stage}`, {
                    defaultValue: humaniseStage(row.stage),
                  });
                  // ─── Work-order row ────────────────────────────────────
                  if (row.kind === "work_order") {
                    const wo = row.wo;
                    const counterparty =
                      (wo.payload?.counterpartyName as string | undefined) ??
                      wo.counterpartyName ??
                      null;
                    const instruction =
                      (wo.payload?.instructionNote as string | undefined) ?? null;
                    const isManual = wo.payload?.origin === "manual";
                    const requestHeadline = isManual
                      ? instruction ?? counterparty ?? "—"
                      : counterparty ?? instruction ?? "—";
                    const sourceTitle = isAr
                      ? wo.sourceContractTitleAr
                      : wo.sourceContractTitleEn;
                    const canAct = wo.status !== "completed" && wo.status !== "cancelled";
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "group border-b border-border/60 transition-colors hover:bg-surface/50",
                          row.stale && "bg-[var(--gold)]/[0.06]",
                        )}
                      >
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-start gap-2">
                            <div className="font-medium text-ink line-clamp-2">
                              {requestHeadline}
                            </div>
                            {row.stale && (
                              <span
                                className="rounded-md border border-[var(--gold)]/50 bg-[var(--gold)]/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink"
                                title={t("assignedWork.staleHint", {
                                  defaultValue:
                                    "Not started for {{days}}+ days — consider nudging the owner.",
                                  days: STALE_DAYS,
                                })}
                              >
                                {t("assignedWork.stale", { defaultValue: "Stale" })}
                              </span>
                            )}
                          </div>
                          {sourceTitle && (
                            <div className="text-xs text-ink-muted line-clamp-1">
                              {t("myWork.basedOn", { defaultValue: "Based on" })}{" "}
                              <span className="font-mono">{wo.sourceContractNumber}</span>
                              <span className="mx-1">·</span>
                              {sourceTitle}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-ink-muted">
                          <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-[11px] tracking-wider">
                            {t(`myWork.types.${wo.workOrderType}`, {
                              defaultValue: wo.workOrderType,
                            })}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-ink/80">
                          {wo.assignedToName ?? "—"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-normal",
                              STAGE_TONE[row.stage],
                            )}
                          >
                            {stageLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-ink-muted whitespace-nowrap font-mono text-xs">
                          {formatCreatedDate(wo.createdAt)}
                        </td>
                        <td className="px-4 py-3 align-top text-center">
                          <RowActionsMenu
                            open={actionRowId === wo.id}
                            onToggle={() =>
                              setActionRowId((id) => (id === wo.id ? null : wo.id))
                            }
                            onClose={() => setActionRowId(null)}
                            canAct={canAct}
                            onView={() => {
                              const target = wo.targetContractId ?? wo.sourceContractId;
                              if (target) {
                                setActionRowId(null);
                                void navigate({
                                  to: "/app/contracts/$id",
                                  params: { id: String(target) },
                                });
                              }
                            }}
                            onNudge={() => {
                              setActionRowId(null);
                              setNudgeTarget(wo);
                            }}
                            onReassign={() => {
                              setActionRowId(null);
                              setReassignTarget(wo);
                            }}
                            onCancel={() => {
                              setActionRowId(null);
                              setCancelTarget(wo);
                            }}
                            labels={{
                              view: t("assignedWork.actions.view", { defaultValue: "View contract" }),
                              nudge: t("assignedWork.actions.nudge", { defaultValue: "Nudge owner" }),
                              reassign: t("assignedWork.actions.reassign", { defaultValue: "Reassign" }),
                              cancel: t("assignedWork.actions.cancel", { defaultValue: "Cancel work order" }),
                            }}
                          />
                        </td>
                      </tr>
                    );
                  }

                  // ─── Risk-case row (kind = risk_promoted | risk_reassigned) ───
                  const rc = row.rc;
                  const typeLabel = row.kind === "risk_reassigned"
                    ? t("assignedWork.types.risk_reassigned", { defaultValue: "Risk Reassigned" })
                    : t("assignedWork.types.risk_assigned",   { defaultValue: "Risk Assigned" });
                  const typeTone = row.kind === "risk_reassigned"
                    ? "bg-[var(--gold)]/15 text-foreground"
                    : "bg-[var(--sage)]/15 text-[var(--sage)]";
                  // Owner fallback: prefer the actual pinned user; if no user
                  // is set (Eman promoted to a role queue without picking a
                  // person), humanise the role + show a small "(role queue)"
                  // helper so the row isn't ambiguously blank.
                  const ownerCell = rc.assigned_user_name
                    ? <span>{rc.assigned_user_name}</span>
                    : rc.assigned_role
                    ? (
                        <span className="text-ink/80">
                          {humanizeLabel(rc.assigned_role)}
                          <span className="ms-1 text-[10px] text-ink-subtle/70">
                            {t("assignedWork.roleQueue", { defaultValue: "(role queue — awaiting claim)" })}
                          </span>
                        </span>
                      )
                    : <span className="text-ink-muted">—</span>;
                  // Use a stable numeric key for the action-menu state so
                  // risk rows don't collide with work-order ids (which can
                  // also be small integers). Offset by -10_000_000.
                  const rcMenuKey = -10_000_000 - Number(rc.id);
                  return (
                    <tr
                      key={row.id}
                      className="group border-b border-border/60 transition-colors hover:bg-surface/50"
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-ink line-clamp-2">{rc.title}</div>
                        {rc.contract_number && (
                          <div className="text-xs text-ink-muted line-clamp-1">
                            <span className="font-mono">{rc.contract_number}</span>
                            {rc.counterparty_name && (
                              <>
                                <span className="mx-1">·</span>
                                {rc.counterparty_name}
                              </>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-ink-muted">
                        <span className={cn("rounded-md px-2 py-0.5 font-mono text-[11px] tracking-wider", typeTone)}>
                          {typeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-ink/80">
                        {ownerCell}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-normal",
                            STAGE_TONE[row.stage],
                          )}
                        >
                          {stageLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-ink-muted whitespace-nowrap font-mono text-xs">
                        {formatCreatedDate(rc.action_at)}
                      </td>
                      <td className="px-4 py-3 align-top text-center">
                        <RowActionsMenu
                          open={actionRowId === rcMenuKey}
                          onToggle={() =>
                            setActionRowId((id) => (id === rcMenuKey ? null : rcMenuKey))
                          }
                          onClose={() => setActionRowId(null)}
                          canAct={true}
                          onView={() => {
                            setActionRowId(null);
                            void navigate({
                              to: "/app/risk-cases/$caseId",
                              params: { caseId: rc.id },
                            });
                          }}
                          labels={{
                            view: t("assignedWork.actions.viewCase", { defaultValue: "View risk case" }),
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination footer */}
      {totalCount > 0 && (
        <div className="mt-3 flex items-center justify-between gap-4 text-xs text-muted-foreground">
          <div>
            {t("myWork.pagination.range", {
              defaultValue: "{{from}}–{{to}} of {{total}}",
              from: (page - 1) * pageSize + 1,
              to: Math.min(page * pageSize, totalCount),
              total: totalCount,
            })}
            {sorted.length !== merged.length && (
              <span className="ms-1 text-muted-foreground/70">
                {t("myWork.pagination.localMatch", {
                  defaultValue: "({{visible}} match local filters)",
                  visible: sorted.length,
                })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || listQuery.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              data-testid="assignedwork-prev"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t("common.prev", { defaultValue: "Prev" })}
            </Button>
            <span className="font-mono">
              {t("myWork.pagination.pageOf", {
                defaultValue: "{{page}} / {{total}}",
                page,
                total: totalPages,
              })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || listQuery.isFetching}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              data-testid="assignedwork-next"
            >
              {t("common.next", { defaultValue: "Next" })}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {nudgeTarget && (
        <NudgeDialog
          row={nudgeTarget}
          onClose={() => setNudgeTarget(null)}
        />
      )}
      {reassignTarget && (
        <ReassignDialog
          row={reassignTarget}
          onClose={() => setReassignTarget(null)}
        />
      )}
      {cancelTarget && (
        <CancelDialog
          row={cancelTarget}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────
function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gold)]/15">
        <Plus className="h-5 w-5 text-[var(--gold)]" />
      </div>
      <p className="text-sm font-medium text-foreground">
        {t("assignedWork.empty.title", { defaultValue: "You haven't assigned any work yet." })}
      </p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
        {t("assignedWork.empty.hint", {
          defaultValue:
            "Open a contract and click \"Request similar contract\", or ask the chatbot: \"Draft a similar contract for Vibrant Energy based on CT-2026-000028 and assign to Hala.\"",
        })}
      </p>
    </div>
  );
}

// ─── RowActionsMenu ──────────────────────────────────────────────────────
// Lightweight popover (no third-party). Clicking the kebab toggles a small
// floating menu of actions. Clicking outside (handled by the row map's
// ToggleSet via setActionRowId(null)) closes it.
function RowActionsMenu({
  open,
  onToggle,
  onClose,
  canAct,
  onView,
  onNudge,
  onReassign,
  onCancel,
  labels,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  canAct: boolean;
  onView: () => void;
  /**
   * Risk-case rows pass only `onView`; the other three are work-order
   * specific (nudge / reassign-drafter / cancel-work-order) and stay
   * undefined here so the menu drops those items rather than showing
   * disabled rows that confuse the executive.
   */
  onNudge?: () => void;
  onReassign?: () => void;
  onCancel?: () => void;
  labels: {
    view: string;
    nudge?: string;
    reassign?: string;
    cancel?: string;
  };
}) {
  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = () => onClose();
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [open, onClose]);

  return (
    <div className="relative inline-block text-start">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute end-0 z-30 mt-1 w-48 rounded-md border border-border bg-card shadow-lg"
        >
          <MenuItem icon={Eye} label={labels.view} onClick={onView} />
          {onNudge && labels.nudge && (
            <MenuItem icon={Send} label={labels.nudge} onClick={onNudge} disabled={!canAct} />
          )}
          {onReassign && labels.reassign && (
            <MenuItem icon={UserCog} label={labels.reassign} onClick={onReassign} disabled={!canAct} />
          )}
          {onCancel && labels.cancel && (
            <MenuItem icon={X} label={labels.cancel} onClick={onCancel} disabled={!canAct} tone="danger" />
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-start text-xs",
        "hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
        tone === "danger" && "text-[var(--terracotta)]",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ─── NudgeDialog ─────────────────────────────────────────────────────────
function NudgeDialog({
  row,
  onClose,
}: {
  row: AssignedByMeRow;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const mutation = useNudgeWorkOrder();

  const onSubmit = () => {
    mutation.mutate(
      { id: row.id, message: message.trim() || undefined },
      {
        onSuccess: (data) => {
          if (data.throttled) {
            toast(
              t("assignedWork.nudge.throttledToast", {
                defaultValue: "Already nudged recently. You can nudge {{name}} again at {{when}}.",
                name: row.assignedToName ?? "the owner",
                when: data.nextEligibleAt
                  ? new Date(data.nextEligibleAt).toLocaleString()
                  : "—",
              }),
            );
          } else {
            toast.success(
              t("assignedWork.nudge.sentToast", {
                defaultValue: "Nudge sent to {{name}}.",
                name: data.assigneeName ?? row.assignedToName ?? "the owner",
              }),
            );
          }
          onClose();
        },
        onError: (err) => {
          toast.error(
            err.message ??
              t("assignedWork.nudge.errorToast", {
                defaultValue: "Couldn't send the nudge.",
              }),
          );
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("assignedWork.nudge.title", {
              defaultValue: "Nudge {{name}}",
              name: row.assignedToName ?? "owner",
            })}
          </DialogTitle>
          <DialogDescription>
            {t("assignedWork.nudge.description", {
              defaultValue:
                "An in-app reminder will be sent to the owner. You can nudge again after 6 hours.",
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="nudge-msg" className="text-xs font-medium text-foreground">
            {t("assignedWork.nudge.messageLabel", { defaultValue: "Add a short note (optional)" })}
          </label>
          <textarea
            id="nudge-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={t("assignedWork.nudge.placeholder", {
              defaultValue: "Any extra context? e.g. 'Customer is asking — can you push this?'",
            })}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button type="button" disabled={mutation.isPending} onClick={onSubmit}>
            <Send className="h-3.5 w-3.5" />
            {t("assignedWork.nudge.send", { defaultValue: "Send nudge" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ReassignDialog ──────────────────────────────────────────────────────
function ReassignDialog({
  row,
  onClose,
}: {
  row: AssignedByMeRow;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const drafters = useAssignableDrafters();
  const mutation = useReassignWorkOrder();
  const [newAssigneeId, setNewAssigneeId] = useState<number | "">("");
  const [reason, setReason] = useState("");

  const eligible = (drafters.data ?? []).filter(
    (d) => d.id !== row.assignedToUserId,
  );

  const submit = () => {
    if (newAssigneeId === "") return;
    mutation.mutate(
      { id: row.id, newAssigneeId: Number(newAssigneeId), reason: reason.trim() || undefined },
      {
        onSuccess: (data) => {
          toast.success(
            t("assignedWork.reassign.successToast", {
              defaultValue: "Moved to {{name}}.",
              name: data.newAssignee.name,
            }),
          );
          onClose();
        },
        onError: (err) => {
          toast.error(
            err.message ??
              t("assignedWork.reassign.errorToast", {
                defaultValue: "Couldn't reassign.",
              }),
          );
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("assignedWork.reassign.title", { defaultValue: "Reassign work order" })}
          </DialogTitle>
          <DialogDescription>
            {t("assignedWork.reassign.description", {
              defaultValue:
                "The new owner will get an in-app notification. The previous owner ({{prev}}) stays silent.",
              prev: row.assignedToName ?? "—",
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="reassign-to" className="text-xs font-medium text-foreground">
              {t("assignedWork.reassign.newOwnerLabel", { defaultValue: "New owner" })}
            </label>
            <select
              id="reassign-to"
              value={newAssigneeId === "" ? "" : String(newAssigneeId)}
              onChange={(e) =>
                setNewAssigneeId(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">
                {t("assignedWork.reassign.pickOwner", {
                  defaultValue: drafters.isLoading ? "Loading…" : "Pick a drafter…",
                })}
              </option>
              {eligible.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName} · {d.openWorkOrders} open
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="reassign-reason" className="text-xs font-medium text-foreground">
              {t("assignedWork.reassign.reasonLabel", { defaultValue: "Reason (optional)" })}
            </label>
            <textarea
              id="reassign-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || newAssigneeId === ""}
            onClick={submit}
          >
            <UserCog className="h-3.5 w-3.5" />
            {t("assignedWork.reassign.submit", { defaultValue: "Reassign" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CancelDialog ────────────────────────────────────────────────────────
function CancelDialog({
  row,
  onClose,
}: {
  row: AssignedByMeRow;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const mutation = useCancelWorkOrder();

  const submit = () => {
    mutation.mutate(
      { id: row.id, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(
            t("assignedWork.cancel.successToast", {
              defaultValue: "Work order cancelled.",
            }),
          );
          onClose();
        },
        onError: (err) => {
          toast.error(
            err.message ??
              t("assignedWork.cancel.errorToast", {
                defaultValue: "Couldn't cancel.",
              }),
          );
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("assignedWork.cancel.title", { defaultValue: "Cancel work order" })}
          </DialogTitle>
          <DialogDescription>
            {t("assignedWork.cancel.description", {
              defaultValue:
                "Cancels the assignment for {{name}}. They will no longer see it in their queue.",
              name: row.assignedToName ?? "owner",
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <label htmlFor="cancel-reason" className="text-xs font-medium text-foreground">
            {t("assignedWork.cancel.reasonLabel", { defaultValue: "Reason (optional)" })}
          </label>
          <textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.back", { defaultValue: "Back" })}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={submit}
            className="border-[var(--terracotta)]/50 text-[var(--terracotta)] hover:bg-[var(--terracotta)]/10"
          >
            <X className="h-3.5 w-3.5" />
            {t("assignedWork.cancel.submit", { defaultValue: "Cancel work order" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

