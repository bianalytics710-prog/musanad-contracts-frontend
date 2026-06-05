/**
 * /app/admin/internal-systems — Platform Admin registry of internal-system
 * integrations (ERP / Finance / HRMS / CRM / etc.).
 *
 * Mirrors /app/admin/sources but for internal systems. 4-status tile strip
 * (healthy / degraded / failing / untested), filter row, list of cards.
 * "Add system" dialog + per-row Edit / Test connection / Deactivate.
 *
 * Gate: platform.integrations.manage.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Plus,
  Server,
  Wifi,
  Search,
  Trash2,
  Pencil,
} from "lucide-react";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import {
  adminInternalSystemsService,
  type InternalSystemRow,
  type InternalSystemKind,
  type InternalSystemStatus,
  type AuthMethod,
  type InternalSystemInput,
} from "@/services/api/admin-internal-systems.service";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/admin/internal-systems/")({
  component: () => (
    <ErrorBoundary>
      <InternalSystemsList />
    </ErrorBoundary>
  ),
});

const KIND_OPTIONS: InternalSystemKind[] = [
  "erp",
  "finance",
  "hrms",
  "crm",
  "itsm",
  "dms",
  "scm",
  "data_warehouse",
  "custom",
];

const STATUS_OPTIONS: InternalSystemStatus[] = [
  "untested",
  "healthy",
  "degraded",
  "failing",
  "unauthorised",
];

const AUTH_METHOD_OPTIONS: AuthMethod[] = [
  "none",
  "oauth2",
  "api_key",
  "basic",
  "saml",
  "certificate",
];

// Kind → friendly label (when no i18n key).
const KIND_LABEL: Record<InternalSystemKind, string> = {
  erp: "ERP",
  finance: "Finance",
  hrms: "HRMS",
  crm: "CRM",
  itsm: "ITSM",
  dms: "DMS",
  scm: "SCM",
  data_warehouse: "Data warehouse",
  custom: "Custom",
};

function InternalSystemsList() {
  const { t } = useTranslation();
  const canManage = useAuthStore(
    selectHasPermission("platform.integrations.manage"),
  );

  const [kind, setKind] = useState<InternalSystemKind | "">("");
  const [status, setStatus] = useState<InternalSystemStatus | "">("");
  const [search, setSearch] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [editRow, setEditRow] = useState<InternalSystemRow | null>(null);

  const params = useMemo(
    () => ({
      kind: kind || undefined,
      status: status || undefined,
      search: search.trim() || undefined,
    }),
    [kind, status, search],
  );

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["admin-internal-systems", params],
    queryFn: () => adminInternalSystemsService.list(params),
    enabled: canManage,
    staleTime: 30_000,
  });

  // Status roll-up for the tile strip.
  const counts = useMemo(() => {
    const c: Record<InternalSystemStatus, number> = {
      untested: 0,
      healthy: 0,
      degraded: 0,
      failing: 0,
      unauthorised: 0,
    };
    rows.forEach((r) => {
      c[r.lastStatus] = (c[r.lastStatus] ?? 0) + 1;
    });
    return c;
  }, [rows]);

  if (!canManage) {
    return (
      <div className="mx-auto w-full max-w-[1200px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t("common.accessDenied", { defaultValue: "Access denied" })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("admin.internalSystems.kicker", {
              defaultValue: "Platform configuration",
            })}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("admin.internalSystems.title", {
              defaultValue: "Internal systems",
            })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("admin.internalSystems.subtitle", {
              defaultValue:
                "Inventory of internal systems the platform connects to — ERP, Finance, HRMS, CRM, ITSM, and more. Add a system, configure its endpoint, and test the connection.",
            })}
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="me-1 h-4 w-4" />
          {t("admin.internalSystems.add", { defaultValue: "Add system" })}
        </Button>
      </header>

      {/* Status tile strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatusTile
          label={t("admin.internalSystems.status.healthy", { defaultValue: "Healthy" })}
          value={counts.healthy}
          tone="sage"
          icon={CheckCircle2}
        />
        <StatusTile
          label={t("admin.internalSystems.status.degraded", { defaultValue: "Degraded" })}
          value={counts.degraded}
          tone="amber"
          icon={AlertTriangle}
        />
        <StatusTile
          label={t("admin.internalSystems.status.failing", { defaultValue: "Failing" })}
          value={counts.failing}
          tone="terracotta"
          icon={XCircle}
        />
        <StatusTile
          label={t("admin.internalSystems.status.unauthorised", {
            defaultValue: "Unauthorised",
          })}
          value={counts.unauthorised}
          tone="terracotta"
          icon={XCircle}
        />
        <StatusTile
          label={t("admin.internalSystems.status.untested", { defaultValue: "Untested" })}
          value={counts.untested}
          tone="muted"
          icon={HelpCircle}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <div className="space-y-1">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("admin.internalSystems.filter.kind", { defaultValue: "Kind" })}
          </span>
          <select
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as InternalSystemKind | "")}
          >
            <option value="">{t("common.all", { defaultValue: "All" })}</option>
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("admin.internalSystems.filter.status", { defaultValue: "Status" })}
          </span>
          <select
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as InternalSystemStatus | "")}
          >
            <option value="">{t("common.all", { defaultValue: "All" })}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="relative min-w-[220px] flex-1 space-y-1">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("admin.internalSystems.filter.search", { defaultValue: "Search" })}
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.internalSystems.filter.searchPh", {
                defaultValue: "Search by code, name, or vendor…",
              })}
              className="ps-9"
            />
          </div>
        </div>
        <div className="ms-auto flex items-end">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("admin.internalSystems.total", { defaultValue: "Total" })}:{" "}
            <span className="font-semibold text-ink">{rows.length}</span>
          </span>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3" aria-busy>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-surface" aria-hidden />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-terracotta/40 bg-terracotta/5 p-6 text-center">
          <p className="text-sm text-terracotta">
            {t("admin.internalSystems.error.fetch", {
              defaultValue: "Failed to load internal systems.",
            })}
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <Server className="mx-auto mb-2 h-8 w-8 text-ink-subtle" />
          <p className="text-sm font-medium text-ink">
            {t("admin.internalSystems.empty.title", {
              defaultValue: "No internal systems configured",
            })}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {t("admin.internalSystems.empty.body", {
              defaultValue:
                "Add your first system — ERP / Finance / HRMS / CRM — to start tracking integrations.",
            })}
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <InternalSystemRowItem
                  key={row.id}
                  row={row}
                  onEdit={() => setEditRow(row)}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <SystemFormDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        existing={null}
      />
      <SystemFormDialog
        open={!!editRow}
        onClose={() => setEditRow(null)}
        existing={editRow}
      />
    </motion.div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────

function StatusTile({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "sage" | "amber" | "terracotta" | "muted";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const palette =
    tone === "sage"
      ? "bg-sage/10 text-sage border-sage/30"
      : tone === "amber"
        ? "bg-amber/10 text-amber-ink border-amber/30"
        : tone === "terracotta"
          ? "bg-terracotta/10 text-terracotta border-terracotta/30"
          : "bg-surface text-ink-muted border-border";
  return (
    <div className={cn("rounded-lg border p-3", palette)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="font-mono text-[10px] uppercase tracking-wider opacity-80">
          {label}
        </span>
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function InternalSystemRowItem({
  row,
  onEdit,
}: {
  row: InternalSystemRow;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const testMutation = useMutation({
    mutationFn: () => adminInternalSystemsService.testConnection(row.id),
    onSuccess: (res) => {
      const tone =
        res.probe.status === "healthy"
          ? "success"
          : res.probe.status === "unauthorised" || res.probe.status === "failing"
            ? "error"
            : "warning";
      const msg = `${row.displayName}: ${res.probe.status}${
        res.probe.httpStatus ? ` (HTTP ${res.probe.httpStatus})` : ""
      }${res.probe.error ? ` — ${res.probe.error}` : ""}`;
      if (tone === "success") toast.success(msg);
      else if (tone === "error") toast.error(msg);
      else toast.warning(msg);
      void qc.invalidateQueries({ queryKey: ["admin-internal-systems"] });
    },
    onError: () => {
      toast.error(
        t("admin.internalSystems.test.failed", {
          defaultValue: "Test failed — could not reach the system.",
        }),
      );
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => adminInternalSystemsService.deactivate(row.id),
    onSuccess: () => {
      toast.success(
        t("admin.internalSystems.deactivated", {
          defaultValue: "{{name}} deactivated.",
          name: row.displayName,
        }),
      );
      void qc.invalidateQueries({ queryKey: ["admin-internal-systems"] });
    },
  });

  return (
    <li className="flex items-center gap-3 p-4">
      <div className="rounded-md bg-gold/10 p-2">
        <Server className="h-5 w-5 text-gold" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-base font-semibold text-ink">
            {row.displayName}
          </p>
          <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
            {KIND_LABEL[row.kind]}
          </span>
          <StatusPill status={row.lastStatus} />
        </div>
        <p className="truncate font-mono text-[11px] text-ink-subtle">
          {row.systemCode}
          {row.vendor ? ` · ${row.vendor}` : ""}
          {row.baseUrl ? ` · ${row.baseUrl}` : ""}
        </p>
        {row.notes && (
          <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{row.notes}</p>
        )}
        {row.lastError && row.lastStatus !== "healthy" && (
          <p className="mt-1 text-[11px] text-terracotta">
            {t("admin.internalSystems.lastError", { defaultValue: "Last error" })}:{" "}
            {row.lastError}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending}
        >
          <Wifi className="me-1 h-3.5 w-3.5" />
          {testMutation.isPending
            ? t("admin.internalSystems.testing", { defaultValue: "Testing…" })
            : t("admin.internalSystems.test", { defaultValue: "Test" })}
        </Button>
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (
              confirm(
                t("admin.internalSystems.confirmDeactivate", {
                  defaultValue: "Deactivate {{name}}? You can re-add it later.",
                  name: row.displayName,
                }),
              )
            ) {
              deactivateMutation.mutate();
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: InternalSystemStatus }) {
  const palette =
    status === "healthy"
      ? "bg-sage/15 text-sage"
      : status === "degraded"
        ? "bg-amber/15 text-amber-ink"
        : status === "failing" || status === "unauthorised"
          ? "bg-terracotta/15 text-terracotta"
          : "bg-surface text-ink-muted";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        palette,
      )}
    >
      {status}
    </span>
  );
}

// ─── Form dialog ─────────────────────────────────────────────────────────

function deriveCode(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

function SystemFormDialog({
  open,
  onClose,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  existing: InternalSystemRow | null;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = !!existing;

  const [form, setForm] = useState<InternalSystemInput>(() =>
    existing
      ? {
          systemCode: existing.systemCode,
          displayName: existing.displayName,
          displayNameAr: existing.displayNameAr,
          kind: existing.kind,
          vendor: existing.vendor,
          baseUrl: existing.baseUrl,
          apiEndpoint: existing.apiEndpoint,
          authMethod: existing.authMethod,
          pullScheduleCron: existing.pullScheduleCron,
          notes: existing.notes,
        }
      : {
          systemCode: "",
          displayName: "",
          displayNameAr: null,
          kind: "erp",
          vendor: null,
          baseUrl: null,
          apiEndpoint: null,
          authMethod: "oauth2",
          pullScheduleCron: null,
          notes: null,
        },
  );

  // When `existing` flips, re-seed the form.
  // (Cheap reset; the dialog mounts/unmounts on parent toggle anyway.)
  useMemoSync(existing, setForm);

  const reset = () => {
    onClose();
    if (!isEdit) {
      setForm({
        systemCode: "",
        displayName: "",
        displayNameAr: null,
        kind: "erp",
        vendor: null,
        baseUrl: null,
        apiEndpoint: null,
        authMethod: "oauth2",
        pullScheduleCron: null,
        notes: null,
      });
    }
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      isEdit && existing
        ? adminInternalSystemsService.update(existing.id, form)
        : adminInternalSystemsService.create(form),
    onSuccess: () => {
      toast.success(
        isEdit
          ? t("admin.internalSystems.updated", {
              defaultValue: "{{name}} updated.",
              name: form.displayName,
            })
          : t("admin.internalSystems.created", {
              defaultValue: "{{name}} created.",
              name: form.displayName,
            }),
      );
      void qc.invalidateQueries({ queryKey: ["admin-internal-systems"] });
      reset();
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      const msg =
        e.response?.data?.error?.message ??
        e.message ??
        t("admin.internalSystems.saveFailed", {
          defaultValue: "Failed to save system.",
        });
      toast.error(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); }}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t("admin.internalSystems.dialog.editTitle", {
                  defaultValue: "Edit internal system",
                })
              : t("admin.internalSystems.dialog.addTitle", {
                  defaultValue: "Add internal system",
                })}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-ink-muted">
            <span>{t("admin.internalSystems.fields.displayName", { defaultValue: "Display name" })}</span>
            <Input
              value={form.displayName}
              onChange={(e) => {
                const v = e.target.value;
                setForm({
                  ...form,
                  displayName: v,
                  systemCode: isEdit ? form.systemCode : form.systemCode || deriveCode(v),
                });
              }}
              placeholder="SAP S/4HANA Finance"
            />
          </label>
          <label className="grid gap-1 text-xs text-ink-muted">
            <span>{t("admin.internalSystems.fields.systemCode", { defaultValue: "System code" })}</span>
            <Input
              value={form.systemCode}
              onChange={(e) => setForm({ ...form, systemCode: e.target.value })}
              placeholder="sap_s4_finance"
              disabled={isEdit}
            />
            <span className="text-[11px] text-ink-subtle">
              {isEdit
                ? t("admin.internalSystems.fields.codeImmutable", {
                    defaultValue: "Code is immutable after create.",
                  })
                : t("admin.internalSystems.fields.codeHelp", {
                    defaultValue: "Lowercase + underscores. Used as the FK target.",
                  })}
            </span>
          </label>
          <label className="grid gap-1 text-xs text-ink-muted">
            <span>{t("admin.internalSystems.fields.kind", { defaultValue: "Kind" })}</span>
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as InternalSystemKind })}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-ink-muted">
            <span>{t("admin.internalSystems.fields.vendor", { defaultValue: "Vendor" })}</span>
            <Input
              value={form.vendor ?? ""}
              onChange={(e) => setForm({ ...form, vendor: e.target.value || null })}
              placeholder="sap_s4 / workday / salesforce / …"
            />
          </label>
          <label className="grid gap-1 text-xs text-ink-muted sm:col-span-2">
            <span>{t("admin.internalSystems.fields.baseUrl", { defaultValue: "Base URL" })}</span>
            <Input
              value={form.baseUrl ?? ""}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value || null })}
              placeholder="https://s4hana-finance.adnoc.ae"
            />
          </label>
          <label className="grid gap-1 text-xs text-ink-muted sm:col-span-2">
            <span>{t("admin.internalSystems.fields.apiEndpoint", { defaultValue: "API endpoint" })}</span>
            <Input
              value={form.apiEndpoint ?? ""}
              onChange={(e) => setForm({ ...form, apiEndpoint: e.target.value || null })}
              placeholder="/sap/opu/odata/sap/API_JOURNAL_ENTRY"
            />
          </label>
          <label className="grid gap-1 text-xs text-ink-muted">
            <span>{t("admin.internalSystems.fields.authMethod", { defaultValue: "Auth method" })}</span>
            <select
              value={form.authMethod ?? "none"}
              onChange={(e) => setForm({ ...form, authMethod: e.target.value as AuthMethod })}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {AUTH_METHOD_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-ink-muted">
            <span>{t("admin.internalSystems.fields.cron", { defaultValue: "Pull schedule (cron)" })}</span>
            <Input
              value={form.pullScheduleCron ?? ""}
              onChange={(e) => setForm({ ...form, pullScheduleCron: e.target.value || null })}
              placeholder="0 */4 * * *"
            />
          </label>
          <label className="grid gap-1 text-xs text-ink-muted sm:col-span-2">
            <span>{t("admin.internalSystems.fields.notes", { defaultValue: "Notes" })}</span>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
              rows={2}
              className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
              placeholder="Owner, point-of-contact, scope of integration…"
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={reset} disabled={saveMutation.isPending}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={
              saveMutation.isPending ||
              !form.systemCode ||
              !form.displayName ||
              !form.kind
            }
          >
            {saveMutation.isPending
              ? t("common.saving", { defaultValue: "Saving…" })
              : isEdit
                ? t("common.save", { defaultValue: "Save" })
                : t("admin.internalSystems.dialog.create", {
                    defaultValue: "Create system",
                  })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Tiny utility to re-seed form state when `existing` swaps under the dialog.
// (React doesn't auto-reset useState on prop change; we do it explicitly.)
import { useEffect } from "react";
function useMemoSync(
  existing: InternalSystemRow | null,
  setForm: React.Dispatch<React.SetStateAction<InternalSystemInput>>,
) {
  useEffect(() => {
    if (existing) {
      setForm({
        systemCode: existing.systemCode,
        displayName: existing.displayName,
        displayNameAr: existing.displayNameAr,
        kind: existing.kind,
        vendor: existing.vendor,
        baseUrl: existing.baseUrl,
        apiEndpoint: existing.apiEndpoint,
        authMethod: existing.authMethod,
        pullScheduleCron: existing.pullScheduleCron,
        notes: existing.notes,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);
}
