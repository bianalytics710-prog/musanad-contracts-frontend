/**
 * /app/admin/role-modules — Role × Module Access (v2 redesign).
 *
 * v2 (post-v1.5 UI polish): Two-pane Per-Role Detail (default) + Compare Grid.
 * Per-Role Detail: left rail role picker (grouped + search) + right pane
 * with sticky header, module bundle sections, state pills, clear/cycle actions.
 * Compare Grid: full matrix table with bundle groupings + CSV export.
 *
 * Permission gate: same as Product Modules screen.
 */
import { createFileRoute, Navigate } from "@tanstack/react-router";
import React, {
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Check,
  X,
  Search,
  ShieldCheck,
  Crown,
  PenLine,
  CheckCircle2,
  Inbox,
  LineChart,
  Wrench,
  Coins,
  Leaf,
  Package,
  User,
  Lock,
  Minus,
  Star,
  AlertTriangle,
  RefreshCw,
  Download,
  Briefcase,
  Brain,
  Shield,
  Layers,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthStore, readPersistedAuthSnapshot } from "@/store/auth.store";
import {
  adminModulesService,
  type RoleRef,
  type MatrixModule,
  type MatrixCell,
  type EffectiveState,
  type AccessSource,
  type ProductModule,
} from "@/services/api/admin-modules.service";
import { translateApiError } from "@/lib/translate-api-error";

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/app/admin/role-modules")({
  component: () => (
    <ErrorBoundary>
      <RoleModulesRoute />
    </ErrorBoundary>
  ),
});

// ─── Permission gate ──────────────────────────────────────────────────────────

function RoleModulesRoute() {
  // Race-proof: fall back to localStorage snapshot when Zustand persist
  // hasn't yet rehydrated on a cold page load.
  const storeUser = useAuthStore((s) => s.user);
  const user = storeUser ?? readPersistedAuthSnapshot()?.user ?? null;
  const roleName = user?.role?.name ?? "";
  const effectiveModules = user?.effectiveModules ?? [];

  const canAccess =
    effectiveModules.includes("admin") &&
    (roleName === "platform_admin" || roleName === "Super Admin");

  if (!canAccess) {
    return <Navigate to="/app/dashboards/insights" />;
  }
  return <RoleModulesView />;
}

// ─── Role metadata ────────────────────────────────────────────────────────────

const ROLE_DISPLAY_ORDER: Record<string, number> = {
  platform_admin: 1,
  "Super Admin": 2,
  contract_drafter: 10,
  contract_approver: 11,
  contract_approver_2: 12,
  contract_recipient: 13,
  legal_counsel: 14,
  executive: 20,
  operations: 30,
  finance_treasury: 31,
  compliance_esg: 32,
  procurement_supplier_risk: 33,
};

// Role display labels (human-readable)
const ROLE_LABEL: Record<string, string> = {
  "Super Admin": "Super Admin",
  platform_admin: "Platform Admin",
  contract_drafter: "Contract Drafter",
  contract_approver: "Contract Approver",
  contract_approver_2: "Contract Approver II",
  contract_recipient: "Contract Recipient",
  legal_counsel: "Legal Counsel",
  executive: "Executive",
  operations: "Operations",
  finance_treasury: "Finance & Treasury",
  compliance_esg: "Compliance & ESG",
  procurement_supplier_risk: "Procurement Risk",
};

// Role grouping
const PLATFORM_ADMIN_ROLES = new Set(["Super Admin", "platform_admin"]);
const CLM_PERSONA_ROLES = new Set([
  "contract_drafter",
  "contract_approver",
  "contract_approver_2",
  "contract_recipient",
  "legal_counsel",
]);
// ECIP: everyone else

function getRoleGroup(roleName: string): "platform" | "clm" | "ecip" {
  if (PLATFORM_ADMIN_ROLES.has(roleName)) return "platform";
  if (CLM_PERSONA_ROLES.has(roleName)) return "clm";
  return "ecip";
}

// Role tone (color) — same pattern as admin.users.tsx ROLE_TONE
const ROLE_TONE: Record<string, { bg: string; text: string; tile: string }> = {
  "Super Admin":              { bg: "bg-gold/10",        text: "text-gold",         tile: "bg-gold/15" },
  platform_admin:             { bg: "bg-terracotta/10",  text: "text-terracotta",   tile: "bg-terracotta/15" },
  legal_counsel:              { bg: "bg-amber/10",       text: "text-amber-ink",    tile: "bg-amber/15" },
  contract_drafter:           { bg: "bg-sage/10",        text: "text-sage",         tile: "bg-sage/15" },
  contract_approver:          { bg: "bg-plum/10",        text: "text-plum",         tile: "bg-plum-tint" },
  contract_approver_2:        { bg: "bg-plum/10",        text: "text-plum",         tile: "bg-plum-tint" },
  contract_recipient:         { bg: "bg-surface",        text: "text-ink-muted",    tile: "bg-surface" },
  executive:                  { bg: "bg-gold/10",        text: "text-gold",         tile: "bg-gold/15" },
  operations:                 { bg: "bg-sage/10",        text: "text-sage",         tile: "bg-sage/15" },
  finance_treasury:           { bg: "bg-amber/10",       text: "text-amber-ink",    tile: "bg-amber/15" },
  compliance_esg:             { bg: "bg-terracotta/10",  text: "text-terracotta",   tile: "bg-terracotta/15" },
  procurement_supplier_risk:  { bg: "bg-slate/10",       text: "text-slate-ink",    tile: "bg-slate-tint" },
};

const ROLE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "Super Admin":              Crown,
  platform_admin:             ShieldCheck,
  legal_counsel:              Leaf,
  contract_drafter:           PenLine,
  contract_approver:          CheckCircle2,
  contract_approver_2:        CheckCircle2,
  contract_recipient:         Inbox,
  executive:                  LineChart,
  operations:                 Wrench,
  finance_treasury:           Coins,
  compliance_esg:             Leaf,
  procurement_supplier_risk:  Package,
};

