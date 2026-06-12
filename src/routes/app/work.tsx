import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { MyWorkPage } from "@/features/work-orders/components/MyWorkPage";

export const Route = createFileRoute("/app/work")({
  component: WorkRoute,
});

function WorkRoute() {
  return (
    <ErrorBoundary>
      <MyWorkPage />
    </ErrorBoundary>
  );
}
