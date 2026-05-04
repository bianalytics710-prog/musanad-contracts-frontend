/**
 * Authenticated route — /app/imports/review-queue (S6).
 *
 * Review-queue list of medium-confidence imported contracts (status='draft',
 * importConfidence in [50, 79]). Approve / reject / inline edit.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { ReviewQueueView } from "@/features/imports/components/ReviewQueueView";

export const Route = createFileRoute("/app/imports/review-queue")({
  component: ReviewQueueRoute,
});

function ReviewQueueRoute() {
  return (
    <ErrorBoundary>
      <ReviewQueueView />
    </ErrorBoundary>
  );
}
