/**
 * /app/risk-cases — outlet shim per TanStack file-based parent/child pattern
 * (memory feedback_playwright_e2e_real_walk.md). The list view lives at
 * risk-cases.index.tsx; the detail view at risk-cases.$caseId.tsx.
 * Without an explicit <Outlet/> here, child routes do not mount.
 *
 * CR-W: RequireModule gate — redirects to insights hub if risk_cases
 * is not in the user's effectiveModules.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { RequireModule } from '@/components/routing/RequireModule';

export const Route = createFileRoute('/app/risk-cases')({
  component: () => (
    <RequireModule moduleKey="risk_cases">
      <Outlet />
    </RequireModule>
  ),
});
