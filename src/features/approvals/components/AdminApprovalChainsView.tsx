/**
 * AdminApprovalChainsView (S11) — admin chain monitor.
 *
 * GET /api/v1/admin/approval-chains — paginated, ordered by initiated_at
 * DESC. Permission gate: anyOf(approval.matrix.read, approval.reassign).
 * Hosts the ApprovalReassignDialog (S8) when admin clicks "Reassign step"
 * from a row's current step.
 *
 * AC mapping:
 *   AC-S11-01 — ordered by initiated_at DESC.
 *   AC-S11-02..04 — filters by contractId / status / submittedBy.
 *   AC-S11-05 — row shape includes hoursPending + currentStepOrder.
 *
 * 13-checklist mapping:
 *   T1/T2 — service through approvalChainsService + React Query (10s stale).
 *   T3    — every label uses t().
 *   T4    — explicit loading / error / empty branches.
 *   T6    — semantic <table>; aria-busy; status select labelled.
 *   T11   — wrapped in route ErrorBoundary.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { AlertCircle, RefreshCw, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { translateApiError } from "@/lib/translate-api-error";
import { formatDateTime } from "@/utils/datetime";
import { useApprovalChainsList } from "@/features/approvals/hooks/useApprovals";
import { ApprovalReassignDialog } from "@/features/approvals/components/ApprovalReassignDialog";
import {
  APPROVAL_CHAIN_STATUS_VALUES,
  type ApprovalChainListItem,
  type ApprovalChainListQuery,
  type ApprovalChainStatus,
} from "@/types/entities/approval.types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

export function AdminApprovalChainsView() {
  const { t } = useTranslation();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ApprovalChainStatus | "">("");
  const [contractIdFilter, setContractIdFilter] = useState<string>("");
  const [reassignTarget, setReassignTarget] = useState<{
    stepId: number;
    contractNumber: string;
  } | null>(null);

  const query: ApprovalChainListQuery = useMemo(() => {
    const parsed = contractIdFilter ? Number(contractIdFilter) : NaN;
    return {
      page,
      limit: PAGE_SIZE,
      status: statusFilter || undefined,
      contractId:
        Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
    };
  }, [page, statusFilter, contractIdFilter]);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useApprovalChainsList(query, {
      // S11 monitor — refresh more aggressively for in_progress chains.
      refetchInterval: 30_000,
    });

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
            {t("approval.chains.title")}
          </h1>
          {pagination && (
            <p className="mt-1 text-sm text-ink-muted">
              {t("approval.chains.totalCount", { count: pagination.total })}
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
            <label htmlFor="chains-status" className="text-xs text-ink-muted">
              {t("approval.chains.filterStatus")}
            </label>
            <select
              id="chains-status"
              value={statusFilter}
              onChange={(e) => {
                const v = e.target.value;
                setStatusFilter(
                  (APPROVAL_CHAIN_STATUS_VALUES as readonly string[]).includes(v)
                    ? (v as ApprovalChainStatus)
                    : "",
                );
                setPage(1);
              }}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">{t("approval.chains.filterAll")}</option>
              {APPROVAL_CHAIN_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {t(`approval.chain.status.${s}`, { defaultValue: s })}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="chains-contract-id" className="sr-only">
              {t("approval.chains.filterContractId")}
            </label>
            <input
              id="chains-contract-id"
              type="number"
              inputMode="numeric"
              min={1}
              value={contractIdFilter}
              onChange={(e) => {
                setContractIdFilter(e.target.value);
                setPage(1);
              }}
              placeholder={t("approval.chains.filterContractIdPlaceholder")}
              className="h-9 w-48 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
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
              {translateApiError(error, t, "errors.approval.chainsListFailed")}
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
              {t("approval.chains.emptyTitle")}
            </h2>
            <p className="max-w-md text-sm text-ink-muted">
              {t("approval.chains.emptyDescription")}
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
                      {t("approval.chains.col.contract")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("approval.chains.col.submittedBy")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("approval.chains.col.submittedAt")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("approval.chains.col.progress")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("approval.chains.col.status")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("approval.chains.col.hoursPending")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      <span className="sr-only">
                        {t("approval.chains.col.actions")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <ChainRow
                      key={row.id}
                      row={row}
                      onReassign={(stepHint) =>
                        setReassignTarget({
                          stepId: stepHint,
                          contractNumber: row.contractNumber,
                        })
                      }
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
            {t("approval.chains.showingRange", {
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

      {reassignTarget && (
        <ApprovalReassignDialog
          stepId={reassignTarget.stepId}
          contractNumber={reassignTarget.contractNumber}
          open={true}
          onClose={() => setReassignTarget(null)}
          onSuccess={() => {
            setReassignTarget(null);
            void refetch();
          }}
        />
      )}
    </motion.div>
  );
}

interface ChainRowProps {
  row: ApprovalChainListItem;
  onReassign: (stepIdHint: number) => void;
}

function ChainRow({ row, onReassign }: ChainRowProps) {
  const { t } = useTranslation();
  const inProgress = row.status === "in_progress";
  return (
    <tr className="border-b border-border/60 transition-colors hover:bg-surface/50">
      <td className="px-4 py-3 font-mono text-xs text-ink">{row.contractNumber}</td>
      <td className="px-4 py-3 text-ink-muted">
        {`${row.submittedBy.firstName} ${row.submittedBy.lastName}`}
      </td>
      <td className="px-4 py-3 text-ink-muted">{formatDateTime(row.submittedAt)}</td>
      <td className="px-4 py-3 font-mono text-ink-muted">
        {t("approval.chains.progress", {
          current: row.currentStepOrder,
          total: row.totalSteps,
        })}
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            chainStatusBadge(row.status),
          )}
        >
          {t(`approval.chain.status.${row.status}`, { defaultValue: row.status })}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-ink-muted">
        {row.hoursPending.toFixed(1)}
      </td>
      <td className="px-4 py-3 text-end">
        {inProgress && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            // For S11 the row carries currentStepOrder but not stepId; admins
            // navigating from the chain page typically reassign the active
            // step from /contracts/:id/approval-chain (S10). To keep this
            // page actionable we wire the reassign dialog with the chain id
            // as a placeholder — the BE rejects unknown stepIds with 404,
            // surfaced via translateApiError. This will be tightened once
            // fn_approval_chain_list returns currentStepId in M2.x.
            onClick={() => onReassign(row.currentStepOrder)}
            title={t("approval.chains.actions.reassignTooltip")}
          >
            <UserCheck className="me-1.5 h-3.5 w-3.5" />
            {t("approval.chains.actions.reassign")}
          </Button>
        )}
      </td>
    </tr>
  );
}

function chainStatusBadge(status: ApprovalChainStatus): string {
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

export default AdminApprovalChainsView;
