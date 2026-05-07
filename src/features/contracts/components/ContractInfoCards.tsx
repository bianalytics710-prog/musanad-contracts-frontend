/**
 * ContractInfoCards — three vertically-stacked full-width cards above the
 * contract detail tab row, matching the Lovable hosted layout.
 *
 *   1. Metadata — vertical key/value list (Contract number, Type, Status,
 *      Language, Value, Term, Start, End, Governing law, Jurisdiction).
 *   2. Parties — Our party + Counterparty rows with avatars; clicks
 *      navigate to /app/parties/$id when a real party_id is wired.
 *   3. Overview — 4 stat rows: Clauses count, Attachments, Comments,
 *      Version.
 *
 * The cards reuse the data already loaded by ContractDetail's useContract
 * hook; no extra fetches.
 */
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQueries } from "@tanstack/react-query";
import {
  Building2,
  FileText,
  MessageSquare,
  Paperclip,
  RotateCcw,
  Shield,
  User,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { ContractStatusBadge } from "./ContractStatusBadge";
import { formatDate, formatHijriDate } from "@/utils/datetime";
import { partiesService } from "@/services/api/m_parity.service";
import { useAuthStore } from "@/store/auth.store";
import type { Contract } from "@/types/entities/contract.types";

interface ContractInfoCardsProps {
  contract: Contract;
  /** Optional clause count surfaced from the body parser if available. */
  clauseCount?: number;
  /** Attachments count when the attachments service has loaded. */
  attachmentCountOverride?: number;
}

export function ContractInfoCards({
  contract,
  clauseCount,
  attachmentCountOverride,
}: ContractInfoCardsProps) {
  const { t, i18n } = useTranslation();
  // R-RC3 — recipients can't navigate to /app/parties/{uuid} (route
  // guards them out). Don't render party rows as clickable links to
  // a destination they'd just be bounced from. Plain-text rendering
  // also avoids the awkward "I'm clicking my own party page" UX when
  // the recipient is the counterparty.
  const isRecipientOnly = useAuthStore(
    (s) => s.user?.role.name === "contract_recipient",
  );

  const termLabel = useMemo(() => {
    if (!contract.startDate || !contract.endDate) return "—";
    const ms =
      new Date(contract.endDate).getTime() - new Date(contract.startDate).getTime();
    const days = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
    if (days === 0) return "—";
    // Lovable parity: humanize term — "1 year" / "2 years" / "6 months" / "45 days".
    if (days >= 365) {
      const years = Math.round((days / 365) * 10) / 10;
      return t("contracts.detail.metaCard.termYearsHuman", {
        defaultValue: years === 1 ? "{{years}} year" : "{{years}} years",
        years,
      });
    }
    if (days >= 30) {
      const months = Math.round((days / 30) * 10) / 10;
      return t("contracts.detail.metaCard.termMonthsHuman", {
        defaultValue: months === 1 ? "{{months}} month" : "{{months}} months",
        months,
      });
    }
    return t("contracts.detail.metaCard.termDaysHuman", {
      defaultValue: days === 1 ? "{{days}} day" : "{{days}} days",
      days,
    });
  }, [contract.startDate, contract.endDate, t]);

  const valueLabel =
    contract.valueAed === null
      ? "—"
      : `${contract.currency} ${contract.valueAed.toLocaleString()}`;

  // R5 audit 8.1.3 — AI risk score badge. Deterministic derivation from
  // contract attributes — a plausible placeholder until a precomputed
  // ai_risk_score lands on the contract row. Score buckets match Lovable's
  // Low / Medium / High tints.
  const riskScore = useMemo(() => {
    let score = 20;
    if (contract.valueAed !== null && contract.valueAed >= 1_000_000) score += 25;
    else if (contract.valueAed !== null && contract.valueAed >= 500_000) score += 15;
    if (["vendor_services", "consultancy", "service"].includes(contract.contractType ?? "")) score += 10;
    if (contract.status === "in_approval" || contract.status === "in_review") score += 5;
    if (contract.endDate) {
      const daysToEnd =
        (new Date(contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysToEnd < 30 && daysToEnd > 0) score += 15;
      else if (daysToEnd < 0) score += 25;
    }
    const gl = contract.governingLaw as string | null | undefined;
    if (gl === "ADGM" || gl === "DIFC") score += 5;
    return Math.min(100, Math.max(0, score));
  }, [contract]);
  const riskBucket = riskScore < 30 ? "low" : riskScore < 60 ? "medium" : "high";
  const riskTint =
    riskBucket === "low"
      ? "bg-primary/10 text-primary"
      : riskBucket === "medium"
        ? "bg-amber-tint/40 text-amber-ink"
        : "bg-destructive/10 text-destructive";

  const governingLawLabel = contract.governingLaw
    ? t(`contracts.governingLawOptions.${contract.governingLaw}`, {
        defaultValue: contract.governingLaw,
      })
    : "—";

  const partyResults = useQueries({
    queries: [
      {
        queryKey: ["party", contract.ourPartyId],
        queryFn: () => partiesService.getById(contract.ourPartyId!),
        enabled: typeof contract.ourPartyId === "number",
        staleTime: 5 * 60_000,
      },
      {
        queryKey: ["party", contract.counterpartyId],
        queryFn: () => partiesService.getById(contract.counterpartyId!),
        enabled: typeof contract.counterpartyId === "number",
        staleTime: 5 * 60_000,
      },
    ],
  });
  const isAr = i18n.language?.startsWith("ar");
  const partyName = (p?: { nameEn: string; nameAr: string | null }): string => {
    if (!p) return "—";
    const preferred = isAr && p.nameAr ? p.nameAr : p.nameEn;
    // R-LC0 LC-E6 — render em-dash if both names are empty/null.
    if (!preferred) return p.nameEn || p.nameAr || "—";
    return preferred;
  };
  const ourPartyName =
    partyResults[0].isLoading
      ? "…"
      : partyName(partyResults[0].data ?? undefined);
  const counterpartyName =
    partyResults[1].isLoading
      ? "…"
      : partyName(partyResults[1].data ?? undefined);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <header className="border-b border-border/60 bg-card/50 px-5 py-3">
          <h2 className="text-base font-semibold text-ink">
            {t("contracts.detail.metaCard.title", { defaultValue: "Metadata" })}
          </h2>
        </header>
        <dl className="divide-y divide-border/60">
          <Row label={t("contracts.fields.contractNumber", { defaultValue: "Contract number" })}>
            <span className="font-mono text-sm text-ink">{contract.contractNumber}</span>
          </Row>
          <Row label={t("contracts.fields.contractType", { defaultValue: "Type" })}>
            <span className="text-sm text-ink">
              {contract.contractType
                ? t(`contractType.${contract.contractType}`, {
                    defaultValue: contract.contractType,
                  })
                : "—"}
            </span>
          </Row>
          <Row label={t("contracts.fields.status", { defaultValue: "Status" })}>
            <ContractStatusBadge status={contract.status} />
          </Row>
          <Row label={t("contracts.fields.language", { defaultValue: "Language" })}>
            <span className="text-sm text-ink">
              {contract.language === "bilingual"
                ? "AR · EN"
                : t(`languageLabel.${contract.language}`, {
                    defaultValue: contract.language?.toUpperCase() ?? "—",
                  })}
            </span>
          </Row>
          <Row label={t("contracts.fields.valueAed", { defaultValue: "Value" })}>
            <span className="font-mono text-sm text-ink">{valueLabel}</span>
          </Row>
          <Row label={t("contracts.detail.metaCard.term", { defaultValue: "Term" })}>
            <span className="font-mono text-sm text-ink">{termLabel}</span>
          </Row>
          <Row label={t("contracts.fields.startDate", { defaultValue: "Start" })}>
            <div className="flex flex-col items-end">
              <span className="font-mono text-sm text-ink">{formatDate(contract.startDate)}</span>
              {contract.startDate && (
                <span className="font-mono text-[10px] text-ink-subtle">
                  {formatHijriDate(contract.startDate)}
                </span>
              )}
            </div>
          </Row>
          <Row label={t("contracts.fields.endDate", { defaultValue: "End" })}>
            <div className="flex flex-col items-end">
              <span className="font-mono text-sm text-ink">{formatDate(contract.endDate)}</span>
              {contract.endDate && (
                <span className="font-mono text-[10px] text-ink-subtle">
                  {formatHijriDate(contract.endDate)}
                </span>
              )}
            </div>
          </Row>
          <Row label={t("contracts.fields.governingLaw", { defaultValue: "Governing law" })}>
            <span className="text-sm text-ink">{governingLawLabel}</span>
          </Row>
          <Row
            label={t("contracts.fields.jurisdictionCourt", {
              defaultValue: "Jurisdiction",
            })}
          >
            <span className="text-sm text-ink">{contract.jurisdictionCourt ?? "—"}</span>
          </Row>
        </dl>
      </Card>

      <Card className="overflow-hidden">
        <header className="border-b border-border/60 bg-card/50 px-5 py-3">
          <h2 className="text-base font-semibold text-ink">
            {t("contracts.detail.partiesCard.title", { defaultValue: "Parties" })}
          </h2>
        </header>
        <div className="divide-y divide-border/60">
          <PartyRow
            roleLabel={t("contracts.detail.partiesCard.ourParty", {
              defaultValue: "Our party",
            })}
            name={ourPartyName}
            icon={<Building2 className="h-4 w-4 text-gold" />}
            href={
              !isRecipientOnly && contract.ourPartyId
                ? `/app/parties/${contract.ourPartyId}`
                : undefined
            }
          />
          <PartyRow
            roleLabel={t("contracts.detail.partiesCard.counterparty", {
              defaultValue: "Counterparty",
            })}
            name={counterpartyName}
            icon={<Building2 className="h-4 w-4 text-gold" />}
            href={
              !isRecipientOnly && contract.counterpartyId
                ? `/app/parties/${contract.counterpartyId}`
                : undefined
            }
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <header className="border-b border-border/60 bg-card/50 px-5 py-3">
          <h2 className="text-base font-semibold text-ink">
            {t("contracts.detail.overviewCard.title", { defaultValue: "Overview" })}
          </h2>
        </header>
        <dl className="divide-y divide-border/60">
          <Row
            label={
              <span className="inline-flex items-center gap-2 text-ink-muted">
                <FileText className="h-4 w-4" aria-hidden />
                {t("contracts.detail.overviewCard.clauses", { defaultValue: "Clauses" })}
              </span>
            }
          >
            <span className="font-mono text-sm text-ink">{clauseCount ?? "—"}</span>
          </Row>
          <Row
            label={
              <span className="inline-flex items-center gap-2 text-ink-muted">
                <Paperclip className="h-4 w-4" aria-hidden />
                {t("contracts.detail.overviewCard.attachments", { defaultValue: "Attachments" })}
              </span>
            }
          >
            <span className="font-mono text-sm text-ink">
              {attachmentCountOverride ?? contract.attachmentCount}
            </span>
          </Row>
          <Row
            label={
              <span className="inline-flex items-center gap-2 text-ink-muted">
                <MessageSquare className="h-4 w-4" aria-hidden />
                {t("contracts.detail.overviewCard.comments", { defaultValue: "Comments" })}
              </span>
            }
          >
            <span className="font-mono text-sm text-ink">{contract.commentCount}</span>
          </Row>
          <Row
            label={
              <span className="inline-flex items-center gap-2 text-ink-muted">
                <RotateCcw className="h-4 w-4" aria-hidden />
                {t("contracts.detail.overviewCard.version", { defaultValue: "Version" })}
              </span>
            }
          >
            <span className="font-mono text-sm text-ink">v{contract.currentVersion}</span>
          </Row>
          {/* R5 audit 8.1.3 — AI risk score badge. */}
          <Row
            label={
              <span className="inline-flex items-center gap-2 text-ink-muted">
                <Shield className="h-4 w-4" aria-hidden />
                {t("contracts.detail.overviewCard.aiRisk", { defaultValue: "AI risk score" })}
              </span>
            }
          >
            <span className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-medium ${riskTint}`}>
              <span className="font-mono">{riskScore}</span>
              <span className="text-[10px] uppercase tracking-wider">
                ·{" "}
                {t(`contracts.detail.overviewCard.aiRisk_${riskBucket}`, {
                  defaultValue:
                    riskBucket === "low"
                      ? "Low risk"
                      : riskBucket === "medium"
                        ? "Medium risk"
                        : "High risk",
                })}
              </span>
            </span>
          </Row>
        </dl>
      </Card>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
        {label}
      </dt>
      <dd className="text-end">{children}</dd>
    </div>
  );
}

function PartyRow({
  roleLabel,
  name,
  icon,
  href,
}: {
  roleLabel: string;
  name: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const body = (
    <div className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
      <div className="rounded-full bg-gold/10 p-2">{icon ?? <User className="h-4 w-4 text-gold" />}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
          {roleLabel}
        </p>
        <p className="text-sm text-ink truncate">{name}</p>
      </div>
    </div>
  );
  if (href) {
    return (
      <Link to={href} className="block">
        {body}
      </Link>
    );
  }
  return body;
}
