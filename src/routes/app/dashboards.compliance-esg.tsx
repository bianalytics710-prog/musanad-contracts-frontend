/**
 * M15 / CR-G — Compliance & ESG dashboard route.
 * Path: /app/dashboards/compliance-esg
 * Permission: insights.compliance_esg (fallback: insights.executive, platform_admin, Super Admin)
 * T11: ErrorBoundary at route level.
 *
 * CR-W: RequireModule gate — redirects to insights hub if dashboards.compliance_esg
 * is not in the user's effectiveModules.
 */
import { createFileRoute } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/common';
import { ComplianceEsgDashboard } from '@/features/dashboards/components/ComplianceEsgDashboard';
import { RequireModule } from '@/components/routing/RequireModule';

export const Route = createFileRoute('/app/dashboards/compliance-esg')({
  component: ComplianceEsgDashboardRoute,
});

function ComplianceEsgDashboardRoute() {
  return (
    <RequireModule moduleKey="dashboards.compliance_esg">
      <ErrorBoundary>
        <ComplianceEsgDashboard />
      </ErrorBoundary>
    </RequireModule>
  );
}
