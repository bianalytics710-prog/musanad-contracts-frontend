/**
 * Authenticated route — /app/admin/imports/$batchId (S4 drill-down).
 *
 * Single-batch detail view — counters, config, lifecycle controls, and
 * per-batch contract list (M1a fn_contract_list filtered by importBatchId).
 *
 * Path param `batchId` is parsed as a positive integer; non-numeric values
 * surface as the standard "batch not found" empty state.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { AdminImportBatchDetailView } from "@/features/imports/components/AdminImportBatchDetailView";

export const Route = createFileRoute("/app/admin/imports/$batchId")({
  component: AdminImportBatchDetailRoute,
});

function AdminImportBatchDetailRoute() {
  const { batchId: raw } = Route.useParams();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return (
      <ErrorBoundary>
        <AdminImportBatchDetailView batchId={-1} />
      </ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary>
      <AdminImportBatchDetailView batchId={parsed} />
    </ErrorBoundary>
  );
}
