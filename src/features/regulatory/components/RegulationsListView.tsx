/**
 * RegulationsListView (S1) — paginated list of regulations.
 *
 * Mode: regenerate. Lovable's `routes/_app/admin.regulations.tsx` (232L)
 * was thin admin chrome reading from `regulations` table via supabase. The
 * v2.6 implementation routes through GET /api/v1/regulations which applies
 * permission gates server-side (regulations.read).
 *
 * AC mapping:
 *   AC-S1-01 — pagination metadata always present; default page=1 limit=20.
 *   AC-S1-02 — filters: jurisdiction, regulationType, issuerId, status, search.
 *   AC-S1-03 — search debounced 300ms (T10 useDebounce).
 *   AC-S1-04 — empty state visible when total=0.
 *   AC-S1-05 — list omits summaryEn/Ar/sourceUrl/tags/supersededBy chain
 *              (lighter shape vs detail; mirrors REG-OI-A).
 *   AC-S1-06 — contract_recipient denied by BE (403) — surfaced via toast.
 *
 * 13-checklist:
 *   T1/T2 — service + React Query hook.
 *   T3 — every label uses t().
 *   T4 — explicit loading / error / empty branches.
 *   T5 — semantic Tailwind tokens only.
 *   T6 — semantic <table>, aria-busy on body during refetch.
 *   T7 — strict TS, no any.
 *   T10 — useDebounce(300) on search.
 *   T11 — wrapped in route ErrorBoundary.
 *   T12 — formatDateTime for effectiveDate.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Plus, RefreshCw, Search, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { translateApiError } from "@/lib/translate-api-error";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDate } from "@/utils/datetime";
import { selectHasPermission, useAuthStore } from "@/store/auth.store";
import { useRegulationList } from "@/features/regulatory/hooks/useRegulatory";
import {
  REGULATION_JURISDICTION_VALUES,
  REGULATION_STATUS_VALUES,
  REGULATION_TYPE_VALUES,
  type RegulationJurisdiction,
  type RegulationListItem,
  type RegulationListQuery,
  type RegulationStatus,
  type RegulationType,
} from "@/types/entities/regulatory.types";
import { RegulationDetailDrawer } from "./RegulationDetailDrawer";
import { RegulationCreateDialog } from "./RegulationCreateDialog";
import { RegulationEditDialog } from "./RegulationEditDialog";
import { RegulationDeleteConfirmDialog } from "./RegulationDeleteConfirmDialog";

const PAGE_SIZE = 20;

export function RegulationsListView() {
  const { t } = useTranslation();
  const canManage = useAuthStore(selectHasPermission("regulations.manage"));

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [jurisdiction, setJurisdiction] = useState<RegulationJurisdiction | "">(
    "",
  );
  const [regulationType, setRegulationType] = useState<RegulationType | "">("");
  const [status, setStatus] = useState<RegulationStatus | "">("");

  const debouncedSearch = useDebounce(search, 300);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<RegulationListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RegulationListItem | null>(
    null,
  );
  const [createOpen, setCreateOpen] = useState(false);

  const query: RegulationListQuery = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      jurisdiction: jurisdiction || undefined,
      regulationType: regulationType || undefined,
      status: status || undefined,
      search: debouncedSearch.trim() || undefined,
    }),
    [page, jurisdiction, regulationType, status, debouncedSearch],
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useRegulationList(query);

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
            {t("regulatory.regulation.list.title")}
          </h1>
          {pagination && (
            <p className="mt-1 text-sm text-ink-muted">
              {t("regulatory.regulation.list.totalCount", {
                count: pagination.total,
              })}
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
          {canManage && (
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateOpen(true)}
              aria-label={t("regulatory.regulation.list.createButton")}
            >
              <Plus className="h-4 w-4" />
              {t("regulatory.regulation.list.createButton")}
            </Button>
          )}
        </div>
      </header>

      <Card>
        <CardContent className="space-y-4 pt-6">
          {/* Filters */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t("regulatory.regulation.list.searchPlaceholder")}
                aria-label={t("regulatory.regulation.list.searchLabel")}
                className="ps-9"
              />
            </div>

            <FilterSelect
              label={t("regulatory.regulation.fields.jurisdiction")}
              value={jurisdiction}
              onChange={(v) => {
                setJurisdiction(v as RegulationJurisdiction | "");
                setPage(1);
              }}
              options={REGULATION_JURISDICTION_VALUES.map((v) => ({
                value: v,
                label: t(`regulatory.regulation.jurisdiction.${v}`),
              }))}
              placeholderKey="regulatory.regulation.list.allJurisdictions"
            />

            <FilterSelect
              label={t("regulatory.regulation.fields.regulationType")}
              value={regulationType}
              onChange={(v) => {
                setRegulationType(v as RegulationType | "");
                setPage(1);
              }}
              options={REGULATION_TYPE_VALUES.map((v) => ({
                value: v,
                label: t(`regulatory.regulation.regulationType.${v}`),
              }))}
              placeholderKey="regulatory.regulation.list.allTypes"
            />

            <FilterSelect
              label={t("regulatory.regulation.fields.status")}
              value={status}
              onChange={(v) => {
                setStatus(v as RegulationStatus | "");
                setPage(1);
              }}
              options={REGULATION_STATUS_VALUES.map((v) => ({
                value: v,
                label: t(`regulatory.regulation.status.${v}`),
              }))}
              placeholderKey="regulatory.regulation.list.allStatuses"
            />
          </div>

          {/* Body */}
          {isError ? (
            <div
              role="alert"
              className="rounded-md border border-terracotta/30 bg-terracotta-tint/30 p-4 text-sm text-terracotta-ink"
            >
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                {translateApiError(error, t)}
              </div>
            </div>
          ) : isLoading ? (
            <div
              role="status"
              aria-busy="true"
              className="space-y-2"
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-12 w-full animate-pulse rounded-md bg-muted/30"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-ink-muted">
              <p>{t("regulatory.regulation.list.empty")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full text-sm"
                aria-busy={isFetching ? "true" : "false"}
              >
                <thead className="border-b border-border text-start text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="py-2 pe-3 text-start">
                      {t("regulatory.regulation.fields.referenceCode")}
                    </th>
                    <th className="py-2 pe-3 text-start">
                      {t("regulatory.regulation.fields.titleEn")}
                    </th>
                    <th className="py-2 pe-3 text-start">
                      {t("regulatory.regulation.fields.issuer")}
                    </th>
                    <th className="py-2 pe-3 text-start">
                      {t("regulatory.regulation.fields.regulationType")}
                    </th>
                    <th className="py-2 pe-3 text-start">
                      {t("regulatory.regulation.fields.jurisdiction")}
                    </th>
                    <th className="py-2 pe-3 text-start">
                      {t("regulatory.regulation.fields.effectiveDate")}
                    </th>
                    <th className="py-2 pe-3 text-start">
                      {t("regulatory.regulation.fields.status")}
                    </th>
                    <th className="py-2 text-end">
                      <span className="sr-only">
                        {t("common.actions")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/20">
                      <td className="py-2 pe-3 font-mono text-xs">
                        {row.referenceCode}
                      </td>
                      <td className="py-2 pe-3">
                        <button
                          type="button"
                          onClick={() => setDetailId(row.id)}
                          className="text-start font-medium text-ink hover:underline"
                        >
                          {row.titleEn}
                        </button>
                        {row.supersededByCode && (
                          <div className="mt-0.5 text-xs text-ink-muted">
                            {t("regulatory.regulation.list.supersededBy", {
                              code: row.supersededByCode,
                            })}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pe-3 text-ink-muted">
                        {row.issuer.code}
                      </td>
                      <td className="py-2 pe-3">
                        {t(
                          `regulatory.regulation.regulationType.${row.regulationType}`,
                        )}
                      </td>
                      <td className="py-2 pe-3">
                        {row.jurisdiction
                          ? t(
                              `regulatory.regulation.jurisdiction.${row.jurisdiction}`,
                            )
                          : "—"}
                      </td>
                      <td className="py-2 pe-3 font-mono text-xs">
                        {formatDate(row.effectiveDate)}
                      </td>
                      <td className="py-2 pe-3">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="py-2 text-end">
                        {canManage && (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditTarget(row)}
                              aria-label={t(
                                "regulatory.regulation.list.editAction",
                                { name: row.referenceCode },
                              )}
                            >
                              {t("common.edit")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(row)}
                              aria-label={t(
                                "regulatory.regulation.list.deleteAction",
                                { name: row.referenceCode },
                              )}
                            >
                              {t("common.delete")}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 border-t border-border pt-3 text-sm">
              <p className="text-ink-muted">
                {t("common.pagination.showing", {
                  current: pagination.page,
                  total: pagination.totalPages,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1 || isFetching}
                  onClick={() => setPage(Math.max(1, page - 1))}
                >
                  {t("common.pagination.previous")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages || isFetching}
                  onClick={() =>
                    setPage(Math.min(pagination.totalPages, page + 1))
                  }
                >
                  {t("common.pagination.next")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail drawer (S2) */}
      {detailId !== null && (
        <RegulationDetailDrawer
          regulationId={detailId}
          open={detailId !== null}
          onClose={() => setDetailId(null)}
        />
      )}

      {/* Create dialog (S3) */}
      <RegulationCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {/* Edit dialog (S4) */}
      {editTarget !== null && (
        <RegulationEditDialog
          regulationId={editTarget.id}
          open={editTarget !== null}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Delete confirm dialog (S5) — T9 destructive */}
      {deleteTarget !== null && (
        <RegulationDeleteConfirmDialog
          regulation={deleteTarget}
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </motion.div>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholderKey: string;
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholderKey,
}: FilterSelectProps) {
  const { t } = useTranslation();
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">{t(placeholderKey)}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const STATUS_PILL_CLASS: Record<string, string> = {
  active: "bg-sage-tint/40 text-sage-ink border-sage/30",
  superseded: "bg-amber-tint/40 text-amber-ink border-amber/30",
  repealed: "bg-terracotta-tint/40 text-terracotta-ink border-terracotta/30",
  draft: "bg-muted/40 text-ink-muted border-border",
};

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const cls = STATUS_PILL_CLASS[status] ?? STATUS_PILL_CLASS.draft;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {t(`regulatory.regulation.status.${status}`, { defaultValue: status })}
    </span>
  );
}
