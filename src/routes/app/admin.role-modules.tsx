/**
 * /app/admin/role-modules — Role × Module access matrix.
 *
 * CR-X (v1.5): Lets platform admin override which modules each role can
 * access within the currently-enabled module set.
 *
 * Layout:
 *   H1 + subtitle + legend
 *   Filter bar (bundle chips + search + hide-disabled toggle)
 *   Sticky-header matrix table (roles × modules)
 *   Footer with matrix limitation note
 *
 * Permission gate: same as Product Modules screen.
 */
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Check,
  X,
  Bookmark,
  HelpCircle,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuthStore } from "@/store/auth.store";
import {
  adminModulesService,
  type RoleRef,
  type MatrixModule,
  type MatrixCell,
  type EffectiveState,
  type AccessSource,
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
  const user = useAuthStore((s) => s.user);
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

// ─── Tri-state cycle ──────────────────────────────────────────────────────────
// default-allow → explicit-deny → explicit-allow → default (cycle)
// default-deny  → explicit-allow → explicit-deny → default (cycle)

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
    return { isAllowed: null }; // clear override → revert to default
  }
  // default-deny
  return { isAllowed: true };
}

// ─── Role display order ───────────────────────────────────────────────────────

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

const BUNDLE_ORDER = ["clm", "ecip", "platform"];

// ─── Cell indicator ───────────────────────────────────────────────────────────

interface CellIndicatorProps {
  effectiveState: EffectiveState;
  source: AccessSource;
  isDisabledAtApp: boolean;
  ariaLabel: string;
  onClick: () => void;
}

