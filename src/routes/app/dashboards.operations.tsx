/**
 * M15 / CR-G — Operations & SLA dashboard route.
 * Path: /app/dashboards/operations
 * Permission: insights.operations (fallback: insights.executive, platform_admin, Super Admin)
 * T11: ErrorBoundary at route level.
 *
 * CR-W: RequireModule gate — redirects to insights hub if dashboards.operations
 * is not in the user's effectiveModules.
 */
import { createFileRoute } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/common';
import { OperationsDashboard } from '@/features/dashboards/components/OperationsDashboard';
import { RequireModule } from '@/components/routing/RequireModule';

export const Route = createFileRoute('/app/dashboards/operations')({
  component: OperationsDashboardRoute,
});

function OperationsDashboardRoute() {
  return (
    <RequireModule moduleKey="dashboards.operations">
      <ErrorBoundary>
        <OperationsDashboard />
      </ErrorBoundary>
    </RequireModule>
  );
}
