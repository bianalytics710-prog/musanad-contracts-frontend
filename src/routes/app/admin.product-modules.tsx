/**
 * /app/admin/product-modules — Product Module Toggle screen.
 *
 * CR-X (v1.5): Lets platform admin enable / disable product bundles
 * (CLM / ECIP / PLATFORM) and individual modules within each bundle.
 *
 * Layout:
 *   H1 + subtitle
 *   Bundle card row (3 columns)
 *   Module catalog grouped by bundle (accordion per bundle)
 *
 * Permission gate: requires effectiveModules includes "admin" AND
 * role is "platform_admin" or "Super Admin".
 */
import { createFileRoute, Navigate } from "@tanstack/react-router";
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
} from "lucide-react";
import { toast } from "sonner";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
import { useAuthStore } from "@/store/auth.store";
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
  const user = useAuthStore((s) => s.user);
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

// ─── Bundle icon map ──────────────────────────────────────────────────────────

const BUNDLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  clm: Briefcase,
  ecip: Brain,
  platform: Shield,
};

const BUNDLE_ORDER = ["clm", "ecip", "platform"];

// ─── Confirmation dialog state ────────────────────────────────────────────────

interface ConfirmState {
  type: "bundle" | "module";
  targetKey: string;       // bundle code or module key
  targetLabel: string;
  isEnabling: boolean;
  affectedCount: number;   // children that will be disabled
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
  // Track pending toggles for optimistic updates. key → new value.
  const [optimisticModules, setOptimisticModules] = useState<Map<string, boolean>>(new Map());
  const [optimisticBundles, setOptimisticBundles] = useState<Map<string, boolean>>(new Map());

