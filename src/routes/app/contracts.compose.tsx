/**
 * Authenticated route — /app/contracts/compose (Compose Wizard).
 *
 * Accepts `?template_id=N` to seed the wizard from an existing template
 * (Templates list / Preview "Use template" flow). The id is parsed as a
 * positive integer; anything else is dropped.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ErrorBoundary } from "@/components/common";
import { ComposeWizard } from "@/features/contracts/wizard/ComposeWizard";

const composeSearchSchema = z
  .object({
    template_id: z.coerce.number().int().positive().optional(),
  })
  .partial();

export const Route = createFileRoute("/app/contracts/compose")({
  validateSearch: (s) => composeSearchSchema.parse(s),
  component: ContractsComposeRoute,
});

function ContractsComposeRoute() {
  const { template_id } = Route.useSearch();
  return (
    <ErrorBoundary>
      <ComposeWizard prefillTemplateId={template_id ?? null} />
    </ErrorBoundary>
  );
}
