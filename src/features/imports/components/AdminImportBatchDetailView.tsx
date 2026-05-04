/**
 * AdminImportBatchDetailView (S4) — drill-down for a single import batch.
 *
 * Mode: regenerate — there is NO Lovable counterpart for this view (the
 * Lovable admin.imports.tsx surfaces only the list). This view is built
 * fresh against the v2.6 standards.
 *
 * AC mapping:
 *   AC-S4-01: GET /api/v1/import-batches/:id → full ImportBatch shape with
 *             initiatedBy hydrated as UserRef.
 *   AC-S4-02: 404 surfaces as "Import batch not found" empty state.
 *   AC-S4-03: 403 also surfaces as 404 (Design Note D7) — same empty UI.
 *   AC-S4-04: initiatedBy displayed as "First Last" via UserRef.
 *   AC-S4-05: per-batch contracts listed via M1a fn_contract_list filtered
 *             by importBatchId — uses the now-extended ContractListQuery.
 *
 * Reopen / cancel actions for the batch (AC-S2-08 / AC-S2-02 transitions)
 * are gated by ConfirmDialog (T9 destructive confirmation).
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { translateApiError } from "@/lib/translate-api-error";
import { formatDateTime } from "@/utils/datetime";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import {
  useImportBatch,
  useUpdateImportBatch,
} from "@/features/imports/hooks/useImportBatches";
import { useContractList } from "@/features/contracts/hooks/useContracts";
import { ConfirmDialog } from "./ConfirmDialog";
import type {
  ContractListQuery,
} from "@/types/entities/contract.types";
import type {
  ImportBatchStatus,
} from "@/types/entities/import-batch.types";

interface AdminImportBatchDetailViewProps {
  batchId: number;
}

const CONTRACTS_PAGE_SIZE = 20;

export function AdminImportBatchDetailView({
  batchId,
}: AdminImportBatchDetailViewProps) {
  const { t } = useTranslation();
  const canRun = useAuthStore(selectHasPermission("import.run"));

  const {
    data: batch,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useImportBatch(batchId);

  const updateMutation = useUpdateImportBatch();

  // Drill-down contracts list — AC-S4-05 via M1a fn_contract_list extended.
  const [page, setPage] = useState(1);
  const contractsQuery: ContractListQuery = useMemo(
    () => ({
      page,
      limit: CONTRACTS_PAGE_SIZE,
      importBatchId: batchId,
    }),
    [page, batchId],
  );
  const {
    data: contractsData,
    isLoading: contractsLoading,
    isError: contractsError,
    error: contractsErr,
    refetch: refetchContracts,
  } = useContractList(contractsQuery);

  const [pendingTransition, setPendingTransition] = useState<
    ImportBatchStatus | null
  >(null);

  const onConfirmTransition = () => {
    if (pendingTransition === null) return;
    updateMutation.mutate(
      { id: batchId, data: { status: pendingTransition } },
      {
        onSettled: () => setPendingTransition(null),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1280px] space-y-3 p-6">
        <div className="h-8 w-1/3 animate-pulse rounded-md bg-surface" />
        <div className="h-32 w-full animate-pulse rounded-md bg-surface" />
        <div className="h-64 w-full animate-pulse rounded-md bg-surface" />
      </div>
    );
  }

  if (isError || !batch) {
    return (
      <div className="mx-auto w-full max-w-2xl p-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <p className="text-sm font-medium text-destructive">
              {error
                ? translateApiError(error, t, "errors.import.batchNotFound")
                : t("errors.import.batchNotFound")}
            </p>
            <Link
              to="/app/admin/imports"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-ink hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("admin.imports.backToList")}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canPause = batch.status === "in_progress";
  const canResume = batch.status === "paused";
  const canCancel = batch.status === "in_progress" || batch.status === "paused";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to="/app/admin/imports"
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("admin.imports.backToList")}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {t("admin.imports.batchTitle", { id: batch.id })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("admin.imports.initiatedByLabel")}: {batch.initiatedBy.firstName}{" "}
            {batch.initiatedBy.lastName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          {canRun && canPause && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPendingTransition("paused")}
            >
              {t("admin.imports.actions.pause")}
            </Button>
          )}
          {canRun && canResume && (
            <Button
              type="button"
              size="sm"
              onClick={() => setPendingTransition("in_progress")}
            >
              {t("admin.imports.actions.resume")}
            </Button>
          )}
          {canRun && canCancel && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => setPendingTransition("cancelled")}
            >
              {t("admin.imports.actions.cancel")}
            </Button>
          )}
        </div>
      </header>

      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-2">
          <DetailRow
            label={t("admin.imports.detail.status")}
            value={t(`admin.imports.status.${batch.status}`, {
              defaultValue: batch.status,
            })}
          />
          <DetailRow
            label={t("admin.imports.detail.totalFiles")}
            value={String(batch.totalFiles)}
          />
          <DetailRow
            label={t("admin.imports.detail.startedAt")}
            value={formatDateTime(batch.startedAt)}
          />
          <DetailRow
            label={t("admin.imports.detail.completedAt")}
            value={
              batch.completedAt !== null ? formatDateTime(batch.completedAt) : "—"
            }
          />
          <DetailRow
            label={t("admin.imports.detail.statusMode")}
            value={batch.config.statusMode}
          />
          <DetailRow
            label={t("admin.imports.detail.contractType")}
            value={batch.config.contractType ?? "—"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            {t("admin.imports.detail.countersTitle")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Counter
              label={t("admin.imports.detail.autoSaved")}
              value={batch.autoSaved}
            />
            <Counter
              label={t("admin.imports.detail.reviewQueue")}
              value={batch.reviewQueue}
            />
            <Counter
              label={t("admin.imports.detail.manualEntry")}
              value={batch.manualEntry}
            />
            <Counter
              label={t("admin.imports.detail.duplicatesSkipped")}
              value={batch.duplicatesSkipped}
            />
            <Counter
              label={t("admin.imports.detail.errored")}
              value={batch.errored}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-semibold text-ink">
              {t("admin.imports.detail.contractsTitle")}
            </h2>
            {contractsData?.pagination && (
              <p className="mt-1 text-xs text-ink-muted">
                {t("admin.imports.detail.contractsCount", {
                  count: contractsData.pagination.total,
                })}
              </p>
            )}
          </div>
          {contractsLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-md bg-surface"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : contractsError ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-sm font-medium text-destructive">
                {contractsErr
                  ? translateApiError(
                      contractsErr,
                      t,
                      "errors.import.contractsFailed",
                    )
                  : t("common.error")}
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => void refetchContracts()}
              >
                {t("common.retry")}
              </Button>
            </div>
          ) : (contractsData?.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-ink-muted">
              {t("admin.imports.detail.contractsEmpty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface">
                  <tr className="text-left">
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("admin.imports.detail.col.contract")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("admin.imports.detail.col.status")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("admin.imports.detail.col.confidence")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      <span className="sr-only">
                        {t("admin.imports.detail.col.actions")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(contractsData?.data ?? []).map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border/60 transition-colors hover:bg-surface/50"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-ink">{c.titleEn}</p>
                          <p className="font-mono text-xs text-ink-muted">
                            {c.contractNumber}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{c.status}</td>
                      <td className="px-4 py-3 font-mono text-ink-muted">
                        {c.importConfidence !== null
                          ? `${c.importConfidence}%`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Link
                          to="/app/contracts/$id"
                          params={{ id: String(c.id) }}
                          className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-ink-muted hover:bg-accent hover:text-accent-foreground"
                        >
                          {t("common.view")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {contractsData?.pagination &&
                contractsData.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between gap-2 p-4">
                    <p className="text-xs text-ink-muted">
                      {t("admin.imports.detail.showingRange", {
                        from:
                          (contractsData.pagination.page - 1) *
                            contractsData.pagination.limit +
                          1,
                        to: Math.min(
                          contractsData.pagination.page *
                            contractsData.pagination.limit,
                          contractsData.pagination.total,
                        ),
                        total: contractsData.pagination.total,
                      })}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={contractsData.pagination.page <= 1}
                      >
                        {t("common.back")}
                      </Button>
                      <span className="font-mono text-xs text-ink-muted">
                        {contractsData.pagination.page} /{" "}
                        {contractsData.pagination.totalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={
                          contractsData.pagination.page >=
                          contractsData.pagination.totalPages
                        }
                      >
                        {t("common.next")}
                      </Button>
                    </div>
                  </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingTransition !== null}
        title={
          pendingTransition === "cancelled"
            ? t("admin.imports.confirmCancelTitle")
            : pendingTransition === "paused"
              ? t("admin.imports.confirmPauseTitle")
              : t("admin.imports.confirmResumeTitle")
        }
        description={t("admin.imports.confirmTransitionDescription", {
          status: pendingTransition ?? "",
          id: batch.id,
        })}
        confirmLabel={
          pendingTransition === "cancelled"
            ? t("admin.imports.confirmCancelYes")
            : t("common.confirm")
        }
        destructive={pendingTransition === "cancelled"}
        isPending={updateMutation.isPending}
        onConfirm={onConfirmTransition}
        onClose={() => setPendingTransition(null)}
      />
    </motion.div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2.5">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

export default AdminImportBatchDetailView;
