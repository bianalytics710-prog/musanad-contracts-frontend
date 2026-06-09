/**
 * /app/templates/$id — outlet shim per TanStack file-based parent/child
 * pattern (memory feedback_playwright_e2e_real_walk.md).
 *
 * The detail view lives at templates.$id.index.tsx; the editor at
 * templates.$id.edit.tsx. Without an explicit <Outlet/> here, the child
 * routes do not mount — navigating to /edit changes the URL but leaves
 * the detail view rendered (caught by the user during the drafter walk).
 */
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/templates/$id")({
  component: () => <Outlet />,
});
