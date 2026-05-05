/**
 * Authenticated route — /app/dashboards/executive/anomalies (S8).
 *
 * Standalone history view for cached AI executive anomalies. Distinct
 * from the inline ExecutiveAnomaliesCard (S9) mounted inside the
 * ExecutiveDashboard — that one is the live regenerate UX (M4
 * mutation). This standalone route shows historical cache rows.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { ExecutiveAnomaliesHistoryCard } from "@/features/dashboards/components/ExecutiveAnomaliesHistoryCard";

export const Route = createFileRoute("/app/dashboards/executive/anomalies")({
  component: ExecutiveAnomaliesHistoryRoute,
});

function ExecutiveAnomaliesHistoryRoute() {
  return (
    <ErrorBoundary>
      <ExecutiveAnomaliesHistoryCard />
    </ErrorBoundary>
  );
}
