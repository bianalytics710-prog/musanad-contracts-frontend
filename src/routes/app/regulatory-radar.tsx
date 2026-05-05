/**
 * Authenticated route — /app/regulatory-radar (S6..S13).
 *
 * Primary radar dashboard for regulations / regulatory_updates / impacts.
 * Permission gate regulations.read at the BE.
 *
 * Wraps RegulatoryRadarDashboard in ErrorBoundary (T11).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { RegulatoryRadarDashboard } from "@/features/regulatory/components/RegulatoryRadarDashboard";

export const Route = createFileRoute("/app/regulatory-radar")({
  component: RegulatoryRadarRoute,
});

function RegulatoryRadarRoute() {
  return (
    <ErrorBoundary>
      <RegulatoryRadarDashboard />
    </ErrorBoundary>
  );
}
