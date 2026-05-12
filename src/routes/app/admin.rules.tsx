/**
 * /app/admin/rules — Outlet shim
 *
 * Renders the matched child route. List view lives in admin.rules.index.tsx
 * (exact /app/admin/rules); detail in admin.rules.$id.tsx
 * (/app/admin/rules/$id). Without this shim, TanStack file-based routing
 * treats admin.rules.tsx as a leaf and never descends into $id.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/app/admin/rules')({
  component: () => <Outlet />,
});
