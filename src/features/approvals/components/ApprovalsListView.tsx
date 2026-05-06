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
import { RefreshCw, AlertCircle, Zap, Clock, CheckCircle2, XCircle, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { translateApiError } from "@/lib/translate-api-error";
import { useMyPendingApprovals } from "@/features/approvals/hooks/useApprovals";
import { ApprovalDecisionDialog } from "@/features/approvals/components/ApprovalDecisionDialog";
import { useAuthStore } from "@/store/auth.store";
import {
  APPROVAL_PENDING_SORT_VALUES,
  type ApprovalPendingSort,
  type MyPendingApprovalListItem,
  type MyPendingApprovalListQuery,
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
  // R1 audit 6.2.1: 5-tab inbox matches Lovable. "Pending mine" is the
  // default + only tab with real data in R1; the other 4 surface a
  // "coming soon" placeholder until the BE endpoints land in R3.
  const [activeTab, setActiveTab] = useState<TabKey>("pending");

  const query: MyPendingApprovalListQuery = useMemo(
    () => ({ page, limit: PAGE_SIZE, sort }),
    [page, sort],
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useMyPendingApprovals(query);

  const items = data?.data ?? [];
  const pagination = data?.pagination;

  const slaBreaches = useMemo(
    () => items.filter((i) => i.hoursPending > 24).length,
    [items],
  );
  const avgWaitHours = useMemo(() => {
    if (items.length === 0) return 0;
    return Math.round(
      items.reduce((s, i) => s + i.hoursPending, 0) / items.length,
    );
  }, [items]);
  const totalValue = useMemo(
    () =>
      items.reduce((s, i) => s + (i.valueAed ?? 0), 0),
    [items],
  );

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
            {t("approval.list.eyebrow", {
              count: pagination?.total ?? items.length,
              urgent: slaBreaches,
              defaultValue: "{{count}} pending · {{urgent}} urgent",
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
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label={t("common.retry")}
        >
          <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {t("common.retry")}
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
            {pagination?.total ?? items.length}
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
              badge: pagination?.total ?? items.length,
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
            onClick={() => setActiveTab(tab.key)}
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

      {activeTab !== "pending" ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
            <h2 className="text-base font-semibold text-ink">
              {t("approval.list.tabComingSoonTitle", {
                defaultValue: "Coming soon",
              })}
            </h2>
            <p className="max-w-md text-sm text-ink-muted">
              {t("approval.list.tabComingSoonBody", {
                defaultValue:
                  "This view will land alongside the upcoming approver decision history endpoint.",
              })}
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
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
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="h-5 w-5 text-destructive" aria-hidden />
            <p className="text-sm font-medium text-destructive">
              {translateApiError(error, t, "errors.approval.listFailed")}
            </p>
            <Button type="button" size="sm" onClick={() => void refetch()}>
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
                aria-busy={isFetching ? "true" : "false"}
              >
                <thead className="border-b border-border bg-surface">
                  <tr className="text-left">
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("approval.list.col.contract")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("approval.list.col.requester")}
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
                      <span className="sr-only">{t("approval.list.col.actions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <ApprovalListRow
                      key={row.stepId}
                      row={row}
                      onAct={(it, action) => {
                        setActiveStep(it);
                        setPresetAction(action ?? null);
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
              disabled={pagination.page <= 1 || isFetching}
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
              disabled={pagination.page >= pagination.totalPages || isFetching}
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
    </motion.div>
  );
}

interface ApprovalListRowProps {
  row: MyPendingApprovalListItem;
  onAct: (item: MyPendingApprovalListItem, presetAction?: ApprovalActionKind) => void;
}

function ApprovalListRow({ row, onAct }: ApprovalListRowProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hoursPending } = row;
  const days = Math.floor(hoursPending / 24);
  const pendingLabel =
    days >= 1
      ? t("approval.list.daysAgo", { count: days })
      : t("approval.list.hoursAgo", { count: Math.floor(hoursPending) });
  const breach = hoursPending > 24;

  // R0 audit bug 6.6.1: row clickable to navigate to contract detail.
  // The Act button stops propagation so it doesn't double-fire.
  const goToContract = () =>
    void navigate({ to: "/app/contracts/$id", params: { id: String(row.contractId) } });

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
      className="cursor-pointer border-b border-border/60 transition-colors hover:bg-surface/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-surface/50"
    >
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs text-ink-muted">
            {row.contractNumber}
          </span>
          <span className="text-sm font-medium text-ink">{row.contractTitleEn}</span>
          {row.contractTitleAr && (
            <span dir="rtl" className="text-xs text-ink-muted">
              {row.contractTitleAr}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-ink-muted">
        {row.requesterUserRef
          ? `${row.requesterUserRef.firstName} ${row.requesterUserRef.lastName}`
          : t("approval.list.unknownRequester")}
      </td>
      <td className="px-4 py-3 font-mono text-ink-muted">
        {row.valueAed === null
          ? "—"
          : t("approval.list.valueAed", { value: row.valueAed.toLocaleString() })}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-ink-muted">
          {t("approval.list.stepLabel", {
            order: row.stepOrder,
            ...(row.parallelGroup !== null
              ? { parallel: row.parallelGroup }
              : {}),
          })}
        </span>
        {!row.isRequired && (
          <span className="ms-1 inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-ink-muted">
            {t("approval.chain.optional")}
          </span>
        )}
      </td>
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
      <td className="px-4 py-3 text-end">
        {/* R1 audit 6.4.6: 3 inline icon buttons (Approve / Reject / Request
            info) match Lovable's 1-click decision UX. Each presets the
            ApprovalDecisionDialog action so the user lands on the right
            screen with no extra step. */}
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
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t("approval.decide.requestResubmission", { defaultValue: "Request info" })}
            title={t("approval.decide.requestResubmission", { defaultValue: "Request info" })}
            onClick={(e) => {
              e.stopPropagation();
              onAct(row, "request_resubmission");
            }}
            className="text-amber-ink hover:bg-amber-tint/40"
          >
            <MessageCircleQuestion className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default ApprovalsListView;