function CellIndicator({
  effectiveState,
  source,
  isDisabledAtApp,
  ariaLabel,
  onClick,
}: CellIndicatorProps) {
  const { t } = useTranslation();
  const isAllow = effectiveState === "allow";
  const isExplicit = source === "explicit";

  const cellTitle = isDisabledAtApp
    ? t("admin.roleModules.disabledAtApp", {
        defaultValue: "Module disabled at app level",
      })
    : t("admin.roleModules.cellTooltip", {
        defaultValue: "Click to cycle: default → explicit deny → explicit allow → default",
      });

  let iconEl: React.ReactNode;
  if (isDisabledAtApp) {
    iconEl = (
      <span className="h-4 w-4 rounded bg-surface/40" aria-label={ariaLabel} />
    );
  } else if (isAllow) {
    iconEl = isExplicit ? (
      <span className="relative inline-flex">
        <Check className="h-4 w-4 text-blue-500" />
        <Bookmark className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 text-blue-400" />
      </span>
    ) : (
      <Check className="h-4 w-4 text-sage" />
    );
  } else {
    iconEl = isExplicit ? (
      <span className="relative inline-flex">
        <X className="h-4 w-4 text-terracotta" />
        <Bookmark className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 text-terracotta/80" />
      </span>
    ) : (
      <X className="h-3 w-3 text-ink-subtle/40" />
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={isDisabledAtApp ? undefined : onClick}
          disabled={isDisabledAtApp}
          className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-surface/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={ariaLabel}
          aria-pressed={isAllow}
        >
          {iconEl}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px]">
        {cellTitle}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

function RoleModulesView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [bundleFilter, setBundleFilter] = useState<string>("all");
  const [searchRaw, setSearch] = useState("");
  const search = useDeferredValue(searchRaw);
  const [hideDisabled, setHideDisabled] = useState(true);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-role-modules"],
    queryFn: () => adminModulesService.getRoleModuleMatrix(),
    staleTime: 30_000,
  });

  // ── Optimistic cell state ──────────────────────────────────────────────────
  // key: `${roleId}::${moduleKey}` → { effectiveState, source }
  const [optimisticCells, setOptimisticCells] = useState<
    Map<string, { effectiveState: EffectiveState; source: AccessSource }>
  >(new Map());

  const cellKey = (roleId: number, moduleKey: string) => `${roleId}::${moduleKey}`;

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
      toast.success(
        t("admin.roleModules.updateSuccess", {
          role: String(vars.roleId),
          module: vars.moduleKey,
          defaultValue: "Access updated.",
        }),
      );
      void queryClient.invalidateQueries({ queryKey: ["admin-role-modules"] });
    },
    onError: (err, vars) => {
      const k = cellKey(vars.roleId, vars.moduleKey);
      setOptimisticCells((prev) => {
        const next = new Map(prev);
        next.delete(k);
        return next;
      });
      toast.error(
        translateApiError(err, t, "admin.roleModules.updateFailed"),
      );
    },
  });

  // ── Cell click handler ────────────────────────────────────────────────────
  const handleCellClick = useCallback(
    (role: RoleRef, mod: MatrixModule, originalCell: MatrixCell | undefined) => {
      const current = effectiveCell(role.id, mod.key, originalCell);
      const { isAllowed } = nextCellState(current);

      // Compute optimistic next state
      let nextState: { effectiveState: EffectiveState; source: AccessSource };
      if (isAllowed === null) {
        // Reverted to default — peek at what default would be
        nextState = { effectiveState: current.effectiveState, source: "default" };
      } else {
        nextState = {
          effectiveState: isAllowed ? "allow" : "deny",
          source: "explicit",
        };
      }

      const k = cellKey(role.id, mod.key);
      setOptimisticCells((prev) => new Map(prev).set(k, nextState));

      patchMutation.mutate({
        roleId: role.id,
        moduleKey: mod.key,
        isAllowed,
      });
    },
    [effectiveCell, patchMutation],
  );

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

  const modules: MatrixModule[] = useMemo(() => {
    let mods = data?.modules ?? [];
    if (hideDisabled) mods = mods.filter((m) => m.isEnabledAtApp);
    if (bundleFilter !== "all") mods = mods.filter((m) => m.bundleCode === bundleFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      mods = mods.filter((m) =>
        m.key.toLowerCase().includes(q) ||
        m.labelKey.toLowerCase().includes(q),
      );
    }
    return mods.slice().sort((a, b) => {
      const ba = BUNDLE_ORDER.indexOf(a.bundleCode);
      const bb = BUNDLE_ORDER.indexOf(b.bundleCode);
      if (ba !== bb) return ba - bb;
      return a.key.localeCompare(b.key);
    });
  }, [data, hideDisabled, bundleFilter, search]);

  // Build matrix lookup: `${roleId}::${moduleKey}` → MatrixCell
  const cellMap = useMemo(() => {
    const m = new Map<string, MatrixCell>();
    for (const cell of data?.matrix ?? []) {
      m.set(cellKey(cell.roleId, cell.moduleKey), cell);
    }
    return m;
  }, [data]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto w-full max-w-[1400px] space-y-4 p-6"
      >
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-ink">
                {t("admin.roleModules.title", {
                  defaultValue: "Role × module access",
                })}
              </h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-ink-subtle hover:text-ink"
                    aria-label="Matrix limitations info"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[280px]">
                  {t("admin.roleModules.footnote", {
                    defaultValue:
                      "The matrix can hide a module from a role, but cannot grant a role access beyond its database-level defaults.",
                  })}
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {t("admin.roleModules.subtitle", {
                defaultValue:
                  "Override which modules each role can access within the enabled set.",
              })}
            </p>
          </div>
        </header>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface/30 px-4 py-2 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-sage" />
            {t("admin.roleModules.matrixLegend.defaultAllow", {
              defaultValue: "Default allow",
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <X className="h-3 w-3 text-ink-subtle/40" />
            {t("admin.roleModules.matrixLegend.defaultDeny", {
              defaultValue: "Default deny",
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="relative inline-flex">
              <Check className="h-3.5 w-3.5 text-blue-500" />
              <Bookmark className="absolute -right-1.5 -top-1.5 h-2 w-2 text-blue-400" />
            </span>
            {t("admin.roleModules.matrixLegend.explicitAllow", {
              defaultValue: "Explicit allow (override)",
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="relative inline-flex">
              <X className="h-3.5 w-3.5 text-terracotta" />
              <Bookmark className="absolute -right-1.5 -top-1.5 h-2 w-2 text-terracotta/80" />
            </span>
            {t("admin.roleModules.matrixLegend.explicitDeny", {
              defaultValue: "Explicit deny (override)",
            })}
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Bundle chips */}
          <div className="flex gap-1" role="group" aria-label="Filter by bundle">
            {(["all", "clm", "ecip", "platform"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setBundleFilter(f)}
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
                      : t("admin.roleModules.filterPlatform", {
                          defaultValue: "Platform",
                        })}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute start-2 h-3.5 w-3.5 text-ink-subtle" />
            <input
              type="search"
              value={searchRaw}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search", { defaultValue: "Search…" })}
              aria-label={t("common.search", { defaultValue: "Search" })}
              className="h-8 rounded-md border border-border bg-card ps-7 pe-2 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Hide-disabled toggle */}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
            <Switch
              checked={hideDisabled}
              onCheckedChange={setHideDisabled}
              aria-label={t("admin.roleModules.hideDisabled", {
                defaultValue: "Hide disabled modules",
              })}
            />
            {t("admin.roleModules.hideDisabled", {
              defaultValue: "Hide disabled modules",
            })}
          </label>
        </div>

        {isLoading ? (
          <MatrixSkeleton />
        ) : isError ? (
          <ErrorCard onRetry={refetch} />
        ) : roles.length === 0 || modules.length === 0 ? (
          <div
            role="status"
            className="rounded-lg border border-border bg-card p-12 text-center"
          >
            <p className="text-sm text-ink-muted">
              {t("admin.roleModules.noResults", {
                defaultValue: "No roles or modules match the current filter.",
              })}
            </p>
          </div>
        ) : (
          <MatrixGrid
            roles={roles}
            modules={modules}
            cellMap={cellMap}
            effectiveCell={effectiveCell}
            onCellClick={handleCellClick}
          />
        )}

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

// ─── Matrix grid ──────────────────────────────────────────────────────────────

function MatrixGrid({
  roles,
  modules,
  cellMap,
  effectiveCell,
  onCellClick,
}: {
  roles: RoleRef[];
  modules: MatrixModule[];
  cellMap: Map<string, MatrixCell>;
  effectiveCell: (
    roleId: number,
    moduleKey: string,
    original: MatrixCell | undefined,
  ) => { effectiveState: EffectiveState; source: AccessSource };
  onCellClick: (role: RoleRef, mod: MatrixModule, orig: MatrixCell | undefined) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table
        className="min-w-full text-sm"
        role="grid"
        aria-label={t("admin.roleModules.title", { defaultValue: "Role × module access" })}
      >
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border">
            {/* Top-left corner */}
            <th
              scope="col"
              className="sticky start-0 z-20 min-w-[160px] bg-card px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-subtle"
            >
              {t("admin.roles.headers.permission", { defaultValue: "Role" })}
            </th>
            {/* Module column headers — rotated */}
            {modules.map((mod) => {
              const label = t(`admin.modules.${mod.bundleCode}.${mod.key.replace(/\./g, "_")}`, {
                defaultValue: mod.key,
              });
              return (
                <th
                  key={mod.key}
                  scope="col"
                  className={`min-w-[40px] px-1 py-2 align-bottom ${
                    !mod.isEnabledAtApp ? "opacity-40" : ""
                  }`}
                >
                  <div
                    className="flex h-24 w-8 items-end justify-center"
                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                  >
                    <span
                      className="truncate text-[10px] font-medium uppercase tracking-wider text-ink-subtle"
                      title={label}
                    >
                      {label}
                    </span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr
              key={role.id}
              className="border-t border-border/60 transition-colors hover:bg-surface/30"
            >
              {/* Role label — sticky on scroll */}
              <td
                className="sticky start-0 z-10 bg-card px-4 py-2"
              >
                <span className="text-sm font-medium text-ink">
                  {role.label || role.name}
                </span>
              </td>
              {/* Cells */}
              {modules.map((mod) => {
                const k = `${role.id}::${mod.key}`;
                const originalCell = cellMap.get(k);
                const cell = effectiveCell(role.id, mod.key, originalCell);
                const ariaLabel = `${role.label ?? role.name} × ${mod.key}: ${cell.effectiveState} (${cell.source})`;

                return (
                  <td
                    key={mod.key}
                    className={`px-1 py-2 text-center ${
                      !mod.isEnabledAtApp ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex justify-center">
                      <CellIndicator
                        effectiveState={cell.effectiveState}
                        source={cell.source}
                        isDisabledAtApp={!mod.isEnabledAtApp}
                        ariaLabel={ariaLabel}
                        onClick={() => onCellClick(role, mod, originalCell)}
                      />
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function MatrixSkeleton() {
  return (
    <div
      className="space-y-2"
      aria-busy
      aria-label="Loading role module matrix"
    >
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

// ─── Error card ───────────────────────────────────────────────────────────────

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="rounded-lg border border-border bg-card p-12 text-center"
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
