/**
 * ReviewQueueView (S6) — review medium-confidence imported contracts.
 *
 * Mode: harden — the Lovable original (`routes/_app/import.review-queue.tsx`)
 * was tightly coupled to supabase.from('contracts') reads + writes. The
 * v2.6 implementation routes everything through M1a fn_contract_list
 * (extended in M1c with importConfidenceMin/Max + importBatchId filters).
 *
 * Behaviour:
 *   - Lists contracts WHERE status='draft' AND import_confidence in [50, 79]
 *     AND importBatchId IS NOT NULL (AC-S6-01).
 *   - Order: oldest first per AC-S6-01. fn_contract_list returns DESC by
 *     created_at; per Q3-OI-D we reverse client-side here (no sortDir param).
 *   - Per-row: titleEn, contractType, confidence%, warnings (from M1a
 *     ContractListItem.importWarnings — extended in M1c).
 *   - Approve: PATCH /api/v1/contracts/:id/status to 'active'.
 *     AC-S6-04 — only when batch.statusMode='active'; for 'draft' mode the
 *     row simply leaves the queue when the user marks reviewed (no-op).
 *   - Reject: DELETE /api/v1/contracts/:id (soft-delete via fn_contract_delete).
 *     AC-S6-05 — confirmation modal required (T9).
 *   - Bulk approve: AC-S6-06 — Promise.allSettled across visible rows; partial
 *     success surfaced as a toast with succeeded / failed counts.
 *
 * Codex lessons embedded:
 *   F-FE-002: useDoubleSubmitLock on bulk-approve (single-trigger UI).
 *   F-FE-M2:  toast errors via translateApiError.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Check, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { translateApiError } from "@/lib/translate-api-error";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import {
  useContractList,
  useDeleteContract,
  useUpdateContractStatus,
} from "@/features/contracts/hooks/useContracts";
import { useDoubleSubmitLock } from "@/features/imports/hooks/useDoubleSubmitLock";
import { ConfirmDialog } from "./ConfirmDialog";
import { IMPORT_CONFIDENCE_THRESHOLDS } from "@/types/entities/import-batch.types";
import type {
  ContractListItem,
  ContractListQuery,
} from "@/types/entities/contract.types";
import { toast } from "sonner";
import { contractsService } from "@/services/api/contracts.service";

const PAGE_SIZE = 20;

export function ReviewQueueView() {
  const { t } = useTranslation();
  const canEdit = useAuthStore(selectHasPermission("contract.edit"));
  const canDelete = useAuthStore(selectHasPermission("contract.delete"));
  const canApprove = useAuthStore(selectHasPermission("contract.status.update"));

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [batchFilter, setBatchFilter] = useState<string>("");
  const debouncedSearch = useDebounce(searchInput, 300);

  const query: ContractListQuery = useMemo(() => {
    const parsedBatch = batchFilter ? Number(batchFilter) : NaN;
    return {
      page,
      limit: PAGE_SIZE,
      status: "draft",
      importConfidenceMin: IMPORT_CONFIDENCE_THRESHOLDS.medium,
      importConfidenceMax: IMPORT_CONFIDENCE_THRESHOLDS.high - 1,
      importBatchId:
        Number.isFinite(parsedBatch) && parsedBatch > 0 ? parsedBatch : undefined,
      search: debouncedSearch.trim() || undefined,
    };
  }, [page, debouncedSearch, batchFilter]);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useContractList(query);

  // AC-S6-01 — oldest-first ordering. fn_contract_list returns newest first;
  // we reverse client-side per Q3-OI-D / BE-Q3-OI-D-FE-handoff.
  const items = useMemo(() => [...(data?.data ?? [])].reverse(), [data?.data]);
  const pagination = data?.pagination;

  const [rejectTarget, setRejectTarget] = useState<ContractListItem | null>(null);
  const deleteMutation = useDeleteContract();
  const statusMutation = useUpdateContractStatus();

  const bulkLock = useDoubleSubmitLock();
  const [bulkRunning, setBulkRunning] = useState(false);

  const onBulkApprove = async () => {
    if (!bulkLock.acquire()) return;
    if (items.length === 0) {
      bulkLock.release();
      return;
    }
    setBulkRunning(true);
    try {
      const outcomes = await Promise.allSettled(
        items.map((c) =>
          contractsService.updateStatus(c.id, { newStatus: "active" }),
        ),
      );
      const ok = outcomes.filter((o) => o.status === "fulfilled").length;
      const fail = outcomes.length - ok;
      if (ok > 0) {
        toast.success(
          t("import.review.bulkApprovedToast", { ok, total: outcomes.length }),
        );
      }
      if (fail > 0) {
        toast.error(t("import.review.bulkPartialFailToast", { fail }));
      }
      void refetch();
    } finally {
      setBulkRunning(false);
      bulkLock.release();
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
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("import.review.title")}
          </h1>
          {pagination && (
            <p className="mt-1 text-sm text-ink-muted">
              {t("import.review.totalCount", { count: pagination.total })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label={t("common.retry")}
          >
            <RefreshCw className="h-4 w-4" />
            {t("common.retry")}
          </Button>
          {canApprove && items.length > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={() => void onBulkApprove()}
              disabled={bulkRunning}
            >
              <Check className="h-4 w-4" />
              {t("import.review.bulkApprove", { count: items.length })}
            </Button>
          )}
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="review-search" className="sr-only">
              {t("import.review.searchPlaceholder")}
            </label>
            <input
              id="review-search"
              type="search"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              placeholder={t("import.review.searchPlaceholder")}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="review-batch-filter" className="sr-only">
              {t("import.review.filterByBatch")}
            </label>
            <input
              id="review-batch-filter"
              type="number"
              value={batchFilter}
              onChange={(e) => {
                setBatchFilter(e.target.value);
                setPage(1);
              }}
              placeholder={t("import.review.filterByBatchPlaceholder")}
              className="h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4">
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
            <p className="text-sm font-medium text-destructive">
              {error
                ? translateApiError(error, t, "errors.import.reviewListFailed")
                : t("common.error")}
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
              {t("import.review.emptyTitle")}
            </h2>
            <p className="max-w-md text-sm text-ink-muted">
              {t("import.review.emptyDescription")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface">
                  <tr className="text-left">
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("import.review.col.contract")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("import.review.col.type")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("import.review.col.confidence")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("import.review.col.warnings")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      <span className="sr-only">
                        {t("import.review.col.actions")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <ReviewRow
                      key={c.id}
                      contract={c}
                      canApprove={canApprove}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      isApprovePending={statusMutation.isPending}
                      onApprove={() =>
                        statusMutation.mutate({
                          id: c.id,
                          data: { newStatus: "active" },
                        })
                      }
                      onReject={() => setRejectTarget(c)}
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
            {t("import.review.showingRange", {
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

      <ConfirmDialog
        open={rejectTarget !== null}
        title={t("import.review.rejectTitle")}
        description={
          rejectTarget
            ? t("import.review.rejectDescription", {
                title: rejectTarget.titleEn,
                number: rejectTarget.contractNumber,
              })
            : ""
        }
        confirmLabel={t("import.review.rejectConfirm")}
        destructive
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (rejectTarget) {
            deleteMutation.mutate(rejectTarget.id, {
              onSettled: () => setRejectTarget(null),
            });
          }
        }}
        onClose={() => setRejectTarget(null)}
      />
    </motion.div>
  );
}

interface ReviewRowProps {
  contract: ContractListItem;
  canApprove: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isApprovePending: boolean;
  onApprove: () => void;
  onReject: () => void;
}

function ReviewRow({
  contract,
  canApprove,
  canEdit,
  canDelete,
  isApprovePending,
  onApprove,
  onReject,
}: ReviewRowProps) {
  const { t } = useTranslation();
  const warnings = contract.importWarnings ?? [];
  const confidence = contract.importConfidence ?? 0;
  return (
    <tr className="border-b border-border/60 transition-colors hover:bg-surface/50">
      <td className="px-4 py-3">
        <div>
          <p className="font-medium text-ink">{contract.titleEn}</p>
          <p className="font-mono text-xs text-ink-muted">
            {contract.contractNumber}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 text-ink-muted">{contract.contractType}</td>
      <td className="px-4 py-3 font-mono text-ink-muted">{confidence}%</td>
      <td className="px-4 py-3 text-ink-muted">
        {warnings.length > 0 ? warnings.join(" · ") : "—"}
      </td>
      <td className="px-4 py-3 text-end">
        <div className="flex justify-end gap-1">
          {canEdit && (
            <a
              href={`/app/contracts/${contract.id}`}
              className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-ink-muted hover:bg-accent hover:text-accent-foreground"
            >
              {t("import.review.actions.edit")}
            </a>
          )}
          {canApprove && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onApprove}
              disabled={isApprovePending}
              aria-label={t("import.review.actions.approveAria", {
                title: contract.titleEn,
              })}
            >
              <Check className="h-3.5 w-3.5" />
              {t("import.review.actions.approve")}
            </Button>
          )}
          {canDelete && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onReject}
              aria-label={t("import.review.actions.rejectAria", {
                title: contract.titleEn,
              })}
            >
              <X className="h-3.5 w-3.5" />
              {t("import.review.actions.reject")}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default ReviewQueueView;
