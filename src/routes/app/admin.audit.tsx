/**
 * /app/admin/audit — layout/outlet route.
 *
 * Lets `admin.audit.index.tsx` (the paginated audit log viewer) and
 * `admin.audit.verify.tsx` (the audit chain verification page) render as
 * siblings even though TanStack file-based routing groups them under this
 * parent path. Without an explicit Outlet, the parent component is rendered
 * for both URLs and the `verify` child never mounts.
 */
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/admin/audit")({
  component: () => <Outlet />,
});
