/**
 * /app/admin/audit — paginated audit log viewer with 5 filters + CSV export.
 *
 * Filters: tableName, action, changedBy, dateFrom, dateTo.
 * Retention disclosure: workspace setting `contractRetentionMonths` (defaults
 * to "see Configuration" when missing). Banner displayed at the top.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Download, Search, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import {
  adminAuditService,
  type AuditLogQuery,
} from "@/services/api/admin-audit.service";
import { adminUsersService } from "@/services/api/admin-users.service";
import { adminSettingsService } from "@/services/api/admin-settings.service";
import { formatDateTime } from "@/utils/datetime";

export const Route = createFileRoute("/app/admin/audit/")({
  component: () => (
    <ErrorBoundary>
      <AdminAuditView />
    </ErrorBoundary>
  ),
});

const ACTION_TONE: Record<string, string> = {
  INSERT: "bg-sage/15 text-sage",
  UPDATE: "bg-gold/15 text-gold",
  DELETE: "bg-terracotta/15 text-terracotta",
};

function AdminAuditView() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AuditLogQuery>({});
  const [draftTable, setDraftTable] = useState("");
  const [draftAction, setDraftAction] = useState<"" | "INSERT" | "UPDATE" | "DELETE">("");
  const [draftChangedBy, setDraftChangedBy] = useState<number | "">("");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");

  const usersQuery = useQuery({
    queryKey: ["admin-users", "all", "for-audit"],
    queryFn: () => adminUsersService.list({ limit: 100 }),
    staleTime: 5 * 60_000,
  });

  const settingsQuery = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => adminSettingsService.list(),
    staleTime: 5 * 60_000,
  });

  const retentionMonths = useMemo(() => {
    const row = settingsQuery.data?.settings.find(
      (s) => s.key === "contractRetentionMonths",
    );
    return typeof row?.value === "number" ? row.value : null;
  }, [settingsQuery.data]);

  const query: AuditLogQuery = useMemo(
    () => ({ ...filters, page, limit: 50 }),
    [filters, page],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", query],
    queryFn: () => adminAuditService.list(query),
    staleTime: 30_000,
  });

  const items = data?.data ?? [];
  const totalRows = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;

  const apply = () => {
    setPage(1);
    setFilters({
      tableName: draftTable.trim() || undefined,
      action: draftAction || undefined,
      changedBy: draftChangedBy === "" ? undefined : draftChangedBy,
      dateFrom: draftFrom ? new Date(draftFrom).toISOString() : undefined,
      dateTo: draftTo ? new Date(draftTo).toISOString() : undefined,
    });
  };

  const clear = () => {
    setDraftTable("");
    setDraftAction("");
    setDraftChangedBy("");
    setDraftFrom("");
    setDraftTo("");
    setFilters({});
    setPage(1);
  };

  const onExport = async () => {
    const blob = await adminAuditService.downloadCsv(filters);
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] space-y-4 p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("admin.audit.title", { defaultValue: "Audit log" })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("admin.audit.subtitle", {
              defaultValue:
                "Every INSERT / UPDATE / DELETE on auditable tables. Filter by table, action, actor, or date range.",
            })}
          </p>
        </div>
        <Button variant="outline" onClick={onExport} disabled={isLoading}>
          <Download className="me-2 h-4 w-4" />
          {t("admin.audit.actions.exportCsv", { defaultValue: "Export CSV" })}
        </Button>
      </header>

      <div className="flex items-start gap-2 rounded-md border border-border bg-surface/40 px-3 py-2 text-xs text-ink-subtle">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          {retentionMonths === null
            ? t("admin.audit.retention.unknown", {
                defaultValue:
                  "Audit events follow the workspace retention policy. See Configuration → General → Contract retention.",
              })
            : t("admin.audit.retention.known", {
                defaultValue:
                  "Audit events are retained for {{months}} months. Older entries are pruned by the daily retention job.",
                months: retentionMonths,
              })}
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-5">
        <Field id="audit-table" label={t("admin.audit.filters.table", { defaultValue: "Table" })}>
          <Input
            id="audit-table"
            value={draftTable}
            onChange={(e) => setDraftTable(e.target.value)}
            placeholder="user, contract, …"
          />
        </Field>
        <Field id="audit-action" label={t("admin.audit.filters.action", { defaultValue: "Action" })}>
          <select
            id="audit-action"
            value={draftAction}
            onChange={(e) =>
              setDraftAction(e.target.value as "" | "INSERT" | "UPDATE" | "DELETE")
            }
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-ink"
          >
            <option value="">Any</option>
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </Field>
        <Field id="audit-actor" label={t("admin.audit.filters.actor", { defaultValue: "Actor" })}>
          <select
            id="audit-actor"
            value={draftChangedBy}
            onChange={(e) =>
              setDraftChangedBy(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-ink"
          >
            <option value="">Any</option>
            {(usersQuery.data?.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        </Field>
        <Field id="audit-from" label={t("admin.audit.filters.dateFrom", { defaultValue: "From" })}>
          <Input
            id="audit-from"
            type="date"
            value={draftFrom}
            onChange={(e) => setDraftFrom(e.target.value)}
          />
        </Field>
        <Field id="audit-to" label={t("admin.audit.filters.dateTo", { defaultValue: "To" })}>
          <Input
            id="audit-to"
            type="date"
            value={draftTo}
            onChange={(e) => setDraftTo(e.target.value)}
          />
        </Field>
        <div className="flex items-end gap-2 md:col-span-5">
          <Button onClick={apply}>
            <Search className="me-2 h-4 w-4" />
            {t("common.apply", { defaultValue: "Apply" })}
          </Button>
          <Button variant="ghost" onClick={clear}>
            {t("common.clear", { defaultValue: "Clear" })}
          </Button>
          <span className="ms-auto text-xs text-ink-subtle">
            {totalRows.toLocaleString()} events
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-surface" aria-hidden />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t("admin.audit.empty", { defaultValue: "No events match the filters." })}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-ink-subtle">
                  <th scope="col" className="px-4 py-3 font-medium">When</th>
                  <th scope="col" className="px-4 py-3 font-medium">Table</th>
                  <th scope="col" className="px-4 py-3 font-medium">Record ID</th>
                  <th scope="col" className="px-4 py-3 font-medium">Action</th>
                  <th scope="col" className="px-4 py-3 font-medium">Actor</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-border/60 transition-colors hover:bg-surface/40"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                      {formatDateTime(row.changedAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink">
                      {row.tableName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                      {row.recordId ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                          ACTION_TONE[row.action] ?? "bg-surface text-ink-muted"
                        }`}
                      >
                        {row.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.changedByName ? (
                        <div className="flex flex-col">
                          <span className="text-sm text-ink">
                            {row.changedByName}
                          </span>
                          {row.changedByEmail && (
                            <span className="font-mono text-[10px] text-ink-subtle">
                              {row.changedByEmail}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-ink-subtle">
                          system
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-ink-subtle">
              {t("admin.audit.pagination.label", {
                defaultValue: "Page {{page}} of {{totalPages}}",
                page,
                totalPages,
              })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("common.previous", { defaultValue: "Previous" })}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("common.next", { defaultValue: "Next" })}
              </Button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-xs font-medium uppercase tracking-wider text-ink-subtle"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
