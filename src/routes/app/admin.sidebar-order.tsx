/**
 * /app/admin/sidebar-order — Per-role sidebar module ordering (mig 539).
 *
 * Left rail: role picker (11 roles; platform_admin intentionally excluded).
 * Right pane: that role's currently-visible modules as an ordered list with
 * Up / Down arrow buttons. Save persists the full override map.
 *
 * Reset is per-role (clears that role's override entry).
 *
 * Gated by admin.sidebar.manage; non-managers see read-only banner.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUp,
  ArrowDown,
  Save,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import {
  sidebarOrderService,
  type SidebarOrderMap,
} from "@/services/api/sidebar-order.service";
import {
  modulesForRole,
  type AppRole,
  type ModuleKey,
  type SidebarModule,
} from "@/config/sidebar";

export const Route = createFileRoute("/app/admin/sidebar-order")({
  component: () => (
    <ErrorBoundary>
      <SidebarOrderPage />
    </ErrorBoundary>
  ),
});

/**
 * The 11 roles whose sidebars can be re-ordered. platform_admin is
 * deliberately omitted (HITL Q4 — 2026-06-04).
 */
const ROLE_PICKER: Array<{ name: AppRole; label: string }> = [
  { name: "Super Admin",              label: "Super Admin" },
  { name: "executive",                label: "Executive" },
  { name: "legal_counsel",            label: "Legal Counsel" },
  { name: "contract_drafter",         label: "Contract Drafter" },
  { name: "contract_approver",        label: "Contract Approver" },
  { name: "contract_approver_2",      label: "Contract Approver (2)" },
  { name: "contract_recipient",       label: "Contract Recipient" },
  { name: "operations",               label: "Operations" },
  { name: "finance_treasury",         label: "Finance & Treasury" },
  { name: "compliance_esg",           label: "Compliance & ESG" },
  { name: "procurement_supplier_risk", label: "Procurement & Supplier Risk" },
];

function SidebarOrderPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const canManage = useAuthStore(selectHasPermission("admin.sidebar.manage"));

  const { data: storedMap, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["sidebarRoleOrderAdmin"],
    queryFn: () => sidebarOrderService.getOrder(),
    staleTime: 30_000,
  });

  const [selectedRole, setSelectedRole] = useState<AppRole>(ROLE_PICKER[0].name);
  const [draft, setDraft] = useState<SidebarOrderMap | null>(null);

  useEffect(() => {
    if (storedMap && !draft) {
      setDraft({ ...storedMap });
    }
  }, [storedMap, draft]);

  /**
   * The ordered list of modules to render for the selected role.
   * Source of truth = ROLE_MODULES static fallback (only modules the role
   * currently has). If the role has an override, sort by that index;
   * unknown / new modules fall to the end in built-in displayOrder.
   */
  const orderedModules: SidebarModule[] = useMemo(() => {
    const base = modulesForRole(selectedRole);
    const override = draft?.[selectedRole] ?? [];
    if (override.length === 0) return base;
    const idx = new Map<string, number>();
    override.forEach((k, i) => idx.set(k, i));
    return [...base].sort((a, b) => {
      const ai = idx.has(a.key) ? (idx.get(a.key) as number) : Number.MAX_SAFE_INTEGER;
      const bi = idx.has(b.key) ? (idx.get(b.key) as number) : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.displayOrder - b.displayOrder;
    });
  }, [selectedRole, draft]);

  const dirty = useMemo(() => {
    if (!draft || !storedMap) return false;
    const keys = new Set([...Object.keys(draft), ...Object.keys(storedMap)]);
    for (const k of keys) {
      const a = draft[k] ?? [];
      const b = storedMap[k] ?? [];
      if (a.length !== b.length) return true;
      for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return true;
      }
    }
    return false;
  }, [draft, storedMap]);

  const saveMutation = useMutation({
    mutationFn: (next: SidebarOrderMap) => sidebarOrderService.setOrder(next),
    onSuccess: () => {
      toast.success(
        t("admin.sidebarOrder.saved", { defaultValue: "Sidebar order saved." }),
      );
      void qc.invalidateQueries({ queryKey: ["sidebarRoleOrderAdmin"] });
      void qc.invalidateQueries({ queryKey: ["sidebarRoleOrderMap"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = (from: number, to: number) => {
    if (!draft) return;
    const current = orderedModules.map((m) => m.key);
    if (to < 0 || to >= current.length) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDraft({ ...draft, [selectedRole]: next });
  };

  const handleSave = () => {
    if (!draft) return;
    saveMutation.mutate(draft);
  };

  const handleResetRole = () => {
    if (!draft) return;
    const next = { ...draft };
    delete next[selectedRole];
    setDraft(next);
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1100px] space-y-4 p-6">
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
          <div className="h-96 animate-pulse rounded-lg border border-border bg-card" />
          <div className="h-96 animate-pulse rounded-lg border border-border bg-card" />
        </div>
      </div>
    );
  }

  if (isError || !draft) {
    return (
      <div className="mx-auto w-full max-w-[820px] p-6">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {(error as Error)?.message ?? t("common.error")}
          </p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()} className="mt-2">
            {t("common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const hasOverride = (draft[selectedRole]?.length ?? 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1100px] space-y-5 p-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink">
            <SlidersHorizontal className="h-6 w-6 text-gold" aria-hidden />
            {t("admin.sidebarOrder.title", { defaultValue: "Sidebar order" })}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            {t("admin.sidebarOrder.intro", {
              defaultValue:
                "Reorder the sidebar modules each role sees. Visibility is unchanged — this only affects the order in which already-visible modules appear.",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetRole}
            disabled={!canManage || !hasOverride}
          >
            <RotateCcw className="me-1.5 h-3.5 w-3.5" aria-hidden />
            {t("admin.sidebarOrder.resetRole", { defaultValue: "Reset this role" })}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!dirty || !canManage || saveMutation.isPending}
          >
            <Save className="me-1.5 h-3.5 w-3.5" aria-hidden />
            {saveMutation.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </header>

      {!canManage && (
        <p className="rounded-md border border-amber/40 bg-amber-tint/40 p-3 text-xs text-amber-ink">
          {t("admin.sidebarOrder.readOnly", {
            defaultValue:
              "You can view the current order but only platform admins can save changes (permission admin.sidebar.manage).",
          })}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
        {/* Left rail — role picker */}
        <nav
          aria-label={t("admin.sidebarOrder.rolePicker", { defaultValue: "Role" })}
          className="space-y-1 rounded-lg border border-border bg-card p-2"
        >
          <p className="px-2 pb-1 pt-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            {t("admin.sidebarOrder.rolePicker", { defaultValue: "Role" })}
          </p>
          {ROLE_PICKER.map((role) => {
            const selected = role.name === selectedRole;
            const overridden = (draft[role.name]?.length ?? 0) > 0;
            return (
              <button
                key={role.name}
                type="button"
                onClick={() => setSelectedRole(role.name)}
                className={
                  "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-start text-sm transition " +
                  (selected
                    ? "bg-gold/15 font-medium text-ink"
                    : "text-ink-muted hover:bg-muted/60 hover:text-ink")
                }
              >
                <span className="truncate">{role.label}</span>
                {overridden && (
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-gold"
                    aria-label={t("admin.sidebarOrder.customised", {
                      defaultValue: "Custom order applied",
                    })}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right pane — ordered module list */}
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">
                {ROLE_PICKER.find((r) => r.name === selectedRole)?.label}
              </h2>
              <p className="text-xs text-ink-muted">
                {orderedModules.length === 0
                  ? t("admin.sidebarOrder.empty", {
                      defaultValue: "This role has no sidebar modules.",
                    })
                  : t("admin.sidebarOrder.moduleCount", {
                      defaultValue: "{{n}} modules visible to this role",
                      n: orderedModules.length,
                    })}
              </p>
            </div>
            {hasOverride && (
              <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">
                {t("admin.sidebarOrder.customLabel", { defaultValue: "Custom order" })}
              </span>
            )}
          </div>

          <ol className="space-y-1.5">
            {orderedModules.map((mod, idx) => {
              const Icon = mod.icon;
              const labelKey = mod.labelKey;
              const def = mod.defaultLabel;
              return (
                <li
                  key={mod.key as ModuleKey}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-mono text-ink-muted">
                      {idx + 1}
                    </span>
                    <Icon className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                    <span className="truncate text-sm font-medium text-ink">
                      {t(labelKey, { defaultValue: def })}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(idx, idx - 1)}
                      disabled={!canManage || idx === 0}
                      aria-label={t("admin.sidebarOrder.moveUp", { defaultValue: "Move up" })}
                      className="rounded p-1.5 text-ink-muted transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, idx + 1)}
                      disabled={!canManage || idx === orderedModules.length - 1}
                      aria-label={t("admin.sidebarOrder.moveDown", { defaultValue: "Move down" })}
                      className="rounded p-1.5 text-ink-muted transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="pt-2 text-[11px] text-ink-muted">
            {t("admin.sidebarOrder.hint", {
              defaultValue:
                "Changes affect every user with this role on their next sign-in or sidebar refresh (cached 5 minutes).",
            })}
          </p>
        </section>
      </div>

    </motion.div>
  );
}
