/**
 * Authenticated route — /app/admin/impact-categories (S14, S15).
 *
 * Admin-only view (config.manage permission gate at BE for S15 mutations;
 * S14 list is JWT-only — every authenticated user can read).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common";
import { ImpactCategoryConfigList } from "@/features/regulatory/components/ImpactCategoryConfigList";

export const Route = createFileRoute("/app/admin/impact-categories")({
  component: AdminImpactCategoriesRoute,
});

function AdminImpactCategoriesRoute() {
  return (
    <ErrorBoundary>
      <ImpactCategoryConfigList />
    </ErrorBoundary>
  );
}
