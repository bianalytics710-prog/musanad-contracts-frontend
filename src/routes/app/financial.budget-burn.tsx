/**
 * /app/financial/budget-burn — layout/outlet route.
 *
 * CR-N — M21 Financial Intelligence (Budget Burn).
 * Parent route that lets:
 *   financial.budget-burn.index.tsx  (portfolio list) and
 *   financial.budget-burn.$contractId.tsx (contract detail)
 * mount as sibling children under the same path segment.
 *
 * TanStack file-based routing lesson (CR-H / CR-M): sibling files do not
 * auto-mount — the parent MUST render <Outlet />.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/app/financial/budget-burn')({
  component: () => <Outlet />,
});
