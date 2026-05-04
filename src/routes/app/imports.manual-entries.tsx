/**
 * Authenticated route — /app/imports/manual-entries (S7).
 *
 * Low-confidence imported drafts (importConfidence < 50) requiring manual
 * field completion. Linear form is provided by the existing M1a contract
 * edit flow at /app/contracts/$id; this view links to it per row.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { ManualEntriesView } from "@/features/imports/components/ManualEntriesView";

export const Route = createFileRoute("/app/imports/manual-entries")({
  component: ManualEntriesRoute,
});

function ManualEntriesRoute() {
  return (
    <ErrorBoundary>
      <ManualEntriesView />
    </ErrorBoundary>
  );
}
