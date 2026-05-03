/**
 * ContractListView (S1) — paginated, filterable list of contracts.
 *
 * Mode: harden — derived from the Lovable `routes/_app/contracts.tsx` visual
 * idiom (toolbar + search + filter chips + simple table) but rebuilt against
 * the v2.6 contract API and design tokens. The Lovable file (1,730 lines)
 * was tightly coupled to supabase, the compose-wizard chrome, and Lovable-
 * specific UI primitives that are out of M1a scope (bulk export, archive,
 * tag-bulk, signatory filter — all deferred to M1b/M2). M1a keeps the
 * essential CRUD surface so QA Stage 4 can pass.
 *
 * Harden checklist:
 *   T1  All API calls go through contractsService → React Query.
 *   T2  useContractList wraps the read; mutations use useDeleteContract via the dialog.
 *   T3  Every string is t()-keyed; no hardcoded English in JSX.
 *   T4  Loading skeleton, empty state, error state — all rendered.
 *   T5  Semantic tokens only (bg-card, text-ink, border-border, etc.).
 *   T6  Inputs labelled, icon buttons aria-labelled, focus rings preserved.
 *   T7  Strict TS — no `any`. Status enum exhaustively typed.
 *   T8  Filter form uses controlled inputs with debounced search (T10).
 *   T9  Delete is gated by ContractDeleteDialog — type-to-confirm.
 *   T10 useDebounce(300) on the search box.
 *   T11 Wrapped in <ErrorBoundary> by the route entry.
 *   T12 formatDateTime for every date column.
 *   T13 No console.log; no sensitive fields ever pulled into list (the API
 *       does not return body_en/body_ar in list responses — AC-S1-08).
 */
import { useMemo, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Plus, Search, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDate } from "@/utils/datetime";
import { translateApiError } from "@/lib/translate-api-error";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import {
  CONTRACT_STATUS_VALUES,
  type ContractListItem,
  type ContractListQuery,
  type ContractStatus,
} from "@/types/entities/contract.types";
import { useContractList } from "@/features/contracts/hooks/useContracts";
import { ContractStatusBadge } from "./ContractStatusBadge";
import { ContractDeleteDialog } from "./ContractDeleteDialog";

const PAGE_SIZE = 20;

export function ContractListView() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // FE-C3 — defense-in-depth RBAC gating. BE remains source of truth (403);
  // these flags simply hide actions the user cannot perform.
  const canCreate = useAuthStore(selectHasPermission("contract.draft"));
  const canDelete = useAuthStore(selectHasPermission("contract.delete"));

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "">("");
  const [deleteTarget, setDeleteTarget] = useState<ContractListItem | null>(null);

  const debouncedSearch = useDebounce(searchInput, 300);

  const query: ContractListQuery = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch.trim() || undefined,
      status: statusFilter || undefined,
    }),
    [page, debouncedSearch, statusFilter],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useContractList(query);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setStatusFilter(
      (CONTRACT_STATUS_VALUES as readonly string[]).includes(value)
        ? (value as ContractStatus)
        : "",
    );
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setStatusFilter("");
    setPage(1);
  };

  const items = data?.data ?? [];
  const pagination = data?.pagination;
  const hasFilters = !!debouncedSearch || !!statusFilter;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{t("contracts.title")}</h1>
          {pagination && (
            <p className="mt-1 text-sm text-ink-muted">
              {t("contracts.totalCount", { count: pagination.total })}
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
          {canCreate && (
            <Button
              type="button"
              size="sm"
              onClick={() => void navigate({ to: "/app/contracts/new" })}
            >
              <Plus className="h-4 w-4" />
              {t("contracts.newContract")}
            </Button>
          )}
        </div>
      </header>

      {/* Filter toolbar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <label htmlFor="contracts-search" className="sr-only">
              {t("contracts.searchPlaceholder")}
            </label>
            <Search
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle"
              aria-hidden="true"
            />
            <Input
              id="contracts-search"
              type="search"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={t("contracts.searchPlaceholder")}
              className="ps-9"
              autoComplete="off"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="contracts-status" className="sr-only">
              {t("contracts.filterStatus")}
            </label>
            <select
              id="contracts-status"
              value={statusFilter}
              onChange={handleStatusChange}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">{t("contracts.filterAll")}</option>
              {CONTRACT_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {t(`contractStatus.${s}`, { defaultValue: s })}
                </option>
              ))}
            </select>

            {hasFilters && (
              <Button type="button" variant="ghost" size="sm" onClick={handleClearFilters}>
                <X className="h-3.5 w-3.5" />
                {t("contracts.clearFilters")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Three data states (T4) */}
      {isLoading ? (
        <ContractListSkeleton />
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm font-medium text-destructive">
              {error ? translateApiError(error, t) : t("common.error")}
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
              {hasFilters ? t("contracts.noResultsTitle") : t("contracts.emptyTitle")}
            </h2>
            <p className="max-w-md text-sm text-ink-muted">
              {hasFilters ? t("contracts.noResultsDescription") : t("contracts.emptyDescription")}
            </p>
            {!hasFilters && canCreate && (
              <Button
                type="button"
                size="sm"
                className="mt-2"
                onClick={() => void navigate({ to: "/app/contracts/new" })}
              >
                <Plus className="h-4 w-4" />
                {t("contracts.newContract")}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <ContractTable items={items} onDelete={(c) => setDeleteTarget(c)} canDelete={canDelete} />
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-ink-muted">
            {t("contracts.showingRange", {
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

      {/* Delete dialog (T9) */}
      {deleteTarget && (
        <ContractDeleteDialog
          contractId={deleteTarget.id}
          contractNumber={deleteTarget.contractNumber}
          contractTitle={deleteTarget.titleEn}
          open={true}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </motion.div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface ContractTableProps {
  items: ContractListItem[];
  onDelete: (c: ContractListItem) => void;
  /** Defense-in-depth RBAC flag — hides the per-row delete button. */
  canDelete: boolean;
}

function ContractTable({ items, onDelete, canDelete }: ContractTableProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface">
              <tr className="text-left">
                <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                  {t("contracts.colNumber")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                  {t("contracts.colTitle")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                  {t("contracts.colType")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                  {t("contracts.colStatus")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                  {t("contracts.colEndDate")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                  {t("contracts.colValue")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-ink-muted">
                  <span className="sr-only">{t("common.view")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const displayTitle = isAr && c.titleAr ? c.titleAr : c.titleEn;
                return (
                  <tr
                    key={c.id}
                    className="border-b border-border/60 transition-colors hover:bg-surface/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-ink-subtle">
                      {c.contractNumber}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to="/app/contracts/$id"
                        params={{ id: String(c.id) }}
                        className="font-medium text-ink hover:underline"
                      >
                        {displayTitle}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{c.contractType}</td>
                    <td className="px-4 py-3">
                      <ContractStatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {c.endDate ? formatDate(c.endDate) : "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {c.valueAed !== null ? `${c.currency} ${c.valueAed.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex justify-end gap-1">
                        <Link
                          to="/app/contracts/$id"
                          params={{ id: String(c.id) }}
                          className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-ink-muted hover:bg-accent hover:text-accent-foreground"
                        >
                          {t("common.view")}
                        </Link>
                        {canDelete && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(c)}
                            aria-label={t("contracts.delete.ariaLabel", {
                              number: c.contractNumber,
                            })}
                          >
                            {t("common.delete")}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ContractListSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-surface" aria-hidden="true" />
        ))}
      </CardContent>
    </Card>
  );
}

export default ContractListView;
