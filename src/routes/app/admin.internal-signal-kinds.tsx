/**
 * /app/admin/internal-signal-kinds — read-only catalogue viewer (M8 / CR-A2).
 *
 * Surfaces the 8-row internal signal kinds catalogue per tenant: signal type
 * (slug + i18n display label), default severity (semantic-token badge), AR
 * display name, description, and the parameter schema as a collapsible JSON
 * preview. No edit / no create — system-only catalogue. Pilot will revisit
 * with admin CRUD if signal taxonomy demand warrants it (see Q-DA3 lock).
 *
 * Permission gate: internal_signal.read (Super Admin / platform_admin /
 * legal_counsel / executive). Sidebar visibility is governed by the same
 * role membership as the rest of the admin sub-nav.
 *
 * Three data states (T4): loading skeleton + empty + error+retry.
 * ErrorBoundary wrap (T11). Bare-array data shape — no pagination.
 *
 * No Lovable predecessor for this surface — regenerate mode (same precedent
 * as M7 /app/admin/sources). 13-item Harden Mode checklist still applies.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { adminInternalSignalKindsService } from "@/services/api/admin-internal-signal-kinds.service";
import { translateApiError } from "@/lib/translate-api-error";
import type {
  InternalSignalKind,
  InternalSignalParameterSchema,
  InternalSignalType,
} from "@/types/entities/internal-signal.types";
import type { Severity } from "@/types/entities/osint.types";

export const Route = createFileRoute("/app/admin/internal-signal-kinds")({
  component: () => (
    <ErrorBoundary>
      <InternalSignalKindsView />
    </ErrorBoundary>
  ),
});

// Severity → semantic-token badge classes. NO hex literals (T5 / C13).
// Tokens drawn from src/styles.css design palette: slate / sage / amber /
// gold / terracotta. Mirrors the project's existing 7-name palette
// (ink, gold, sage, amber, terracotta, slate, plum) — no Tailwind defaults.
const SEVERITY_TONE: Record<Severity, string> = {
  informational: "bg-slate-tint text-slate-ink",
  low: "bg-sage-tint text-sage-ink",
  medium: "bg-amber-tint text-amber-ink",
  high: "bg-gold-tint text-gold-hover",
  critical: "bg-terracotta-tint text-terracotta-ink",
};

// Order rows by signal_type alphabetically for stable rendering.
// Server already orders by signal_type ASC (api-contracts.json ordering).
const SIGNAL_TYPES: InternalSignalType[] = [
  "milestone_slippage",
  "sla_breach",
  "payment_delay",
  "invoice_dispute",
  "vendor_incident",
  "ics_incident",
  "icv_status_change",
  "certificate_expiry",
];

function InternalSignalKindsView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "internal-signal-kinds"],
    queryFn: () => adminInternalSignalKindsService.list(),
    staleTime: 5 * 60 * 1000, // catalogue is stable reference data
  });

  // Stable client-side ordering matching SIGNAL_TYPES enum order. Defends
  // against any server reordering and gives a deterministic UI for screen
  // readers iterating top-to-bottom.
  const rows = useMemo<InternalSignalKind[]>(() => {
    const list = data ?? [];
    const indexOf = (st: InternalSignalType): number => {
      const idx = SIGNAL_TYPES.indexOf(st);
      return idx === -1 ? SIGNAL_TYPES.length : idx;
    };
    return list.slice().sort((a, b) => indexOf(a.signalType) - indexOf(b.signalType));
  }, [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("admin.internalSignalKinds.title", {
            defaultValue: "Internal Signal Kinds",
          })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("admin.internalSignalKinds.subtitle", {
            defaultValue:
              "Catalogue of operational risk signals ingested via the harness API and consumed by dashboards.",
          })}
        </p>
      </header>

      {isLoading ? (
        <div
          className="space-y-2"
          aria-busy
          aria-label={t("admin.internalSignalKinds.loading", {
            defaultValue: "Loading internal signal kinds…",
          })}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-surface"
              aria-hidden
            />
          ))}
        </div>
      ) : isError ? (
        <div
          className="rounded-lg border border-terracotta/40 bg-terracotta/5 p-6 text-center"
          role="alert"
        >
          <p className="text-sm text-terracotta">
            {translateApiError(
              error,
              t,
              "admin.internalSignalKinds.error.fetch",
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => refetch()}
          >
            <RefreshCcw className="me-2 h-3.5 w-3.5" />
            {t("admin.internalSignalKinds.error.retry", {
              defaultValue: "Retry",
            })}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm font-medium text-ink">
            {t("admin.internalSignalKinds.empty.title", {
              defaultValue: "No internal signal kinds configured",
            })}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {t("admin.internalSignalKinds.empty.body", {
              defaultValue:
                "The catalogue is seeded by the M8 migration. If this list is empty the seed has not run for this tenant.",
            })}
          </p>
        </div>
      ) : (
        <section className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-ink-subtle">
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("admin.internalSignalKinds.columns.signalType", {
                    defaultValue: "Signal type",
                  })}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("admin.internalSignalKinds.columns.displayName", {
                    defaultValue: "Display name",
                  })}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("admin.internalSignalKinds.columns.defaultSeverity", {
                    defaultValue: "Default severity",
                  })}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("admin.internalSignalKinds.columns.description", {
                    defaultValue: "Description",
                  })}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("admin.internalSignalKinds.columns.parameterSchema", {
                    defaultValue: "Parameter schema",
                  })}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((kind) => (
                <KindRow key={kind.id} kind={kind} isAr={isAr} />
              ))}
            </tbody>
          </table>
        </section>
      )}
    </motion.div>
  );
}

interface KindRowProps {
  kind: InternalSignalKind;
  isAr: boolean;
}

function KindRow({ kind, isAr }: KindRowProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const localeName = isAr && kind.displayNameAr ? kind.displayNameAr : kind.displayName;
  const severityClass = SEVERITY_TONE[kind.defaultSeverity] ?? "bg-surface text-ink";

  const schemaId = `internal-signal-kind-schema-${kind.id}`;

  return (
    <>
      <tr className="border-t border-border/60 transition-colors hover:bg-surface/40">
        <th
          scope="row"
          className="px-4 py-3 text-left align-top font-medium text-ink"
        >
          <div className="flex flex-col gap-1">
            <span>
              {t(`admin.internalSignalKinds.signalType.${kind.signalType}`, {
                defaultValue: kind.signalType,
              })}
            </span>
            <span className="font-mono text-[10px] text-ink-muted">
              {kind.signalType}
            </span>
          </div>
        </th>
        <td className="px-4 py-3 align-top text-sm text-ink">{localeName}</td>
        <td className="px-4 py-3 align-top">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${severityClass}`}
          >
            {t(
              `admin.internalSignalKinds.severity.${kind.defaultSeverity}`,
              { defaultValue: kind.defaultSeverity },
            )}
          </span>
        </td>
        <td className="max-w-[320px] px-4 py-3 align-top text-xs text-ink-muted">
          {kind.description ?? "—"}
        </td>
        <td className="px-4 py-3 align-top">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface/60 px-2 py-1 text-xs text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={schemaId}
            aria-label={
              expanded
                ? t("admin.internalSignalKinds.actions.hideSchema", {
                    defaultValue: "Hide parameter schema",
                  })
                : t("admin.internalSignalKinds.actions.showSchema", {
                    defaultValue: "Show parameter schema",
                  })
            }
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            )}
            <ParameterSchemaBadge schema={kind.parameterSchema} />
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr id={schemaId} className="bg-surface/30">
          <td colSpan={5} className="px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t("admin.internalSignalKinds.schema.required", {
                    defaultValue: "Required",
                  })}
                </p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {kind.parameterSchema.required.length === 0 ? (
                    <li className="text-xs text-ink-muted">—</li>
                  ) : (
                    kind.parameterSchema.required.map((field) => (
                      <li
                        key={field}
                        className="rounded-md bg-card px-2 py-0.5 font-mono text-[11px] text-ink"
                      >
                        {field}
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t("admin.internalSignalKinds.schema.optional", {
                    defaultValue: "Optional",
                  })}
                </p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {kind.parameterSchema.optional.length === 0 ? (
                    <li className="text-xs text-ink-muted">—</li>
                  ) : (
                    kind.parameterSchema.optional.map((field) => (
                      <li
                        key={field}
                        className="rounded-md bg-card px-2 py-0.5 font-mono text-[11px] text-ink-muted"
                      >
                        {field}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

interface ParameterSchemaBadgeProps {
  schema: InternalSignalParameterSchema;
}

function ParameterSchemaBadge({ schema }: ParameterSchemaBadgeProps) {
  const { t } = useTranslation();
  const reqCount = schema.required.length;
  const optCount = schema.optional.length;
  return (
    <span className="font-mono text-[11px] text-ink-muted">
      {t("admin.internalSignalKinds.schema.summary", {
        defaultValue: "{{req}} required · {{opt}} optional",
        req: reqCount,
        opt: optCount,
      })}
    </span>
  );
}
