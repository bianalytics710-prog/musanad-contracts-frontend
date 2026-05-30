/**
 * Authenticated route — /app/dashboards/executive (S7).
 *
 * S7 mounts the existing M4 ExecutiveAnomaliesCard inside the body of
 * ExecutiveDashboard (S9 closure). This route file only needs the
 * ErrorBoundary wrap.
 *
 * CR-W: RequireModule gate — redirects to insights hub if dashboards.executive
 * is not in the user's effectiveModules.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { ExecutiveDashboard } from "@/features/dashboards/components/ExecutiveDashboard";
import { RequireModule } from "@/components/routing/RequireModule";

export const Route = createFileRoute("/app/dashboards/executive")({
  component: ExecutiveDashboardRoute,
});

function ExecutiveDashboardRoute() {
  return (
    <RequireModule moduleKey="dashboards.executive">
      <ErrorBoundary>
        <ExecutiveDashboard />
      </ErrorBoundary>
    </RequireModule>
  );
}
