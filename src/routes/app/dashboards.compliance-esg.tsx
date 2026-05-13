/**
 * M15 / CR-G — Compliance & ESG dashboard route.
 * Path: /app/dashboards/compliance-esg
 * Permission: insights.compliance_esg (fallback: insights.executive, platform_admin, Super Admin)
 * T11: ErrorBoundary at route level.
 */
import { createFileRoute } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/common';
import { ComplianceEsgDashboard } from '@/features/dashboards/components/ComplianceEsgDashboard';

export const Route = createFileRoute('/app/dashboards/compliance-esg')({
  component: ComplianceEsgDashboardRoute,
});

function ComplianceEsgDashboardRoute() {
  return (
    <ErrorBoundary>
      <ComplianceEsgDashboard />
    </ErrorBoundary>
  );
}