function getRoleTone(name: string) {
  return ROLE_TONE[name] ?? { bg: "bg-surface", text: "text-ink-muted", tile: "bg-surface" };
}

function getRoleIcon(name: string): React.ComponentType<{ className?: string }> {
  return ROLE_ICON[name] ?? User;
}

function getRoleLabel(role: RoleRef): string {
  return ROLE_LABEL[role.name] ?? (role.label || role.name);
}

// ─── Bundle metadata ──────────────────────────────────────────────────────────

const BUNDLE_ORDER = ["clm", "ecip", "platform"];
const BUNDLE_LABELS: Record<string, string> = {
  clm: "CLM",
  ecip: "ECIP",
  platform: "Platform",
};
const BUNDLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  clm: Briefcase,
  ecip: Brain,
  platform: Shield,
};
const BUNDLE_TINT: Record<string, string> = {
  clm: "bg-gold-tint border-gold/20",
  ecip: "bg-sage-tint border-sage/20",
  platform: "bg-surface border-border",
};
const BUNDLE_ICON_COLOR: Record<string, string> = {
  clm: "text-gold",
  ecip: "text-sage",
  platform: "text-ink-muted",
};

// ─── Tri-state cycle ──────────────────────────────────────────────────────────

function nextCellState(
  current: { effectiveState: EffectiveState; source: AccessSource },
): { isAllowed: boolean | null } {
  if (current.source === "default" && current.effectiveState === "allow") {
    return { isAllowed: false };
  }
  if (current.source === "explicit" && current.effectiveState === "deny") {
    return { isAllowed: true };
  }
  if (current.source === "explicit" && current.effectiveState === "allow") {
    return { isAllowed: null };
  }
  return { isAllowed: true };
}

// ─── Status Pill ──────────────────────────────────────────────────────────────

interface StatusPillProps {
  effectiveState: EffectiveState;
  source: AccessSource;
  isDisabledAtApp: boolean;
  compact?: boolean;
}

function StatusPill({ effectiveState, source, isDisabledAtApp, compact }: StatusPillProps) {
  const { t } = useTranslation();

  if (isDisabledAtApp) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded border border-dashed border-border bg-surface/40 text-ink-subtle ${compact ? "px-1 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}
      >
        <Lock className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        {!compact && t("admin.roleModules.pill.disabledAtApp", { defaultValue: "Disabled at app level" })}
      </span>
    );
  }

  const isAllow = effectiveState === "allow";
  const isExplicit = source === "explicit";

  if (isAllow && !isExplicit) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded border border-sage/30 bg-sage-tint text-sage-ink ${compact ? "px-1 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}
      >
        <Check className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        {!compact && t("admin.roleModules.pill.defaultAllow", { defaultValue: "Default allow" })}
      </span>
    );
  }
  if (!isAllow && !isExplicit) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded border border-border bg-surface text-ink-subtle ${compact ? "px-1 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}
      >
        <Minus className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        {!compact && t("admin.roleModules.pill.defaultDeny", { defaultValue: "Default deny" })}
      </span>
    );
  }
  if (isAllow && isExplicit) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded border-2 border-gold font-medium text-gold ${compact ? "px-1 py-0.5 text-[10px] bg-gold/10" : "px-2 py-0.5 text-xs bg-gold-tint"}`}
      >
        <span className="relative inline-flex items-center">
          <Check className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
          <Star className="absolute -right-1.5 -top-1.5 h-2 w-2 fill-gold text-gold" />
        </span>
        {!compact && t("admin.roleModules.pill.overrideAllow", { defaultValue: "Override allow" })}
      </span>
    );
  }
  // explicit deny
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border-2 border-terracotta font-medium text-terracotta-ink ${compact ? "px-1 py-0.5 text-[10px] bg-terracotta/10" : "px-2 py-0.5 text-xs bg-terracotta-tint"}`}
    >
      <X className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {!compact && t("admin.roleModules.pill.overrideDeny", { defaultValue: "Override deny" })}
    </span>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

