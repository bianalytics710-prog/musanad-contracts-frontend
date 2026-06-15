/**
 * Authenticated route — /app/contracts/$id (detail).
 *
 * Parses :id into a number; rejects non-numeric / coerced ids by rendering
 * the NotFound branch in ContractDetail. Wrapped in ErrorBoundary (T11).
 *
 * FE-C2 (Codex): Number.parseInt accepts trailing junk (e.g. "123abc" -> 123),
 * which would silently call the API with a coerced id. Validate against a
 * strict positive-integer regex before parsing.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "@/components/common";
import { ContractDetail } from "@/features/contracts/components/ContractDetail";

interface ContractDetailSearch {
  tab?: string;
  // 2026-06-14 — risk case id is carried forward when Layla navigates
  // from /app/risk-cases/$id → contract link. The Notices tab uses it
  // to preselect a template type and link the resulting draft back to
  // the case.
  riskCase?: string;
}

export const Route = createFileRoute("/app/contracts/$id")({
  component: ContractDetailRoute,
  validateSearch: (s: Record<string, unknown>): ContractDetailSearch => ({
    // 2026-06-15 — accept tab as either raw string ("notices") or
    // JSON-quoted string ('"notices"'). Same for riskCase: TanStack
    // sometimes serialises numbers raw and sometimes JSON-encodes them
    // as strings depending on caller.
    tab: typeof s.tab === "string" && s.tab ? s.tab : undefined,
    riskCase:
      typeof s.riskCase === "string" && s.riskCase
        ? s.riskCase
        : typeof s.riskCase === "number"
          ? String(s.riskCase)
          : undefined,
  }),
});

// Strict positive integer with no leading zero, no sign, no whitespace,
// no trailing junk. Mirrors the BE id parser.
const POSITIVE_INT = /^[1-9]\d*$/;

function ContractDetailRoute() {
  const { id } = Route.useParams();
  const { riskCase, tab } = Route.useSearch();
  const { t } = useTranslation();

  if (typeof id !== "string" || !POSITIVE_INT.test(id)) {
    return (
      <div className="mx-auto w-full max-w-md p-12 text-center">
        <h1 className="text-base font-semibold text-ink">{t("contracts.detail.notFound")}</h1>
      </div>
    );
  }

  // Safe to parse — regex above guarantees a clean positive integer.
  const numericId = Number.parseInt(id, 10);

  if (!Number.isSafeInteger(numericId) || numericId <= 0) {
    return (
      <div className="mx-auto w-full max-w-md p-12 text-center">
        <h1 className="text-base font-semibold text-ink">{t("contracts.detail.notFound")}</h1>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ContractDetail
        contractId={numericId}
        riskCaseIdFromUrl={riskCase}
        initialTab={tab}
      />
    </ErrorBoundary>
  );
}
