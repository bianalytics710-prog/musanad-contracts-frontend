/**
 * /app/exec/risk-triage — Phase B (mig 643, 2026-06-13).
 *
 * Executive's primary triage door for Tier-2 borderline risk-case alerts.
 * Mechanically identical to /app/admin/risk-review (same component, same
 * endpoints, same permission) — the difference is who walks in. The exec
 * is the right judge of "is this a real risk that needs to go to legal /
 * compliance / finance, or noise?", which is why this entry sits on their
 * sidebar right next to Risk Cases.
 *
 * Platform Admin keeps the original /admin/risk-review route as a system
 * view; the executive doesn't have to dig under Admin to find their work.
 *
 * Permission: risk.review.manage (granted to executive via mig 643).
 */
import { createFileRoute } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { RiskReviewQueue } from '@/features/risk-review/components/RiskReviewQueue';

export const Route = createFileRoute('/app/exec/risk-triage')({
  component: () => (
    <ErrorBoundary>
      <RiskReviewQueue variant="exec" />
    </ErrorBoundary>
  ),
});
