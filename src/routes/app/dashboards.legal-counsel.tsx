/**
 * Authenticated route — /app/dashboards/legal-counsel (S4).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { LegalCounselDashboard } from "@/features/dashboards/components/LegalCounselDashboard";

export const Route = createFileRoute("/app/dashboards/legal-counsel")({
  component: LegalCounselDashboardRoute,
});

function LegalCounselDashboardRoute() {
  return (
    <ErrorBoundary>
      <LegalCounselDashboard />
    </ErrorBoundary>
  );
}
