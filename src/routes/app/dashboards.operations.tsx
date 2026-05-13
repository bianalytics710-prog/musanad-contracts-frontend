/**
 * M15 / CR-G — Operations & SLA dashboard route.
 * Path: /app/dashboards/operations
 * Permission: insights.operations (fallback: insights.executive, platform_admin, Super Admin)
 * T11: ErrorBoundary at route level.
 */
import { createFileRoute } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/common';
import { OperationsDashboard } from '@/features/dashboards/components/OperationsDashboard';

export const Route = createFileRoute('/app/dashboards/operations')({
  component: OperationsDashboardRoute,
});

function OperationsDashboardRoute() {
  return (
    <ErrorBoundary>
      <OperationsDashboard />
    </ErrorBoundary>
  );
}
