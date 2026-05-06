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
  User,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { ContractStatusBadge } from "./ContractStatusBadge";
import { formatDate } from "@/utils/datetime";
import { partiesService } from "@/services/api/m_parity.service";
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

  const termLabel = useMemo(() => {
    if (!contract.startDate || !contract.endDate) return "—";
    const ms =
      new Date(contract.endDate).getTime() - new Date(contract.startDate).getTime();
    const days = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
    if (days === 0) return "—";
    const years = Math.round((days / 365) * 10) / 10;
    if (days >= 365) return t("contracts.detail.metaCard.termYears", { defaultValue: "{{years}}y", years });
    return t("contracts.detail.metaCard.termDays", { defaultValue: "{{days}}d", days });
  }, [contract.startDate, contract.endDate, t]);

  const valueLabel =
    contract.valueAed === null
      ? "—"
      : `${contract.currency} ${contract.valueAed.toLocaleString()}`;

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
  const partyName = (p?: { nameEn: string; nameAr: string | null }) =>
    p ? (isAr && p.nameAr ? p.nameAr : p.nameEn) : "—";
  const ourPartyName = partyName(partyResults[0].data);
  const counterpartyName = partyName(partyResults[1].data);

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
            <span className="text-sm text-ink">{contract.contractType}</span>
          </Row>
          <Row label={t("contracts.fields.status", { defaultValue: "Status" })}>
            <ContractStatusBadge status={contract.status} />
          </Row>
          <Row label={t("contracts.fields.language", { defaultValue: "Language" })}>
            <span className="text-sm text-ink uppercase">
              {contract.language === "bilingual" ? "AR · EN" : contract.language}
            </span>
          </Row>
          <Row label={t("contracts.fields.valueAed", { defaultValue: "Value" })}>
            <span className="font-mono text-sm text-ink">{valueLabel}</span>
          </Row>
          <Row label={t("contracts.detail.metaCard.term", { defaultValue: "Term" })}>
            <span className="font-mono text-sm text-ink">{termLabel}</span>
          </Row>
          <Row label={t("contracts.fields.startDate", { defaultValue: "Start" })}>
            <span className="font-mono text-sm text-ink">{formatDate(contract.startDate)}</span>
          </Row>
          <Row label={t("contracts.fields.endDate", { defaultValue: "End" })}>
            <span className="font-mono text-sm text-ink">{formatDate(contract.endDate)}</span>
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
            href={contract.ourPartyId ? `/app/parties/${contract.ourPartyId}` : undefined}
          />
          <PartyRow
            roleLabel={t("contracts.detail.partiesCard.counterparty", {
              defaultValue: "Counterparty",
            })}
            name={counterpartyName}
            icon={<Building2 className="h-4 w-4 text-gold" />}
            href={contract.counterpartyId ? `/app/parties/${contract.counterpartyId}` : undefined}
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
