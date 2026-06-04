/**
 * ManualEntriesView (S7) — list low-confidence imported drafts requiring
 * manual completion + a linear form to submit.
 *
 * AC mapping:
 *   AC-S7-01: Same field set as the M1b compose wizard but presented as a
 *             single linear scroll layout (NOT a 5-step wizard). We reuse
 *             the existing ContractCreateForm — it already covers the same
 *             field set and is M1a-tested.
 *   AC-S7-02: Pre-fill from partial AI-extraction. M1c does NOT persist the
 *             AI extraction across page reloads (browser cannot persist the
 *             original File handle), so the pre-fill source for entries
 *             that survive a refresh is whatever data fn_contract_create
 *             stored on the row. The list page surfaces those drafts and
 *             links to the existing edit form (M1a) which loads the row.
 *   AC-S7-03: Zod validation mirrors M1a CreateContractDto schema (.strict).
 *   AC-S7-04: Submit calls fn_contract_create with importBatchId etc.
 *             Already extended in CreateContractDto.
 *   AC-S7-05: Form retains values on failure; counter NOT incremented.
 *   AC-S7-06: 403 on contract.draft delegated to M1a route gate.
 *
 * For M1c we present the LIST of low-confidence drafts (status='draft',
 * importConfidence < 50) and let the user click each one to edit-and-promote
 * via the existing M1a contract edit flow. The "linear form for a fresh
 * manual entry" pattern is provided by /app/contracts/new (M1a S3); we link
 * to it from this page.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImportsHeader } from "./ImportsHeader";
import { translateApiError } from "@/lib/translate-api-error";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import { useContractList } from "@/features/contracts/hooks/useContracts";
import { IMPORT_CONFIDENCE_THRESHOLDS } from "@/types/entities/import-batch.types";
import { formatDate } from "@/utils/datetime";
import type { ContractListQuery } from "@/types/entities/contract.types";

const PAGE_SIZE = 20;

export function ManualEntriesView() {
  const { t } = useTranslation();
  const canDraft = useAuthStore(selectHasPermission("contract.draft"));

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);

  const query: ContractListQuery = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      status: "draft",
      importConfidenceMin: 0,
      importConfidenceMax: IMPORT_CONFIDENCE_THRESHOLDS.medium - 1,
      search: debouncedSearch.trim() || undefined,
    }),
    [page, debouncedSearch],
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useContractList(query);
  const items = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <ImportsHeader
        title={t("import.manual.title")}
        subtitle={t("import.manual.subtitle", {
          defaultValue:
            "Low-confidence drafts that need a human to finish the metadata before they can be sent for approval.",
        })}
        actions={
          <>
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
            {canDraft && (
              <Link
                to="/app/contracts/new"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gold px-3 text-sm font-medium text-ink hover:bg-gold-hover"
              >
                <Plus className="h-4 w-4" />
                {t("import.manual.newEntry")}
              </Link>
            )}
          </>
        }
      />

      <Card>
        <CardContent className="p-4">
          <label htmlFor="manual-search" className="sr-only">
            {t("import.manual.searchPlaceholder")}
          </label>
          <input
            id="manual-search"
            type="search"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            placeholder={t("import.manual.searchPlaceholder")}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            autoComplete="off"
          />
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
                ? translateApiError(error, t, "errors.import.manualListFailed")
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
              {t("import.manual.emptyTitle")}
            </h2>
            <p className="max-w-md text-sm text-ink-muted">
              {t("import.manual.emptyDescription")}
            </p>
            {canDraft && (
              <Link
                to="/app/contracts/new"
                className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-md bg-gold px-3 text-sm font-medium text-ink hover:bg-gold-hover"
              >
                <Plus className="h-4 w-4" />
                {t("import.manual.newEntry")}
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface/60">
                  <tr className="text-start">
                    <th scope="col" className="px-4 py-2.5 text-start font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("import.manual.col.contract")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-start font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("import.manual.col.confidence")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-start font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("import.manual.col.batch")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-start font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("import.manual.col.created")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-end font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      <span className="sr-only">
                        {t("import.manual.col.actions")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
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
                      <td className="px-4 py-3 font-mono text-ink-muted">
                        {c.importConfidence !== null
                          ? `${c.importConfidence}%`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {c.importBatchId ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {formatDate(c.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Link
                          to="/app/contracts/$id"
                          params={{ id: String(c.id) }}
                          className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-medium text-ink transition-colors hover:bg-surface"
                        >
                          {t("import.manual.actions.complete")}
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
            {t("import.manual.showingRange", {
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

export default ManualEntriesView;
