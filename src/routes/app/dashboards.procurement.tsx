/**
 * M15 / CR-G — Procurement supplier-risk dashboard route.
 * Path: /app/dashboards/procurement
 * Permission: insights.procurement_supplier_risk
 * Accessible: contract_drafter, contract_approver, platform_admin, Super Admin
 * T11: ErrorBoundary at route level.
 *
 * CR-W: RequireModule gate — redirects to insights hub if dashboards.procurement
 * is not in the user's effectiveModules.
 */
import { createFileRoute } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/common';
import { ProcurementDashboard } from '@/features/dashboards/components/ProcurementDashboard';
import { RequireModule } from '@/components/routing/RequireModule';

export const Route = createFileRoute('/app/dashboards/procurement')({
  component: ProcurementDashboardRoute,
});

function ProcurementDashboardRoute() {
  return (
    <RequireModule moduleKey="dashboards.procurement">
      <ErrorBoundary>
        <ProcurementDashboard />
      </ErrorBoundary>
    </RequireModule>
  );
}
