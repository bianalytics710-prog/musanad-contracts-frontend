/**
 * Authenticated route — /app/dashboards/admin (S1).
 *
 * Admin / Super Admin admin dashboard (insights chart layout). Wraps in
 * ErrorBoundary (T11) and mounts the AICostPanel as an independent
 * sidebar widget per DASH-OI-G.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { AdminDashboard } from "@/features/dashboards/components/AdminDashboard";
import { AICostPanel } from "@/features/dashboards/components/AICostPanel";

export const Route = createFileRoute("/app/dashboards/admin")({
  component: AdminDashboardRoute,
});

function AdminDashboardRoute() {
  return (
    <ErrorBoundary>
      <div className="grid gap-6 px-2 lg:grid-cols-[2fr_1fr]">
        <AdminDashboard variant="insights" />
        <aside className="p-6">
          <AICostPanel variant="panel" />
        </aside>
      </div>
    </ErrorBoundary>
  );
}
