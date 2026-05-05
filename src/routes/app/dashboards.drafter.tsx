/**
 * Authenticated route — /app/dashboards/drafter (S2).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { DrafterDashboard } from "@/features/dashboards/components/DrafterDashboard";

export const Route = createFileRoute("/app/dashboards/drafter")({
  component: DrafterDashboardRoute,
});

function DrafterDashboardRoute() {
  return (
    <ErrorBoundary>
      <DrafterDashboard />
    </ErrorBoundary>
  );
}
