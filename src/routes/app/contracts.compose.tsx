/**
 * Authenticated route — /app/contracts/compose (Compose Wizard).
 *
 * Renders the M1b 5-step Compose Wizard wrapped in ErrorBoundary (T11).
 * The route is gated by contract.draft permission via the wizard component
 * itself (defense-in-depth — the BE remains the source of truth).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { ComposeWizard } from "@/features/contracts/wizard/ComposeWizard";

export const Route = createFileRoute("/app/contracts/compose")({
  component: ContractsComposeRoute,
});

function ContractsComposeRoute() {
  return (
    <ErrorBoundary>
      <ComposeWizard />
    </ErrorBoundary>
  );
}
