/**
 * Authenticated route — /app/imports/bulk (S5).
 *
 * Bulk multi-file import — drag/drop PDF/DOCX, browser-side text
 * extraction, AI-assisted routing, per-file save against M1a contracts.
 *
 * T11 — wrapped in ErrorBoundary so a render-time crash does not blank
 * the authenticated app shell.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { BulkImportView } from "@/features/imports/components/BulkImportView";

export const Route = createFileRoute("/app/imports/bulk")({
  component: BulkImportRoute,
});

function BulkImportRoute() {
  return (
    <ErrorBoundary>
      <BulkImportView />
    </ErrorBoundary>
  );
}
