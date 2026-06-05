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

type RiskBucket = "high" | "medium" | "low" | "flagged";
type SortKey = "updated_at" | "created_at" | "end_date" | "value" | "alpha" | "risk";

interface ContractsSearch {
  status?: ContractStatus;
  risk?: RiskBucket;
  sort?: SortKey;
}

const STATUS_SET = new Set<string>(CONTRACT_STATUS_VALUES);
const RISK_SET = new Set<RiskBucket>(["high", "medium", "low", "flagged"]);
const SORT_SET = new Set<SortKey>([
  "updated_at",
  "created_at",
  "end_date",
  "value",
  "alpha",
  "risk",
]);

export const Route = createFileRoute("/app/contracts/")({
  // Drafter dashboard pipeline pills (and other inbound surfaces) deep-link
  // here with `?status=<contract_status>`. We only accept whitelisted enum
  // values; anything else gets dropped so the list opens unfiltered.
  //
  // Mig 562 adds `?risk=<bucket>` and extends sort with `risk`. The exec
  // dashboard "View all flagged contracts →" link sets
  // ?risk=high&sort=risk to land on a pre-filtered, pre-sorted view.
  validateSearch: (raw: Record<string, unknown>): ContractsSearch => {
    const out: ContractsSearch = {};
    const s = raw?.status;
    if (typeof s === "string" && STATUS_SET.has(s)) out.status = s as ContractStatus;
    const r = raw?.risk;
    if (typeof r === "string" && RISK_SET.has(r as RiskBucket)) out.risk = r as RiskBucket;
    const so = raw?.sort;
    if (typeof so === "string" && SORT_SET.has(so as SortKey)) out.sort = so as SortKey;
    return out;
  },
  component: ContractsListRoute,
});

function ContractsListRoute() {
  const { status, risk, sort } = Route.useSearch();
  return (
    <ErrorBoundary>
      <ContractListView initialStatus={status} initialRisk={risk} initialSort={sort} />
    </ErrorBoundary>
  );
}
