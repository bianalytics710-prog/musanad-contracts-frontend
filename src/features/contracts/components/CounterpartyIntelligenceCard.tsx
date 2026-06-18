/**
 * CounterpartyIntelligenceCard
 *
 * Compact, decision-useful read of a counterparty's contract history, shown
 * during drafting (compose wizard, once the counterparty resolves to a known
 * party) and review (contract detail). Backed by GET /parties/:id/intelligence
 * (mig 707/708 fn_party_drafting_intelligence + a short grounded AI note).
 *
 * Each stat tile is clickable: it expands an inline detail frame below (the
 * Expiry-Cliff pattern) listing the rows behind the number — contracts,
 * sent-back approvals, or risk cases. Single-frame-at-a-time.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  History,
  AlertTriangle,
  GitBranch,
  Scale,
  ChevronDown,
  X,
  ExternalLink,
} from "lucide-react";
import {
  partyGraphService,
  type PartyIntelligenceMetrics,
} from "@/services/api/party-graph.service";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/datetime";

type TileKey = "contracts" | "versions" | "sentBack" | "risk" | "redlines";

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
      partyGraphService.getIntelligence(partyId, { excludeContractId, lang }),
    enabled: Number.isFinite(partyId) && partyId > 0,
    staleTime: 10 * 60_000,
  });

  if (isError) return null;

  return (
    <div className={cn("rounded-lg border border-gold/30 bg-gold/[0.04] p-4", className)}>
      <div className="mb-2 flex items-center gap-2">
        <History className="h-4 w-4 text-gold" aria-hidden />
        <h3 className="text-sm font-semibold text-ink">
          {t("contracts.counterpartyIntel.title", { defaultValue: "Counterparty insight" })}
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
  const [open, setOpen] = useState<TileKey | null>(null);
  const toggle = (k: TileKey) => setOpen((cur) => (cur === k ? null : k));

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
      {/* Stat chips — clickable */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          icon={History}
          label={t("contracts.counterpartyIntel.priorContracts", { defaultValue: "Prior contracts" })}
          value={`${metrics.priorContracts}`}
          sub={t("contracts.counterpartyIntel.active", { defaultValue: "{{n}} active", n: metrics.activeContracts })}
          active={open === "contracts"}
          onClick={() => toggle("contracts")}
        />
        <Stat
          icon={GitBranch}
          label={t("contracts.counterpartyIntel.avgVersions", { defaultValue: "Avg versions" })}
          value={metrics.avgVersions != null ? `${metrics.avgVersions}` : "—"}
          sub={
            metrics.portfolioAvgVersions != null
              ? t("contracts.counterpartyIntel.norm", { defaultValue: "norm {{n}}", n: metrics.portfolioAvgVersions })
              : undefined
          }
          tone={versionsHigh ? "amber" : "default"}
          active={open === "versions"}
          onClick={() => toggle("versions")}
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
          active={open === "sentBack"}
          onClick={() => toggle("sentBack")}
        />
        <Stat
          icon={Scale}
          label={t("contracts.counterpartyIntel.riskCases", { defaultValue: "Risk cases" })}
          value={`${metrics.riskCases.total}`}
          sub={t("contracts.counterpartyIntel.open", { defaultValue: "{{n}} open", n: metrics.riskCases.open })}
          tone={metrics.riskCases.open > 0 ? "terracotta" : "default"}
          active={open === "risk"}
          onClick={() => toggle("risk")}
        />
      </div>

      {/* Drill-down frame */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key={open}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden rounded-md border border-border bg-card"
          >
            <DrillFrame tileKey={open} metrics={metrics} onClose={() => setOpen(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Themes — clickable → past redline comments */}
      {themes.length > 0 && (
        <button
          type="button"
          onClick={() => metrics.redlineComments.length > 0 && toggle("redlines")}
          aria-expanded={open === "redlines"}
          className={cn(
            "flex w-full flex-wrap items-center gap-1.5 rounded-md px-1 py-1 text-left",
            metrics.redlineComments.length > 0 && "hover:bg-surface/60",
          )}
        >
          <span className="text-[11px] font-medium text-ink-muted">
            {t("contracts.counterpartyIntel.themes", { defaultValue: "Watch:" })}
          </span>
          {themes.map((th) => (
            <span key={th} className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink">
              {th}
            </span>
          ))}
          {metrics.redlineComments.length > 0 && (
            <span className="ms-auto inline-flex items-center gap-1 text-[10px] text-ink-subtle">
              {t("contracts.counterpartyIntel.viewRedlines", {
                defaultValue: "{{n}} past redlines",
                n: metrics.redlineComments.length,
              })}
              <ChevronDown
                className={cn("h-3 w-3 transition-transform", open === "redlines" && "rotate-180")}
                aria-hidden
              />
            </span>
          )}
        </button>
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

// ─── Drill-down frame content per tile ──────────────────────────────────────

function DrillFrame({
  tileKey,
  metrics,
  onClose,
}: {
  tileKey: TileKey;
  metrics: PartyIntelligenceMetrics;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  const titles: Record<TileKey, string> = {
    contracts: t("contracts.counterpartyIntel.frame.contracts", { defaultValue: "Prior contracts" }),
    versions: t("contracts.counterpartyIntel.frame.versions", { defaultValue: "Negotiation rounds (versions)" }),
    sentBack: t("contracts.counterpartyIntel.frame.sentBack", { defaultValue: "Sent back in approval" }),
    risk: t("contracts.counterpartyIntel.frame.risk", { defaultValue: "Risk cases" }),
    redlines: t("contracts.counterpartyIntel.frame.redlines", { defaultValue: "Past redlines from previous contracts" }),
  };

  return (
    <div>
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-ink">{titles[tileKey]}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close", { defaultValue: "Close" })}
          className="rounded p-0.5 text-ink-subtle hover:bg-surface hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </header>
      <div className="max-h-[320px] overflow-y-auto p-2">
        {tileKey === "contracts" && <ContractsList rows={metrics.contracts} />}
        {tileKey === "versions" && (
          <ContractsList rows={[...metrics.contracts].sort((a, b) => b.versions - a.versions)} showVersions />
        )}
        {tileKey === "sentBack" && <SentBackList rows={metrics.sentBack} />}
        {tileKey === "risk" && <RiskList rows={metrics.riskCaseList} />}
        {tileKey === "redlines" && <RedlineList rows={metrics.redlineComments} />}
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-2 py-4 text-center text-xs text-ink-muted">{text}</p>;
}

function ContractRef({ id, number, title }: { id: number; number: string; title: string }) {
  return (
    <Link
      to="/app/contracts/$id"
      params={{ id: String(id) }}
      className="group inline-flex flex-col"
    >
      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-gold group-hover:underline">
        {number}
        <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
      </span>
      <span className="text-xs text-ink">{title}</span>
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ContractsList({
  rows,
  showVersions,
}: {
  rows: PartyIntelligenceMetrics["contracts"];
  showVersions?: boolean;
}) {
  const { t } = useTranslation();
  if (rows.length === 0)
    return <EmptyRow text={t("contracts.counterpartyIntel.frame.empty", { defaultValue: "Nothing to show." })} />;
  return (
    <ul className="divide-y divide-border/60">
      {rows.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 px-2 py-2">
          <ContractRef id={c.id} number={c.contractNumber} title={c.title} />
          <div className="flex shrink-0 items-center gap-2">
            {showVersions ? (
              <span className="font-mono text-xs text-ink">
                {t("contracts.counterpartyIntel.frame.vCount", { defaultValue: "v{{n}}", n: c.versions })}
              </span>
            ) : (
              c.valueAed != null &&
              c.valueAed > 0 && (
                <span className="font-mono text-[11px] text-ink-muted">
                  AED {c.valueAed.toLocaleString()}
                </span>
              )
            )}
            <StatusPill status={c.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function SentBackList({ rows }: { rows: PartyIntelligenceMetrics["sentBack"] }) {
  const { t } = useTranslation();
  if (rows.length === 0)
    return (
      <EmptyRow
        text={t("contracts.counterpartyIntel.frame.noSentBack", {
          defaultValue: "No contracts were rejected or sent back.",
        })}
      />
    );
  return (
    <ul className="divide-y divide-border/60">
      {rows.map((r, i) => (
        <li key={`${r.contractId}-${i}`} className="flex items-center justify-between gap-3 px-2 py-2">
          <ContractRef id={r.contractId} number={r.contractNumber} title={r.title} />
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                r.action === "rejected"
                  ? "bg-terracotta/15 text-terracotta"
                  : "bg-amber/15 text-amber-ink",
              )}
            >
              {r.action === "rejected"
                ? t("contracts.counterpartyIntel.frame.rejected", { defaultValue: "Rejected" })
                : t("contracts.counterpartyIntel.frame.resubmission", { defaultValue: "Resubmission" })}
            </span>
            <span className="text-[10px] text-ink-subtle">
              {(r.role ?? "—").replace(/_/g, " ")}
              {r.decidedAt ? ` · ${formatDateTime(r.decidedAt)}` : ""}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RiskList({ rows }: { rows: PartyIntelligenceMetrics["riskCaseList"] }) {
  const { t } = useTranslation();
  if (rows.length === 0)
    return (
      <EmptyRow
        text={t("contracts.counterpartyIntel.frame.noRisk", { defaultValue: "No risk cases raised." })}
      />
    );
  return (
    <ul className="divide-y divide-border/60">
      {rows.map((rc) => (
        <li key={rc.id} className="flex items-start justify-between gap-3 px-2 py-2">
          <div className="min-w-0">
            <Link
              to="/app/risk-cases/$caseId"
              params={{ caseId: String(rc.id) }}
              className="text-xs font-medium text-ink hover:text-gold hover:underline"
            >
              {rc.title}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-surface px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink-muted">
                {rc.caseType.replace(/_/g, " ")}
              </span>
              <Link
                to="/app/contracts/$id"
                params={{ id: String(rc.contractId) }}
                className="font-mono text-[10px] text-gold hover:underline"
              >
                {rc.contractNumber}
              </Link>
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              rc.open ? "bg-terracotta/15 text-terracotta" : "bg-sage/15 text-sage",
            )}
          >
            {rc.open
              ? t("contracts.counterpartyIntel.frame.open", { defaultValue: "Open" })
              : t("contracts.counterpartyIntel.frame.closed", { defaultValue: "Closed" })}
          </span>
        </li>
      ))}
    </ul>
  );
}

function RedlineList({ rows }: { rows: PartyIntelligenceMetrics["redlineComments"] }) {
  const { t } = useTranslation();
  if (rows.length === 0)
    return (
      <EmptyRow
        text={t("contracts.counterpartyIntel.frame.noRedlines", {
          defaultValue: "No redline comments on previous contracts.",
        })}
      />
    );
  return (
    <ul className="divide-y divide-border/60">
      {rows.map((rc, i) => (
        <li key={`${rc.contractId}-${i}`} className="px-2 py-2">
          <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
            {rc.clauseHeading && (
              <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold">
                {rc.clauseHeading}
              </span>
            )}
            <Link
              to="/app/contracts/$id"
              params={{ id: String(rc.contractId) }}
              className="font-mono text-[10px] text-ink-muted hover:text-gold hover:underline"
            >
              {rc.contractNumber}
            </Link>
          </div>
          <p className="text-xs text-ink">{rc.body}</p>
          {(rc.author || rc.createdAt) && (
            <p className="mt-0.5 text-[10px] text-ink-subtle">
              {rc.author ?? "—"}
              {rc.createdAt ? ` · ${formatDateTime(rc.createdAt)}` : ""}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
  active = false,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "amber" | "terracotta";
  active?: boolean;
  onClick?: () => void;
}) {
  const valueColor =
    tone === "terracotta" ? "text-terracotta" : tone === "amber" ? "text-amber-ink" : "text-ink";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={cn(
        "rounded-md border bg-card px-2.5 py-2 text-left transition-colors hover:border-gold/50",
        active ? "border-gold ring-1 ring-gold/40" : "border-border",
      )}
    >
      <div className="flex items-center justify-between text-ink-subtle">
        <div className="flex items-center gap-1">
          <Icon className="h-3 w-3" />
          <span className="font-mono text-[9px] uppercase tracking-wider">{label}</span>
        </div>
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", active && "rotate-180")}
          aria-hidden
        />
      </div>
      <p className={cn("mt-0.5 text-lg font-semibold tabular-nums leading-none", valueColor)}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-ink-subtle">{sub}</p>}
    </button>
  );
}
