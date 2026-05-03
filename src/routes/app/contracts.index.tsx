/**
 * Authenticated route — /app/contracts (list view).
 *
 * The file naming convention here (`contracts.index.tsx`) keeps this as a
 * leaf route alongside `contracts.$id.tsx` and `contracts.new.tsx`, which
 * are siblings rather than children of a layout. ErrorBoundary wraps the
 * list so a render-time crash does not blank the authenticated app shell.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { ContractListView } from "@/features/contracts/components/ContractListView";

export const Route = createFileRoute("/app/contracts/")({
  component: ContractsListRoute,
});

function ContractsListRoute() {
  return (
    <ErrorBoundary>
      <ContractListView />
    </ErrorBoundary>
  );
}
