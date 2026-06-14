/**
 * M21 — My Work page (table redesign, 2026-06-12).
 *
 * Replaces the card list with a table + toolbar pattern that mirrors the
 * Contracts list. Key differences from the v2 card design:
 *
 *   1. STAGE column derived from work_order.status + target.contract.status +
 *      sidecar progress.currentApproverNames so the drafter sees whether a
 *      draft has been composed, sent for approval, returned, or completed.
 *      The previous design only showed a "Compose draft" button regardless
 *      of stage — invisible progress was the #1 complaint.
 *   2. Dynamic primary action per row driven by (type, stage). E.g. a
 *      draft_request whose target is already in approval shows "View progress"
 *      not "Compose draft".
 *   3. Toolbar: search + Type + Stage + From dropdowns (no tabs).
 *   4. Drops the Inbox icon next to the title per design request.
 *
 * Architecture:
 *   - useMyWorkOrders → canonical list (unchanged fn_work_order_list_for_user)
 *   - useMyWorkProgress → sidecar (mig 628) returns currentApproverNames only
 *   - merged client-side by workOrderId
 *   - if progress query fails, table still renders without "Awaiting <name>"
 *     enrichment — graceful degradation, no hard dependency on the sidecar
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, ChevronLeft, ChevronRight, Plus, Search, Wand2, Eye, Edit3 } from "lucide-react";
import { AddManualWorkOrderDialog } from "./AddManualWorkOrderDialog";
// M21 mig 638/639 — executive variant of the page is the inverse of MyWork.
import { AssignedByMeView } from "./AssignedByMeView";
// Phase A (mig 640) — Legal Counsel + Approver get the unified inbox.
import { MyWorkUnifiedInbox } from "./MyWorkUnifiedInbox";
import { useAuthStore, selectUser } from "@/store/auth.store";
import {
  useMyWorkOrders,
  useMyWorkProgress,
  useMarkMyWorkViewedOnMount,
} from "../hooks/useWorkOrders";
import {
  workOrdersService,
  workOrderKeys,
  type ManualStageValue,
  type WorkOrderRow,
  type WorkOrderType,
} from "@/services/api/work-orders.service";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── Stage derivation ────────────────────────────────────────────────────────
//
// Single source of truth for translating (work_order.status, target.status)
// into a human-readable Stage label + the primary action available. Mirrors
// the matrix in CLAUDE.md and the design discussion with the user.

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

function deriveStage(wo: WorkOrderRow): Stage {
  // 2026-06-12 mig 631 — Drafter override takes precedence. When set, this is
  // the single effective stage everywhere (table cell, filters, sorting). The
  // override values map 1:1 to the five non-cancelled Stage codes.
  if (wo.manualStage) return wo.manualStage as Stage;

  if (wo.status === "cancelled") return "cancelled";
  if (wo.status === "completed") return "completed";
  // From here wo.status is "open" or "in_progress"
  if (!wo.targetContractId) {
    // 2026-06-12 — manual entries don't have a target contract. Respect the
    // drafter's selected initial stage encoded in wo.status:
    //   open         → Not started
    //   in_progress  → Drafting (work has started but no contract row yet)
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

// ─── Action derivation ───────────────────────────────────────────────────────

interface RowAction {
  labelKey: string;
  labelDefault: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "default" | "outline";
  to: {
    route: "compose" | "contractDetail";
    params?: Record<string, string>;
    search?: Record<string, unknown>;
  };
}

function deriveAction(wo: WorkOrderRow, stage: Stage): RowAction | null {
  const isDraftRequest = wo.workOrderType === "contract_draft_request";

  if (stage === "not_started" && isDraftRequest) {
    // 2026-06-12 mig 631 — manual entries without a similar contract should
    // land in the regular Compose flow (template picker). Only seed the AI
    // extract path when the work order has a source contract linked.
    if (wo.sourceContractId) {
      return {
        labelKey: "myWork.actions.composeDraft",
        labelDefault: "Compose draft",
        icon: Wand2,
        variant: "default",
        to: { route: "compose", search: { fromWorkOrder: wo.id } },
      };
    }
    return {
      labelKey: "myWork.actions.composeDraft",
      labelDefault: "Compose draft",
      icon: Wand2,
      variant: "default",
      to: { route: "compose" },
    };
  }
  if (stage === "draft_in_progress" && wo.targetContractId) {
    return {
      labelKey: "myWork.actions.continueEditing",
      labelDefault: "Continue editing",
      icon: Edit3,
      variant: "default",
      to: { route: "contractDetail", params: { id: String(wo.targetContractId) } },
    };
  }
  if (stage === "awaiting_approval" && wo.targetContractId) {
    return {
      labelKey: "myWork.actions.viewProgress",
      labelDefault: "View progress",
      icon: Eye,
      variant: "outline",
      to: { route: "contractDetail", params: { id: String(wo.targetContractId) } },
    };
  }
  if (stage === "returned" && wo.targetContractId) {
    return {
      labelKey: "myWork.actions.editDraft",
      labelDefault: "Edit draft",
      icon: Edit3,
      variant: "default",
      to: { route: "contractDetail", params: { id: String(wo.targetContractId) } },
    };
  }
  if (stage === "completed" && wo.targetContractId) {
    return {
      labelKey: "myWork.actions.viewContract",
      labelDefault: "View contract",
      icon: Eye,
      variant: "outline",
      to: { route: "contractDetail", params: { id: String(wo.targetContractId) } },
    };
  }
  // Comment-response / returned with no target → open the source contract.
  if (!isDraftRequest && wo.targetContractId) {
    return {
      labelKey: "myWork.actions.open",
      labelDefault: "Open",
      icon: ArrowRight,
      variant: "outline",
      to: {
        route: "contractDetail",
        params: { id: String(wo.targetContractId) },
        search: wo.workOrderType === "comment_response" ? { tab: "comments" } : undefined,
      },
    };
  }
  return null;
}

// ─── Toolbar dropdown helper ─────────────────────────────────────────────────

function FilterSelect<T extends string>({
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
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      aria-label={ariaLabel}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── Date formatting ─────────────────────────────────────────────────────────

// 2026-06-12 — switched from relative strings ("Today", "Yesterday") to a
// concrete date so the column is unambiguous regardless of when the drafter
// looks at it. Format uses the user's locale; defaults to en-CA for ISO-like
// yyyy-MM-dd which sorts naturally and is the same in EN + AR locales.
function formatCreatedDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleDateString("en-CA"); // yyyy-MM-dd
}

// ─── Pagination ──────────────────────────────────────────────────────────────
// 2026-06-12 mig 632 — server-paginated. Matches the Contracts list pattern
// (PAGE_SIZE = 20) so the footer + UX read identically to the rest of the app.
const PAGE_SIZE = 20;

// ─── Main component ──────────────────────────────────────────────────────────

export function MyWorkPage() {
  // M21 mig 638 — Persona dispatch happens at the route level — render the
  // inverse view for executives ("Assigned Work") and the today's queue for
  // everyone else. We split into a top-level component because the two views
  // have different hook sets (AssignedByMeView uses its own data hooks).
  const user = useAuthStore(selectUser);
  const roleName = user?.role?.name;
  if (roleName === "executive") {
    return <AssignedByMeView />;
  }
  // Phase A (mig 640) — Legal Counsel + Contract Approver get the unified
  // inbox that UNIONs approvals + risk cases + tpa reviews + advisory drafts.
  // Phase E.7 (mig 654, 2026-06-13) widens to operations / compliance_esg /
  // finance_treasury / procurement_supplier_risk so noise-dismiss + reassign
  // notifications land somewhere the receiver actually sees. Drafter keeps
  // the original work_order-only inbox below so the Compose-draft wizard +
  // manual-stage dropdown stay intact.
  const UNIFIED_INBOX_ROLES = new Set([
    "legal_counsel",
    "contract_approver",
    "operations",
    "compliance_esg",
    "finance_treasury",
    "procurement_supplier_risk",
    // mig 657 (Gap 5) — recipients are signers, so the signature_required
    // branch only reaches them if their /app/work renders the unified inbox.
    "contract_recipient",
  ]);
  if (roleName && UNIFIED_INBOX_ROLES.has(roleName)) {
    return <MyWorkUnifiedInbox />;
  }
  return <MyWorkInbox />;
}

function MyWorkInbox() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useMarkMyWorkViewedOnMount();

  // 2026-06-12 mig 631 — Drafter stage override. Mutation handles a single row
  // at a time. Optimistic-update via setQueryData would be cleaner but the
  // canonical query key changes with filters, so we invalidate instead and
  // let the row re-render from the fresh server snapshot.
  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: ManualStageValue }) =>
      workOrdersService.setStage(id, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.all });
    },
    onError: () => {
      toast.error(
        t("myWork.stageUpdateError", { defaultValue: "Couldn't update the stage." }),
      );
    },
  });

  // Toolbar state.
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | WorkOrderType>("all");
  const [stageFilter, setStageFilter] = useState<"all" | Stage>("all");
  const [fromFilter, setFromFilter] = useState<string>("all");
  const [sort, setSort] = useState<"createdDesc" | "createdAsc">("createdDesc");
  const [addManualOpen, setAddManualOpen] = useState(false);
  // 2026-06-12 mig 632 — server-paginated. Type filter goes to the BE.
  // Stage + From + Search remain client-side narrowing of the current page.
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever the server-side filter changes so we don't
  // ask for, say, page 5 of a fresh-filter result that only has 2 pages.
  useEffect(() => {
    setPage(1);
  }, [typeFilter]);

  const listQuery = useMyWorkOrders({
    status: ["open", "in_progress", "completed"],
    type: typeFilter === "all" ? undefined : [typeFilter],
    limit: PAGE_SIZE,
    page,
  });
  const progressQuery = useMyWorkProgress();

  // Merge sidecar names by workOrderId. Graceful degradation: if the sidecar
  // failed, every row falls back to no approver name (Stage cell still
  // renders "Awaiting approval", just without the "Awaiting <name>" detail).
  const approverNamesByWoId = useMemo(() => {
    const map = new Map<number, string[]>();
    progressQuery.data?.items?.forEach((p) =>
      map.set(p.workOrderId, p.currentApproverNames),
    );
    return map;
  }, [progressQuery.data]);

  const rows = listQuery.data?.data ?? [];
  const totalPages = Math.max(1, listQuery.data?.totalPages ?? 1);
  const totalCount = listQuery.data?.totalCount ?? rows.length;
  const pageSize = listQuery.data?.pageSize ?? PAGE_SIZE;

  // Per-row enriched objects (stage + approver + action) precomputed once so
  // filter + sort + render all read from the same source.
  const enriched = useMemo(
    () =>
      rows.map((wo) => {
        const stage = deriveStage(wo);
        const approverNames = approverNamesByWoId.get(wo.id) ?? [];
        const action = deriveAction(wo, stage);
        return { wo, stage, approverNames, action };
      }),
    [rows, approverNamesByWoId],
  );

  // Build the "From" dropdown from the data we have — assignedByName is the
  // sender for draft_request; the same field is set on returned + comment
  // rows by upstream auto-insert hooks.
  const fromOptions = useMemo(() => {
    const set = new Set<string>();
    enriched.forEach(({ wo }) => {
      if (wo.assignedByName) set.add(wo.assignedByName);
    });
    return Array.from(set).sort();
  }, [enriched]);

  // Apply filters.
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return enriched.filter(({ wo, stage }) => {
      if (typeFilter !== "all" && wo.workOrderType !== typeFilter) return false;
      if (stageFilter !== "all" && stage !== stageFilter) return false;
      if (fromFilter !== "all" && wo.assignedByName !== fromFilter) return false;
      if (!needle) return true;
      const hay = [
        wo.counterpartyName,
        wo.sourceContractNumber,
        wo.targetContractNumber,
        wo.sourceContractTitleEn,
        wo.targetContractTitleEn,
        (wo.payload?.instructionNote as string | undefined) ?? null,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [enriched, search, typeFilter, stageFilter, fromFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const aMs = Date.parse(a.wo.createdAt);
      const bMs = Date.parse(b.wo.createdAt);
      return sort === "createdDesc" ? bMs - aMs : aMs - bMs;
    });
    return copy;
  }, [filtered, sort]);

  const handleAction = (wo: WorkOrderRow, action: RowAction) => {
    if (action.to.route === "compose") {
      void navigate({
        to: "/app/contracts/compose",
        search: action.to.search as Record<string, unknown>,
      });
    } else {
      void navigate({
        to: "/app/contracts/$id",
        params: { id: action.to.params!.id },
        search: action.to.search as Record<string, unknown> | undefined,
      });
    }
    void wo;
  };

  const stageOptions: Array<{ value: "all" | Stage; label: string }> = [
    { value: "all", label: t("myWork.filters.allStages", { defaultValue: "All stages" }) },
    { value: "not_started", label: t("myWork.stages.notStarted", { defaultValue: "Not started" }) },
    {
      value: "draft_in_progress",
      label: t("myWork.stages.draftInProgress", { defaultValue: "Draft in progress" }),
    },
    {
      value: "awaiting_approval",
      label: t("myWork.stages.awaitingApproval", { defaultValue: "Awaiting approval" }),
    },
    { value: "returned", label: t("myWork.stages.returned", { defaultValue: "Returned for changes" }) },
    { value: "completed", label: t("myWork.stages.completed", { defaultValue: "Completed" }) },
  ];

  const typeOptions: Array<{ value: "all" | WorkOrderType; label: string }> = [
    { value: "all", label: t("myWork.filters.allTypes", { defaultValue: "All types" }) },
    {
      value: "contract_draft_request",
      label: t("myWork.types.contract_draft_request", { defaultValue: "Draft request" }),
    },
    {
      value: "contract_returned",
      label: t("myWork.types.contract_returned", { defaultValue: "Returned" }),
    },
    {
      value: "comment_response",
      label: t("myWork.types.comment_response", { defaultValue: "Comment" }),
    },
  ];

  const fromSelectOptions: Array<{ value: string; label: string }> = [
    { value: "all", label: t("myWork.filters.allSenders", { defaultValue: "All senders" }) },
    ...fromOptions.map((n) => ({ value: n, label: n })),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Title — icon dropped per 2026-06-12 design ask. */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("myWork.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("myWork.subtitle")}</p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setAddManualOpen(true)}
          data-testid="addmanual-open"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("myWork.addManual.openButton", { defaultValue: "Add to my queue" })}
        </Button>
      </div>

      <AddManualWorkOrderDialog
        open={addManualOpen}
        onOpenChange={setAddManualOpen}
      />

      {/* Toolbar */}
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("myWork.searchPlaceholder", {
                defaultValue: "Search counterparty, contract number…",
              })}
              className="ps-7"
            />
          </div>
          <FilterSelect
            value={typeFilter}
            onChange={setTypeFilter}
            options={typeOptions}
            ariaLabel={t("myWork.filters.typeLabel", { defaultValue: "Filter by type" })}
          />
          <FilterSelect
            value={stageFilter}
            onChange={setStageFilter}
            options={stageOptions}
            ariaLabel={t("myWork.filters.stageLabel", { defaultValue: "Filter by stage" })}
          />
          <FilterSelect
            value={fromFilter}
            onChange={setFromFilter}
            options={fromSelectOptions}
            ariaLabel={t("myWork.filters.fromLabel", { defaultValue: "Filter by sender" })}
          />
        </div>
      </Card>

      {/* Table — matches Contracts list visual system (bg-surface header,
          font-mono uppercase column labels, border-b row separators). */}
      <Card>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : listQuery.isError ? (
            <p className="p-6 text-sm text-[var(--terracotta)]">
              {t("myWork.loadError", { defaultValue: "Couldn't load your queue. Try again." })}
            </p>
          ) : sorted.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-muted-foreground">
                {rows.length === 0
                  ? t("myWork.empty", { defaultValue: "Your queue is empty." })
                  : t("myWork.emptyFiltered", {
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
                    {t("myWork.columns.from", { defaultValue: "From" })}
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
                {sorted.map(({ wo, stage, approverNames, action }) => {
                  const counterparty =
                    (wo.payload?.counterpartyName as string | undefined) ??
                    wo.counterpartyName ??
                    null;
                  const instruction =
                    (wo.payload?.instructionNote as string | undefined) ?? null;
                  // 2026-06-12 — for manual "Add to my queue" rows, whatever the
                  // drafter typed in Request details is the canonical headline,
                  // even when they pinned a similar contract (which would
                  // otherwise leak the source contract's counterparty into the
                  // Request column). System-generated rows keep the original
                  // counterparty-first behaviour.
                  const isManual = wo.payload?.origin === "manual";
                  const requestHeadline = isManual
                    ? instruction ?? counterparty ?? "—"
                    : counterparty ?? instruction ?? "—";
                  const sourceTitle = isAr
                    ? wo.sourceContractTitleAr
                    : wo.sourceContractTitleEn;
                  // 2026-06-12 — simplified to a single-concept label per stage
                  // ("Approval" instead of "Awaiting Contract Approver,
                  // Legal Counsel"). Approver names move to a row tooltip so
                  // the detail is still one hover away.
                  const stageLabel = t(`myWork.stages.${stage}`, {
                    defaultValue: humaniseStage(stage),
                  });
                  const stageTooltip =
                    stage === "awaiting_approval" && approverNames.length > 0
                      ? t("myWork.stages.awaitingNamed", {
                          defaultValue: "Awaiting {{names}}",
                          names: approverNames.join(", "),
                        })
                      : undefined;
                  const ActionIcon = action?.icon;

                  return (
                    <tr
                      key={wo.id}
                      className="group border-b border-border/60 transition-colors hover:bg-surface/50"
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-ink line-clamp-2">
                          {requestHeadline}
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
                        {wo.assignedByName ?? "—"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StageSelect
                          workOrderId={wo.id}
                          stage={stage}
                          stageLabel={stageLabel}
                          stageTooltip={stageTooltip}
                          onChange={(next) =>
                            stageMutation.mutate({ id: wo.id, stage: next })
                          }
                          disabled={stageMutation.isPending}
                          t={t}
                        />
                      </td>
                      <td className="px-4 py-3 align-top text-ink-muted whitespace-nowrap font-mono text-xs">
                        {formatCreatedDate(wo.createdAt)}
                      </td>
                      <td className="px-4 py-3 align-top text-center">
                        {action ? (
                          <Button
                            size="sm"
                            variant={action.variant}
                            onClick={() => handleAction(wo, action)}
                            data-testid={`mywork-action-${wo.id}`}
                          >
                            {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
                            {t(action.labelKey, { defaultValue: action.labelDefault })}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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

      {/* Pagination footer — mirrors the Contracts list (Prev / page N of M / Next).
          Stage + From + Search are client-side narrowing, so the from-to numbers
          come from the server's totalCount; the visible row count after local
          filters appears in parens. */}
      {totalCount > 0 && (
        <div className="mt-3 flex items-center justify-between gap-4 text-xs text-muted-foreground">
          <div>
            {t("myWork.pagination.range", {
              defaultValue: "{{from}}–{{to}} of {{total}}",
              from: (page - 1) * pageSize + 1,
              to: Math.min(page * pageSize, totalCount),
              total: totalCount,
            })}
            {sorted.length !== rows.length && (
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
              data-testid="mywork-prev"
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
              data-testid="mywork-next"
            >
              {t("common.next", { defaultValue: "Next" })}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
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

// ─── Inline Stage select ─────────────────────────────────────────────────────
//
// 2026-06-12 mig 631 — Replaces the read-only Stage badge with an inline
// dropdown. Drafter picks any of the five effective stages; we PATCH the
// override and let React Query refresh. Cancelled rows render the badge
// unchanged (drafter shouldn't reopen a cancelled work order from here).
//
// Visual style mirrors the previous Badge: same STAGE_TONE classes wrap a
// native <select>, so it reads as a clickable pill instead of a form control
// until the drafter focuses it.

const STAGE_OPTIONS: readonly Stage[] = [
  "not_started",
  "draft_in_progress",
  "awaiting_approval",
  "returned",
  "completed",
] as const;

function StageSelect({
  stage,
  stageLabel,
  stageTooltip,
  onChange,
  disabled,
  t,
}: {
  workOrderId: number;
  stage: Stage;
  stageLabel: string;
  stageTooltip: string | undefined;
  onChange: (next: ManualStageValue) => void;
  disabled: boolean;
  t: (k: string, opts?: { defaultValue?: string }) => string;
}) {
  // Cancelled stays read-only — drafter can't reopen via the dropdown.
  if (stage === "cancelled") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-normal",
          STAGE_TONE[stage],
        )}
        title={stageTooltip}
      >
        {stageLabel}
      </span>
    );
  }

  const stageLabels = STAGE_OPTIONS.map((s) => ({
    value: s,
    label: t(`myWork.stages.${s}`, { defaultValue: humaniseStage(s) }),
  }));

  return (
    <select
      value={stage}
      onChange={(e) => onChange(e.target.value as ManualStageValue)}
      disabled={disabled}
      title={stageTooltip}
      aria-label={t("myWork.stageSelectAria", { defaultValue: "Change stage" })}
      className={cn(
        "h-7 rounded-full border px-2 py-0 text-xs font-normal",
        "appearance-none cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-60",
        STAGE_TONE[stage],
      )}
    >
      {stageLabels.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
