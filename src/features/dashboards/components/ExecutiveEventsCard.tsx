/**
 * R-EX3 — Executive events (last 14 days) timeline card.
 *
 * Single chronological feed of recent enterprise activity from
 * regulatory_update + contract_activity. Backed by migration 092/093.
 */
import { useTranslation } from "react-i18next";
import { Calendar, AlertTriangle } from "lucide-react";
import type { ExecutiveEventRow } from "@/types/entities/dashboards.types";

const SEVERITY_TONE: Record<string, string> = {
  critical: "border-l-terracotta",
  high: "border-l-amber",
  low: "border-l-sage",
};

export function ExecutiveEventsCard({ rows }: { rows: ExecutiveEventRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-3 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-gold" />
        <h3 className="text-sm font-semibold text-ink">
          {t("dashboards.executive.events.title", {
            defaultValue: "Executive events (last 14 days)",
          })}
        </h3>
      </header>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li
            key={`${r.eventType}-${r.subRef}-${i}`}
            className={`border-l-2 pl-3 ${SEVERITY_TONE[r.severity] ?? "border-l-border"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">
                  {r.severity === "critical" && (
                    <AlertTriangle className="me-1 inline h-3.5 w-3.5 align-text-bottom text-terracotta" />
                  )}
                  {r.headline}
                </p>
                {r.subRef && (
                  <p className="mt-0.5 font-mono text-[11px] text-ink-subtle">
                    {r.subRef}
                  </p>
                )}
              </div>
              <span className="font-mono text-[11px] text-ink-subtle whitespace-nowrap">
                {formatRelative(r.occurredAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatRelative(iso: string): string {
  // Simple "Xh ago" / "Xd ago" formatter — keeps the timeline compact
  // without pulling in date-fns. Falls back to ISO date if parsing fails.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
