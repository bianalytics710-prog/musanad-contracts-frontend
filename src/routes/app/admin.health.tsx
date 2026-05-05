/**
 * Authenticated route — /app/admin/health (S12).
 *
 * Admin observability status page. Distinct from M0's public liveness
 * endpoint at /api/health (no version, no auth). This is admin-scoped
 * and gated on platform_admin / Super Admin role at the BE.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { AdminHealth } from "@/features/dashboards/components/AdminHealth";

export const Route = createFileRoute("/app/admin/health")({
  component: AdminHealthRoute,
});

function AdminHealthRoute() {
  return (
    <ErrorBoundary>
      <AdminHealth />
    </ErrorBoundary>
  );
}
