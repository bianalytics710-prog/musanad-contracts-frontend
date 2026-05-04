/**
 * Authenticated route — /app/admin/imports (S3).
 *
 * Admin / drafter list of import batches. Role-narrowing applied
 * server-side (contract_drafter sees own batches only — AC-S3-07).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { AdminImportsListView } from "@/features/imports/components/AdminImportsListView";

export const Route = createFileRoute("/app/admin/imports")({
  component: AdminImportsRoute,
});

function AdminImportsRoute() {
  return (
    <ErrorBoundary>
      <AdminImportsListView />
    </ErrorBoundary>
  );
}
