/**
 * /app/legal/advisory-queue — outlet shim per TanStack file-based parent/child
 * pattern (memory feedback_playwright_e2e_real_walk.md). The list view lives at
 * legal.advisory-queue.index.tsx; the detail view at legal.advisory-queue.$id.tsx.
 * Without an explicit <Outlet/> here, child routes do not mount.
 *
 * CR-W: RequireModule gate — redirects to insights hub if advisory_queue
 * is not in the user's effectiveModules.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { RequireModule } from '@/components/routing/RequireModule';

export const Route = createFileRoute('/app/legal/advisory-queue')({
  component: () => (
    <RequireModule moduleKey="advisory_queue">
      <Outlet />
    </RequireModule>
  ),
});
