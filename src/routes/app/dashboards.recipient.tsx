/**
 * Authenticated route — /app/dashboards/recipient (S5).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { RecipientDashboard } from "@/features/dashboards/components/RecipientDashboard";

export const Route = createFileRoute("/app/dashboards/recipient")({
  component: RecipientDashboardRoute,
});

function RecipientDashboardRoute() {
  return (
    <ErrorBoundary>
      <RecipientDashboard />
    </ErrorBoundary>
  );
}
