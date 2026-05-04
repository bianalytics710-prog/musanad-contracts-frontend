/**
 * Authenticated route — /app/admin/approval-chains (S11).
 *
 * Admin chain monitor — paginated list of all approval chains with
 * filters for status / contractId. Permission gate at BE:
 * anyOf(approval.matrix.read, approval.reassign).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { AdminApprovalChainsView } from "@/features/approvals/components/AdminApprovalChainsView";

export const Route = createFileRoute("/app/admin/approval-chains")({
  component: AdminApprovalChainsRoute,
});

function AdminApprovalChainsRoute() {
  return (
    <ErrorBoundary>
      <AdminApprovalChainsView />
    </ErrorBoundary>
  );
}
