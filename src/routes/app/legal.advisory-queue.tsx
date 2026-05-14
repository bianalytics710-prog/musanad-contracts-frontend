/**
 * /app/legal/advisory-queue — outlet shim per TanStack file-based parent/child
 * pattern (memory feedback_playwright_e2e_real_walk.md). The list view lives at
 * legal.advisory-queue.index.tsx; the detail view at legal.advisory-queue.$id.tsx.
 * Without an explicit <Outlet/> here, child routes do not mount.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/app/legal/advisory-queue')({
  component: () => <Outlet />,
});
