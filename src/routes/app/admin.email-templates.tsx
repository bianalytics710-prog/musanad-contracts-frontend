/**
 * /app/admin/email-templates — parent route shim.
 *
 * TanStack file routing groups admin.email-templates.index.tsx (the list),
 * admin.email-templates.$id.tsx (the edit page), and
 * admin.email-templates.new.tsx (the create page) under this parent. Without
 * an Outlet here, the parent component would render for every URL and the
 * child routes would never mount — that's the bug the user hit when "Edit"
 * navigated to /:id but the list page kept rendering.
 */
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/admin/email-templates")({
  component: () => <Outlet />,
});
