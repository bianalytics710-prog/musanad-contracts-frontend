/**
 * Authenticated route — /app/admin/ai/requests (M4 — S11).
 *
 * Admin observability: paginated ai_request_log list with filters
 * (user, prompt, outcome, date range). 50 per page (server max 200).
 *
 * Permission: ai.observability.read (BE-enforced).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { AdminAIRequestsList } from "@/features/admin-ai/components/AdminAIRequestsList";

export const Route = createFileRoute("/app/admin/ai/requests")({
  component: AdminAiRequestsRoute,
});

function AdminAiRequestsRoute() {
  return (
    <ErrorBoundary>
      <AdminAIRequestsList />
    </ErrorBoundary>
  );
}
