/**
 * /app/admin/source-health — dedicated OSINT source health monitor (S8).
 *
 * Bare-array list ordered by state priority (failing > unauthorised >
 * degraded > healthy) then displayName. Permission gate: source.read
 * (platform_admin / executive).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { SourceHealthMonitor } from "@/components/sources/SourceHealthMonitor";

export const Route = createFileRoute("/app/admin/source-health")({
  component: () => (
    <ErrorBoundary>
      <SourceHealthRoute />
    </ErrorBoundary>
  ),
});

function SourceHealthRoute() {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <Link
        to="/app/admin/sources"
        className="inline-flex items-center text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="me-1 h-3.5 w-3.5" />
        {t("admin.sources.detail.back", { defaultValue: "Back to sources" })}
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("admin.sources.health.title", {
            defaultValue: "Source health",
          })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("admin.sources.health.subtitle", {
            defaultValue:
              "Adapter status by source. Updated every 5 minutes by the health-check cron.",
          })}
        </p>
      </header>
      <SourceHealthMonitor variant="compact" />
      <SourceHealthMonitor variant="full" />
    </motion.div>
  );
}
