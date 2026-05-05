/**
 * Authenticated route — /app/admin (S13).
 *
 * Admin landing page — admin dashboard tile-grid variant. Reuses the same
 * GET /api/v1/dashboards/admin endpoint as S1 but renders a denser tile
 * grid optimised for quick navigation rather than the insights chart
 * layout.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { AdminDashboard } from "@/features/dashboards/components/AdminDashboard";

export const Route = createFileRoute("/app/admin/")({
  component: AdminLandingRoute,
});

function AdminLandingRoute() {
  return (
    <ErrorBoundary>
      <AdminDashboard variant="tile-grid" />
    </ErrorBoundary>
  );
}
