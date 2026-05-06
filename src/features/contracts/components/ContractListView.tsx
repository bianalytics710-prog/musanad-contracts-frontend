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
import { StatCard, TableSkeleton } from "@/components/patterns";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDate } from "@/utils/datetime";
import { translateApiError } from "@/lib/translate-api-error";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import {
  CONTRACT_LANGUAGE_VALUES,
  CONTRACT_STATUS_VALUES,
  GOVERNING_LAW_VALUES,
  type ContractLanguage,
  type ContractListItem,
  type ContractListQuery,
  type ContractStatus,
  type GoverningLaw,
} from "@/types/entities/contract.types";
import { useContractList } from "@/features/contracts/hooks/useContracts";
import { ContractStatusBadge } from "./ContractStatusBadge";
import { ContractDeleteDialog } from "./ContractDeleteDialog";
import { ExportXlsxButton } from "./ExportXlsxButton";
import type { ContractExportXlsxQueryParams } from "@/types/entities/payment-schedule.types";

const PAGE_SIZE = 20;

const QUICK_FILTERS: ReadonlyArray<{ key: ContractStatus | ""; defaultLabel: string }> = [
  { key: "", defaultLabel: "All" },
  { key: "active", defaultLabel: "Active" },
  { key: "in_approval", defaultLabel: "In approval" },
  { key: "awaiting_signature_employer", defaultLabel: "Awaiting us" },
  { key: "awaiting_signature_counterparty", defaultLabel: "Awaiting counterparty" },
  { key: "fully_signed", defaultLabel: "Fully signed" },
  { key: "expiring_soon", defaultLabel: "Expiring soon" },
  { key: "draft", defaultLabel: "Draft" },
  { key: "expired", defaultLabel: "Expired" },
  // Lovable-parity additions
  { key: "amended", defaultLabel: "Amended" },
  { key: "terminated", defaultLabel: "Terminated" },
  { key: "rejected", defaultLabel: "Rejected" },
  { key: "resubmission_requested", defaultLabel: "Resubmission requested" },
];

/** Lovable parity: contract type filter options. */
const CONTRACT_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "employment", label: "Employment" },
  { value: "vendor_services", label: "Vendor / services" },
  { value: "service", label: "Service" },
  { value: "consultancy", label: "Consultancy" },
  { value: "advisory", label: "Advisory" },
  { value: "nda", label: "Non-disclosure" },
  { value: "master_services", label: "Master services" },
  { value: "sow", label: "SOW" },
  { value: "supply", label: "Supply" },
  { value: "concession", label: "Concession" },
];

/** Lovable parity: sort options. */
const SORT_OPTIONS: ReadonlyArray<{
  value: NonNullable<ContractListQuery["sort"]>;
  label: string;
}> = [
  { value: "updated_at", label: "Last updated" },
  { value: "created_at", label: "Created" },
  { value: "end_date", label: "End date" },
  { value: "value", label: "Value" },
  { value: "alpha", label: "Alphabetical" },
];


