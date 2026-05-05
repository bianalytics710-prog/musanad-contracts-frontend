/**
 * Authenticated route — /app/dashboards/approver (S3).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { ApproverDashboard } from "@/features/dashboards/components/ApproverDashboard";

export const Route = createFileRoute("/app/dashboards/approver")({
  component: ApproverDashboardRoute,
});

function ApproverDashboardRoute() {
  return (
    <ErrorBoundary>
      <ApproverDashboard />
    </ErrorBoundary>
  );
}
