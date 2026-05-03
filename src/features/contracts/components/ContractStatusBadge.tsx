/**
 * ContractStatusBadge — small chip rendering a contract's lifecycle status
 * with a semantic-token color group per status family. Used throughout the
 * contracts feature (list cells, detail header, timeline nodes, version
 * timestamp pills).
 *
 * All 14 enum values from ContractStatus are mapped. Translation keys live
 * under `contractStatus.<value>` (already shipped in M0 i18n bundles).
 *
 * T5 Token replacement — every color is a semantic Tailwind token.
 * T7 Type safety — exhaustive switch over ContractStatus.
 */
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ContractStatus } from "@/types/entities/contract.types";

interface ContractStatusBadgeProps {
  status: ContractStatus;
  className?: string;
}

type Tone = "gold" | "sage" | "amber" | "terracotta" | "plum" | "slate";

function toneFor(status: ContractStatus): Tone {
  switch (status) {
    case "draft":
    case "in_review":
      return "slate";
    case "approved":
    case "fully_signed":
    case "active":
      return "sage";
    case "awaiting_signature_employer":
    case "awaiting_signature_counterparty":
    case "expiring_soon":
      return "amber";
    case "expired":
    case "rejected":
    case "terminated":
      return "terracotta";
    case "amended":
    case "renewed":
      return "plum";
    case "resubmission_requested":
      return "gold";
    default: {
      // Defensive fallback when a future status is added before this code is updated.
      const _exhaustive: never = status;
      void _exhaustive;
      return "slate";
    }
  }
}

const TONE_CLASSES: Record<Tone, string> = {
  gold: "border-gold/40 bg-gold-tint text-gold",
  sage: "border-sage/40 bg-sage-tint text-sage-ink",
  amber: "border-amber/40 bg-amber-tint text-amber-ink",
  terracotta: "border-terracotta/40 bg-terracotta-tint text-terracotta-ink",
  plum: "border-plum/40 bg-plum-tint text-plum-ink",
  slate: "border-slate/40 bg-slate-tint text-slate-ink",
};

export function ContractStatusBadge({ status, className }: ContractStatusBadgeProps) {
  const { t } = useTranslation();
  const tone = toneFor(status);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {t(`contractStatus.${status}`, { defaultValue: status })}
    </span>
  );
}

export default ContractStatusBadge;