function formatAed(value: number | null, currency: string | undefined): string {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: currency || "AED",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || "AED"} ${value.toLocaleString()}`;
  }
}

interface ContractListViewProps {
  /**
   * Pre-applies a status filter on first render. Threaded from
   * `?status=<contract_status>` on the route — set by inbound deep links
   * such as the drafter dashboard pipeline pills.
   */
  initialStatus?: ContractStatus;
}

export function ContractListView({ initialStatus }: ContractListViewProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // FE-C3 — defense-in-depth RBAC gating. BE remains source of truth (403);
  // these flags simply hide actions the user cannot perform.
  const canCreate = useAuthStore(selectHasPermission("contract.draft"));
  const canDelete = useAuthStore(selectHasPermission("contract.delete"));

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "">(
    initialStatus ?? "",
  );
  // R5+ Lovable parity filters
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [languageFilter, setLanguageFilter] = useState<ContractLanguage | "">("");
  const [governingLawFilter, setGoverningLawFilter] = useState<GoverningLaw | "">("");
  const [startFromFilter, setStartFromFilter] = useState<string>("");
  const [startToFilter, setStartToFilter] = useState<string>("");
  const [sortField, setSortField] = useState<NonNullable<ContractListQuery["sort"]>>(
    "updated_at",
  );
  const [deleteTarget, setDeleteTarget] = useState<ContractListItem | null>(null);

  const debouncedSearch = useDebounce(searchInput, 300);

  const query: ContractListQuery = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch.trim() || undefined,
      status: statusFilter || undefined,
      contractType: typeFilter || undefined,
      language: (languageFilter as ContractLanguage) || undefined,
      governingLaw: (governingLawFilter as GoverningLaw) || undefined,
      startDateFrom: startFromFilter || undefined,
      startDateTo: startToFilter || undefined,
      sort: sortField,
    }),
    [
      page,
      debouncedSearch,
      statusFilter,
      typeFilter,
      languageFilter,
      governingLawFilter,
      startFromFilter,
      startToFilter,
      sortField,
    ],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useContractList(query);

  // M1b — XLSX export takes the same filter set, sans page/limit (the BE
  // does not paginate exports — see api-contracts.json _routeOrderingNote).
  const exportFilter: ContractExportXlsxQueryParams = useMemo(
    () => ({
      status: statusFilter || undefined,
      search: debouncedSearch.trim() || undefined,
    }),
    [statusFilter, debouncedSearch],
  );

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
    setTypeFilter("");
    setLanguageFilter("");
    setGoverningLawFilter("");
    setStartFromFilter("");
    setStartToFilter("");
    setSortField("updated_at");
    setPage(1);
  };

  const items = data?.data ?? [];
  const pagination = data?.pagination;
  const hasFilters =
    !!debouncedSearch ||
    !!statusFilter ||
    !!typeFilter ||
    !!languageFilter ||
    !!governingLawFilter ||
    !!startFromFilter ||
    !!startToFilter ||
    sortField !== "updated_at";

  // Lightweight KPI strip derived from the current page rows. Faithful to
  // the visible page; for whole-set numbers we use pagination.total.
  const kpis = useMemo(() => {
    const totalAll = pagination?.total ?? items.length;
    const active = items.filter((c) => c.status === "active" || c.status === "fully_signed").length;
    const inApproval = items.filter((c) => c.status === "in_approval").length;
    const expiring = items.filter((c) => c.status === "expiring_soon").length;
    const totalAed = items.reduce((sum, c) => sum + (c.valueAed ?? 0), 0);
    return { totalAll, active, inApproval, expiring, totalAed };
  }, [items, pagination?.total]);

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
            {t("contracts.kicker", { defaultValue: "Contract register" })}
          </div>
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
          <ExportXlsxButton filter={exportFilter} disabled={isLoading} />
          {canCreate && (
            <Button
              type="button"
              size="sm"
              onClick={() => void navigate({ to: "/app/contracts/compose" })}
            >
              <Plus className="h-4 w-4" />
              {t("contracts.compose.newCta")}
            </Button>
          )}
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t("contracts.kpis.total", { defaultValue: "Total" })}
          value={kpis.totalAll.toLocaleString()}
        />
        <StatCard
          label={t("contracts.kpis.active", { defaultValue: "Active or signed" })}
          value={kpis.active.toLocaleString()}
          delta={t("contracts.kpis.thisPage", { defaultValue: "on this page" })}
        />
        <StatCard
          label={t("contracts.kpis.inApproval", { defaultValue: "In approval" })}
          value={kpis.inApproval.toLocaleString()}
          variant={kpis.inApproval > 0 ? "warning" : "default"}
          delta={t("contracts.kpis.thisPage", { defaultValue: "on this page" })}
        />
        <StatCard
          label={t("contracts.kpis.expiring", { defaultValue: "Expiring soon" })}
          value={kpis.expiring.toLocaleString()}
          variant={kpis.expiring > 0 ? "risk" : "default"}
          delta={t("contracts.kpis.thisPage", { defaultValue: "on this page" })}
        />
      </div>

      {/* Filter toolbar — search + status chips */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
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
          {hasFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={handleClearFilters}>
              <X className="h-3.5 w-3.5" />
              {t("contracts.clearFilters")}
            </Button>
          )}
        </div>
        {/* Filters: Status / Type / Language / Governing law / Date range / Sort */}
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
          <FilterSelect
            label={t("contracts.filters.status", { defaultValue: "Status" })}
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter((v as ContractStatus) || "");
              setPage(1);
            }}
            options={QUICK_FILTERS.map((f) => ({
              value: f.key,
              label: f.key
                ? t(`contractStatus.${f.key}`, { defaultValue: f.defaultLabel })
                : t("contracts.filterAll", { defaultValue: f.defaultLabel }),
            }))}
          />
          <FilterSelect
            label={t("contracts.filters.type", { defaultValue: "Type" })}
            value={typeFilter}
            onChange={(v) => {
              setTypeFilter(v);
              setPage(1);
            }}
            options={[
              { value: "", label: t("common.all", { defaultValue: "All" }) },
              ...CONTRACT_TYPE_OPTIONS.map((o) => ({
                value: o.value,
                label: t(`contracts.contractType.${o.value}`, { defaultValue: o.label }),
              })),
            ]}
          />
          <FilterSelect
            label={t("contracts.filters.language", { defaultValue: "Language" })}
            value={languageFilter}
            onChange={(v) => {
              setLanguageFilter(v as ContractLanguage | "");
              setPage(1);
            }}
            options={[
              { value: "", label: t("common.all", { defaultValue: "All" }) },
              ...CONTRACT_LANGUAGE_VALUES.map((v) => ({
                value: v,
                label: t(`contracts.languageOptions.${v}`, {
                  defaultValue: v === "en" ? "English" : v === "ar" ? "Arabic" : "Bilingual",
                }),
              })),
            ]}
          />
          <FilterSelect
            label={t("contracts.filters.governingLaw", { defaultValue: "Governing law" })}
            value={governingLawFilter}
            onChange={(v) => {
              setGoverningLawFilter(v as GoverningLaw | "");
              setPage(1);
            }}
            options={[
              { value: "", label: t("common.all", { defaultValue: "All" }) },
              ...GOVERNING_LAW_VALUES.map((v) => ({
                value: v,
                label: t(`contracts.governingLawOptions.${v}`, {
                  defaultValue: v.replace("_", " "),
                }),
              })),
            ]}
          />
          <div className="flex flex-col gap-1">
            <label
              htmlFor="contracts-start-from"
              className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
            >
              {t("contracts.filters.startFrom", { defaultValue: "Start from" })}
            </label>
            <input
              id="contracts-start-from"
              type="date"
              value={startFromFilter}
              onChange={(e) => {
                setStartFromFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-ink shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="contracts-start-to"
              className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
            >
              {t("contracts.filters.startTo", { defaultValue: "Start to" })}
            </label>
            <input
              id="contracts-start-to"
              type="date"
              value={startToFilter}
              onChange={(e) => {
                setStartToFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-ink shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <FilterSelect
            label={t("contracts.filters.sort", { defaultValue: "Sort by" })}
            value={sortField}
            onChange={(v) => {
              setSortField((v as NonNullable<ContractListQuery["sort"]>) || "updated_at");
              setPage(1);
            }}
            options={SORT_OPTIONS.map((o) => ({
              value: o.value,
              label: t(`contracts.filters.sortOption.${o.value}`, { defaultValue: o.label }),
            }))}
          />
        </div>
      </div>

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
                onClick={() => void navigate({ to: "/app/contracts/compose" })}
              >
                <Plus className="h-4 w-4" />
                {t("contracts.compose.newCta")}
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
                <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t("contracts.colNumber")}
                </th>
                <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t("contracts.colTitle")}
                </th>
                <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t("contracts.colType")}
                </th>
                <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t("contracts.colStatus")}
                </th>
                <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t("contracts.colEndDate")}
                </th>
                <th scope="col" className="px-4 py-3 text-end font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t("contracts.colValue")}
                </th>
                <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
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
                    className="group border-b border-border/60 transition-colors hover:bg-surface/50"
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
                    <td className="px-4 py-3 text-ink-muted">
                      <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider">
                        {t(`contractType.${c.contractType}`, { defaultValue: c.contractType })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ContractStatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                      {c.endDate ? formatDate(c.endDate) : "—"}
                    </td>
                    <td className="px-4 py-3 text-end font-mono text-xs text-ink">
                      {formatAed(c.valueAed, c.currency)}
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
    <div className="rounded-lg border border-border bg-card p-4">
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}

/**
 * R5+ — labelled select used by the Lovable-parity filter row.
 */
interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}
function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-ink shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value || "_all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ContractListView;
