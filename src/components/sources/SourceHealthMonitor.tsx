/**
 * SourceHealthMonitor — top-of-page health summary used on /app/admin/sources
 * and /app/admin/source-health. Renders a count summary + a compact list of
 * sources sorted by state priority (failing > unauthorised > degraded > healthy).
 */
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { adminSourceHealthService } from "@/services/api/admin-source-health.service";
import type {
  HealthState,
  SourceHealthListItem,
} from "@/types/entities/osint.types";
import { HealthStateBadge } from "./healthBadge";
import { formatRelative } from "./relativeTime";

const STATE_ORDER: Record<HealthState, number> = {
  failing: 0,
  unauthorised: 1,
  degraded: 2,
  healthy: 3,
};

interface SourceHealthMonitorProps {
  /** Show the full table (true on /app/admin/source-health) or a compact band (false default). */
  variant?: "compact" | "full";
}

export function SourceHealthMonitor({
  variant = "compact",
}: SourceHealthMonitorProps) {
  const { t } = useTranslation();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-source-health"],
    queryFn: () => adminSourceHealthService.list(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-2 sm:grid-cols-4" aria-busy>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg bg-surface"
            aria-hidden
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-terracotta/40 bg-terracotta/5 p-4 text-sm text-terracotta">
        <p>
          {t("admin.sources.error.fetch", {
            defaultValue: "Could not load source health.",
          })}
        </p>
        <button
          type="button"
          className="mt-2 font-mono text-[10px] uppercase tracking-wider text-terracotta hover:underline"
          onClick={() => refetch()}
        >
          {t("admin.sources.error.retry", { defaultValue: "Retry" })}
        </button>
      </div>
    );
  }

  const rows: SourceHealthListItem[] = (data ?? []).slice().sort((a, b) => {
    const order = STATE_ORDER[a.state] - STATE_ORDER[b.state];
    if (order !== 0) return order;
    return a.displayName.localeCompare(b.displayName);
  });

  if (rows.length === 0) {
    return null;
  }

  const counts: Record<HealthState, number> = {
    healthy: 0,
    degraded: 0,
    failing: 0,
    unauthorised: 0,
  };
  for (const r of rows) counts[r.state] += 1;

  if (variant === "compact") {
    return (
      <section className="grid gap-2 sm:grid-cols-4">
        {(["healthy", "degraded", "failing", "unauthorised"] as HealthState[]).map(
          (state) => (
            <div
              key={state}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t(`admin.sources.health.state.${state}`, {
                    defaultValue: state,
                  })}
                </span>
                <HealthStateBadge state={state} showLabel={false} />
              </div>
              <p className="mt-1 font-mono text-2xl font-semibold text-ink">
                {counts[state]}
              </p>
            </div>
          ),
        )}
      </section>
    );
  }

  return (
    <section className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-ink-subtle">
            <th scope="col" className="px-4 py-3 font-medium">
              {t("admin.sources.health.col.source", { defaultValue: "Source" })}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t("admin.sources.health.col.kind", { defaultValue: "Kind" })}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t("admin.sources.health.col.state", { defaultValue: "State" })}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t("admin.sources.health.col.lastSuccess", {
                defaultValue: "Last success",
              })}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t("admin.sources.health.col.lastFailure", {
                defaultValue: "Last failure",
              })}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t("admin.sources.health.col.signals24h", {
                defaultValue: "Signals (24h)",
              })}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t("admin.sources.health.col.error", {
                defaultValue: "Error",
              })}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.sourceId}
              className="border-t border-border/60 transition-colors hover:bg-surface/40"
            >
              <th
                scope="row"
                className="px-4 py-3 text-left font-medium text-ink"
              >
                <div className="flex flex-col">
                  <span>{r.displayName}</span>
                  <span className="font-mono text-[10px] text-ink-muted">
                    {r.sourceId}
                  </span>
                </div>
              </th>
              <td className="px-4 py-3 text-xs text-ink-muted">
                {t(`admin.sources.kind.${r.kind}`, { defaultValue: r.kind })}
              </td>
              <td className="px-4 py-3">
                <HealthStateBadge state={r.state} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                {r.lastSuccessAt ? formatRelative(r.lastSuccessAt) : "—"}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                {r.lastFailureAt ? formatRelative(r.lastFailureAt) : "—"}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-ink">
                {r.signals24h}
              </td>
              <td
                className="max-w-[280px] truncate px-4 py-3 text-xs text-terracotta"
                title={r.lastErrorMessage ?? undefined}
              >
                {r.lastErrorMessage ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
