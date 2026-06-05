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
import { Plus, Search, RefreshCw, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard, TableSkeleton } from "@/components/patterns";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDate, formatHijriDate } from "@/utils/datetime";
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
// E23 fix — title-case + acronym preservation for contract_type display.
import { humanizeLabel } from "@/features/dashboards/components/dashboard-primitives";

const humanizeContractType = (slug: string | null | undefined): string =>
  humanizeLabel(slug ?? "");
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

/** Lovable parity: contract type filter options.
 *  L33 — added EPC, gas_spa; removed duplicate Vendor/services vs Service.
 */
const CONTRACT_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "services", label: "Services" },
  { value: "epc", label: "EPC" },
  { value: "gas_spa", label: "Gas SPA" },
  { value: "concession", label: "Concession" },
  { value: "employment", label: "Employment" },
  { value: "consultancy", label: "Consultancy" },
  { value: "advisory", label: "Advisory" },
  { value: "nda", label: "Non-disclosure" },
  { value: "master_services", label: "Master Services" },
  { value: "sow", label: "SOW" },
  { value: "supply", label: "Supply" },
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
  { value: "risk", label: "Risk score" },
];

const RISK_OPTIONS: ReadonlyArray<{
  value: "" | NonNullable<ContractListQuery["risk"]>;
  label: string;
  defaultLabel: string;
}> = [
  { value: "", label: "common.all", defaultLabel: "All" },
  { value: "high", label: "contracts.filters.riskOption.high", defaultLabel: "High (≥70)" },
  { value: "medium", label: "contracts.filters.riskOption.medium", defaultLabel: "Medium (40–69)" },
  { value: "low", label: "contracts.filters.riskOption.low", defaultLabel: "Low (<40)" },
  { value: "flagged", label: "contracts.filters.riskOption.flagged", defaultLabel: "Any flagged" },
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
  /** Mig 562 — pre-applies a risk-bucket filter. Set by the executive
   *  dashboard "View all flagged contracts →" link (?risk=high). */
  initialRisk?: NonNullable<ContractListQuery["risk"]>;
  /** Mig 562 — pre-applies a sort. Set by the same exec link (?sort=risk). */
  initialSort?: NonNullable<ContractListQuery["sort"]>;
}

