/**
 * M15 / CR-G — Procurement supplier-risk dashboard route.
 * Path: /app/dashboards/procurement
 * Permission: insights.procurement_supplier_risk
 * Accessible: contract_drafter, contract_approver, platform_admin, Super Admin
 * T11: ErrorBoundary at route level.
 */
import { createFileRoute } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/common';
import { ProcurementDashboard } from '@/features/dashboards/components/ProcurementDashboard';

export const Route = createFileRoute('/app/dashboards/procurement')({
  component: ProcurementDashboardRoute,
});

function ProcurementDashboardRoute() {
  return (
    <ErrorBoundary>
      <ProcurementDashboard />
    </ErrorBoundary>
  );
}
