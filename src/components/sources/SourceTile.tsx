/**
 * SourceTile — single source card on /app/admin/sources list view.
 *
 * Surfaces source_id + kind badge + health badge + last success (relative)
 * + signals_24h + truncated error preview (when present).
 */
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { OsintSourceListItem } from "@/types/entities/osint.types";
import { HealthStateBadge } from "./healthBadge";
import { formatRelative } from "./relativeTime";

interface SourceTileProps {
  source: OsintSourceListItem;
}

export function SourceTile({ source }: SourceTileProps) {
  const { t } = useTranslation();
  const health = source.health;
  const errorPreview = health?.lastErrorMessage
    ? health.lastErrorMessage.length > 140
      ? `${health.lastErrorMessage.slice(0, 140)}…`
      : health.lastErrorMessage
    : null;

  return (
    <Link
      to="/app/admin/sources/$id"
      params={{ id: String(source.id) }}
      className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-gold/40 hover:bg-surface/40"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{source.displayName}</p>
          <p className="font-mono text-xs text-ink-muted">{source.sourceId}</p>
        </div>
        {health ? <HealthStateBadge state={health.state} /> : null}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
          {t(`admin.sources.kind.${source.kind}`, { defaultValue: source.kind })}
        </span>
        {!source.enabled ? (
          <span className="inline-flex items-center rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("admin.sources.disabled", { defaultValue: "Disabled" })}
          </span>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("admin.sources.tile.lastSuccess", { defaultValue: "Last success" })}
          </dt>
          <dd className="text-ink-muted">
            {health?.lastSuccessAt ? formatRelative(health.lastSuccessAt) : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("admin.sources.tile.signalsLast24h", {
              defaultValue: "Signals (24h)",
            })}
          </dt>
          <dd className="font-mono text-ink">
            {health?.signals24h ?? 0}
          </dd>
        </div>
      </dl>

      {errorPreview ? (
        <p
          className="truncate rounded-md border border-terracotta/30 bg-terracotta/5 px-2 py-1 font-mono text-[11px] text-terracotta"
          title={errorPreview}
        >
          {errorPreview}
        </p>
      ) : null}
    </Link>
  );
}
