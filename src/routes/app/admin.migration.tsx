/**
 * M22 — parent route shim. TanStack Start requires this so child routes
 * /index, /connections, /batches mount via <Outlet />.
 */
import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/app/admin/migration')({
  component: () => <Outlet />,
});
