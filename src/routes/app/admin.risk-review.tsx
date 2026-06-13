/**
 * /app/admin/risk-review — Tier 2 manual triage (Phase C, relocated).
 *
 * Lives under Workflow & rules. Surfaces borderline risk-case alerts the
 * correlation engine wasn't confident enough to auto-route (confidence
 * 0.60–0.85 OR no matching routing rule). The business admin scans the
 * queue, then either:
 *   - Confirm risk → runs fn_risk_review_promote → assigned_role cleared,
 *     fn_risk_case_classify_and_route fires, case lands in the matching
 *     specialist team's queue with the rule's SLA.
 *   - Mark as noise → runs fn_risk_review_dismiss → status='closed',
 *     closure_outcome='no_action'. Audit trail retained.
 *
 * Bulk checkbox + bulk-action buttons match the same pattern.
 *
 * Permission: risk.review.manage. Grant lives on platform_admin +
 * Super Admin + executive (Phase B mig 643 added the executive grant).
 *
 * 2026-06-13 — body extracted into RiskReviewQueue so the same UI renders
 * behind /app/exec/risk-triage for the executive persona too.
 */
import { createFileRoute } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { RiskReviewQueue } from '@/features/risk-review/components/RiskReviewQueue';

export const Route = createFileRoute('/app/admin/risk-review')({
  component: () => (
    <ErrorBoundary>
      <RiskReviewQueue variant="admin" />
    </ErrorBoundary>
  ),
});
