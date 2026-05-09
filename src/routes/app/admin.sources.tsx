/**
 * /app/admin/sources — layout/outlet route.
 *
 * Lets `admin.sources.index.tsx` (the list) and `admin.sources.$id.tsx`
 * (the detail/edit page) render as siblings even though TanStack file-based
 * routing groups them under this parent path. Without an explicit Outlet,
 * the parent component is rendered for both URLs and the $id child never
 * mounts (the bug caught during post-implementation verification).
 */
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/admin/sources")({
  component: () => <Outlet />,
});
