/**
 * Authenticated route — /app/admin/ai/cost-report (M4 — S12).
 *
 * Admin AI cost dashboard. 90-day max date range enforced server- and
 * client-side. Optional groupByUser drilldown.
 *
 * Permission: ai.observability.read (BE-enforced).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { AdminAICostDashboard } from "@/features/admin-ai/components/AdminAICostDashboard";

export const Route = createFileRoute("/app/admin/ai/cost-report")({
  component: AdminAiCostReportRoute,
});

function AdminAiCostReportRoute() {
  return (
    <ErrorBoundary>
      <AdminAICostDashboard />
    </ErrorBoundary>
  );
}
