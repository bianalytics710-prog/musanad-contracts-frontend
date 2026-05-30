/**
 * /app/reports — outlet shim per TanStack file-based parent/child pattern
 * (memory feedback_playwright_e2e_real_walk.md). The library view lives at
 * reports.index.tsx; the run viewer at reports.runs.$runId.tsx.
 * Without an explicit <Outlet/> here, child routes do not mount.
 *
 * CR-W: RequireModule gate — redirects to insights hub if reports
 * is not in the user's effectiveModules.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { RequireModule } from '@/components/routing/RequireModule';

export const Route = createFileRoute('/app/reports')({
  component: () => (
    <RequireModule moduleKey="reports">
      <Outlet />
    </RequireModule>
  ),
});
