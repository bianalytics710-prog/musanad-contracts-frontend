/**
 * Parent shim for /app/admin/industry-catalogs — renders the matching
 * child route (.index.tsx or .$industryId.tsx). Required for TanStack
 * Router file-based routing per feedback_playwright_e2e_real_walk note.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/app/admin/industry-catalogs')({
  component: () => <Outlet />,
});
