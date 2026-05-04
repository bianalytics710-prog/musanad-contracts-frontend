/**
 * Authenticated route — /app/admin/approval-matrix (S4 + S5).
 *
 * Admin view for the approval matrix. Permission gate
 * approval.matrix.read at the BE; FE error branch surfaces a 403 via
 * translateApiError when the caller lacks the permission.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { ApprovalMatrixView } from "@/features/approvals/components/ApprovalMatrixView";

export const Route = createFileRoute("/app/admin/approval-matrix")({
  component: AdminApprovalMatrixRoute,
});

function AdminApprovalMatrixRoute() {
  return (
    <ErrorBoundary>
      <ApprovalMatrixView />
    </ErrorBoundary>
  );
}
