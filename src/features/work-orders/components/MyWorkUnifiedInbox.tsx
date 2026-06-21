/**
 * Phase A (mig 640, 2026-06-13) — Unified My Work inbox for non-drafter
 * personas (Legal Counsel + Contract Approver, and ready for Compliance /
 * Procurement / Finance when we widen later).
 *
 * Reads from /api/v1/my-work (useMyWorkUnified) which UNIONs five sources:
 *   - work_order  (materialised; today only drafters get these, but the
 *                  branch is included so LC / Approver get parity if they
 *                  ever do)
 *   - approval_step (their pending approval queue)
 *   - risk_case   (anything routed to them by the risk-routing matrix)
 *   - tpa_review  (Legal Counsel only — role-scoped server-side)
 *   - advisory_draft (assigned by template's approver_role)
 *
 * Why this lives next to MyWorkInbox instead of in it: the drafter inbox
 * carries persona-specific concerns (stage dropdown, Compose-draft wizard
 * entry, "Add to my queue" manual flow) that don't apply here. Sharing
 * would mean threading a dozen flags through one component. Same table
 * styling, separate component, simpler call sites.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, ArrowRight, Plus, ScrollText, ClipboardList } from "lucide-react";
import { useMyWorkUnified } from "../hooks/useWorkOrders";
import { AddManualWorkOrderDialog } from "./AddManualWorkOrderDialog";
import {
  myWorkService,
  myWorkKeys,
  PERSONAL_WORK_STATUSES,
  type MyWorkRow,
  type MyWorkType,
  type PersonalWorkStatus,
  type MyWorkStatusEntry,
} from "@/services/api/my-work.service";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StageCheckboxFilter } from "./StageCheckboxFilter";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const PAGE_SIZE = 20;

/**
 * Type filter options.
 *
 * mig 657 (Gaps 4 + 5): added comment_mention + signature_required.
 * Dropped comment_response from the non-drafter inbox — it routes only to
 * the drafter (work_order branch reads assigned_to_user_id) and never
 * matches for the personas on this surface.
 */
const TYPE_OPTIONS: Array<{ value: "all" | MyWorkType; labelKey: string; labelDefault: string }> = [
  { value: "all",                     labelKey: "myWork.filters.allTypes",                labelDefault: "All types" },
  { value: "approval_awaiting",       labelKey: "myWork.types.approval_awaiting",         labelDefault: "Approval awaiting" },
  { value: "risk_case_assigned",      labelKey: "myWork.types.risk_case_assigned",        labelDefault: "Risk case" },
  { value: "third_party_review",      labelKey: "myWork.types.third_party_review",        labelDefault: "Third-party review" },
  { value: "advisory_draft",          labelKey: "myWork.types.advisory_draft",            labelDefault: "Advisory draft" },
  { value: "comment_mention",         labelKey: "myWork.types.comment_mention",           labelDefault: "Comment mention" },
  { value: "signature_required",      labelKey: "myWork.types.signature_required",        labelDefault: "Signature required" },
  { value: "contract_draft_request",  labelKey: "myWork.types.contract_draft_request",    labelDefault: "Draft request" },
  { value: "contract_returned",       labelKey: "myWork.types.contract_returned",         labelDefault: "Returned" },
];

/** Tone classes for the type pill — matches the i18n key conventions. */
const TYPE_TONE: Record<string, string> = {
  approval_awaiting:      "bg-[var(--sage)]/15 text-[var(--sage)]",
  risk_case_assigned:     "bg-[var(--terracotta)]/15 text-[var(--terracotta)]",
  third_party_review:     "bg-[var(--gold)]/15 text-foreground",
  advisory_draft:         "bg-blue-500/10 text-blue-700",
  comment_mention:        "bg-blue-500/10 text-blue-700",
  signature_required:     "bg-[var(--gold)]/15 text-foreground",
  contract_draft_request: "bg-surface text-ink-muted",
  contract_returned:      "bg-[var(--terracotta)]/10 text-[var(--terracotta)]",
};

const PRIORITY_TONE: Record<string, string> = {
  urgent: "bg-[var(--terracotta)]/15 text-[var(--terracotta)] border-[var(--terracotta)]/40",
  high:   "bg-[var(--gold)]/15 text-foreground border-[var(--gold)]/40",
  normal: "bg-muted text-muted-foreground border-transparent",
  low:    "bg-muted/60 text-muted-foreground/80 border-transparent",
};

