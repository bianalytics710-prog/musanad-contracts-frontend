/**
 * AdminImportsListView (S3) — paginated list of import batches.
 *
 * Mode: harden — the Lovable original (`routes/_app/admin.imports.tsx`) was
 * a thin admin list against supabase.from('import_batches'). The v2.6
 * implementation routes through M1c GET /api/v1/import-batches which
 * applies role narrowing + RLS server-side (AC-S3-07).
 *
 * AC mapping:
 *   AC-S3-01: pagination metadata always present.
 *   AC-S3-02: empty data array (NOT an error) when total = 0.
 *   AC-S3-03: filters by status + initiatedBy (URL search params).
 *   AC-S3-04: row shape mirrors fn_import_batch_list (id, initiatedBy raw,
 *             totalFiles, 5 counters, status, startedAt, completedAt, config).
 *   AC-S3-05: limit clamped to 1..100 — fixed at 20.
 *   AC-S3-07: contract_drafter sees own batches only — enforced server-side.
 *   AC-S3-08: is_active=false batches filtered server-side.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { translateApiError } from "@/lib/translate-api-error";
import { formatDateTime } from "@/utils/datetime";
import { useImportBatchList } from "@/features/imports/hooks/useImportBatches";
import {
  IMPORT_BATCH_STATUS_VALUES,
  type ImportBatchListQuery,
  type ImportBatchStatus,
} from "@/types/entities/import-batch.types";

const PAGE_SIZE = 20;

export function AdminImportsListView() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ImportBatchStatus | "">("");
  const [initiatedByFilter, setInitiatedByFilter] = useState<string>("");

  const query: ImportBatchListQuery = useMemo(() => {
    const parsed = initiatedByFilter ? Number(initiatedByFilter) : NaN;
    return {
      page,
      limit: PAGE_SIZE,
      status: statusFilter || undefined,
      initiatedBy:
        Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
    };
  }, [page, statusFilter, initiatedByFilter]);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useImportBatchList(query);

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
            {t("admin.imports.title")}
          </h1>
          {pagination && (
            <p className="mt-1 text-sm text-ink-muted">
              {t("admin.imports.totalCount", { count: pagination.total })}
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
          <RefreshCw className="h-4 w-4" />
          {t("common.retry")}
        </Button>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2">
            <label htmlFor="admin-import-status" className="sr-only">
              {t("admin.imports.filterStatus")}
            </label>
            <select
              id="admin-import-status"
              value={statusFilter}
              onChange={(e) => {
                const v = e.target.value;
                setStatusFilter(
                  (IMPORT_BATCH_STATUS_VALUES as readonly string[]).includes(v)
                    ? (v as ImportBatchStatus)
                    : "",
                );
                setPage(1);
              }}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">{t("admin.imports.filterAll")}</option>
              {IMPORT_BATCH_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {t(`admin.imports.status.${s}`, { defaultValue: s })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="admin-import-initiator" className="sr-only">
              {t("admin.imports.filterInitiator")}
            </label>
            <input
              id="admin-import-initiator"
              type="number"
              value={initiatedByFilter}
              onChange={(e) => {
                setInitiatedByFilter(e.target.value);
                setPage(1);
              }}
              placeholder={t("admin.imports.filterInitiatorPlaceholder")}
              className="h-9 w-48 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                ? translateApiError(error, t, "errors.import.adminListFailed")
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
              {t("admin.imports.emptyTitle")}
            </h2>
            <p className="max-w-md text-sm text-ink-muted">
              {t("admin.imports.emptyDescription")}
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
                      {t("admin.imports.col.id")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("admin.imports.col.initiatedBy")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("admin.imports.col.startedAt")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("admin.imports.col.totalFiles")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("admin.imports.col.counters")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      {t("admin.imports.col.status")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                      <span className="sr-only">
                        {t("admin.imports.col.actions")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-border/60 transition-colors hover:bg-surface/50"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-ink">
                        {b.id}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{b.initiatedBy}</td>
                      <td className="px-4 py-3 text-ink-muted">
                        {formatDateTime(b.startedAt)}
                      </td>
                      <td className="px-4 py-3 font-mono text-ink-muted">
                        {b.totalFiles}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                        {t("admin.imports.counterSummary", {
                          auto: b.autoSaved,
                          review: b.reviewQueue,
                          manual: b.manualEntry,
                          skipped: b.duplicatesSkipped,
                          errored: b.errored,
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass(
                            b.status,
                          )}`}
                        >
                          {t(`admin.imports.status.${b.status}`, {
                            defaultValue: b.status,
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Link
                          to="/app/admin/imports/$batchId"
                          params={{ batchId: String(b.id) }}
                          className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-ink-muted hover:bg-accent hover:text-accent-foreground"
                        >
                          {t("admin.imports.actions.view")}
                        </Link>
                      </td>
                    </tr>
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
            {t("admin.imports.showingRange", {
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
    </motion.div>
  );
}

function badgeClass(status: ImportBatchStatus): string {
  switch (status) {
    case "in_progress":
      return "bg-primary/10 text-primary";
    case "paused":
      return "bg-warning/10 text-warning";
    case "completed":
      return "bg-success/10 text-success";
    case "cancelled":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-surface text-ink-muted";
  }
}

export default AdminImportsListView;
