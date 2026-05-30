/**
 * /app/admin/product-modules — Product Module Toggle screen (v2 polish).
 *
 * v2 (post-v1.5 UI polish):
 *   - KPI hero strip (3 stat-cards: modules enabled, bundles enabled, overrides)
 *   - Bundle cards: bigger icon tile, hover lift, PLATFORM "Always on" chip
 *   - Module catalog: tinted bundle headers, polished rows with route paths,
 *     parent-child connectors, framer-motion stagger
 *   - Confirm modal: icon at top (AlertTriangle / CheckCircle)
 *
 * Data layer, mutations, and optimistic updates are UNCHANGED from v1.5.
 *
 * Permission gate: requires effectiveModules includes "admin" AND
 * role is "platform_admin" or "Super Admin".
 */
import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Briefcase,
  Brain,
  Shield,
  Lock,
  ChevronDown,
  ChevronRight,
  Package,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useAuthStore, readPersistedAuthSnapshot } from "@/store/auth.store";
import {
  adminModulesService,
  type ProductBundle,
  type ProductModule,
} from "@/services/api/admin-modules.service";
import { translateApiError } from "@/lib/translate-api-error";

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/app/admin/product-modules")({
  component: () => (
    <ErrorBoundary>
      <ProductModulesRoute />
    </ErrorBoundary>
  ),
});

// ─── Permission gate ──────────────────────────────────────────────────────────

function ProductModulesRoute() {
  // Read both: in-memory store (live updates) AND localStorage snapshot
  // (race-proof on first render before Zustand persist hydrates).
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
  return <ProductModulesView />;
}

// ─── Bundle metadata ──────────────────────────────────────────────────────────

const BUNDLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  clm: Briefcase,
  ecip: Brain,
  platform: Shield,
};

const BUNDLE_ORDER = ["clm", "ecip", "platform"];

// Tinted tile colors for bundle icon backgrounds
const BUNDLE_TILE_BG: Record<string, string> = {
  clm: "bg-gold-tint",
  ecip: "bg-sage-tint",
  platform: "bg-surface",
};
const BUNDLE_ICON_COLOR: Record<string, string> = {
  clm: "text-gold",
  ecip: "text-sage",
  platform: "text-ink-muted",
};

// Tinted header band for module catalog groups
const BUNDLE_HEADER_BG: Record<string, string> = {
  clm: "bg-gold-tint border-gold/20",
  ecip: "bg-sage-tint border-sage/20",
  platform: "bg-surface border-border",
};

// ─── Confirmation dialog state ────────────────────────────────────────────────

interface ConfirmState {
  type: "bundle" | "module";
  targetKey: string;
  targetLabel: string;
  isEnabling: boolean;
  affectedCount: number;
  reason: string;
}

// ─── Main view ───────────────────────────────────────────────────────────────