// mig 684 — personal work-status overlay (To do / In progress / Done /
// Blocked). Independent of the row's derived lifecycle status; the user
// sets it per item. Rows without a saved value default to to_do.
const PERSONAL_STATUS_TONE: Record<PersonalWorkStatus, string> = {
  to_do:       "bg-muted text-muted-foreground border-input",
  in_progress: "bg-[var(--gold)]/15 text-foreground border-[var(--gold)]/40",
  done:        "bg-[var(--sage)]/15 text-[var(--sage)] border-[var(--sage)]/40",
  blocked:     "bg-[var(--terracotta)]/15 text-[var(--terracotta)] border-[var(--terracotta)]/40",
};

const PERSONAL_STATUS_DEFAULT_LABEL: Record<PersonalWorkStatus, string> = {
  to_do:       "To do",
  in_progress: "In progress",
  done:        "Completed",
  blocked:     "Blocked",
};

function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleDateString("en-CA");
}

/**
 * Action button label per row type. Synthesized rows navigate to the source
 * page (actionUrl); materialised work_order rows would ordinarily use the
 * drafter's stage-aware logic, but for LC / Approver they're rare and the
 * actionUrl fallback is enough.
 */
function actionLabelKey(workOrderType: MyWorkType): { key: string; def: string } {
  switch (workOrderType) {
    case "approval_awaiting":       return { key: "myWork.actions.decide",         def: "Decide" };
    case "risk_case_assigned":      return { key: "myWork.actions.review",         def: "Review" };
    case "third_party_review":      return { key: "myWork.actions.openTpa",        def: "Open review" };
    case "advisory_draft":          return { key: "myWork.actions.openAdvisory",   def: "Open draft" };
    case "comment_mention":         return { key: "myWork.actions.openComment",    def: "Open comment" };
    case "signature_required":      return { key: "myWork.actions.sign",           def: "Sign" };
    case "contract_draft_request":  return { key: "myWork.actions.composeDraft",   def: "Compose draft" };
    case "contract_returned":       return { key: "myWork.actions.editDraft",      def: "Edit draft" };
    case "comment_response":        return { key: "myWork.actions.open",           def: "Open" };
    case "redline_approver_tag":    return { key: "myWork.actions.reviewRedline",  def: "Review redline" };
    default:                        return { key: "myWork.actions.open",           def: "Open" };
  }
}

// mig 684 — personal status dropdown. Pill-styled <select> matching the
// drafter MyWorkInbox StageSelect look. Defaults to to_do when unset.
function StatusSelect({
  value,
  disabled,
  onChange,
  t,
}: {
  value: PersonalWorkStatus;
  disabled: boolean;
  onChange: (next: PersonalWorkStatus) => void;
  t: (k: string, opts?: { defaultValue?: string }) => string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as PersonalWorkStatus)}
      aria-label={t("myWork.personalStatus.aria", { defaultValue: "Change my status" })}
      className={`h-7 cursor-pointer appearance-none rounded-full border px-2 py-0 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${PERSONAL_STATUS_TONE[value]}`}
    >
      {PERSONAL_WORK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(`myWork.personalStatus.${s}`, { defaultValue: PERSONAL_STATUS_DEFAULT_LABEL[s] })}
        </option>
      ))}
    </select>
  );
}

