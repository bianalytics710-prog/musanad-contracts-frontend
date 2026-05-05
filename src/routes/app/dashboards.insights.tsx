/**
 * Authenticated route — /app/dashboards/insights (S6).
 *
 * Auto-redirect entry route. Calls GET /api/v1/dashboards/router and
 * navigates the user to the dashboard appropriate for their role.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { InsightsRouter } from "@/features/dashboards/components/InsightsRouter";

export const Route = createFileRoute("/app/dashboards/insights")({
  component: InsightsRouterRoute,
});

function InsightsRouterRoute() {
  return (
    <ErrorBoundary>
      <InsightsRouter />
    </ErrorBoundary>
  );
}
