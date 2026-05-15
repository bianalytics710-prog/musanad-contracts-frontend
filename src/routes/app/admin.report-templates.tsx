/**
 * /app/admin/report-templates — outlet shim per TanStack file-based pattern.
 * The list view lives at admin.report-templates.index.tsx; the editor at
 * admin.report-templates.$templateId.tsx.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/app/admin/report-templates')({
  component: () => <Outlet />,
});
