/**
 * Authenticated route — /app/contracts/new (create form).
 *
 * Renders ContractCreateForm wrapped in ErrorBoundary (T11).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { ContractCreateForm } from "@/features/contracts/components/ContractCreateForm";

export const Route = createFileRoute("/app/contracts/new")({
  component: ContractsNewRoute,
});

function ContractsNewRoute() {
  return (
    <ErrorBoundary>
      <ContractCreateForm />
    </ErrorBoundary>
  );
}
