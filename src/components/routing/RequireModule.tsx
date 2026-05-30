/**
 * RequireModule — route-level guard for product module access.
 *
 * CR-W (v1.5 Product Module Toggle):
 * Reads `effectiveModules` from the persisted auth store.  If the requested
 * `moduleKey` (BE key space — e.g. "financial.budget_burn") is NOT in the
 * effective set, the user is redirected to `fallbackTo` (default: insights hub)
 * and shown a toast message.
 *
 * Apply at route-group parent level only — not at every child route.
 * Example:
 *   component: () => <RequireModule moduleKey="financial.budget_burn"><Outlet /></RequireModule>
 *
 * WCAG 2.1 AA: navigation is immediate (no visible delay), toast is assertive.
 */
import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuthStore, selectUser } from "@/store/auth.store";
import { BE_TO_FE_KEY } from "@/config/sidebar";
import type { ModuleKey } from "@/config/sidebar";

interface RequireModuleProps {
  /**
   * The module key to check. Accepts BOTH the BE key format (e.g.
   * "financial.budget_burn") and the FE ModuleKey format (e.g.
   * "financial.budgetBurn") — normalisation is applied internally.
   */
  moduleKey: string;
  children: ReactNode;
  /**
   * Where to redirect if the module is not available.
   * Defaults to the insights hub.
   */
  fallbackTo?: string;
}

/**
 * Normalise a module key from BE or FE format to the FE ModuleKey.
 * Looks up BE_TO_FE_KEY; if not found, passes through as-is.
 */
function normaliseKey(key: string): string {
  return (BE_TO_FE_KEY[key] as ModuleKey | undefined) ?? key;
}

export function RequireModule({
  moduleKey,
  children,
  fallbackTo = "/app/dashboards/insights",
}: RequireModuleProps) {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);

  // Normalise so both BE key ("financial.budget_burn") and FE key
  // ("financial.budgetBurn") are matched correctly.
  const normalisedKey = normaliseKey(moduleKey);

  // If effectiveModules is absent (pre-CR-V token or first hydration), allow
  // access — the route guard degrades gracefully.  The Axios interceptor will
  // catch any backend 404 MODULE_DISABLED that leaks through.
  const effectiveModules = user?.effectiveModules;
  if (!effectiveModules) {
    return <>{children}</>;
  }

  // Check both the raw key AND the normalised FE key against effectiveModules
  // (the BE sends BE keys; after normalisation we compare FE keys).
  const hasModule =
    effectiveModules.includes(moduleKey) ||
    effectiveModules.includes(normalisedKey) ||
    // Also check the reverse: if user passed a FE key, check its BE equivalent
    Object.entries(BE_TO_FE_KEY).some(
      ([beKey, feKey]) => feKey === normalisedKey && effectiveModules.includes(beKey),
    );

  if (!hasModule) {
    return <ModuleDisabledRedirect fallbackTo={fallbackTo} t={t} />;
  }

  return <>{children}</>;
}

/**
 * Fires the toast exactly once, then navigates.  Split into its own component
 * so the useEffect runs on mount (React strict-mode safe).
 */
function ModuleDisabledRedirect({
  fallbackTo,
  t,
}: {
  fallbackTo: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, opts?: any) => string;
}) {
  useEffect(() => {
    toast.warning(
      t("common.moduleDisabled", {
        defaultValue: "This module is not available for your account.",
      }),
    );
    // Only one toast per redirect — effect runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Navigate to={fallbackTo} replace />;
}

export default RequireModule;
