/**
 * Authenticated route — /app/admin/regulations (S1..S5).
 *
 * Admin / legal_counsel list view of regulations. Permission gate
 * regulations.read at the BE; FE error branch surfaces a 403 via
 * translateApiError when the caller lacks the permission.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { RegulationsListView } from "@/features/regulatory/components/RegulationsListView";

export const Route = createFileRoute("/app/admin/regulations")({
  component: AdminRegulationsRoute,
});

function AdminRegulationsRoute() {
  return (
    <ErrorBoundary>
      <RegulationsListView />
    </ErrorBoundary>
  );
}
