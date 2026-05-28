/**
 * /app/compliance/regulatory-cascade — layout/outlet route.
 *
 * CR-M — Labor-Law Cascade. Parent route that lets
 * `compliance.regulatory-cascade.index.tsx` (the list) and
 * `compliance.regulatory-cascade.$runId.tsx` (the run detail)
 * mount as sibling children under the same path segment.
 *
 * TanStack file-based routing lesson (CR-H): sibling files do not
 * auto-mount — the parent must render <Outlet />.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/app/compliance/regulatory-cascade')({
  component: () => <Outlet />,
});