function RoleModulesView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"detail" | "grid">("detail");
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [roleSearchRaw, setRoleSearchRaw] = useState("");
  const roleSearch = useDeferredValue(roleSearchRaw);

  // Grid view filters
  const [gridBundleFilter, setGridBundleFilter] = useState<string>("all");
  const [gridHideDisabled, setGridHideDisabled] = useState(true);

  // Optimistic cell state
  const [optimisticCells, setOptimisticCells] = useState<
    Map<string, { effectiveState: EffectiveState; source: AccessSource }>
  >(new Map());

  const cellKey = (roleId: number, moduleKey: string) => `${roleId}::${moduleKey}`;

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-role-modules"],
    queryFn: () => adminModulesService.getRoleModuleMatrix(),
    staleTime: 30_000,
  });

  // Also load product module list for parent/child + displayOrder
  const { data: productData } = useQuery({
    queryKey: ["admin-modules"],
    queryFn: () => adminModulesService.getProductModuleList(),
    staleTime: 30_000,
  });

  // Build parent/child + displayOrder lookup from product modules
  const productModuleMap = useMemo((): Map<string, ProductModule> => {
    const m = new Map<string, ProductModule>();
    for (const pm of productData?.modules ?? []) {
      m.set(pm.key, pm);
    }
    return m;
  }, [productData]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const roles: RoleRef[] = useMemo(
    () =>
      (data?.roles ?? []).slice().sort(
        (a, b) =>
          (ROLE_DISPLAY_ORDER[a.name] ?? 99) -
          (ROLE_DISPLAY_ORDER[b.name] ?? 99),
      ),
    [data],
  );

  const allModules: MatrixModule[] = useMemo(
    () =>
      (data?.modules ?? []).slice().sort((a, b) => {
        const ba = BUNDLE_ORDER.indexOf(a.bundleCode);
        const bb = BUNDLE_ORDER.indexOf(b.bundleCode);
        if (ba !== bb) return ba - bb;
        const pmA = productModuleMap.get(a.key);
        const pmB = productModuleMap.get(b.key);
        return (pmA?.displayOrder ?? 999) - (pmB?.displayOrder ?? 999);
      }),
    [data, productModuleMap],
  );

  const cellMap = useMemo(() => {
    const m = new Map<string, MatrixCell>();
    for (const cell of data?.matrix ?? []) {
      m.set(cellKey(cell.roleId, cell.moduleKey), cell);
    }
    return m;
  }, [data]);

  const effectiveCell = useCallback(
    (
      roleId: number,
      moduleKey: string,
      original: MatrixCell | undefined,
    ): { effectiveState: EffectiveState; source: AccessSource } => {
      const k = cellKey(roleId, moduleKey);
      if (optimisticCells.has(k)) return optimisticCells.get(k)!;
      return {
        effectiveState: original?.effectiveState ?? "deny",
        source: original?.source ?? "default",
      };
    },
    [optimisticCells],
  );

  // ── Mutation ───────────────────────────────────────────────────────────────
  const patchMutation = useMutation({
    mutationFn: adminModulesService.patchRoleModuleAccess,
    onSuccess: (_, vars) => {
      const k = cellKey(vars.roleId, vars.moduleKey);
      setOptimisticCells((prev) => {
        const next = new Map(prev);
        next.delete(k);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-role-modules"] });
    },
    onError: (err, vars) => {
      const k = cellKey(vars.roleId, vars.moduleKey);
      setOptimisticCells((prev) => {
        const next = new Map(prev);
        next.delete(k);
        return next;
      });
      toast.error(translateApiError(err, t, "admin.roleModules.updateFailed"));
    },
  });

  // Simple checkbox toggle: flip between allow/deny. We always write an
  // explicit override so the user's intent is preserved; the "Reset to
  // defaults" button clears overrides en masse if they ever want to revert.
  const handleCellClick = useCallback(
    (role: RoleRef, mod: MatrixModule, originalCell: MatrixCell | undefined) => {
      if (!mod.isEnabledAtApp) return;
      const current = effectiveCell(role.id, mod.key, originalCell);
      const newAllowed = current.effectiveState !== "allow"; // flip
      const nextState: { effectiveState: EffectiveState; source: AccessSource } = {
        effectiveState: newAllowed ? "allow" : "deny",
        source: "explicit",
      };
      const k = cellKey(role.id, mod.key);
      setOptimisticCells((prev) => new Map(prev).set(k, nextState));
      patchMutation.mutate({ roleId: role.id, moduleKey: mod.key, isAllowed: newAllowed });
    },
    [effectiveCell, patchMutation],
  );

  const handleClearOverride = useCallback(
    (role: RoleRef, mod: MatrixModule, originalCell: MatrixCell | undefined) => {
      const current = effectiveCell(role.id, mod.key, originalCell);
      // Snap back to default
      const nextState: { effectiveState: EffectiveState; source: AccessSource } = {
        effectiveState: current.effectiveState,
        source: "default",
      };
      const k = cellKey(role.id, mod.key);
      setOptimisticCells((prev) => new Map(prev).set(k, nextState));
      patchMutation.mutate({ roleId: role.id, moduleKey: mod.key, isAllowed: null });
    },
    [effectiveCell, patchMutation],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-4 p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-[1400px] p-6">
        <ErrorCard onRetry={refetch} />
      </div>
    );
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto w-full max-w-[1400px] space-y-5 p-6"
      >
        {/* Header */}
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("admin.roleModules.title", { defaultValue: "Role × Module Access" })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("admin.roleModules.subtitle.v2", {
              defaultValue: "Choose a role to fine-tune which modules its users access.",
            })}
          </p>
        </header>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "detail" | "grid")}>
          <TabsList>
            <TabsTrigger value="detail">
              {t("admin.roleModules.tab.detail", { defaultValue: "Per-Role Detail" })}
            </TabsTrigger>
            <TabsTrigger value="grid">
              {t("admin.roleModules.tab.grid", { defaultValue: "Compare Grid" })}
            </TabsTrigger>
          </TabsList>

          {/* ── Per-Role Detail ─────────────────────────────────────────── */}
          <TabsContent value="detail" className="mt-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
              {/* Left rail */}
              <RoleRail
                roles={roles}
                allModules={allModules}
                cellMap={cellMap}
                effectiveCell={effectiveCell}
                selectedRoleId={selectedRoleId}
                onSelectRole={setSelectedRoleId}
                searchRaw={roleSearchRaw}
                onSearchChange={setRoleSearchRaw}
                deferredSearch={roleSearch}
              />

              {/* Right pane */}
              {selectedRole ? (
                <RoleDetailPane
                  role={selectedRole}
                  allModules={allModules}
                  productModuleMap={productModuleMap}
                  cellMap={cellMap}
                  effectiveCell={effectiveCell}
                  onCellClick={handleCellClick}
                  onClearOverride={handleClearOverride}
                  onResetDefaults={(role, overrideModuleKeys) => {
                    // Fire all clears sequentially using the real module objects
                    for (const key of overrideModuleKeys) {
                      const mod = allModules.find((m) => m.key === key);
                      if (!mod) continue;
                      const orig = cellMap.get(cellKey(role.id, key));
                      handleClearOverride(role, mod, orig);
                    }
                  }}
                  onGrantAllEnabled={(role, moduleKeys) => {
                    for (const key of moduleKeys) {
                      const orig = cellMap.get(cellKey(role.id, key));
                      const current = effectiveCell(role.id, key, orig);
                      if (current.effectiveState !== "allow") {
                        const nextState: { effectiveState: EffectiveState; source: AccessSource } = {
                          effectiveState: "allow",
                          source: "explicit",
                        };
                        const k = cellKey(role.id, key);
                        setOptimisticCells((prev) => new Map(prev).set(k, nextState));
                        patchMutation.mutate({ roleId: role.id, moduleKey: key, isAllowed: true });
                      }
                    }
                  }}
                />
              ) : (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-card p-16 text-center">
                  <div>
                    <Layers className="mx-auto mb-3 h-10 w-10 text-ink-subtle/40" />
                    <p className="text-sm text-ink-muted">
                      {t("admin.roleModules.detail.noRoleSelected", {
                        defaultValue: "Select a role from the list to begin.",
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Compare Grid ────────────────────────────────────────────── */}
          <TabsContent value="grid" className="mt-4">
            <CompareGrid
              roles={roles}
              allModules={allModules}
              productModuleMap={productModuleMap}
              cellMap={cellMap}
              effectiveCell={effectiveCell}
              onCellClick={handleCellClick}
              bundleFilter={gridBundleFilter}
              onBundleFilterChange={setGridBundleFilter}
              hideDisabled={gridHideDisabled}
              onHideDisabledChange={setGridHideDisabled}
            />
          </TabsContent>
        </Tabs>

        {/* Footnote */}
        <footer className="rounded-md border border-border/40 bg-surface/20 px-4 py-3 text-xs text-ink-subtle">
          <strong className="font-medium text-ink-muted">
            {t("common.note", { defaultValue: "Note" })}:
          </strong>{" "}
          {t("admin.roleModules.footnote", {
            defaultValue:
              "The matrix can hide a module from a role, but cannot grant a role access beyond its database-level defaults. Contact engineering for further customization.",
          })}
        </footer>
      </motion.div>
    </TooltipProvider>
  );
}

// ─── Role Rail ────────────────────────────────────────────────────────────────

interface RoleRailProps {
  roles: RoleRef[];
  allModules: MatrixModule[];
  cellMap: Map<string, MatrixCell>;
  effectiveCell: (roleId: number, moduleKey: string, original: MatrixCell | undefined) => { effectiveState: EffectiveState; source: AccessSource };
  selectedRoleId: number | null;
  onSelectRole: (id: number) => void;
  searchRaw: string;
  onSearchChange: (v: string) => void;
  deferredSearch: string;
}

function RoleRail({
  roles,
  allModules,
  cellMap,
  effectiveCell,
  selectedRoleId,
  onSelectRole,
  searchRaw,
  onSearchChange,
  deferredSearch,
}: RoleRailProps) {
  const { t } = useTranslation();

  const filteredRoles = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) => {
      const label = ROLE_LABEL[r.name] ?? r.label ?? r.name;
      return label.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
    });
  }, [roles, deferredSearch]);

  // Compute override counts per role
  const overrideCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const [k, cell] of cellMap.entries()) {
      if (cell.source === "explicit") {
        const roleId = parseInt(k.split("::")[0], 10);
        counts.set(roleId, (counts.get(roleId) ?? 0) + 1);
      }
    }
    return counts;
  }, [cellMap]);

  const groups = [
    {
      key: "platform" as const,
      labelKey: "admin.roleModules.group.platformAdmins",
      defaultLabel: "Platform admins",
      roles: filteredRoles.filter((r) => getRoleGroup(r.name) === "platform"),
    },
    {
      key: "clm" as const,
      labelKey: "admin.roleModules.group.clmPersonas",
      defaultLabel: "CLM personas",
      roles: filteredRoles.filter((r) => getRoleGroup(r.name) === "clm"),
    },
    {
      key: "ecip" as const,
      labelKey: "admin.roleModules.group.ecipPersonas",
      defaultLabel: "ECIP personas",
      roles: filteredRoles.filter((r) => getRoleGroup(r.name) === "ecip"),
    },
  ].filter((g) => g.roles.length > 0);

  return (
    <div className="sticky top-6 self-start">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Search */}
        <div className="border-b border-border p-3">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute start-2.5 h-3.5 w-3.5 text-ink-subtle" />
            <input
              type="search"
              value={searchRaw}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t("admin.roleModules.search.placeholder", { defaultValue: "Search role…" })}
              aria-label={t("admin.roleModules.search.placeholder", { defaultValue: "Search role" })}
              className="h-8 w-full rounded-md border border-border bg-surface/40 ps-8 pe-2 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Role list */}
        <div className="max-h-[calc(100vh-280px)] overflow-y-auto py-1" role="listbox" aria-label="Select a role">
          {filteredRoles.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-ink-subtle">
              {t("admin.roleModules.role.empty", {
                search: deferredSearch,
                defaultValue: `No roles match "${deferredSearch}".`,
              })}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.key}>
                <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                  {t(group.labelKey, { defaultValue: group.defaultLabel })}
                </p>
                {group.roles.map((role) => {
                  const tone = getRoleTone(role.name);
                  const RoleIcon = getRoleIcon(role.name);
                  const isSelected = role.id === selectedRoleId;
                  const overrides = overrideCounts.get(role.id) ?? 0;
                  const label = getRoleLabel(role);

                  return (
                    <button
                      key={role.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => onSelectRole(role.id)}
                      className={`flex w-full items-center gap-2.5 border-s-2 px-3 py-2 text-left transition-colors hover:bg-surface/60 ${
                        isSelected
                          ? "border-s-gold bg-gold/5 text-ink"
                          : "border-s-transparent text-ink-muted"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${tone.tile}`}
                      >
                        <RoleIcon className={`h-3.5 w-3.5 ${tone.text}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm font-medium ${isSelected ? "text-ink" : ""}`}>
                          {label}
                        </span>
                      </span>
                      {overrides > 0 && (
                        <span className="shrink-0 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-medium text-gold">
                          {overrides}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Role Detail Pane ─────────────────────────────────────────────────────────

interface ConfirmDialogState {
  kind: "reset" | "grantAll";
  role: RoleRef;
  count: number;
  overrideKeys?: string[];
  grantKeys?: string[];
}

interface RoleDetailPaneProps {
  role: RoleRef;
  allModules: MatrixModule[];
  productModuleMap: Map<string, ProductModule>;
  cellMap: Map<string, MatrixCell>;
  effectiveCell: (roleId: number, moduleKey: string, original: MatrixCell | undefined) => { effectiveState: EffectiveState; source: AccessSource };
  onCellClick: (role: RoleRef, mod: MatrixModule, original: MatrixCell | undefined) => void;
  onClearOverride: (role: RoleRef, mod: MatrixModule, original: MatrixCell | undefined) => void;
  onResetDefaults: (role: RoleRef, overrideKeys: string[]) => void;
  onGrantAllEnabled: (role: RoleRef, moduleKeys: string[]) => void;
}

function RoleDetailPane({
  role,
  allModules,
  productModuleMap,
  cellMap,
  effectiveCell,
  onCellClick,
  onClearOverride,
  onResetDefaults,
  onGrantAllEnabled,
}: RoleDetailPaneProps) {
  const { t } = useTranslation();
  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null);

  const tone = getRoleTone(role.name);
  const RoleIcon = getRoleIcon(role.name);
  const label = getRoleLabel(role);

  const cellKey = (roleId: number, moduleKey: string) => `${roleId}::${moduleKey}`;

  // Stats
  const { enabledCount, defaultCount, overrideCount, overrideKeys } = useMemo(() => {
    let enabled = 0;
    let def = 0;
    let ovr = 0;
    const ovrKeys: string[] = [];
    for (const mod of allModules) {
      const orig = cellMap.get(cellKey(role.id, mod.key));
      const cell = effectiveCell(role.id, mod.key, orig);
      if (cell.effectiveState === "allow") {
        enabled++;
        if (cell.source === "default") def++;
        else { ovr++; ovrKeys.push(mod.key); }
      } else if (cell.source === "explicit") {
        ovr++;
        ovrKeys.push(mod.key);
      }
    }
    return { enabledCount: enabled, defaultCount: def, overrideCount: ovr, overrideKeys: ovrKeys };
  }, [role.id, allModules, cellMap, effectiveCell]);

  // Modules grouped by bundle, with parent/child ordering
  const bundleGroups = useMemo(() => {
    return BUNDLE_ORDER.map((bundleCode) => {
      const bundleMods = allModules.filter((m) => m.bundleCode === bundleCode);
      // Sort: parents first, then children after their parent
      const parents = bundleMods.filter((m) => {
        const pm = productModuleMap.get(m.key);
        return !pm?.parentKey;
      });
      const children = bundleMods.filter((m) => {
        const pm = productModuleMap.get(m.key);
        return !!pm?.parentKey;
      });
      // Interleave children under their parent
      const ordered: MatrixModule[] = [];
      for (const parent of parents) {
        ordered.push(parent);
        for (const child of children) {
          const pm = productModuleMap.get(child.key);
          if (pm?.parentKey === parent.key) {
            ordered.push(child);
          }
        }
      }
      // Any orphan children (parent not in this bundle — shouldn't happen)
      for (const child of children) {
        if (!ordered.includes(child)) ordered.push(child);
      }

      const enabledInBundle = ordered.filter((m) => {
        const orig = cellMap.get(cellKey(role.id, m.key));
        return effectiveCell(role.id, m.key, orig).effectiveState === "allow";
      }).length;

      return { bundleCode, modules: ordered, enabledInBundle };
    }).filter((g) => g.modules.length > 0);
  }, [allModules, productModuleMap, role.id, cellMap, effectiveCell]);

  const handleReset = () => {
    if (overrideCount === 0) return;
    setConfirmState({
      kind: "reset",
      role,
      count: overrideCount,
      overrideKeys,
    });
  };

  const handleGrantAll = () => {
    const grantKeys = allModules
      .filter((m) => {
        if (!m.isEnabledAtApp) return false;
        const orig = cellMap.get(cellKey(role.id, m.key));
        return effectiveCell(role.id, m.key, orig).effectiveState !== "allow";
      })
      .map((m) => m.key);
    if (grantKeys.length === 0) {
      toast.info("All enabled modules are already allowed.");
      return;
    }
    setConfirmState({ kind: "grantAll", role, count: grantKeys.length, grantKeys });
  };

  // Bundle expand/collapse — default ALL COLLAPSED so the user picks
  // a bundle to drill into. Mirrors the product-modules screen pattern.
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());
  const toggleBundle = (code: string) =>
    setExpandedBundles((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  const expandAll = () => setExpandedBundles(new Set(bundleGroups.map((g) => g.bundleCode)));
  const collapseAll = () => setExpandedBundles(new Set());

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      {/* Sticky header strip — compact, fits 1280+ viewports cleanly */}
      <div className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 min-w-0">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone.tile}`}
            aria-hidden
          >
            <RoleIcon className={`h-5 w-5 ${tone.text}`} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-ink">{label}</h2>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              <span className="font-medium text-ink">{enabledCount}</span>
              <span className="text-ink-subtle"> of {allModules.length} modules · </span>
              <span>{defaultCount} default</span>
              {overrideCount > 0 ? (
                <>
                  <span className="text-ink-subtle"> · </span>
                  <span className="font-medium text-gold">{overrideCount} override{overrideCount === 1 ? "" : "s"}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={expandedBundles.size === bundleGroups.length ? collapseAll : expandAll}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-ink-muted transition-colors hover:bg-surface/60 hover:text-ink"
                  aria-label={expandedBundles.size === bundleGroups.length ? "Collapse all" : "Expand all"}
                >
                  <Layers className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {expandedBundles.size === bundleGroups.length ? "Collapse all" : "Expand all"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={overrideCount === 0}
                  aria-label={t("admin.roleModules.detail.resetAll", { defaultValue: "Reset" })}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {t("admin.roleModules.detail.resetAll", { defaultValue: "Reset" })}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={handleGrantAll}
                  aria-label={t("admin.roleModules.detail.grantAll", { defaultValue: "Enable all" })}
                  className="h-8 w-8 bg-gold p-0 text-white hover:bg-gold-hover"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {t("admin.roleModules.detail.grantAll", { defaultValue: "Enable all" })}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Bundle sections */}
      <div className="divide-y divide-border/40">
        {bundleGroups.map((group, gi) => {
          const BundleIcon = BUNDLE_ICONS[group.bundleCode] ?? Package;
          const bundleLabel = BUNDLE_LABELS[group.bundleCode] ?? group.bundleCode.toUpperCase();

          const isExpanded = expandedBundles.has(group.bundleCode);
          return (
            <motion.div
              key={group.bundleCode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: gi * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Bundle header — clickable to expand/collapse */}
              <button
                type="button"
                onClick={() => toggleBundle(group.bundleCode)}
                aria-expanded={isExpanded}
                aria-controls={`bundle-section-${group.bundleCode}`}
                className={`flex w-full items-center gap-2 px-5 py-3 text-left text-sm font-medium transition-colors hover:brightness-95 ${BUNDLE_TINT[group.bundleCode] ?? "bg-surface"}`}
              >
                <ChevronRight
                  className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  aria-hidden
                />
                <BundleIcon className={`h-4 w-4 ${BUNDLE_ICON_COLOR[group.bundleCode] ?? "text-ink-muted"}`} />
                <span className="text-ink">{bundleLabel}</span>
                <span className="ms-auto inline-flex items-center gap-1 text-xs">
                  <span className="font-medium text-ink">{group.enabledInBundle}</span>
                  <span className="text-ink-subtle">/ {group.modules.length}</span>
                </span>
              </button>

              {/* Module cards — collapsed by default */}
              {!isExpanded ? null : (
              <div id={`bundle-section-${group.bundleCode}`} className="divide-y divide-border/30">
                {group.modules.length === 0 ? (
                  <p className="px-5 py-3 text-xs italic text-ink-subtle">
                    {t("admin.roleModules.detail.noModulesInBundle", {
                      defaultValue: "No modules in this bundle for this role.",
                    })}
                  </p>
                ) : (
                  group.modules.map((mod, mi) => {
                    const pm = productModuleMap.get(mod.key);
                    const isChild = !!pm?.parentKey;
                    const parentPm = pm?.parentKey ? productModuleMap.get(pm.parentKey) : null;
                    const orig = cellMap.get(`${role.id}::${mod.key}`);
                    const cell = effectiveCell(role.id, mod.key, orig);
                    const isDisabledAtApp = !mod.isEnabledAtApp;
                    const hasOverride = cell.source === "explicit";

                    // Module label from i18n
                    const keySegs = mod.key.split(".");
                    const i18nKey = `admin.modules.${mod.bundleCode}.${keySegs.join("_").replace(/\./g, "_")}`;
                    const modLabel = t(i18nKey, { defaultValue: mod.key });
                    const parentLabel = parentPm
                      ? t(
                          `admin.modules.${mod.bundleCode}.${(pm?.parentKey ?? "").split(".").join("_").replace(/\./g, "_")}`,
                          { defaultValue: pm?.parentKey ?? "" },
                        )
                      : null;

                    return (
                      <motion.div
                        key={mod.key}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15, delay: Math.min(mi * 0.02, 0.3) }}
                        className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                          isDisabledAtApp ? "bg-surface/40" : "hover:bg-surface/40"
                        } ${isChild ? "ps-11" : ""}`}
                      >
                        {/* Child connector */}
                        {isChild && (
                          <span
                            className="me-1 h-4 w-px shrink-0 self-start border-s-2 border-dashed border-border"
                            aria-hidden
                          />
                        )}

                        {/* Label block */}
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${isDisabledAtApp ? "text-ink-subtle" : "text-ink"}`}>
                            {modLabel}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-ink-subtle">
                            {isChild && parentLabel
                              ? t("admin.roleModules.module.childOf", {
                                  parent: parentLabel,
                                  defaultValue: `Child of ${parentLabel}`,
                                })
                              : (pm?.sidebarPath ?? mod.key)}
                          </p>
                        </div>

                        {/* Simple Switch — ON = role has access, OFF = doesn't */}
                        <div className="flex shrink-0 items-center">
                          {isDisabledAtApp ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex h-5 w-5 items-center justify-center text-ink-subtle">
                                  <Lock className="h-3.5 w-3.5" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-xs">
                                {t("admin.roleModules.disabledAtApp", {
                                  defaultValue: "Module disabled at app level — toggle there first",
                                })}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Switch
                              checked={cell.effectiveState === "allow"}
                              onCheckedChange={() => onCellClick(role, mod, orig)}
                              aria-label={`${modLabel} access for ${label}`}
                            />
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Confirm modals */}
      {confirmState?.kind === "reset" && (
        <Dialog open onOpenChange={(open) => !open && setConfirmState(null)}>
          <DialogContent>
            <DialogHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-terracotta/10">
                <AlertTriangle className="h-5 w-5 text-terracotta" />
              </div>
              <DialogTitle>
                {t("admin.roleModules.confirmReset.title", { defaultValue: "Reset all overrides?" })}
              </DialogTitle>
              <DialogDescription>
                {t("admin.roleModules.confirmReset.body", {
                  count: confirmState.count,
                  role: getRoleLabel(confirmState.role),
                  defaultValue: `This will clear ${confirmState.count} explicit overrides for ${getRoleLabel(confirmState.role)} and restore default access. Continue?`,
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmState(null)}>
                {t("admin.modules.confirmCancel", { defaultValue: "Cancel" })}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirmState.overrideKeys) {
                    onResetDefaults(confirmState.role, confirmState.overrideKeys);
                    toast.success(
                      t("admin.roleModules.toast.resetDone", {
                        role: getRoleLabel(confirmState.role),
                        defaultValue: `Overrides cleared for ${getRoleLabel(confirmState.role)}.`,
                      }),
                    );
                  }
                  setConfirmState(null);
                }}
              >
                {t("admin.modules.confirmContinue", { defaultValue: "Continue" })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {confirmState?.kind === "grantAll" && (
        <Dialog open onOpenChange={(open) => !open && setConfirmState(null)}>
          <DialogContent>
            <DialogHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gold/10">
                <Check className="h-5 w-5 text-gold" />
              </div>
              <DialogTitle>
                {t("admin.roleModules.confirmGrant.title", { defaultValue: "Enable all modules for this role?" })}
              </DialogTitle>
              <DialogDescription>
                {t("admin.roleModules.confirmGrant.body", {
                  count: confirmState.count,
                  role: getRoleLabel(confirmState.role),
                  defaultValue: `This will explicitly allow access to ${confirmState.count} modules for ${getRoleLabel(confirmState.role)}. Continue?`,
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmState(null)}>
                {t("admin.modules.confirmCancel", { defaultValue: "Cancel" })}
              </Button>
              <Button
                className="bg-gold text-white hover:bg-gold-hover"
                onClick={() => {
                  if (confirmState.grantKeys) {
                    onGrantAllEnabled(confirmState.role, confirmState.grantKeys);
                    toast.success(
                      t("admin.roleModules.toast.grantAllDone", { /* keys unchanged for stability */
                        role: getRoleLabel(confirmState.role),
                        defaultValue: `Granting all enabled modules for ${getRoleLabel(confirmState.role)}.`,
                      }),
                    );
                  }
                  setConfirmState(null);
                }}
              >
                {t("admin.modules.confirmContinue", { defaultValue: "Continue" })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Compare Grid ─────────────────────────────────────────────────────────────

interface CompareGridProps {
  roles: RoleRef[];
  allModules: MatrixModule[];
  productModuleMap: Map<string, ProductModule>;
  cellMap: Map<string, MatrixCell>;
  effectiveCell: (roleId: number, moduleKey: string, original: MatrixCell | undefined) => { effectiveState: EffectiveState; source: AccessSource };
  onCellClick: (role: RoleRef, mod: MatrixModule, original: MatrixCell | undefined) => void;
  bundleFilter: string;
  onBundleFilterChange: (v: string) => void;
  hideDisabled: boolean;
  onHideDisabledChange: (v: boolean) => void;
}

function CompareGrid({
  roles,
  allModules,
  productModuleMap,
  cellMap,
  effectiveCell,
  onCellClick,
  bundleFilter,
  onBundleFilterChange,
  hideDisabled,
  onHideDisabledChange,
}: CompareGridProps) {
  const { t } = useTranslation();

  const cellKey = (roleId: number, moduleKey: string) => `${roleId}::${moduleKey}`;

  const filteredModules = useMemo(() => {
    let mods = allModules;
    if (hideDisabled) mods = mods.filter((m) => m.isEnabledAtApp);
    if (bundleFilter !== "all") mods = mods.filter((m) => m.bundleCode === bundleFilter);
    return mods;
  }, [allModules, hideDisabled, bundleFilter]);

  const handleDownloadCsv = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const header = ["Module", "Bundle", ...roles.map((r) => getRoleLabel(r))];
    const rows = filteredModules.map((mod) => {
      const cells = roles.map((role) => {
        const orig = cellMap.get(cellKey(role.id, mod.key));
        const cell = effectiveCell(role.id, mod.key, orig);
        if (!mod.isEnabledAtApp) return "disabled";
        const src = cell.source === "explicit" ? "override-" : "";
        return `${src}${cell.effectiveState}`;
      });
      return [mod.key, mod.bundleCode, ...cells];
    });

    const csv = [header, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t("admin.roleModules.grid.csvFilename", { defaultValue: "musanad-role-module-access" })}-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group modules by bundle
  const bundleGroups = BUNDLE_ORDER.map((bundleCode) => ({
    bundleCode,
    modules: filteredModules.filter((m) => m.bundleCode === bundleCode),
  })).filter((g) => g.modules.length > 0);

  // Bundle expand/collapse — default ALL COLLAPSED so the user picks
  // a bundle to drill into. (Matches the Per-Role Detail pattern.)
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());
  const toggleGridBundle = (code: string) =>
    setExpandedBundles((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  const allExpanded = expandedBundles.size === bundleGroups.length;
  const toggleAll = () =>
    setExpandedBundles(allExpanded ? new Set() : new Set(bundleGroups.map((g) => g.bundleCode)));

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1" role="group" aria-label="Filter by bundle">
          {(["all", "clm", "ecip", "platform"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onBundleFilterChange(f)}
              aria-pressed={bundleFilter === f}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                bundleFilter === f
                  ? "bg-gold text-white"
                  : "bg-surface text-ink-muted hover:bg-surface/80"
              }`}
            >
              {f === "all"
                ? t("admin.roleModules.filterAll", { defaultValue: "All bundles" })
                : f === "clm"
                  ? t("admin.roleModules.filterCLM", { defaultValue: "CLM" })
                  : f === "ecip"
                    ? t("admin.roleModules.filterECIP", { defaultValue: "ECIP" })
                    : t("admin.roleModules.filterPlatform", { defaultValue: "Platform" })}
            </button>
          ))}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
          <Switch
            checked={hideDisabled}
            onCheckedChange={onHideDisabledChange}
            aria-label={t("admin.roleModules.hideDisabled", { defaultValue: "Hide disabled modules" })}
          />
          {t("admin.roleModules.hideDisabled", { defaultValue: "Hide disabled modules" })}
        </label>

        <div className="ms-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleAll}
            className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface/60 hover:text-ink"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleDownloadCsv}
          >
            <Download className="h-3.5 w-3.5" />
            {t("admin.roleModules.grid.downloadCsv", { defaultValue: "Download CSV" })}
          </Button>
        </div>
      </div>

      {/* Grid table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table
          className="min-w-full text-sm"
          role="grid"
          aria-label={t("admin.roleModules.title", { defaultValue: "Role × Module Access" })}
        >
          <thead>
            <tr className="border-b border-border">
              {/* Module name col header */}
              <th
                scope="col"
                className="sticky start-0 z-20 min-w-[200px] border-e border-border bg-card px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-subtle"
              >
                {t("admin.roles.headers.permission", { defaultValue: "Module" })}
              </th>
              {/* Role column headers — persona avatar with initials + tooltip */}
              {roles.map((role) => {
                const tone = getRoleTone(role.name);
                const RoleIcon = getRoleIcon(role.name);
                const label = getRoleLabel(role);
                // 2-letter initials from the display label
                const initials = label
                  .split(/[\s&]+/)
                  .map((w) => w[0]?.toUpperCase() ?? "")
                  .join("")
                  .slice(0, 2);
                return (
                  <th
                    key={role.id}
                    scope="col"
                    className="min-w-[56px] bg-card px-2 py-3 align-middle"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone.tile}`}
                            aria-hidden
                          >
                            <RoleIcon className={`h-4 w-4 ${tone.text}`} />
                          </span>
                          <span className={`text-[10px] font-semibold tracking-wider ${tone.text}`}>
                            {initials}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {label}
                      </TooltipContent>
                    </Tooltip>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {bundleGroups.map((group) => {
              const BundleIcon = BUNDLE_ICONS[group.bundleCode] ?? Package;
              const bundleLabel = BUNDLE_LABELS[group.bundleCode] ?? group.bundleCode.toUpperCase();
              const isExpanded = expandedBundles.has(group.bundleCode);
              return (
                <React.Fragment key={`grid-bundle-${group.bundleCode}`}>
                  {/* Bundle section header row — clickable to toggle */}
                  <tr className="border-t border-border/40">
                    <td
                      colSpan={roles.length + 1}
                      className={`p-0 ${BUNDLE_TINT[group.bundleCode] ?? "bg-surface"}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleGridBundle(group.bundleCode)}
                        aria-expanded={isExpanded}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:brightness-95"
                      >
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          aria-hidden
                        />
                        <BundleIcon className={`h-3.5 w-3.5 ${BUNDLE_ICON_COLOR[group.bundleCode] ?? "text-ink-muted"}`} />
                        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                          {bundleLabel}
                        </span>
                        <span className="ms-auto text-[11px] text-ink-subtle">
                          {group.modules.length} module{group.modules.length === 1 ? "" : "s"}
                        </span>
                      </button>
                    </td>
                  </tr>
                  {/* Module rows — only when expanded */}
                  {isExpanded && group.modules.map((mod) => {
                    const pm = productModuleMap.get(mod.key);
                    const isChild = !!pm?.parentKey;
                    const keySegs = mod.key.split(".");
                    const i18nKey = `admin.modules.${mod.bundleCode}.${keySegs.join("_").replace(/\./g, "_")}`;
                    const modLabel = t(i18nKey, { defaultValue: mod.key });

                    return (
                      <tr
                        key={mod.key}
                        className="border-t border-border/30 hover:bg-surface/20 transition-colors"
                      >
                        {/* Module name — sticky */}
                        <td
                          className={`sticky start-0 z-10 border-e border-border bg-card px-4 py-2 ${
                            !mod.isEnabledAtApp ? "opacity-50" : ""
                          }`}
                        >
                          <span className={`text-sm ${isChild ? "ms-5" : ""} ${isChild ? "text-ink-muted" : "text-ink font-medium"}`}>
                            {modLabel}
                          </span>
                        </td>
                        {/* Role cells */}
                        {roles.map((role) => {
                          const orig = cellMap.get(cellKey(role.id, mod.key));
                          const cell = effectiveCell(role.id, mod.key, orig);
                          const ariaLabel = `${getRoleLabel(role)} × ${modLabel}: ${cell.effectiveState} (${cell.source})`;

                          return (
                            <td key={role.id} className="px-1 py-1 text-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex h-8 w-8 items-center justify-center">
                                    <Checkbox
                                      checked={cell.effectiveState === "allow"}
                                      onCheckedChange={
                                        mod.isEnabledAtApp
                                          ? () => onCellClick(role, mod, orig)
                                          : undefined
                                      }
                                      disabled={!mod.isEnabledAtApp}
                                      aria-label={ariaLabel}
                                    />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[200px]">
                                  <p className="text-xs">
                                    <strong>{getRoleLabel(role)}</strong> × <strong>{modLabel}</strong>
                                  </p>
                                  <p className="mt-0.5 text-xs text-ink-subtle">
                                    {cell.effectiveState} · {cell.source}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {filteredModules.length === 0 && (
          <div className="py-12 text-center text-sm text-ink-muted">
            {t("admin.roleModules.noResults", {
              defaultValue: "No roles or modules match the current filter.",
            })}
          </div>
        )}
      </div>

      {/* TODO: Bulk actions (v2) — apply override allow/deny to selected cells, clear selection */}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading role module matrix">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-5 w-96" />
      <Skeleton className="h-9 w-64" />
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Rail skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        {/* Pane skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-8 w-full" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Error card ───────────────────────────────────────────────────────────────

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="rounded-xl border border-border bg-card p-12 text-center"
    >
      <p className="text-sm text-ink-muted">
        {t("errors.generic", { defaultValue: "Something went wrong." })}
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        {t("common.retry", { defaultValue: "Retry" })}
      </Button>
    </div>
  );
}
