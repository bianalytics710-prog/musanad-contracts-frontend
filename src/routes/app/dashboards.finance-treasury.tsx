/**
 * M15 / CR-G — Finance & Treasury dashboard route.
 * Path: /app/dashboards/finance-treasury
 * Permission: insights.finance_treasury (fallback: insights.executive, platform_admin, Super Admin)
 * T11: ErrorBoundary at route level.
 */
import { createFileRoute } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/common';
import { FinanceTreasuryDashboard } from '@/features/dashboards/components/FinanceTreasuryDashboard';

export const Route = createFileRoute('/app/dashboards/finance-treasury')({
  component: FinanceTreasuryDashboardRoute,
});

function FinanceTreasuryDashboardRoute() {
  return (
    <ErrorBoundary>
      <FinanceTreasuryDashboard />
    </ErrorBoundary>
  );
}
