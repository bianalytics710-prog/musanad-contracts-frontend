/**
 * Authenticated route — /app/approvals (S1).
 *
 * Approver inbox: list of pending approval steps for the calling user
 * with row actions (approve / reject / request_resubmission / delegate)
 * via the ApprovalDecisionDialog.
 *
 * T11 — wrapped in ErrorBoundary so a render-time crash does not blank
 * the authenticated app shell.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { ApprovalsListView } from "@/features/approvals/components/ApprovalsListView";

export const Route = createFileRoute("/app/approvals")({
  component: ApprovalsRoute,
});

function ApprovalsRoute() {
  return (
    <ErrorBoundary>
      <ApprovalsListView />
    </ErrorBoundary>
  );
}
