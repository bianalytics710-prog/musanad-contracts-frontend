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
import { useMemo, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  RefreshCw,
  AlertCircle,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  MessageCircleQuestion,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/patterns";
import { useAuthStore } from "@/store/auth.store";
import { useDebounce } from "@/hooks/useDebounce";
import { translateApiError } from "@/lib/translate-api-error";
import { useMyPendingApprovals, useDecideApproval } from "@/features/approvals/hooks/useApprovals";
import { useQuery } from "@tanstack/react-query";
import { approvalService } from "@/services/api/approval.service";
import type { ApiError } from "@/lib/api-client";
import {
  APPROVAL_PENDING_SORT_VALUES,
  type ApprovalPendingSort,
  type MyPendingApprovalListItem,
  type MyPendingApprovalListQuery,
  type MyPendingApprovalListResponse,
} from "@/types/entities/approval.types";

const PAGE_SIZE = 20;

type TabKey = "all" | "pending" | "approved" | "rejected" | "watching";

export function ApprovalsListView() {
  const { t } = useTranslation();

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ApprovalPendingSort>("oldest");
  // Design-system parity with Contracts list: search input + priority + type
  // filters in the same toolbar shape. Client-side filtering against `items`
  // is acceptable since fn_approval_my_pending caps the page size; if the
  // approver scope grows we can push these to the BE alongside `sort`.
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [priorityFilter, setPriorityFilter] = useState<"" | "highValue" | "urgent" | "none">("");
  const [typeFilter, setTypeFilter] = useState<string>("");
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

  const rawItems = activeData?.data ?? [];
  const pagination = activeData?.pagination;

  // Client-side filter pass — search hits contract number / title / requester
  // name; priority + type filters use the same derivation as the row badge.
  const items = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return rawItems.filter((row) => {
      if (q) {
        const requester = row.requesterUserRef
          ? `${row.requesterUserRef.firstName ?? ""} ${row.requesterUserRef.lastName ?? ""}`.toLowerCase()
          : "";
        const hay = `${row.contractNumber} ${row.contractTitleEn ?? ""} ${row.contractTitleAr ?? ""} ${requester}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (priorityFilter) {
        const p = priorityForRow(row.valueAed, row.hoursPending ?? 0);
        const want = priorityFilter === "none" ? null : priorityFilter;
        if (p !== want) return false;
      }
      if (typeFilter && row.contractType !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [rawItems, debouncedSearch, priorityFilter, typeFilter]);

  const typeOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ value: string; label: string }> = [];
    for (const row of rawItems) {
      if (!row.contractType || seen.has(row.contractType)) continue;
      seen.add(row.contractType);
      out.push({ value: row.contractType, label: humanizeContractType(row.contractType) });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [rawItems]);

  const hasFilters =
    !!debouncedSearch.trim() ||
    !!priorityFilter ||
    !!typeFilter ||
    sort !== "oldest";

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setPage(1);
  };
  const handleClearFilters = () => {
    setSearchInput("");
    setPriorityFilter("");
    setTypeFilter("");
    setSort("oldest");
    setPage(1);
  };

  // 2026-06-15 — Legal Counsel doesn't want the approver-centric KPI strip
  // (pending value / SLA breaches etc.) on her Approvals view. Hide it for
  // legal_counsel only; other approver roles keep it.
  const isLegalCounsel =
    useAuthStore((s) => s.user?.role?.name ?? null) === "legal_counsel";

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
  // Avg waiting time — expressed in days. Approvals routinely sit for days at
  // a time, so "hours" overstates urgency and bloats the number. We compute the
  // average hours then divide; show 1 decimal so a 16h wait reads as "0.7d"
  // rather than rounding to "0d".
  const avgWaitDays = useMemo(() => {
    if (pendingItems.length === 0) return 0;
    const avgHours =
      pendingItems.reduce((s, i) => s + i.hoursPending, 0) / pendingItems.length;
    return Math.round((avgHours / 24) * 10) / 10;
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
          <div className="mb-2 font-mono text-xs uppercase tracking-wider text-ink-subtle">
            {t("approval.list.kicker", { defaultValue: "Approval queue" })}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("approval.list.title")}
          </h1>
          <p className="mt-1 text-xs text-ink-subtle">
            {/* A6/A5 — "urgent" overloaded "Urgent priority" badge + "SLA breach";
                rename to SLA-breach count. Always shows pending-tab counts so
                the eyebrow matches the KPI strip. */}
            {t("approval.list.eyebrow", {
              count: pendingTotal,
              urgent: slaBreaches,
              defaultValue: "{{count}} pending · {{urgent}} SLA breaches",
            })}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void activeRefetch()}
          disabled={activeIsFetching}
          aria-label={t("common.refresh", { defaultValue: "Refresh" })}
        >
          <RefreshCw className={activeIsFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {t("common.refresh", { defaultValue: "Refresh" })}
        </Button>
      </header>

      {/* KPI strip — StatCard pattern matches Contracts list (design system).
          Hidden for legal_counsel (2026-06-15) — approver-centric metrics. */}
      {!isLegalCounsel && (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t("approval.list.stats.pending", { defaultValue: "Pending decisions" })}
          value={pendingTotal.toLocaleString()}
        />
        <StatCard
          label={t("approval.list.stats.slaBreaches", { defaultValue: "SLA breaches (>24h)" })}
          value={slaBreaches.toLocaleString()}
          variant={slaBreaches > 0 ? "risk" : "default"}
        />
        <StatCard
          label={t("approval.list.stats.avgWait", { defaultValue: "Avg waiting" })}
          value={`${avgWaitDays}d`}
          variant={avgWaitDays > 1 ? "warning" : "default"}
        />
        <StatCard
          label={t("approval.list.stats.totalValue", { defaultValue: "Pending value" })}
          value={
            <>
              {totalValue >= 1_000_000
                ? `${(totalValue / 1_000_000).toFixed(1)}M`
                : totalValue >= 1_000
                  ? `${Math.round(totalValue / 1_000)}k`
                  : totalValue.toLocaleString()}{" "}
              <span className="font-mono text-xs text-ink-subtle">AED</span>
            </>
          }
        />
      </div>
      )}

      {/* Tabs — pill-style for design-system parity with the rest of the app. */}
      <div role="tablist" className="flex flex-wrap gap-1.5">
        {(
          [
            { key: "all", label: t("approval.list.tabs.all", { defaultValue: "All" }) },
            {
              key: "pending",
              label: t("approval.list.tabs.pending", {
                defaultValue: "Pending my approval",
              }),
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
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              activeTab === tab.key
                ? "bg-gold text-ink"
                : "border border-border bg-surface text-ink-muted hover:border-gold"
            }`}
          >
            {tab.label}
            {typeof tab.badge === "number" && tab.badge > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                activeTab === tab.key ? "bg-ink/10 text-ink" : "bg-card text-ink-muted"
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filter toolbar — search + priority + type + sort, mirrors the
          Contracts list pattern. Search runs client-side over the current
          tab's data; priority/type derive from the row badge logic. */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <label htmlFor="approvals-search" className="sr-only">
              {t("approval.list.searchPlaceholder", {
                defaultValue: "Search contract, requester…",
              })}
            </label>
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <Input
              id="approvals-search"
              type="search"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={t("approval.list.searchPlaceholder", {
                defaultValue: "Search contract, requester…",
              })}
              className="ps-9"
              autoComplete="off"
            />
          </div>
          {hasFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={handleClearFilters}>
              <X className="h-3.5 w-3.5" />
              {t("approval.list.clearFilters", { defaultValue: "Clear" })}
            </Button>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="approvals-priority"
              className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
            >
              {t("approval.list.filters.priority", { defaultValue: "Priority" })}
            </label>
            <select
              id="approvals-priority"
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value as typeof priorityFilter);
                setPage(1);
              }}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-ink shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">{t("common.all", { defaultValue: "All" })}</option>
              <option value="urgent">
                {t("approval.list.priority.urgent", { defaultValue: "Urgent" })}
              </option>
              <option value="highValue">
                {t("approval.list.priority.highValue", { defaultValue: "High value" })}
              </option>
              <option value="none">
                {t("approval.list.priority.standard", { defaultValue: "Standard" })}
              </option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="approvals-type"
              className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
            >
              {t("approval.list.filters.type", { defaultValue: "Contract type" })}
            </label>
            <select
              id="approvals-type"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-ink shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">{t("common.all", { defaultValue: "All" })}</option>
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(`contractType.${o.value}`, { defaultValue: o.label })}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="approvals-sort"
              className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
            >
              {t("approval.list.sort", { defaultValue: "Sort by" })}
            </label>
            <select
              id="approvals-sort"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as ApprovalPendingSort);
                setPage(1);
              }}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-ink shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {APPROVAL_PENDING_SORT_VALUES.map((s) => (
                <option key={s} value={s}>
                  {t(`approval.list.sortOption.${s}`, { defaultValue: s })}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

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
              {hasFilters
                ? t("approval.list.noResultsTitle", {
                    defaultValue: "No approvals match these filters",
                  })
                : t("approval.list.emptyTitle")}
            </h2>
            <p className="max-w-md text-sm text-ink-muted">
              {hasFilters
                ? t("approval.list.noResultsDescription", {
                    defaultValue:
                      "Try clearing the search or filters to see more.",
                  })
                : t("approval.list.emptyDescription")}
            </p>
            {hasFilters && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={handleClearFilters}
              >
                <X className="h-3.5 w-3.5" />
                {t("approval.list.clearFilters", { defaultValue: "Clear filters" })}
              </Button>
            )}
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
                    {/* Slimmed column set: Contract / Type / Value / Stage /
                        Waiting / Drafter / Actions. Priority moved inline into
                        the Contract cell as a small badge. <th> style follows
                        the Contracts list canonical pattern: mono / 10px /
                        uppercase / tracking-wider / text-ink-subtle. */}
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("approval.list.col.contract")}
                    </th>
                    <th scope="col" className="px-2 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("approval.list.col.type", { defaultValue: "Type" })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("approval.list.col.value")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("approval.list.col.stage", { defaultValue: "Stage" })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("approval.list.col.waiting", { defaultValue: "Waiting" })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("approval.list.col.requester")}
                    </th>
                    <th scope="col" className="px-4 py-3 text-end font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
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

      {/* Row-level decision dialogs removed — View now navigates to the
          contract detail page where approve/reject/request-info/delegate
          live in context. Bulk-approve still uses the inline mutation. */}

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

interface ApprovalListRowProps {
  row: MyPendingApprovalListItem;
  selected: boolean;
  onToggleSelect: () => void;
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

function ApprovalListRow({ row, selected, onToggleSelect }: ApprovalListRowProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
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

  // Stage label data — the contract number + title remain Link elements so
  // users can still jump to the contract; the primary action stays on the
  // explicit View button to keep affordances unambiguous.
  const totalSteps = row.totalSteps ?? row.chainSteps?.length ?? 1;
  // Workflow-style stage name (not role name). The user's review made clear
  // that role labels like "Platform Admin" read as people, not stages, in
  // this column. Map position-in-chain → workflow vocabulary instead.
  const stageLabel = (() => {
    if (totalSteps === 1) {
      return t("approval.list.stage.review", { defaultValue: "Review" });
    }
    if (row.stepOrder === 1) {
      return t("approval.list.stage.initial", { defaultValue: "Initial review" });
    }
    if (row.stepOrder === totalSteps) {
      return t("approval.list.stage.final", { defaultValue: "Final approval" });
    }
    return t("approval.list.stage.intermediate", {
      order: row.stepOrder,
      defaultValue: `Review · stage ${row.stepOrder}`,
    });
  })();

  return (
    <tr
      className={`group border-b border-border/60 transition-colors ${selected ? "bg-gold/5" : "hover:bg-surface/50"}`}
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
      {/* Contract — number + title; priority badge inlines next to number.
          Chain breadcrumb removed — the Stage column now carries the
          workflow position formally. L86 — single title in actor language. */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Link
              to="/app/contracts/$id"
              params={{ id: String(row.contractId) }}
              className="font-mono text-xs text-ink-muted hover:text-gold hover:underline"
              aria-label={`Open contract ${row.contractNumber}`}
            >
              {row.contractNumber}
            </Link>
            {!isPast && priority === "urgent" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-1.5 py-0 font-mono text-[9px] uppercase tracking-wider text-terracotta">
                <Zap className="h-2.5 w-2.5" />
                {t("approval.list.priority.urgent", { defaultValue: "Urgent" })}
              </span>
            )}
            {!isPast && priority === "highValue" && (
              <span className="inline-flex items-center rounded-full bg-amber-tint/40 px-1.5 py-0 font-mono text-[9px] uppercase tracking-wider text-amber-ink">
                {t("approval.list.priority.highValue", { defaultValue: "High value" })}
              </span>
            )}
          </div>
          <Link
            to="/app/contracts/$id"
            params={{ id: String(row.contractId) }}
            className="text-sm font-medium text-ink hover:text-gold"
            dir={isAr && row.contractTitleAr ? "rtl" : "ltr"}
          >
            {isAr && row.contractTitleAr ? row.contractTitleAr : row.contractTitleEn}
          </Link>
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
      {/* Stage — formal workflow label (Initial review / Review / Final
          approval) plus position dots beneath so users see where they are
          without reading numbers. */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-ink">
            {stageLabel}
          </span>
          {totalSteps > 1 && (
            <span
              className="inline-flex items-center gap-0.5"
              aria-label={t("approval.list.stage.positionAria", {
                order: row.stepOrder,
                total: totalSteps,
                defaultValue: `Stage ${row.stepOrder} of ${totalSteps}`,
              })}
              title={t("approval.list.stage.positionAria", {
                order: row.stepOrder,
                total: totalSteps,
                defaultValue: `Stage ${row.stepOrder} of ${totalSteps}`,
              })}
            >
              {Array.from({ length: totalSteps }).map((_, i) => (
                <span
                  key={i}
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    i + 1 < row.stepOrder
                      ? "bg-primary"
                      : i + 1 === row.stepOrder
                        ? "bg-gold"
                        : "bg-border"
                  }`}
                  aria-hidden
                />
              ))}
            </span>
          )}
          {!row.isRequired && (
            <span className="inline-flex w-fit items-center rounded-full border border-border bg-background px-1.5 py-0 text-[9px] font-medium text-ink-muted">
              {t("approval.chain.optional")}
            </span>
          )}
        </div>
      </td>
      {/* Waiting */}
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
      <td className="px-4 py-3 text-end" onClick={(e) => e.stopPropagation()}>
        {isPast ? (
          // Past decisions — show the decision badge, no actions.
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
          // Single primary action — "View" navigates to the contract page.
          // Approve / Reject / Request info / Delegate live on the contract
          // detail surface (Approvals tab), giving the user full context
          // before deciding instead of acting from a list-row popup.
          <Link
            to="/app/contracts/$id"
            params={{ id: String(row.contractId) }}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-3 text-xs font-medium text-ink hover:bg-surface"
          >
            {t("approval.list.actions.view", { defaultValue: "View" })}
          </Link>
        )}
      </td>
    </tr>
  );
}

export default ApprovalsListView;
