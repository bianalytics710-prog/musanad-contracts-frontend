/**
 * ApprovalsListView (S1) — paginated approver inbox.
 *
 * GET /api/v1/approvals/my-pending — auto-refreshes at 30s. RLS narrows
 * naturally (only steps the caller is the approver / delegate / reassigned
 * target / role-match for); BE applies the 4-OR assignment rule.
 *
 * AC mapping:
 *   AC-S1-01..03 — full row shape; 4-OR assignment.
 *   AC-S1-04 / AC-S1-05 — pagination + sort.
 *   AC-S1-06 — empty state copy.
 *   AC-S1-07 — totalPages=0 when total=0 (precedent — handled in BE).
 *
 * 13-checklist mapping:
 *   T1/T2 — service through approvalService.myPending + React Query.
 *   T3    — every label uses t().
 *   T4    — explicit loading / error / empty branches.
 *   T5    — semantic tokens.
 *   T6    — semantic <table> with scope=col, aria-busy, aria-live polite
 *           on the table body during refetch.
 *   T7    — all types from approval.types.ts; no any.
 *   T10   — sort selector; no search input on this view (per Lovable).
 *   T11   — wrapped in route ErrorBoundary.
 *   T12   — formatDateTime for hoursPending → "x days ago" via t().
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { RefreshCw, AlertCircle, Zap, Clock, CheckCircle2, XCircle, MessageCircleQuestion, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { translateApiError } from "@/lib/translate-api-error";
import { useMyPendingApprovals, useDecideApproval } from "@/features/approvals/hooks/useApprovals";
import { useQuery } from "@tanstack/react-query";
import { approvalService } from "@/services/api/approval.service";
import type { ApiError } from "@/lib/api-client";
import { ApprovalDecisionDialog } from "@/features/approvals/components/ApprovalDecisionDialog";
import { RequestInfoDialog } from "@/features/approvals/components/RequestInfoDialog";
import { MessageSquare } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import {
  APPROVAL_PENDING_SORT_VALUES,
  type ApprovalChainStepRef,
  type ApprovalPendingSort,
  type MyPendingApprovalListItem,
  type MyPendingApprovalListQuery,
  type MyPendingApprovalListResponse,
} from "@/types/entities/approval.types";
import type { ApprovalActionKind } from "@/features/approvals/components/ApprovalDecisionDialog";

const PAGE_SIZE = 20;

type TabKey = "all" | "pending" | "approved" | "rejected" | "watching";

export function ApprovalsListView() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const currentUserId = user?.id ?? null;

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ApprovalPendingSort>("oldest");
  const [activeStep, setActiveStep] = useState<MyPendingApprovalListItem | null>(
    null,
  );
  // R1 audit 6.4.6: per-row inline buttons preset the action so the dialog
  // opens directly to Approve / Reject / Request-info, matching Lovable's
  // 1-click decision flow (was previously a 2-step Act → choose-action).
  const [presetAction, setPresetAction] = useState<ApprovalActionKind | null>(null);
  // R-LC4 LC-F7 — separate Request-info dialog (soft action; distinct from
  // request_resubmission's hard bounce).
  const [requestInfoStepId, setRequestInfoStepId] = useState<number | null>(null);
  // R1 audit 6.2.1: 5-tab inbox matches Lovable. "Pending mine" is the
  // default + only tab with real data in R1; the other 4 surface a
  // "coming soon" placeholder until the BE endpoints land in R3.
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  // R3 audit 6.3.1: bulk-select state.
  const [selectedStepIds, setSelectedStepIds] = useState<Set<number>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  const decideMutation = useDecideApproval();

  const query: MyPendingApprovalListQuery = useMemo(
    () => ({ page, limit: PAGE_SIZE, sort }),
    [page, sort],
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useMyPendingApprovals(query, { enabled: activeTab === "pending" });

  // R5 audit 6.2.1 — three additional tab queries.
  const decisionsKind: "approve" | "reject" | undefined =
    activeTab === "approved" ? "approve" : activeTab === "rejected" ? "reject" : undefined;
  const decisionsQuery = useQuery<MyPendingApprovalListResponse, ApiError>({
    queryKey: ["approval", "my-decisions", { page, kind: decisionsKind ?? null }],
    queryFn: () =>
      approvalService.myDecisions({
        page,
        limit: PAGE_SIZE,
        kind: decisionsKind,
      }) as Promise<MyPendingApprovalListResponse>,
    enabled: activeTab === "all" || activeTab === "approved" || activeTab === "rejected",
    staleTime: 15_000,
  });
  const watchingQuery = useQuery<MyPendingApprovalListResponse, ApiError>({
    queryKey: ["approval", "watching", { page }],
    queryFn: () =>
      approvalService.watching({ page, limit: PAGE_SIZE }) as Promise<MyPendingApprovalListResponse>,
    enabled: activeTab === "watching",
    staleTime: 15_000,
  });

  // Choose the active dataset based on the selected tab.
  const activeData =
    activeTab === "pending"
      ? data
      : activeTab === "watching"
        ? watchingQuery.data
        : decisionsQuery.data;
  const activeIsLoading =
    activeTab === "pending"
      ? isLoading
      : activeTab === "watching"
        ? watchingQuery.isLoading
        : decisionsQuery.isLoading;
  const activeIsError =
    activeTab === "pending"
      ? isError
      : activeTab === "watching"
        ? watchingQuery.isError
        : decisionsQuery.isError;
  const activeError =
    activeTab === "pending" ? error : activeTab === "watching" ? watchingQuery.error : decisionsQuery.error;
  const activeRefetch =
    activeTab === "pending"
      ? refetch
      : activeTab === "watching"
        ? watchingQuery.refetch
        : decisionsQuery.refetch;
  const activeIsFetching =
    activeTab === "pending" ? isFetching : activeTab === "watching" ? watchingQuery.isFetching : decisionsQuery.isFetching;

  const items = activeData?.data ?? [];
  const pagination = activeData?.pagination;

  // A5 (Aisha audit) — KPI tiles read "Pending decisions / SLA breaches /
  // Avg waiting / Pending value". Locked to the pending dataset so they keep
  // pending-only semantics regardless of which tab is open. Switching tabs
  // changes the table; the KPIs reflect the inbox snapshot.
  const pendingItems = data?.data ?? [];
  const pendingTotal = data?.pagination?.total ?? pendingItems.length;
  const slaBreaches = useMemo(
    () => pendingItems.filter((i) => i.hoursPending > 24).length,
    [pendingItems],
  );
  const avgWaitHours = useMemo(() => {
    if (pendingItems.length === 0) return 0;
    return Math.round(
      pendingItems.reduce((s, i) => s + i.hoursPending, 0) / pendingItems.length,
    );
  }, [pendingItems]);
  const totalValue = useMemo(
    () =>
      pendingItems.reduce((s, i) => s + (i.valueAed ?? 0), 0),
    [pendingItems],
  );

  // R3 audit 6.3.1: bulk approve fires a decide mutation for each selected
  // step in parallel (Promise.allSettled — partial failures don't abort the
  // batch). Refetch on completion so the inbox reflects the new state.
  const handleBulkApprove = async () => {
    if (selectedStepIds.size === 0 || bulkApproving) return;
    setBulkApproving(true);
    const results = await Promise.allSettled(
      Array.from(selectedStepIds).map((stepId) =>
        decideMutation.mutateAsync({ stepId, data: { decision: "approve" } }),
      ),
    );
    const failures = results.filter((r) => r.status === "rejected").length;
    setBulkApproving(false);
    setSelectedStepIds(new Set());
    if (failures === 0) {
      toast.success(
        t("approval.bulk.approveAllSuccess", {
          count: results.length,
          defaultValue:
            results.length === 1
              ? "1 contract approved"
              : `${results.length} contracts approved`,
        }),
      );
    } else {
      toast.error(
        t("approval.bulk.approveAllPartial", {
          ok: results.length - failures,
          failed: failures,
          defaultValue: `${results.length - failures} approved, ${failures} failed`,
        }),
      );
    }
    void refetch();
  };

  const toggleRowSelected = (stepId: number) => {
    setSelectedStepIds((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };
  const toggleAllSelected = () => {
    if (selectedStepIds.size === items.length && items.length > 0) {
      setSelectedStepIds(new Set());
    } else {
      setSelectedStepIds(new Set(items.map((i) => i.stepId)));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-ink-subtle">
            {/* A6 (Aisha audit) — "urgent" overloaded both "Urgent priority"
                badge and "SLA breach"; rename to SLA-breach count which is
                what the value actually measures. A5 — always show
                Pending-tab counts here so the kicker matches the KPI strip. */}
            {t("approval.list.eyebrow", {
              count: pendingTotal,
              urgent: slaBreaches,
              defaultValue: "{{count}} pending · {{urgent}} SLA breaches",
            })}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("approval.list.title")}
          </h1>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void activeRefetch()}
          disabled={activeIsFetching}
          aria-label={t("common.refresh", { defaultValue: "Refresh" })}
        >
          {/* A12 (Aisha audit) — "Retry" wrongly implied an error state on a
              healthy page; "Refresh" matches industry norm for pull-to-update. */}
          <RefreshCw className={activeIsFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {t("common.refresh", { defaultValue: "Refresh" })}
        </Button>
      </header>

      {/* Stat strip */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-gold" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("approval.list.stats.pending", { defaultValue: "Pending decisions" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {/* A5 (Aisha audit fix) — Lock the tile to pendingTotal (the
                pending query result count). Switching tabs no longer flips
                this from "3 pending" to "4 approved" — the label says
                Pending decisions so it always means pending. */}
            {pendingTotal}
          </p>
        </div>
        <div className={`rounded-lg border border-border bg-card p-4 ${slaBreaches > 0 ? "border-l-2 border-l-terracotta" : ""}`}>
          <div className="flex items-center gap-2">
            <Zap className={`h-4 w-4 ${slaBreaches > 0 ? "text-terracotta" : "text-ink-subtle"}`} />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("approval.list.stats.slaBreaches", { defaultValue: "SLA breaches (>24h)" })}
            </p>
          </div>
          <p className={`mt-1.5 font-mono text-2xl font-semibold ${slaBreaches > 0 ? "text-terracotta" : "text-ink"}`}>
            {slaBreaches}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-ink-subtle" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("approval.list.stats.avgWait", { defaultValue: "Avg waiting" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {avgWaitHours}h
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
            {t("approval.list.stats.totalValue", { defaultValue: "Pending value" })}
          </p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {totalValue >= 1_000_000
              ? `${(totalValue / 1_000_000).toFixed(1)}M`
              : totalValue >= 1_000
                ? `${Math.round(totalValue / 1_000)}k`
                : totalValue.toLocaleString()}{" "}
            <span className="font-mono text-xs text-ink-subtle">AED</span>
          </p>
        </div>
      </section>

      {/* R1 audit 6.2.1: 5-tab inbox parity with Lovable. */}
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-border">
        {(
          [
            { key: "all", label: t("approval.list.tabs.all", { defaultValue: "All" }) },
            {
              key: "pending",
              label: t("approval.list.tabs.pending", {
                defaultValue: "Pending my approval",
              }),
              /* A5 (Aisha audit fix) — badge stays at pending count even when
                 a non-pending tab is active so the user can always see "you
                 have N waiting" from any tab. */
              badge: pendingTotal,
            },
            {
              key: "approved",
              label: t("approval.list.tabs.approved", { defaultValue: "Approved by me" }),
            },
            {
              key: "rejected",
              label: t("approval.list.tabs.rejected", { defaultValue: "Rejected by me" }),
            },
            {
              key: "watching",
              label: t("approval.list.tabs.watching", { defaultValue: "Watching" }),
            },
          ] as Array<{ key: TabKey; label: string; badge?: number }>
        ).map((tab) => (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setPage(1);
              setSelectedStepIds(new Set());
            }}
            className={`inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              activeTab === tab.key
                ? "border-gold text-ink"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {tab.label}
            {typeof tab.badge === "number" && tab.badge > 0 && (
              <span className="rounded-full bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2">
            <label htmlFor="approvals-sort" className="text-xs text-ink-muted">
              {t("approval.list.sort")}
            </label>
            <select
              id="approvals-sort"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as ApprovalPendingSort);
                setPage(1);
              }}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {APPROVAL_PENDING_SORT_VALUES.map((s) => (
                <option key={s} value={s}>
                  {t(`approval.list.sortOption.${s}`, { defaultValue: s })}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {activeIsLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-md bg-surface"
                aria-hidden="true"
              />
            ))}
          </CardContent>
        </Card>
      ) : activeIsError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="h-5 w-5 text-destructive" aria-hidden />
            <p className="text-sm font-medium text-destructive">
              {translateApiError(activeError, t, "errors.approval.listFailed")}
            </p>
            <Button type="button" size="sm" onClick={() => void activeRefetch()}>
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
            <h2 className="text-base font-semibold text-ink">
              {t("approval.list.emptyTitle")}
            </h2>
            <p className="max-w-md text-sm text-ink-muted">
              {t("approval.list.emptyDescription")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table
                className="w-full text-sm"
                aria-busy={activeIsFetching ? "true" : "false"}
              >
                <thead className="border-b border-border bg-surface">
                  <tr className="text-left">
                    {/* R3 audit 6.3.1 — bulk-select header checkbox. */}
                    <th scope="col" className="w-8 px-2 py-3">
                      <input
                        type="checkbox"
                        aria-label={t("approval.list.col.selectAll", { defaultValue: "Select all" })}
                        checked={selectedStepIds.size === items.length && items.length > 0}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate =
                              selectedStepIds.size > 0 && selectedStepIds.size < items.length;
                          }
                        }}
                        onChange={toggleAllSelected}
                        className="h-3.5 w-3.5 cursor-pointer rounded border-border accent-gold"
                      />
                    </th>
                    {/* R2 audit — Lovable column set: Priority / Contract /
                        Type / Value / Stage / Submitted / Drafter / Actions */}
                    <th scope="col" className="px-2 py-3 font-medium text-ink-muted">
                      {t("approval.list.col.priority", { defaultValue: "Priority" })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("approval.list.col.contract")}
                    </th>
                    <th scope="col" className="px-2 py-3 font-medium text-ink-muted">
                      {t("approval.list.col.type", { defaultValue: "Type" })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("approval.list.col.value")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("approval.list.col.step")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("approval.list.col.pending")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("approval.list.col.requester")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      <span className="sr-only">{t("approval.list.col.actions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <ApprovalListRow
                      key={row.stepId}
                      row={row}
                      selected={selectedStepIds.has(row.stepId)}
                      onToggleSelect={() => toggleRowSelected(row.stepId)}
                      onAct={(it, action) => {
                        // R-LC4 — request_info short-circuits to the soft-
                        // action dialog (separate codepath from request_resubmission).
                        if (action === "request_info") {
                          setRequestInfoStepId(it.stepId);
                          return;
                        }
                        setActiveStep(it);
                        setPresetAction((action as ApprovalActionKind | undefined) ?? null);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-ink-muted">
            {t("approval.list.showingRange", {
              from: (pagination.page - 1) * pagination.limit + 1,
              to: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total,
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1 || activeIsFetching}
            >
              {t("common.back")}
            </Button>
            <span className="font-mono text-xs text-ink-muted">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={pagination.page >= pagination.totalPages || activeIsFetching}
            >
              {t("common.next")}
            </Button>
          </div>
        </div>
      )}

      {activeStep && (
        <ApprovalDecisionDialog
          stepId={activeStep.stepId}
          initialKind={presetAction ?? undefined}
          currentUserId={currentUserId}
          open={true}
          onClose={() => {
            setActiveStep(null);
            setPresetAction(null);
          }}
        />
      )}

      {/* R-LC4 LC-F7 — soft Request-info dialog (separate from the
          decision dialog used for approve/reject/request_resubmission). */}
      <RequestInfoDialog
        stepId={requestInfoStepId}
        open={requestInfoStepId != null}
        onClose={() => setRequestInfoStepId(null)}
      />

      {/* R3 audit 6.3.1 — floating bulk-action toolbar appears when ≥1 row
          selected. Only "Approve all selected" is offered (matches Lovable's
          single bulk action). Reject/Request-info remain row-level since
          they require a free-text reason that doesn't fit a bulk flow. */}
      {selectedStepIds.size > 0 && (
        <div
          role="region"
          aria-label={t("approval.bulk.toolbarLabel", { defaultValue: "Bulk actions" })}
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 shadow-lg"
        >
          <span className="text-sm text-ink-muted">
            {t("approval.bulk.selectedCount", {
              count: selectedStepIds.size,
              defaultValue:
                selectedStepIds.size === 1
                  ? "1 selected"
                  : `${selectedStepIds.size} selected`,
            })}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleBulkApprove()}
            disabled={bulkApproving}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {bulkApproving
              ? t("approval.bulk.approving", { defaultValue: "Approving…" })
              : t("approval.bulk.approveAll", { defaultValue: "Approve all selected" })}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setSelectedStepIds(new Set())}
            disabled={bulkApproving}
          >
            {t("common.clear", { defaultValue: "Clear" })}
          </Button>
        </div>
      )}
    </motion.div>
  );
}

// R-LC4 — extend the action kind union to include request_info (handled
// by a separate soft-action dialog, not ApprovalDecisionDialog).
type ListRowActionKind = ApprovalActionKind | "request_info";

interface ApprovalListRowProps {
  row: MyPendingApprovalListItem;
  selected: boolean;
  onToggleSelect: () => void;
  onAct: (item: MyPendingApprovalListItem, presetAction?: ListRowActionKind) => void;
}

/** R2 audit 6.4.1 — derive Priority hint from value + hours-pending. */
function priorityForRow(valueAed: number | null, hoursPending: number): "highValue" | "urgent" | null {
  if (valueAed !== null && valueAed >= 1_000_000) return "highValue";
  if (hoursPending > 24) return "urgent";
  return null;
}

// L85 — humanize contract_type slug for the Type column.
function humanizeContractType(slug: string): string {
  const map: Record<string, string> = {
    services: "Services",
    epc: "EPC",
    gas_spa: "Gas SPA",
    concession: "Concession",
    employment: "Employment",
    consultancy: "Consultancy",
    advisory: "Advisory",
    nda: "Non-disclosure",
    master_services: "Master Services",
    vendor_services: "Vendor Services",
    sow: "SOW",
    supply: "Supply",
  };
  if (map[slug]) return map[slug];
  return slug.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function ApprovalListRow({ row, selected, onToggleSelect, onAct }: ApprovalListRowProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const navigate = useNavigate();
  // R5 — past-decision rows from fn_approval_my_decisions don't carry
  // hoursPending; derive a "decided X ago" label from decidedAt instead.
  const isPast = typeof row.decision === "string";
  const hoursPending = row.hoursPending ?? 0;
  const hoursAgo = row.decidedAt
    ? Math.max(0, (Date.now() - new Date(row.decidedAt).getTime()) / (1000 * 60 * 60))
    : 0;
  const elapsedHours = isPast ? hoursAgo : hoursPending;
  const days = Math.floor(elapsedHours / 24);
  const pendingLabel =
    days >= 1
      ? t("approval.list.daysAgo", { count: days })
      : t("approval.list.hoursAgo", { count: Math.floor(elapsedHours) });
  const breach = !isPast && hoursPending > 24;
  const priority = isPast ? null : priorityForRow(row.valueAed, hoursPending);
  const requesterName = row.requesterUserRef
    ? `${row.requesterUserRef.firstName} ${row.requesterUserRef.lastName}`
    : t("approval.list.unknownRequester");
  const requesterInitials = row.requesterUserRef
    ? `${(row.requesterUserRef.firstName?.[0] ?? "").toUpperCase()}${(row.requesterUserRef.lastName?.[0] ?? "").toUpperCase()}`
    : "??";

  // R0 audit bug 6.6.1: row clickable to navigate to contract detail.
  // The Act button stops propagation so it doesn't double-fire.
  const goToContract = () =>
    void navigate({ to: "/app/contracts/$id", params: { id: String(row.contractId) } });

  // R2 audit 6.4.4 — current step descriptor for "Step X of Y: <role>".
  const totalSteps = row.totalSteps ?? row.chainSteps?.length ?? 1;
  const currentStepRole =
    row.chainSteps?.find((s) => s.order === row.stepOrder)?.role ?? null;

  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={goToContract}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToContract();
        }
      }}
      className={`cursor-pointer border-b border-border/60 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${selected ? "bg-gold/5" : "hover:bg-surface/50 focus-visible:bg-surface/50"}`}
    >
      {/* R3 audit 6.3.1 — bulk-select row checkbox (pending tab only). */}
      <td className="w-8 px-2 py-3" onClick={(e) => e.stopPropagation()}>
        {!isPast && (
          <input
            type="checkbox"
            aria-label={`Select ${row.contractNumber}`}
            checked={selected}
            onChange={onToggleSelect}
            className="h-3.5 w-3.5 cursor-pointer rounded border-border accent-gold"
          />
        )}
      </td>
      {/* Priority */}
      <td className="px-2 py-3">
        {priority === "highValue" ? (
          <span className="inline-flex items-center rounded-full bg-amber-tint/40 px-2 py-0.5 text-[10px] font-medium text-amber-ink">
            {t("approval.list.priority.highValue", { defaultValue: "High value" })}
          </span>
        ) : priority === "urgent" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 text-[10px] font-medium text-terracotta">
            <Zap className="h-2.5 w-2.5" />
            {t("approval.list.priority.urgent", { defaultValue: "Urgent" })}
          </span>
        ) : (
          <span className="text-[10px] text-ink-subtle">—</span>
        )}
      </td>
      {/* Contract — number + title + chain breadcrumb (R2 audit 6.4.3)
          L86 — render single title based on actor language (no EN+AR stacked). */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs text-ink-muted">{row.contractNumber}</span>
          <span
            className="text-sm font-medium text-ink"
            dir={isAr && row.contractTitleAr ? "rtl" : "ltr"}
          >
            {isAr && row.contractTitleAr ? row.contractTitleAr : row.contractTitleEn}
          </span>
          {row.chainSteps && row.chainSteps.length > 0 && (
            <ChainBreadcrumb steps={row.chainSteps} />
          )}
        </div>
      </td>
      {/* Type — contract type pill — L85 humanized (drop uppercase) */}
      <td className="px-2 py-3">
        {row.contractType ? (
          <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[10px] tracking-wider text-ink-muted">
            {t(`contractType.${row.contractType}`, {
              defaultValue: humanizeContractType(row.contractType),
            })}
          </span>
        ) : (
          "—"
        )}
      </td>
      {/* Value */}
      <td className="px-4 py-3 font-mono text-ink-muted">
        {row.valueAed === null
          ? "—"
          : t("approval.list.valueAed", { value: row.valueAed.toLocaleString() })}
      </td>
      {/* Stage — "Step X of Y: <role>" — R-LC0 format role slug via i18n */}
      <td className="px-4 py-3">
        {(() => {
          const roleLabel = currentStepRole
            ? t(`roles.${currentStepRole}`, { defaultValue: currentStepRole })
            : "";
          return (
            <span className="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-ink-muted">
              {t("approval.list.stageLabel", {
                order: row.stepOrder,
                total: totalSteps,
                role: roleLabel,
                defaultValue:
                  roleLabel && totalSteps > 1
                    ? `Step ${row.stepOrder} of ${totalSteps}: ${roleLabel}`
                    : `Step ${row.stepOrder} of ${totalSteps}`,
              })}
            </span>
          );
        })()}
        {!row.isRequired && (
          <span className="ms-1 inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-ink-muted">
            {t("approval.chain.optional")}
          </span>
        )}
      </td>
      {/* Pending */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
            breach
              ? "bg-terracotta/10 text-terracotta"
              : hoursPending > 8
                ? "bg-amber-tint/40 text-amber-ink"
                : "text-ink-muted"
          }`}
        >
          {breach && <Zap className="h-3 w-3" />}
          {pendingLabel}
        </span>
      </td>
      {/* Drafter — avatar + name (R2 audit 6.4.5) */}
      <td className="px-4 py-3 text-ink-muted">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold/20 font-mono text-[10px] font-medium text-gold-ink">
            {requesterInitials}
          </span>
          <span className="text-xs">{requesterName}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-end">
        {isPast ? (
          // R5 — show decision badge instead of action buttons for past rows.
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              row.decision === "approve"
                ? "bg-primary/10 text-primary"
                : row.decision === "reject"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-amber-tint/40 text-amber-ink"
            }`}
          >
            {row.decision === "approve" ? (
              <CheckCircle2 className="h-2.5 w-2.5" />
            ) : row.decision === "reject" ? (
              <XCircle className="h-2.5 w-2.5" />
            ) : (
              <MessageCircleQuestion className="h-2.5 w-2.5" />
            )}
            {t(`approval.list.decisionBadge.${row.decision}`, {
              defaultValue:
                row.decision === "approve"
                  ? "Approved"
                  : row.decision === "reject"
                    ? "Rejected"
                    : row.decision === "request_resubmission"
                      ? "Resubmission"
                      : "Skipped",
            })}
          </span>
        ) : (
          // R1 audit 6.4.6: 3 inline icon buttons.
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("approval.decide.approve", { defaultValue: "Approve" })}
              title={t("approval.decide.approve", { defaultValue: "Approve" })}
              onClick={(e) => {
                e.stopPropagation();
                onAct(row, "approve");
              }}
              className="text-primary hover:bg-primary/10"
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("approval.decide.reject", { defaultValue: "Reject" })}
              title={t("approval.decide.reject", { defaultValue: "Reject" })}
              onClick={(e) => {
                e.stopPropagation();
                onAct(row, "reject");
              }}
              className="text-destructive hover:bg-destructive/10"
            >
              <XCircle className="h-4 w-4" />
            </Button>
            {/* R-LC4 LC-F7 — separate Request info (soft) + Request resubmission (hard) buttons. */}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("approval.decide.requestInfo", { defaultValue: "Request info" })}
              title={t("approval.decide.requestInfo", { defaultValue: "Request info" })}
              onClick={(e) => {
                e.stopPropagation();
                onAct(row, "request_info");
              }}
              className="text-ink-muted hover:bg-surface"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("approval.decide.requestResubmission", { defaultValue: "Request resubmission" })}
              title={t("approval.decide.requestResubmission", { defaultValue: "Request resubmission" })}
              onClick={(e) => {
                e.stopPropagation();
                onAct(row, "request_resubmission");
              }}
              className="text-amber-ink hover:bg-amber-tint/40"
            >
              <MessageCircleQuestion className="h-4 w-4" />
            </Button>
            {/* A11 (Aisha audit fix 2026-06-01) — row Delegate icon mirrors
                the modal so the segmented modal control + row vocabulary
                stay aligned. Click opens the same shared decision dialog
                preset to the Delegate flow. */}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("approval.decide.delegate", { defaultValue: "Delegate" })}
              title={t("approval.decide.delegate", { defaultValue: "Delegate" })}
              onClick={(e) => {
                e.stopPropagation();
                onAct(row, "delegate");
              }}
              className="text-ink-muted hover:bg-surface"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

/**
 * R2 audit 6.4.3 — chain breadcrumb shown beneath the contract title.
 * Renders each step as a small avatar + role chip with a connecting arrow,
 * mirroring Lovable's "Legal Counsel → Contract Approver → Contract
 * Approver (Stage 2)" trail. Pending steps stay neutral; approved steps
 * tint primary; rejected/skipped tint terracotta/muted.
 */
function ChainBreadcrumb({ steps }: { steps: ApprovalChainStepRef[] }) {
  const { t } = useTranslation();
  // L87 — Disambiguate peer-step duplicates: when multiple steps share the
  // same `order` (parallel/peer approvers), label them "2a / 2b / 2c…" so the
  // breadcrumb doesn't read as "2 Legal Counsel → 2 Platform Admin" twice.
  const orderCounts = new Map<number, number>();
  const orderIndex = new Map<number, number>();
  for (const s of steps) {
    orderCounts.set(s.order, (orderCounts.get(s.order) ?? 0) + 1);
  }
  return (
    <ol className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-1 text-[10px] text-ink-subtle">
      {steps.map((step, idx) => {
        const tint =
          step.status === "approved"
            ? "border-primary/40 bg-primary/10 text-primary"
            : step.status === "rejected"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : step.status === "skipped"
                ? "border-border bg-card text-ink-subtle line-through"
                : "border-border bg-card text-ink-muted";
        const roleLabel = step.role
          ? t(`roles.${step.role}`, { defaultValue: step.role })
          : "—";
        const peerCount = orderCounts.get(step.order) ?? 1;
        let peerSuffix = "";
        if (peerCount > 1) {
          const seq = (orderIndex.get(step.order) ?? 0);
          orderIndex.set(step.order, seq + 1);
          peerSuffix = String.fromCharCode(97 + seq); // a, b, c…
        }
        return (
          <li key={`${step.order}-${idx}-${step.role ?? "u"}`} className="inline-flex items-center gap-1">
            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${tint}`}>
              <span className="font-mono">{step.order}{peerSuffix}</span>
              <span>{roleLabel}</span>
            </span>
            {idx < steps.length - 1 && <span aria-hidden>→</span>}
          </li>
        );
      })}
    </ol>
  );
}

export default ApprovalsListView;
