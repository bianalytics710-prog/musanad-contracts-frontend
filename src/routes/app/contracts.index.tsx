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
import {
  CONTRACT_STATUS_VALUES,
  type ContractStatus,
} from "@/types/entities/contract.types";

interface ContractsSearch {
  status?: ContractStatus;
}

const STATUS_SET = new Set<string>(CONTRACT_STATUS_VALUES);

export const Route = createFileRoute("/app/contracts/")({
  // Drafter dashboard pipeline pills (and other inbound surfaces) deep-link
  // here with `?status=<contract_status>`. We only accept whitelisted enum
  // values; anything else gets dropped so the list opens unfiltered.
  validateSearch: (raw: Record<string, unknown>): ContractsSearch => {
    const v = raw?.status;
    return typeof v === "string" && STATUS_SET.has(v)
      ? { status: v as ContractStatus }
      : {};
  },
  component: ContractsListRoute,
});

function ContractsListRoute() {
  const { status } = Route.useSearch();
  return (
    <ErrorBoundary>
      <ContractListView initialStatus={status} />
    </ErrorBoundary>
  );
}