export function ContractListView({
  initialStatus,
  initialRisk,
  initialSort,
}: ContractListViewProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // FE-C3 — defense-in-depth RBAC gating. BE remains source of truth (403);
  // these flags simply hide actions the user cannot perform.
  const canCreate = useAuthStore(selectHasPermission("contract.draft"));
  const canDelete = useAuthStore(selectHasPermission("contract.delete"));
  // R-RC3 — empty-state copy and CTAs are role-aware. Recipients can't
  // draft or import; show signing-context messaging instead.
  const userRole = useAuthStore((s) => s.user?.role.name ?? null);
  const isRecipientOnly = userRole === "contract_recipient";

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
    initialSort ?? "updated_at",
  );
  // Mig 562 — Risk bucket filter (high / medium / low / flagged / unset)
  const [riskFilter, setRiskFilter] = useState<"" | NonNullable<ContractListQuery["risk"]>>(
    initialRisk ?? "",
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
      risk: riskFilter || undefined,
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
      riskFilter,
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
    setRiskFilter("");
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
    !!riskFilter ||
    sortField !== "updated_at";

  // E-rev-E-1: KPI strip reads scope-wide counts from the BE response
  // (mig 485 added `statusCounts`). If the BE response predates the
  // migration the fields are missing — fall back to per-page counts so
  // we degrade gracefully. The qualifier "(on this page)" goes away
  // permanently because the numbers are now whole-scope.
  const kpis = useMemo(() => {
    const totalAll = pagination?.total ?? items.length;
    const counts = data?.statusCounts;
    const active =
      counts?.active ??
      items.filter((c) => c.status === "active" || c.status === "fully_signed").length;
    const inApproval =
      counts?.inApproval ??
      items.filter((c) => c.status === "in_approval").length;
    const expiring =
      counts?.expiringSoon ??
      items.filter((c) => c.status === "expiring_soon").length;
    const totalAed = items.reduce((sum, c) => sum + (c.valueAed ?? 0), 0);
    return { totalAll, active, inApproval, expiring, totalAed };
  }, [items, pagination?.total, data?.statusCounts]);

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
          {/* R14 (Rashid audit 2026-06-01) — the KPI strip already shows
              "Total in scope: N" right below; the H1 subtitle "N total" was
              the same count twice. Hide when the KPI tile is visible (always). */}
        </div>

        <div className="flex items-center gap-2">
          {/* R-LC0 LC-D6 — Retry button only when there's an error to retry. */}
          {isError && (
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
          )}
          <ExportXlsxButton filter={exportFilter} disabled={isLoading} />
          {canCreate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void navigate({ to: "/app/imports/bulk" })}
              aria-label={t("contracts.importCta.ariaLabel", {
                defaultValue: "Import one or more contracts",
              })}
            >
              <Upload className="h-4 w-4" />
              {t("contracts.importCta.label", { defaultValue: "Import" })}
            </Button>
          )}
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

      {/* E-rev-E-1 — KPI tiles now show whole-scope counts (mig 485 added
          per-status aggregates to fn_contract_list). No more "(on this
          page)" qualifier, no more "0 / 367" caption. If 100 of 367
          contracts in scope are signed, the Signed tile reads 100. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t("contracts.kpis.totalScope", { defaultValue: "Total in scope" })}
          value={kpis.totalAll.toLocaleString()}
        />
        <StatCard
          label={t("contracts.kpis.active", { defaultValue: "Active or signed" })}
          value={kpis.active.toLocaleString()}
        />
        <StatCard
          label={t("contracts.kpis.inApproval", { defaultValue: "In approval" })}
          value={kpis.inApproval.toLocaleString()}
          variant={kpis.inApproval > 0 ? "warning" : "default"}
        />
        <StatCard
          label={t("contracts.kpis.expiring", { defaultValue: "Expiring soon" })}
          value={kpis.expiring.toLocaleString()}
          variant={kpis.expiring > 0 ? "risk" : "default"}
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
              // R15 (Rashid audit 2026-06-01) — recipient view uses a
              // signer-tailored placeholder. Other roles keep the existing
              // "Search number, title, counterparty…" prompt.
              placeholder={
                isRecipientOnly
                  ? t("contracts.searchPlaceholderRecipient", {
                      defaultValue: "Search number or title…",
                    })
                  : t("contracts.searchPlaceholder")
              }
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
        {/* Filters: Status / Type / Language / Governing law / Risk / Date range / Sort */}
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-8">
          <FilterSelect
            label={t("contracts.filters.status", { defaultValue: "Status" })}
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter((v as ContractStatus) || "");
              setPage(1);
            }}
            options={QUICK_FILTERS
              // R13 (Rashid audit 2026-06-01) — trim internal-workflow
              // status options for Recipient view (rejected / resubmission
              // requested / amended / draft / in_approval don't apply to an
              // external counterparty signer).
              .filter((f) =>
                !isRecipientOnly ||
                !["draft", "in_approval", "amended", "rejected", "resubmission_requested"].includes(
                  f.key as string,
                ),
              )
              .map((f) => ({
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
              ...CONTRACT_TYPE_OPTIONS
                // R12 (Rashid audit 2026-06-01) — for Recipient view, limit
                // type options to types actually present in the user's
                // scope (computed from visible items). Avoids 10 dead
                // dropdown options for a 5-row scope.
                .filter((o) =>
                  !isRecipientOnly ||
                  items.some((c) => c.contractType === o.value),
                )
                .map((o) => ({
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
          {/* Mig 562 — AI risk bucket filter (executive "View all flagged" link
              lands here pre-set to ?risk=high). */}
          <FilterSelect
            label={t("contracts.filters.risk", { defaultValue: "Risk" })}
            value={riskFilter}
            onChange={(v) => {
              setRiskFilter(
                (RISK_OPTIONS.map((o) => o.value) as readonly string[]).includes(v)
                  ? (v as NonNullable<ContractListQuery["risk"]> | "")
                  : "",
              );
              setPage(1);
            }}
            options={RISK_OPTIONS.map((o) => ({
              value: o.value,
              label: t(o.label, { defaultValue: o.defaultLabel }),
            }))}
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
              {hasFilters
                ? t("contracts.noResultsTitle")
                : isRecipientOnly
                  ? t("contracts.emptyTitleRecipient", {
                      defaultValue: "No contracts assigned to you yet",
                    })
                  : t("contracts.emptyTitle")}
            </h2>
            <p className="max-w-md text-sm text-ink-muted">
              {hasFilters
                ? t("contracts.noResultsDescription")
                : isRecipientOnly
                  ? t("contracts.emptyDescriptionRecipient", {
                      defaultValue:
                        "When an employer adds you as a signatory, the contract will appear here.",
                    })
                  : t("contracts.emptyDescription")}
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
  // R10 (Rashid audit 2026-06-01) — Recipient view hides the Drafter
  // column (header + cell) since internal team members aren't disclosed
  // to external counterparty signers.
  const userRole = useAuthStore((s) => s.user?.role.name ?? null);
  const isRecipientOnly = userRole === "contract_recipient";

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
                {/* R-LC6 LC-D1 — Counterparty column. */}
                <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t("contracts.colCounterparty", { defaultValue: "Counterparty" })}
                </th>
                {/* E-rev-E-2 — Drafter column removed across the board.
                    Executive demo doesn't need internal owner in the
                    register row; keeps the table inside the viewport on
                    standard laptop widths without horizontal scroll. */}
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
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/app/contracts/$id"
                          params={{ id: String(c.id) }}
                          className="font-medium text-ink hover:underline"
                        >
                          {displayTitle}
                        </Link>
                        {/* Mig 562 — inline Risk N badge inside the Title cell
                            when ai_risk_score ≥ 70. Avoids a 9th column while
                            still surfacing the score on high-risk rows. */}
                        {typeof c.aiRiskScore === "number" && c.aiRiskScore >= 70 && (
                          <span
                            className="inline-flex items-center rounded-md bg-terracotta/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-terracotta"
                            title={t("contracts.colRiskBadgeTooltip", {
                              defaultValue: "AI risk score",
                            })}
                          >
                            {t("contracts.colRiskBadge", {
                              defaultValue: "Risk {{score}}",
                              score: String(c.aiRiskScore),
                            })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {/* E23 fix: drop uppercase tracking — "services" /
                          "epc" / "gas_spa" become "Services" / "EPC" /
                          "Gas SPA" via humanizeLabel without forced caps. */}
                      <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-[11px] tracking-wider">
                        {t(`contractType.${c.contractType}`, { defaultValue: humanizeContractType(c.contractType) })}
                      </span>
                    </td>
                    {/* R-LC6 LC-D1 — Counterparty (locale-aware). */}
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {(() => {
                        const cpName = isAr && c.counterpartyNameAr
                          ? c.counterpartyNameAr
                          : c.counterpartyNameEn;
                        return cpName ?? "—";
                      })()}
                    </td>
                    {/* E-rev-E-2 - Drafter cell removed (column gone). */}
                    <td className="px-4 py-3">
                      <ContractStatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                      {c.endDate ? (
                        <div className="flex flex-col">
                          {/* D18 — Greg+Hijri date stack now uses block-level
                              <span className="block"> + explicit separator so
                              the DOM textContent reads "31 Dec 2025 ·
                              Rajab 11, 1447 AH" instead of the mashed
                              "31 Dec 2025Rajab 11, 1447 AH" the inline
                              <span> pair produced. */}
                          <span className="block">{formatDate(c.endDate)}</span>
                          <span className="sr-only"> · </span>
                          <span className="block text-[10px] text-ink-subtle">
                            {formatHijriDate(c.endDate)}
                          </span>
                        </div>
                      ) : (
                        // D19 — bare "—" placeholder used to mash with the
                        // adjacent Value cell in DOM textContent extraction
                        // ("—AED 9,000,000"). Now wrapped in an explicit
                        // aria-labelled span; sr-only separator placed AFTER
                        // the dash so screen readers + textContent get a
                        // clean break before the next column.
                        <>
                          <span aria-label={t("contracts.noEndDate", { defaultValue: "No end date" })}>—</span>
                          <span className="sr-only"> · </span>
                        </>
                      )}
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
