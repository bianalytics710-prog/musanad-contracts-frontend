/**
 * /app/admin/migration/batches — parent shim.
 */
import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/app/admin/migration/batches')({
  component: () => <Outlet />,
});
