/**
 * Authenticated route — /app/admin/ai/prompts (M4 — S13).
 *
 * Admin read-only view of registered AI prompts and their default model +
 * rate limits + feature flags. Editing deferred — read-only in M4.
 *
 * Permission: ai.observability.read (BE-enforced).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { AdminAIPromptsList } from "@/features/admin-ai/components/AdminAIPromptsList";

export const Route = createFileRoute("/app/admin/ai/prompts")({
  component: AdminAiPromptsRoute,
});

function AdminAiPromptsRoute() {
  return (
    <ErrorBoundary>
      <AdminAIPromptsList />
    </ErrorBoundary>
  );
}
