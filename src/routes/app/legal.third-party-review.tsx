/**
 * /app/legal/third-party-review — outlet shim per TanStack file-based parent/child
 * pattern. List view lives at legal.third-party-review.index.tsx;
 * detail at legal.third-party-review.$id.tsx; upload at legal.third-party-review.new.tsx.
 *
 * CR-W: RequireModule gate against tpa_review module.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { RequireModule } from '@/components/routing/RequireModule';

export const Route = createFileRoute('/app/legal/third-party-review')({
  component: () => (
    <RequireModule moduleKey="tpa_review">
      <Outlet />
    </RequireModule>
  ),
});
