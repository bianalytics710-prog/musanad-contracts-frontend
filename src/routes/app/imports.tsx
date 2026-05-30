/**
 * /app/imports — layout/outlet route.
 *
 * Parent that lets imports.bulk.tsx, imports.manual-entries.tsx, and
 * imports.review-queue.tsx mount as children under the same path segment.
 *
 * TanStack file-based routing: sibling files do not auto-mount without a
 * parent that renders <Outlet />.
 *
 * CR-W: RequireModule gate — redirects to insights hub if the "imports"
 * module is not in the user's effectiveModules.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { RequireModule } from '@/components/routing/RequireModule';

export const Route = createFileRoute('/app/imports')({
  component: () => (
    <RequireModule moduleKey="imports">
      <Outlet />
    </RequireModule>
  ),
});