export function MyWorkUnifiedInbox() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | MyWorkType>("all");
  // 2026-06-14 — toolbar parity with drafter MyWorkInbox: From + Status
  // filters, sort toggle, and a local-matches indicator. Status is
  // 'all' | 'open' | 'completed' (the unified inbox today only returns
  // open/in_progress rows, but Status keeps the surface symmetric with
  // the drafter view + leaves headroom for archived rows when added).
  const [fromFilter, setFromFilter] = useState<string>("all");
  // mig 684 — the Status filter now filters on the user's PERSONAL status
  // (To do / In progress / Done / Blocked), matching the new Status column.
  // Multi-select status filter. Defaults to everything still on the task list —
  // all personal statuses except the terminal "done" — so the inbox opens on
  // outstanding work.
  const [statusFilter, setStatusFilter] = useState<Set<PersonalWorkStatus>>(
    () => new Set<PersonalWorkStatus>(["to_do", "in_progress", "blocked"]),
  );
  const [sort, setSort] = useState<"createdDesc" | "createdAsc">("createdDesc");
  const [addOpen, setAddOpen] = useState(false);
  const [addManualOpen, setAddManualOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, search, fromFilter, statusFilter]);

  const listQuery = useMyWorkUnified({
    type: typeFilter === "all" ? undefined : [typeFilter],
    search: search.trim() || undefined,
    limit: PAGE_SIZE,
    page,
  });

  const rows: MyWorkRow[] = listQuery.data?.data ?? [];
  const totalPages = Math.max(1, listQuery.data?.totalPages ?? 1);
  const totalCount = listQuery.data?.totalCount ?? rows.length;
  const pageSize  = listQuery.data?.pageSize ?? PAGE_SIZE;

  // mig 684 — personal status overlay: fetch the map + an upsert mutation.
  const statusesQuery = useQuery({
    queryKey: myWorkKeys.statuses,
    queryFn: () => myWorkService.listStatuses(),
    staleTime: 30_000,
  });
  const statusMap = useMemo(() => {
    const m = new Map<number, PersonalWorkStatus>();
    (statusesQuery.data ?? []).forEach((e) => m.set(e.workItemId, e.status));
    return m;
  }, [statusesQuery.data]);

  const statusMutation = useMutation({
    mutationFn: ({ workItemId, status }: { workItemId: number; status: PersonalWorkStatus }) =>
      myWorkService.setStatus(workItemId, status),
    onMutate: async ({ workItemId, status }) => {
      await qc.cancelQueries({ queryKey: myWorkKeys.statuses });
      const prev = qc.getQueryData<MyWorkStatusEntry[]>(myWorkKeys.statuses);
      qc.setQueryData<MyWorkStatusEntry[]>(myWorkKeys.statuses, (old) => {
        const next = (old ?? []).filter((e) => e.workItemId !== workItemId);
        next.push({ workItemId, status });
        return next;
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(myWorkKeys.statuses, ctx.prev);
      toast.error(t("myWork.statusUpdateError", { defaultValue: "Couldn't update the status." }));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: myWorkKeys.statuses });
    },
  });

  // Build the "From" dropdown options from the rows actually on the page —
  // matches how drafter MyWorkInbox builds its dynamic sender list.
  const fromOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.assignedByName) set.add(r.assignedByName);
    });
    return Array.from(set).sort();
  }, [rows]);

  // Apply local filters (sender + personal status) + sort. Type + search go
  // to BE. Personal status defaults to to_do when the row has no saved value.
  const filteredRows = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (fromFilter !== "all" && r.assignedByName !== fromFilter) return false;
      if (!statusFilter.has(statusMap.get(r.id) ?? "to_do")) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      const aMs = Date.parse(a.createdAt);
      const bMs = Date.parse(b.createdAt);
      return sort === "createdDesc" ? bMs - aMs : aMs - bMs;
    });
    return sorted;
  }, [rows, fromFilter, statusFilter, sort, statusMap]);

  const handleAction = (row: MyWorkRow) => {
    // TanStack Router's typed navigate is strict, so route the wildcard via window history.
    // Within the same SPA both behave identically; this avoids a dozen route-type-imports.
    //
    // The BE my-work UNION (fn_my_work_list_v2) gives several work-order types a
    // generic list-page action_url rather than a contract link:
    //   • redline_approver_tag → "/app/work"      (a self-link → no-op)
    //   • comment_response     → "/app/work"      (a self-link → no-op)
    //   • approval_awaiting    → "/app/approvals" (the queue, not the contract)
    // When the row carries a contract id, route straight to that contract's
    // detail page (the relevant tab) instead. Other types (advisory_draft,
    // risk_case_assigned, signature_required, …) already carry good URLs.
    const contractId = row.targetContractId ?? row.sourceContractId;
    let target = row.actionUrl;
    if (contractId) {
      if (row.workOrderType === "redline_approver_tag") {
        target = `/app/contracts/${contractId}?tab=redline`;
      } else if (row.workOrderType === "comment_response") {
        target = `/app/contracts/${contractId}?tab=comments`;
      } else if (row.workOrderType === "approval_awaiting") {
        // Contract Overview shows the approval stages (A28), so land there.
        target = `/app/contracts/${contractId}`;
      }
    }
    if (target) {
      void navigate({ to: target as never });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("myWork.title", { defaultValue: "My Work" })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("myWork.unifiedSubtitle", {
              defaultValue: "Everything routed to you — approvals, risk cases, third-party reviews and advisory drafts.",
            })}
          </p>
        </div>
        {/* 2026-06-14 — "Add to my queue" parity with drafter MyWorkInbox.
            For non-drafter personas the queue is the actual work board, so
            the user can: (a) start a third-party review (routes to the
            existing /app/legal/third-party-review/new flow), or (b) add a
            personal reminder (opens AddManualWorkOrderDialog with
            comment_response preselected). */}
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" data-testid="unified-add-open">
              <Plus className="h-3.5 w-3.5" />
              {t("myWork.addManual.openButton", { defaultValue: "Add to my queue" })}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1">
            <button
              type="button"
              className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-surface focus:bg-surface focus:outline-none"
              onClick={() => {
                setAddOpen(false);
                void navigate({ to: "/app/legal/third-party-review/new" as never });
              }}
              data-testid="unified-add-tpa"
            >
              <ScrollText className="mt-0.5 h-4 w-4 text-[var(--sage)]" aria-hidden="true" />
              <div>
                <div className="font-medium text-ink">
                  {t("myWork.addManual.options.tpa", {
                    defaultValue: "Start third-party review",
                  })}
                </div>
                <div className="text-xs text-ink-muted">
                  {t("myWork.addManual.options.tpaDescription", {
                    defaultValue: "Log a counterparty paper for review.",
                  })}
                </div>
              </div>
            </button>
            <button
              type="button"
              className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-surface focus:bg-surface focus:outline-none"
              onClick={() => {
                setAddOpen(false);
                setAddManualOpen(true);
              }}
              data-testid="unified-add-reminder"
            >
              <ClipboardList className="mt-0.5 h-4 w-4 text-[var(--gold)]" aria-hidden="true" />
              <div>
                <div className="font-medium text-ink">
                  {t("myWork.addManual.options.reminder", {
                    defaultValue: "Add Task",
                  })}
                </div>
                <div className="text-xs text-ink-muted">
                  {t("myWork.addManual.options.reminderDescription", {
                    defaultValue: "Track an ad-hoc to-do on your queue.",
                  })}
                </div>
              </div>
            </button>
          </PopoverContent>
        </Popover>
      </div>

      <AddManualWorkOrderDialog
        open={addManualOpen}
        onOpenChange={setAddManualOpen}
      />

      {/* Toolbar — matches drafter MyWorkInbox richness: search + Type +
          Status + From + (sortable Created column below). */}
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
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "all" | MyWorkType)}
            aria-label={t("myWork.filters.typeLabel", { defaultValue: "Filter by type" })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey, { defaultValue: o.labelDefault })}
              </option>
            ))}
          </select>
          <StageCheckboxFilter
            options={PERSONAL_WORK_STATUSES.map((s) => ({
              value: s,
              label: t(`myWork.personalStatus.${s}`, {
                defaultValue: PERSONAL_STATUS_DEFAULT_LABEL[s],
              }),
            }))}
            selected={statusFilter}
            onChange={setStatusFilter}
            label={t("myWork.filters.statusesLabel", { defaultValue: "Status" })}
            ariaLabel={t("myWork.filters.statusLabel", { defaultValue: "Filter by status" })}
          />
          <select
            value={fromFilter}
            onChange={(e) => setFromFilter(e.target.value)}
            aria-label={t("myWork.filters.fromLabel", { defaultValue: "Filter by sender" })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">
              {t("myWork.filters.allSenders", { defaultValue: "All senders" })}
            </option>
            {fromOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
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
          ) : filteredRows.length === 0 ? (
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
                      {t("myWork.columns.priority", { defaultValue: "Priority" })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("myWork.columns.from", { defaultValue: "From" })}
                    </th>
                    <th
                      scope="col"
                      className="cursor-pointer select-none px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
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
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("myWork.columns.status", { defaultValue: "Status" })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle text-center">
                      {t("myWork.columns.action", { defaultValue: "Action" })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((wo) => {
                    const sourceTitle = isAr ? wo.sourceContractTitleAr : wo.sourceContractTitleEn;
                    const counterparty = wo.counterpartyName;
                    const payloadAny = (wo.payload ?? {}) as Record<string, unknown>;
                    const advisoryDraftType = payloadAny.draftType as string | undefined;
                    const riskCaseTitle    = payloadAny.title       as string | undefined;
                    const commentSnippet   = payloadAny.snippet     as string | undefined;
                    // mig 657 — risk_case auto-escalated badge
                    const autoEscalated    = payloadAny.autoEscalated === true;
                    const headline =
                      wo.workOrderType === "risk_case_assigned"
                        ? (riskCaseTitle ?? sourceTitle ?? "—")
                        : wo.workOrderType === "third_party_review"
                        ? (sourceTitle ?? wo.sourceContractNumber ?? "—")
                        : wo.workOrderType === "advisory_draft"
                        ? (advisoryDraftType ?? sourceTitle ?? "—")
                        : wo.workOrderType === "comment_mention"
                        ? `@-mention from ${wo.assignedByName ?? "Unknown"}`
                        : wo.workOrderType === "signature_required"
                        ? (sourceTitle ?? wo.sourceContractNumber ?? "Signature required")
                        : (counterparty ?? sourceTitle ?? wo.sourceContractNumber ?? "—");
                    const subtitle =
                      wo.workOrderType === "comment_mention" && commentSnippet
                        ? `“${commentSnippet}”${wo.sourceContractNumber ? ` · ${wo.sourceContractNumber}` : ""}`
                        : wo.sourceContractNumber && wo.workOrderType !== "third_party_review"
                        ? `${wo.sourceContractNumber}${sourceTitle ? " · " + sourceTitle : ""}`
                        : wo.workOrderType === "third_party_review" && wo.counterpartyName
                        ? wo.counterpartyName
                        : null;
                    const action = actionLabelKey(wo.workOrderType as MyWorkType);
                    const priorityTone = PRIORITY_TONE[wo.priority] ?? PRIORITY_TONE.normal;
                    const typeTone     = TYPE_TONE[wo.workOrderType] ?? "bg-surface text-ink-muted";

                    return (
                      <tr key={wo.id} className="group border-b border-border/60 transition-colors hover:bg-surface/50">
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-ink line-clamp-2">{headline}</div>
                          {subtitle && (
                            <div className="text-xs text-ink-muted line-clamp-1">{subtitle}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-ink-muted">
                          <span className={`rounded-md px-2 py-0.5 font-mono text-[11px] tracking-wider ${typeTone}`}>
                            {t(`myWork.types.${wo.workOrderType}`, { defaultValue: wo.workOrderType })}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${priorityTone}`}>
                            {t(`myWork.priorities.${wo.priority}`, { defaultValue: wo.priority })}
                          </span>
                          {autoEscalated && (
                            <span
                              className="ms-1 inline-flex items-center rounded border border-[var(--terracotta)]/40 bg-[var(--terracotta)]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--terracotta)]"
                              title={t("myWork.autoEscalatedTooltip", {
                                defaultValue: "Auto-escalated by the SLA cron — beyond Tier-2 review window.",
                              })}
                            >
                              {t("myWork.autoEscalatedBadge", { defaultValue: "Escalated" })}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-ink/80">{wo.assignedByName ?? "—"}</td>
                        <td className="px-4 py-3 align-top text-ink-muted whitespace-nowrap font-mono text-xs">
                          {formatDate(wo.createdAt)}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <StatusSelect
                            value={statusMap.get(wo.id) ?? "to_do"}
                            disabled={statusMutation.isPending}
                            onChange={(next) =>
                              statusMutation.mutate({ workItemId: wo.id, status: next })
                            }
                            t={t}
                          />
                        </td>
                        <td className="px-4 py-3 align-top text-center">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleAction(wo)}
                            data-testid={`mywork-action-${wo.id}`}
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                            {t(action.key, { defaultValue: action.def })}
                          </Button>
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

      {/* Pagination — mirrors drafter MyWorkInbox: range + a local-matches
          parenthetical when sender / status filters narrow the page below
          the server result count. */}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("myWork.pagination.range", {
            defaultValue: "{{from}}–{{to}} of {{total}}",
            from: rows.length ? (page - 1) * pageSize + 1 : 0,
            to:   (page - 1) * pageSize + rows.length,
            total: totalCount,
          })}
          {filteredRows.length !== rows.length && (
            <span className="ms-1 text-muted-foreground/70">
              {t("myWork.pagination.localMatch", {
                defaultValue: "({{visible}} match local filters)",
                visible: filteredRows.length,
              })}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t("common.prev", { defaultValue: "Prev" })}
          </Button>
          <span className="font-mono">{page} / {totalPages}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("common.next", { defaultValue: "Next" })}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default MyWorkUnifiedInbox;
