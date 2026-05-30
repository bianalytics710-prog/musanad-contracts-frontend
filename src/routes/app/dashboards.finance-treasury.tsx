/**
 * M15 / CR-G — Finance & Treasury dashboard route.
 * Path: /app/dashboards/finance-treasury
 * Permission: insights.finance_treasury (fallback: insights.executive, platform_admin, Super Admin)
 * T11: ErrorBoundary at route level.
 *
 * CR-W: RequireModule gate — redirects to insights hub if dashboards.finance_treasury
 * is not in the user's effectiveModules.
 */
import { createFileRoute } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/common';
import { FinanceTreasuryDashboard } from '@/features/dashboards/components/FinanceTreasuryDashboard';
import { RequireModule } from '@/components/routing/RequireModule';

export const Route = createFileRoute('/app/dashboards/finance-treasury')({
  component: FinanceTreasuryDashboardRoute,
});

function FinanceTreasuryDashboardRoute() {
  return (
    <RequireModule moduleKey="dashboards.finance_treasury">
      <ErrorBoundary>
        <FinanceTreasuryDashboard />
      </ErrorBoundary>
    </RequireModule>
  );
}
