/**
 * /app/financial/trade-margin — layout/outlet route.
 *
 * CR-O — M21 Financial Intelligence (Trade Margin).
 * Parent route that lets:
 *   financial.trade-margin.index.tsx  (positions list) and
 *   financial.trade-margin.$positionId.tsx (position detail)
 * mount as sibling children under the same path segment.
 *
 * TanStack file-based routing lesson (CR-H / CR-M / CR-N): sibling files do not
 * auto-mount — the parent MUST render <Outlet />.
 *
 * CR-W: RequireModule gate — redirects to insights hub if financial.trade_margin
 * is not in the user's effectiveModules.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { RequireModule } from '@/components/routing/RequireModule';

export const Route = createFileRoute('/app/financial/trade-margin')({
  component: () => (
    <RequireModule moduleKey="financial.trade_margin">
      <Outlet />
    </RequireModule>
  ),
});
