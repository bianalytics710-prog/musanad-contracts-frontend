/**
 * /app/admin/demo — layout/outlet route for Demo Control Panel.
 *
 * Parent that lets admin.demo.index.tsx and admin.demo.purge.tsx mount as
 * siblings under the same path segment.
 *
 * CR-W: RequireModule gate — redirects to insights hub if the "demo_harness"
 * module is not in the user's effectiveModules.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { RequireModule } from '@/components/routing/RequireModule';

export const Route = createFileRoute('/app/admin/demo')({
  component: () => (
    <RequireModule moduleKey="demo_harness">
      <Outlet />
    </RequireModule>
  ),
});
