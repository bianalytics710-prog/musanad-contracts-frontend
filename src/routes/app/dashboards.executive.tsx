/**
 * Authenticated route — /app/dashboards/executive (S7).
 *
 * S7 mounts the existing M4 ExecutiveAnomaliesCard inside the body of
 * ExecutiveDashboard (S9 closure). This route file only needs the
 * ErrorBoundary wrap.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { ExecutiveDashboard } from "@/features/dashboards/components/ExecutiveDashboard";

export const Route = createFileRoute("/app/dashboards/executive")({
  component: ExecutiveDashboardRoute,
});

function ExecutiveDashboardRoute() {
  return (
    <ErrorBoundary>
      <ExecutiveDashboard />
    </ErrorBoundary>
  );
}
