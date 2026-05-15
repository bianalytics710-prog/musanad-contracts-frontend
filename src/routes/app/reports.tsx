/**
 * /app/reports — outlet shim per TanStack file-based parent/child pattern
 * (memory feedback_playwright_e2e_real_walk.md). The library view lives at
 * reports.index.tsx; the run viewer at reports.runs.$runId.tsx.
 * Without an explicit <Outlet/> here, child routes do not mount.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/app/reports')({
  component: () => <Outlet />,
});
