/**
 * CounterpartyIntelligenceCard
 *
 * Compact, decision-useful read of a counterparty's contract history, shown
 * during drafting (compose wizard, once the counterparty resolves to a known
 * party) and review (contract detail). Backed by GET /parties/:id/intelligence
 * (mig 707 fn_party_drafting_intelligence + a short grounded AI note).
 *
 * Deliberately minimal — a few key stats + the clauses/issues they push on +
 * one AI sentence. Empty state when there's no prior history.
 */
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Sparkles, History, AlertTriangle, GitBranch, Scale } from "lucide-react";
import {
  partyGraphService,
  type PartyIntelligenceMetrics,
} from "@/services/api/party-graph.service";
import { cn } from "@/lib/utils";

export function CounterpartyIntelligenceCard({
  partyId,
  excludeContractId,
  className,
}: {
  partyId: number;
  excludeContractId?: number;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("ar") ? "ar" : "en";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["party-intelligence", partyId, excludeContractId ?? null, lang],
    queryFn: () =>
      partyGraphService.getIntelligence(partyId, {
        excludeContractId,
        lang,
      }),
    enabled: Number.isFinite(partyId) && partyId > 0,
    staleTime: 10 * 60_000,
  });

  if (isError) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-gold/30 bg-gold/[0.04] p-4",
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <History className="h-4 w-4 text-gold" aria-hidden />
        <h3 className="text-sm font-semibold text-ink">
          {t("contracts.counterpartyIntel.title", {
            defaultValue: "Counterparty insight",
          })}
        </h3>
      </div>

      {isLoading ? (
        <div className="h-16 animate-pulse rounded-md bg-surface" aria-hidden />
      ) : !data ? null : data.metrics.priorContracts === 0 ? (
        <p className="text-xs text-ink-muted">
          {t("contracts.counterpartyIntel.none", {
            defaultValue: "No prior contracts with this counterparty.",
          })}
        </p>
      ) : (
        <IntelBody metrics={data.metrics} summary={data.summary} />
      )}
    </div>
  );
}

function IntelBody({
  metrics,
  summary,
}: {
  metrics: PartyIntelligenceMetrics;
  summary: string | null;
}) {
  const { t } = useTranslation();
  const af = metrics.approvalFriction;
  const friction = af.rejected + af.resubmitted;

  const versionsHigh =
    metrics.avgVersions != null &&
    metrics.portfolioAvgVersions != null &&
    metrics.avgVersions > metrics.portfolioAvgVersions + 0.4;

  const themes = [
    ...metrics.topRedlineClauses.map((c) => c.heading),
    ...metrics.riskCases.byType.map((r) => r.type.replace(/_/g, " ")),
  ].slice(0, 3);

  return (
    <div className="space-y-3">
      {/* Stat chips */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          icon={History}
          label={t("contracts.counterpartyIntel.priorContracts", { defaultValue: "Prior contracts" })}
          value={`${metrics.priorContracts}`}
          sub={t("contracts.counterpartyIntel.active", {
            defaultValue: "{{n}} active",
            n: metrics.activeContracts,
          })}
        />
        <Stat
          icon={GitBranch}
          label={t("contracts.counterpartyIntel.avgVersions", { defaultValue: "Avg versions" })}
          value={metrics.avgVersions != null ? `${metrics.avgVersions}` : "—"}
          sub={
            metrics.portfolioAvgVersions != null
              ? t("contracts.counterpartyIntel.norm", {
                  defaultValue: "norm {{n}}",
                  n: metrics.portfolioAvgVersions,
                })
              : undefined
          }
          tone={versionsHigh ? "amber" : "default"}
        />
        <Stat
          icon={AlertTriangle}
          label={t("contracts.counterpartyIntel.approvalFriction", { defaultValue: "Sent back" })}
          value={`${friction}`}
          sub={t("contracts.counterpartyIntel.rejResub", {
            defaultValue: "{{r}} rej / {{s}} resub",
            r: af.rejected,
            s: af.resubmitted,
          })}
          tone={friction > 0 ? "terracotta" : "default"}
        />
        <Stat
          icon={Scale}
          label={t("contracts.counterpartyIntel.riskCases", { defaultValue: "Risk cases" })}
          value={`${metrics.riskCases.total}`}
          sub={t("contracts.counterpartyIntel.open", {
            defaultValue: "{{n}} open",
            n: metrics.riskCases.open,
          })}
          tone={metrics.riskCases.open > 0 ? "terracotta" : "default"}
        />
      </div>

      {/* Issue / negotiation themes */}
      {themes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-ink-muted">
            {t("contracts.counterpartyIntel.themes", { defaultValue: "Watch:" })}
          </span>
          {themes.map((th) => (
            <span
              key={th}
              className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink"
            >
              {th}
            </span>
          ))}
        </div>
      )}

      {/* AI synthesis */}
      {summary && (
        <div className="flex gap-2 rounded-md bg-card p-2.5">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden />
          <p className="text-xs leading-relaxed text-ink">{summary}</p>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "amber" | "terracotta";
}) {
  const valueColor =
    tone === "terracotta" ? "text-terracotta" : tone === "amber" ? "text-amber-ink" : "text-ink";
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-2">
      <div className="flex items-center gap-1 text-ink-subtle">
        <Icon className="h-3 w-3" />
        <span className="font-mono text-[9px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn("mt-0.5 text-lg font-semibold tabular-nums leading-none", valueColor)}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-ink-subtle">{sub}</p>}
    </div>
  );
}
