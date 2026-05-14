/**
 * /app/admin/advisory-templates — outlet shim per TanStack file-based parent/child
 * pattern (memory feedback_playwright_e2e_real_walk.md). The list view lives at
 * admin.advisory-templates.index.tsx; the editor at admin.advisory-templates.$id.tsx.
 * Without an explicit <Outlet/> here, child routes do not mount.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/app/admin/advisory-templates')({
  component: () => <Outlet />,
});