  // Resolve effective enabled states
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
      toast.success(
        t("admin.modules.toggleSuccess", { module: vars.key }),
      );
      setOptimisticModules((prev) => {
        const next = new Map(prev);
        next.delete(vars.key);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-modules"] });
    },
    onError: (err, vars) => {
      // Revert optimistic
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
      toast.success(
        t("admin.modules.toggleSuccess", { module: vars.code }),
      );
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
        // Show confirm
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

      // Optimistic flip + fire
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
      const newValue = !isEnabling; // module confirms are always "disabling"
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

  // ── Derived counts ─────────────────────────────────────────────────────────
  const totalEnabled = modules.filter((m) =>
    effectiveModuleEnabled(m.key, m.isEnabled),
  ).length;
  const totalModules = modules.length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto w-full max-w-[960px] space-y-6 p-6"
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
            {/* KPI strip */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/40 px-4 py-2 text-sm text-ink-muted">
              <Package className="h-4 w-4 shrink-0 text-gold" />
              <span>
                {t("admin.modules.modulesEnabled", {
                  count: totalEnabled,
                  defaultValue: `${totalEnabled} of ${totalModules} modules enabled`,
                })}
                {" "}
                <span className="text-ink-subtle">/ {totalModules}</span>
              </span>
            </div>

            {/* Bundle cards */}
            <section
              aria-label={t("admin.modules.title")}
              className="grid gap-4 sm:grid-cols-3"
            >
              {bundles.map((bundle) => {
                const BundleIcon = BUNDLE_ICONS[bundle.code] ?? Package;
                const bundleEnabled = effectiveBundleEnabled(bundle.code, bundle.isEnabled);
                const bundleMods = modules.filter(
                  (m) => m.bundleCode === bundle.code,
                );
                const enabledInBundle = bundleMods.filter((m) =>
                  effectiveModuleEnabled(m.key, m.isEnabled),
                ).length;

                return (
                  <BundleCard
                    key={bundle.code}
                    bundle={bundle}
                    icon={BundleIcon}
                    isEnabled={bundleEnabled}
                    enabledModules={enabledInBundle}
                    totalModules={bundleMods.length}
                    onToggle={handleBundleToggle}
                  />
                );
              })}
            </section>

            {/* Module catalog grouped by bundle */}
            <section aria-label="Module catalog" className="space-y-3">
              {bundles.map((bundle) => {
                const bundleMods = modules.filter(
                  (m) => m.bundleCode === bundle.code,
                );
                const isExpanded = expandedBundles.has(bundle.code);
                const bundleEnabled = effectiveBundleEnabled(bundle.code, bundle.isEnabled);

                return (
                  <div
                    key={bundle.code}
                    className="overflow-hidden rounded-lg border border-border bg-card"
                  >
                    {/* Accordion header */}
                    <button
                      type="button"
                      onClick={() => toggleBundleExpand(bundle.code)}
                      aria-expanded={isExpanded}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface/40"
                    >
                      <span className="font-medium text-ink">
                        {t(
                          `admin.modules.bundle.${bundle.code}.label`,
                          { defaultValue: bundle.code.toUpperCase() },
                        )}
                      </span>
                      <div className="flex items-center gap-2 text-sm text-ink-muted">
                        <span>
                          {bundleMods.filter((m) =>
                            effectiveModuleEnabled(m.key, m.isEnabled),
                          ).length}
                          /{bundleMods.length}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </button>

                    {/* Module rows */}
                    {isExpanded && (
                      <div className="divide-y divide-border/60 border-t border-border">
                        {bundleMods.map((mod) => {
                          const isParent = bundleMods.some(
                            (m) => m.parentKey === mod.key,
                          );
                          const isChild = mod.parentKey !== null;
                          const isEnabled = effectiveModuleEnabled(
                            mod.key,
                            mod.isEnabled,
                          );
                          return (
                            <ModuleRow
                              key={mod.key}
                              mod={mod}
                              isEnabled={isEnabled}
                              isParent={isParent}
                              isChild={isChild}
                              bundleEnabled={bundleEnabled}
                              onToggle={handleModuleToggle}
                            />
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
            setConfirmState((prev) => prev ? { ...prev, reason } : null)
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
  isEnabled,
  enabledModules,
  totalModules,
  onToggle,
}: {
  bundle: ProductBundle;
  icon: React.ComponentType<{ className?: string }>;
  isEnabled: boolean;
  enabledModules: number;
  totalModules: number;
  onToggle: (bundle: ProductBundle) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={`relative flex flex-col rounded-lg border bg-card p-5 transition-colors ${
        isEnabled ? "border-border" : "border-border/40 opacity-70"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <BundleIcon className="h-6 w-6 shrink-0 text-gold" aria-hidden />
        {bundle.isCore ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="flex cursor-default items-center gap-1 rounded bg-surface/60 px-2 py-0.5 text-xs text-ink-subtle"
                aria-label={t("admin.modules.coreLockTooltip", {
                  defaultValue: "Always enabled (platform infrastructure)",
                })}
              >
                <Lock className="h-3 w-3" />
              </span>
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
      <p className="font-medium text-ink">
        {t(`admin.modules.bundle.${bundle.code}.label`, {
          defaultValue: bundle.code.toUpperCase(),
        })}
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        {enabledModules} / {totalModules}{" "}
        {t("admin.modules.modulesEnabled", {
          count: enabledModules,
          defaultValue: `${enabledModules} modules enabled`,
        })}
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
      className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface/30 ${
        isChild ? "ps-8" : ""
      }`}
    >
      {/* Child connector visual */}
      {isChild && (
        <span
          className="me-1 h-3 w-px shrink-0 self-start border-s border-dashed border-border"
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
                <span
                  className="flex cursor-default items-center gap-1 rounded bg-surface/60 px-1.5 py-0.5 text-xs text-ink-subtle"
                  aria-label={t("admin.modules.coreLockTooltip")}
                >
                  <Lock className="h-2.5 w-2.5" />
                </span>
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
          <p className="mt-0.5 font-mono text-[10px] text-ink-subtle">
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

  const title =
    state.type === "bundle"
      ? t("admin.modules.bundleConfirmDisable.title", {
          defaultValue: "Disable bundle?",
        })
      : t("admin.modules.moduleConfirmDisable.title", {
          defaultValue: "Disable module?",
        });

  // targetLabel is the i18n label_key (e.g. "admin.modules.bundle.ecip.label") —
  // translate it before interpolating so the modal shows "ECIP" not the raw key.
  const targetLabelText = t(state.targetLabel, { defaultValue: state.targetLabel });
  const body =
    state.type === "bundle"
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
          <Button variant="destructive" onClick={onConfirm}>
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
      {/* Bundle card skeletons */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      {/* Catalog skeletons */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
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