function ProductModulesView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(
    new Set(["clm", "ecip", "platform"]),
  );

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-modules"],
    queryFn: () => adminModulesService.getProductModuleList(),
    staleTime: 30_000,
  });

  const bundles: ProductBundle[] = useMemo(
    () =>
      (data?.bundles ?? []).slice().sort(
        (a, b) => BUNDLE_ORDER.indexOf(a.code) - BUNDLE_ORDER.indexOf(b.code),
      ),
    [data],
  );

  const modules: ProductModule[] = useMemo(
    () =>
      (data?.modules ?? []).slice().sort(
        (a, b) => a.displayOrder - b.displayOrder,
      ),
    [data],
  );

  // ── Optimistic state ───────────────────────────────────────────────────────
  const [optimisticModules, setOptimisticModules] = useState<Map<string, boolean>>(new Map());
  const [optimisticBundles, setOptimisticBundles] = useState<Map<string, boolean>>(new Map());

  const effectiveModuleEnabled = useCallback(
    (key: string, original: boolean): boolean =>
      optimisticModules.has(key) ? optimisticModules.get(key)! : original,
    [optimisticModules],
  );
  const effectiveBundleEnabled = useCallback(
    (code: string, original: boolean): boolean =>
      optimisticBundles.has(code) ? optimisticBundles.get(code)! : original,
    [optimisticBundles],
  );

  // ── Mutations ──────────────────────────────────────────────────────────────
  const moduleMutation = useMutation({
    mutationFn: adminModulesService.patchModule,
    onSuccess: (_, vars) => {
      toast.success(t("admin.modules.toggleSuccess", { module: vars.key }));
      setOptimisticModules((prev) => {
        const next = new Map(prev);
        next.delete(vars.key);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-modules"] });
    },
    onError: (err, vars) => {
      setOptimisticModules((prev) => {
        const next = new Map(prev);
        next.delete(vars.key);
        return next;
      });
      toast.error(translateApiError(err, t, "admin.modules.toggleFailed"));
    },
  });

  const bundleMutation = useMutation({
    mutationFn: adminModulesService.patchBundle,
    onSuccess: (_, vars) => {
      toast.success(t("admin.modules.toggleSuccess", { module: vars.code }));
      setOptimisticBundles((prev) => {
        const next = new Map(prev);
        next.delete(vars.code);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-modules"] });
    },
    onError: (err, vars) => {
      setOptimisticBundles((prev) => {
        const next = new Map(prev);
        next.delete(vars.code);
        return next;
      });
      toast.error(translateApiError(err, t, "admin.modules.toggleFailed"));
    },
  });

  // ── Toggle handlers ────────────────────────────────────────────────────────
  const handleModuleToggle = useCallback(
    (mod: ProductModule) => {
      if (mod.isCore) return;
      const newValue = !effectiveModuleEnabled(mod.key, mod.isEnabled);
      const children = modules.filter((m) => m.parentKey === mod.key);
      const affectedCount = children.length;

      if (!newValue && affectedCount > 0) {
        setConfirmState({
          type: "module",
          targetKey: mod.key,
          targetLabel: mod.labelKey,
          isEnabling: false,
          affectedCount,
          reason: "",
        });
        return;
      }

      setOptimisticModules((prev) => new Map(prev).set(mod.key, newValue));
      moduleMutation.mutate({ key: mod.key, isEnabled: newValue });
    },
    [modules, effectiveModuleEnabled, moduleMutation],
  );

  const handleBundleToggle = useCallback(
    (bundle: ProductBundle) => {
      if (bundle.isCore) return;
      const newValue = !effectiveBundleEnabled(bundle.code, bundle.isEnabled);
      const bundleMods = modules.filter((m) => m.bundleCode === bundle.code);
      const affectedCount = bundleMods.length;

      setConfirmState({
        type: "bundle",
        targetKey: bundle.code,
        targetLabel: bundle.labelKey,
        isEnabling: newValue,
        affectedCount,
        reason: "",
      });
    },
    [modules, effectiveBundleEnabled],
  );

  const handleConfirm = useCallback(() => {
    if (!confirmState) return;
    const { type, targetKey, isEnabling, reason } = confirmState;

    if (type === "bundle") {
      setOptimisticBundles((prev) => new Map(prev).set(targetKey, isEnabling));
      bundleMutation.mutate({ code: targetKey, isEnabled: isEnabling, reason: reason || undefined });
    } else {
      const newValue = !isEnabling;
      setOptimisticModules((prev) => new Map(prev).set(targetKey, newValue));
      moduleMutation.mutate({ key: targetKey, isEnabled: newValue, reason: reason || undefined });
    }
    setConfirmState(null);
  }, [confirmState, bundleMutation, moduleMutation]);

  // ── Accordion toggle ───────────────────────────────────────────────────────
  const toggleBundleExpand = useCallback((code: string) => {
    setExpandedBundles((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  // ── Derived KPI counts ─────────────────────────────────────────────────────
  const totalEnabled = modules.filter((m) =>
    effectiveModuleEnabled(m.key, m.isEnabled),
  ).length;
  const totalModules = modules.length;

  const enabledBundlesCount = bundles.filter((b) =>
    b.isCore || effectiveBundleEnabled(b.code, b.isEnabled),
  ).length;
  const totalBundles = bundles.length;

  // Role-level overrides count — loaded from role-module matrix query if available
  // For now we use the admin-modules query data only — override count is approximate via data shape
  // We show a placeholder "role overrides" from the sibling screen
  const overrideCountPlaceholder = 0; // Actual count comes from role-module matrix

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden p-6"
      >
        {/* Header */}
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("admin.modules.title", { defaultValue: "Product modules" })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("admin.modules.subtitle", {
              defaultValue:
                "Enable or disable the product bundles and individual modules your customers see.",
            })}
          </p>
        </header>

        {isLoading ? (
          <LoadingSkeleton />
        ) : isError ? (
          <ErrorCard onRetry={refetch} />
        ) : (
          <>
            {/* KPI hero strip */}
            <section
              aria-label="Module statistics"
              className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            >
              {/* Modules enabled */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-1 rounded-lg border border-border bg-card p-5"
              >
                <span className="text-3xl font-bold tabular-nums text-ink">
                  {totalEnabled}
                  <span className="text-lg font-normal text-ink-subtle">/{totalModules}</span>
                </span>
                <span className="text-sm text-ink-muted">
                  {t("admin.modules.kpi.modulesEnabled", { defaultValue: "modules enabled" })}
                </span>
              </motion.div>

              {/* Bundles enabled */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-1 rounded-lg border border-border bg-card p-5"
              >
                <span className="text-3xl font-bold tabular-nums text-ink">
                  {enabledBundlesCount}
                  <span className="text-lg font-normal text-ink-subtle">/{totalBundles}</span>
                </span>
                <span className="text-sm text-ink-muted">
                  {t("admin.modules.kpi.bundlesEnabled", { defaultValue: "bundles enabled" })}
                </span>
              </motion.div>

              {/* Role overrides — links to role-modules screen */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-1 rounded-lg border border-border bg-card p-5"
              >
                <span className="text-3xl font-bold tabular-nums text-ink">
                  {overrideCountPlaceholder}
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-muted">
                    {t("admin.modules.kpi.overridesActive", { defaultValue: "role overrides active" })}
                  </span>
                  <Link
                    to="/app/admin/role-modules"
                    className="flex items-center gap-1 text-xs text-gold hover:text-gold-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    {t("admin.modules.kpi.viewOverrides", { defaultValue: "View overrides" })}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </motion.div>
            </section>

            {/* Bundle cards */}
            <section
              aria-label={t("admin.modules.title")}
              className="grid grid-cols-1 gap-4 md:grid-cols-3"
            >
              {bundles.map((bundle, i) => {
                const BundleIcon = BUNDLE_ICONS[bundle.code] ?? Package;
                const bundleEnabled = effectiveBundleEnabled(bundle.code, bundle.isEnabled);
                const bundleMods = modules.filter((m) => m.bundleCode === bundle.code);
                const enabledInBundle = bundleMods.filter((m) =>
                  effectiveModuleEnabled(m.key, m.isEnabled),
                ).length;

                return (
                  <motion.div
                    key={bundle.code}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <BundleCard
                      bundle={bundle}
                      icon={BundleIcon}
                      tileBg={BUNDLE_TILE_BG[bundle.code] ?? "bg-surface"}
                      iconColor={BUNDLE_ICON_COLOR[bundle.code] ?? "text-ink-muted"}
                      isEnabled={bundleEnabled}
                      enabledModules={enabledInBundle}
                      totalModules={bundleMods.length}
                      onToggle={handleBundleToggle}
                    />
                  </motion.div>
                );
              })}
            </section>

            {/* Module catalog grouped by bundle */}
            <section aria-label="Module catalog" className="space-y-3">
              {bundles.map((bundle) => {
                const bundleMods = modules.filter((m) => m.bundleCode === bundle.code);
                const isExpanded = expandedBundles.has(bundle.code);
                const bundleEnabled = effectiveBundleEnabled(bundle.code, bundle.isEnabled);
                const BundleIcon = BUNDLE_ICONS[bundle.code] ?? Package;
                const enabledInBundle = bundleMods.filter((m) =>
                  effectiveModuleEnabled(m.key, m.isEnabled),
                ).length;

                return (
                  <div
                    key={bundle.code}
                    className="overflow-hidden rounded-xl border border-border bg-card"
                  >
                    {/* Accordion header — tinted bundle band */}
                    <button
                      type="button"
                      onClick={() => toggleBundleExpand(bundle.code)}
                      aria-expanded={isExpanded}
                      className={`flex w-full items-center gap-3 border-b px-5 py-3.5 text-left transition-colors hover:brightness-95 ${BUNDLE_HEADER_BG[bundle.code] ?? "bg-surface border-border"}`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${BUNDLE_TILE_BG[bundle.code] ?? "bg-surface"}`}
                      >
                        <BundleIcon
                          className={`h-3.5 w-3.5 ${BUNDLE_ICON_COLOR[bundle.code] ?? "text-ink-muted"}`}
                        />
                      </span>
                      <span className="font-medium text-ink">
                        {t(`admin.modules.bundle.${bundle.code}.label`, {
                          defaultValue: bundle.code.toUpperCase(),
                        })}
                      </span>
                      <span className="ms-1 text-xs text-ink-subtle">
                        {enabledInBundle}/{bundleMods.length}
                      </span>
                      <span className="ms-auto">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-ink-subtle" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-ink-subtle" />
                        )}
                      </span>
                    </button>

                    {/* Module rows */}
                    {isExpanded && (
                      <div className="divide-y divide-border/40">
                        {bundleMods.map((mod, mi) => {
                          const isParent = bundleMods.some((m) => m.parentKey === mod.key);
                          const isChild = mod.parentKey !== null;
                          const isEnabled = effectiveModuleEnabled(mod.key, mod.isEnabled);
                          return (
                            <motion.div
                              key={mod.key}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{
                                duration: 0.15,
                                delay: Math.min(mi * 0.02, 0.4),
                              }}
                            >
                              <ModuleRow
                                mod={mod}
                                isEnabled={isEnabled}
                                isParent={isParent}
                                isChild={isChild}
                                bundleEnabled={bundleEnabled}
                                onToggle={handleModuleToggle}
                              />
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          </>
        )}
      </motion.div>

      {/* Confirm modal */}
      {confirmState && (
        <ConfirmDialog
          state={confirmState}
          onReasonChange={(reason) =>
            setConfirmState((prev) => (prev ? { ...prev, reason } : null))
          }
          onConfirm={handleConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </TooltipProvider>
  );
}

// ─── Bundle card ─────────────────────────────────────────────────────────────

function BundleCard({
  bundle,
  icon: BundleIcon,
  tileBg,
  iconColor,
  isEnabled,
  enabledModules,
  totalModules,
  onToggle,
}: {
  bundle: ProductBundle;
  icon: React.ComponentType<{ className?: string }>;
  tileBg: string;
  iconColor: string;
  isEnabled: boolean;
  enabledModules: number;
  totalModules: number;
  onToggle: (bundle: ProductBundle) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={`relative flex flex-col rounded-xl border bg-card p-5 transition-[box-shadow,border-color] hover:shadow-[0_20px_40px_-25px_rgb(0_0_0/0.15)] ${
        isEnabled ? "border-border" : "border-border/40 opacity-70"
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        {/* Bigger bundle icon in a 64px square tile */}
        <span
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl ${tileBg}`}
          aria-hidden
        >
          <BundleIcon className={`h-8 w-8 ${iconColor}`} />
        </span>
        {/* Toggle or "always on" chip */}
        {bundle.isCore ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                className="flex cursor-default items-center gap-1 border-amber/30 bg-amber-tint px-2 py-1 text-xs font-medium text-amber-ink"
                variant="outline"
              >
                <Lock className="h-3 w-3" />
                {t("admin.modules.bundle.alwaysOn", { defaultValue: "Always on" })}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {t("admin.modules.coreLockTooltip", {
                defaultValue: "Always enabled (platform infrastructure)",
              })}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Switch
            checked={isEnabled}
            onCheckedChange={() => onToggle(bundle)}
            aria-label={`Toggle bundle ${bundle.code}`}
          />
        )}
      </div>

      <p className="text-lg font-semibold text-ink">
        {t(`admin.modules.bundle.${bundle.code}.label`, {
          defaultValue: bundle.code.toUpperCase(),
        })}
      </p>
      <p className="mt-1 text-sm text-ink-muted">
        {enabledModules}/{totalModules}{" "}
        {t("admin.modules.kpi.modulesEnabled", { defaultValue: "modules enabled" })}
      </p>
    </div>
  );
}

// ─── Module row ───────────────────────────────────────────────────────────────

function ModuleRow({
  mod,
  isEnabled,
  isParent,
  isChild,
  bundleEnabled,
  onToggle,
}: {
  mod: ProductModule;
  isEnabled: boolean;
  isParent: boolean;
  isChild: boolean;
  bundleEnabled: boolean;
  onToggle: (mod: ProductModule) => void;
}) {
  const { t } = useTranslation();
  const keySegments = mod.key.split(".");
  const i18nKey = `admin.modules.${mod.bundleCode}.${keySegments
    .join("_")
    .replace(/\./g, "_")}`;

  const isDisabled = mod.isCore || !bundleEnabled;
  const label = t(i18nKey, { defaultValue: mod.key });

  return (
    <div
      className={`flex items-center gap-3 px-5 py-3 transition-colors ${
        isChild ? "ps-11" : ""
      } ${
        isDisabled
          ? "bg-surface/40"
          : "hover:bg-surface/60"
      }`}
    >
      {/* Child connector visual */}
      {isChild && (
        <span
          className="me-1 h-4 w-0.5 shrink-0 self-start border-s-2 border-dashed border-border"
          aria-hidden
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${
              isEnabled && bundleEnabled ? "text-ink" : "text-ink-muted"
            }`}
          >
            {label}
          </span>
          {mod.isCore && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="flex cursor-default items-center gap-1 border-border px-1.5 py-0.5 text-[10px] text-ink-subtle"
                  aria-label={t("admin.modules.coreLockTooltip")}
                >
                  <Lock className="h-2.5 w-2.5" />
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {t("admin.modules.coreLockTooltip", {
                  defaultValue: "Always enabled (platform infrastructure)",
                })}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {mod.sidebarPath && (
          <p className="mt-0.5 font-mono text-[11px] text-ink-subtle">
            {mod.sidebarPath}
          </p>
        )}
      </div>

      {isDisabled ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span aria-hidden tabIndex={-1}>
              <Switch
                checked={isEnabled}
                disabled
                aria-label={`${label} — ${t("admin.modules.coreLockTooltip")}`}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {mod.isCore
              ? t("admin.modules.coreLockTooltip", {
                  defaultValue: "Always enabled (platform infrastructure)",
                })
              : t("admin.modules.bundleDisabledFirst", {
                  defaultValue: "Enable the bundle first",
                })}
          </TooltipContent>
        </Tooltip>
      ) : (
        <Switch
          checked={isEnabled}
          onCheckedChange={() => onToggle(mod)}
          aria-label={`Toggle module ${label}`}
        />
      )}
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  state,
  onReasonChange,
  onConfirm,
  onCancel,
}: {
  state: ConfirmState;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  // Determine enable vs disable direction
  const isEnabling = state.type === "bundle" ? state.isEnabling : false; // module confirms are always disabling

  const title = isEnabling
    ? t("admin.modules.bundleConfirmEnable.title", { defaultValue: "Enable bundle?" })
    : state.type === "bundle"
      ? t("admin.modules.bundleConfirmDisable.title", { defaultValue: "Disable bundle?" })
      : t("admin.modules.moduleConfirmDisable.title", { defaultValue: "Disable module?" });

  // Translate the targetLabel (may be an i18n key like "admin.modules.bundle.ecip.label")
  const targetLabelText = t(state.targetLabel, { defaultValue: state.targetLabel });

  const body = isEnabling
    ? t("admin.modules.bundleConfirmEnable.body", {
        bundle: targetLabelText,
        count: state.affectedCount,
        defaultValue: `Enabling the ${targetLabelText} bundle will turn on ${state.affectedCount} modules. Continue?`,
      })
    : state.type === "bundle"
      ? t("admin.modules.bundleConfirmDisable.body", {
          bundle: targetLabelText,
          count: state.affectedCount,
          defaultValue: `Disabling the ${targetLabelText} bundle will turn off ${state.affectedCount} modules. Users will lose access to these features immediately. Continue?`,
        })
      : t("admin.modules.moduleConfirmDisable.body", {
          module: targetLabelText,
          count: state.affectedCount,
          defaultValue: `Disabling "${targetLabelText}" will also disable ${state.affectedCount} child modules. Continue?`,
        });

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          {/* Icon at top of modal */}
          <div
            className={`mb-3 flex h-11 w-11 items-center justify-center rounded-full ${
              isEnabling ? "bg-sage-tint" : "bg-terracotta/10"
            }`}
          >
            {isEnabling ? (
              <CheckCircle className="h-5 w-5 text-sage" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-terracotta" />
            )}
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>

        {/* Optional reason */}
        <div className="mt-1 space-y-1.5">
          <label
            htmlFor="toggle-reason"
            className="text-sm font-medium text-ink"
          >
            {t("admin.modules.reasonLabel", { defaultValue: "Reason (optional)" })}
          </label>
          <textarea
            id="toggle-reason"
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t("admin.modules.reasonPlaceholder", {
              defaultValue: "e.g., Customer pilot scope reduction",
            })}
            value={state.reason}
            onChange={(e) => onReasonChange(e.target.value)}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t("admin.modules.confirmCancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            variant={isEnabling ? "default" : "destructive"}
            className={isEnabling ? "bg-gold text-white hover:bg-gold-hover" : ""}
            onClick={onConfirm}
          >
            {t("admin.modules.confirmContinue", { defaultValue: "Continue" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading product modules">
      {/* KPI strip skeletons */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      {/* Bundle card skeletons */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
      {/* Catalog skeletons */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
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
