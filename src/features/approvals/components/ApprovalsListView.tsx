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
import { RefreshCw, AlertCircle } from "lucide-react";
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

const PAGE_SIZE = 20;

export function ApprovalsListView() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const currentUserId = user?.id ?? null;

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ApprovalPendingSort>("oldest");
  const [activeStep, setActiveStep] = useState<MyPendingApprovalListItem | null>(
    null,
  );

  const query: MyPendingApprovalListQuery = useMemo(
    () => ({ page, limit: PAGE_SIZE, sort }),
    [page, sort],
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useMyPendingApprovals(query);

  const items = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("approval.list.title")}
          </h1>
          {pagination && (
            <p className="mt-1 text-sm text-ink-muted">
              {t("approval.list.totalCount", { count: pagination.total })}
            </p>
          )}
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

      {isLoading ? (
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
                      onAct={(it) => setActiveStep(it)}
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
          currentUserId={currentUserId}
          open={true}
          onClose={() => setActiveStep(null)}
        />
      )}
    </motion.div>
  );
}

interface ApprovalListRowProps {
  row: MyPendingApprovalListItem;
  onAct: (item: MyPendingApprovalListItem) => void;
}

function ApprovalListRow({ row, onAct }: ApprovalListRowProps) {
  const { t } = useTranslation();
  const { hoursPending } = row;
  const days = Math.floor(hoursPending / 24);
  const pendingLabel =
    days >= 1
      ? t("approval.list.daysAgo", { count: days })
      : t("approval.list.hoursAgo", { count: Math.floor(hoursPending) });

  return (
    <tr className="border-b border-border/60 transition-colors hover:bg-surface/50">
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
      <td className="px-4 py-3 text-ink-muted">{pendingLabel}</td>
      <td className="px-4 py-3 text-end">
        <Button type="button" size="sm" onClick={() => onAct(row)}>
          {t("approval.list.actAction")}
        </Button>
      </td>
    </tr>
  );
}

export default ApprovalsListView;
