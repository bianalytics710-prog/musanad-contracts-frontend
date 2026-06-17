/**
 * RiskTypePill — shared visual chip for the rule-based risk taxonomy.
 *
 * Backed by fn_classify_risk (migration 544). Used on both the executive
 * Critical Impact frame and the Risk Cases list/detail so the same row
 * carries the same colored label across surfaces.
 *
 * The taxonomy slugs are exhaustive (12 + "other"); unknown values fall
 * through to a neutral "other" pill so a future DB taxonomy expansion
 * doesn't break the FE.
 */
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type RiskTypeSlug =
  | "force_majeure"
  | "sanctions"
  | "sla_breach"
  | "approval_workflow"
  | "budget_overrun"
  | "counterparty_concentration"
  | "vendor_supplier"
  | "icv_local_content"
  | "esg_sustainability"
  | "commodity_price"
  | "regulatory_change"
  | "geopolitical"
  | "other";

export const RISK_TYPE_SLUGS: RiskTypeSlug[] = [
  "force_majeure",
  "sanctions",
  "sla_breach",
  "budget_overrun",
  "counterparty_concentration",
  "vendor_supplier",
  "icv_local_content",
  "esg_sustainability",
  "commodity_price",
  "regulatory_change",
  "geopolitical",
  "other",
];

/**
 * Each slug maps to a Tailwind palette pair. Colors deliberately pull
 * from existing design tokens (terracotta / gold / sage / slate) to stay
 * inside the project's palette. Severity-adjacent risks (force_majeure /
 * sanctions / sla_breach) use terracotta; financial risks use gold;
 * regulatory / process risks use sage; "other" falls back to muted slate.
 */
const PALETTE: Record<RiskTypeSlug, string> = {
  force_majeure: "bg-terracotta/15 text-terracotta border-terracotta/30",
  sanctions: "bg-terracotta/15 text-terracotta border-terracotta/30",
  sla_breach: "bg-terracotta/15 text-terracotta border-terracotta/30",
  approval_workflow: "bg-amber/15 text-amber border-amber/30",
  budget_overrun: "bg-gold/15 text-gold border-gold/30",
  counterparty_concentration: "bg-gold/15 text-gold border-gold/30",
  vendor_supplier: "bg-gold/15 text-gold border-gold/30",
  commodity_price: "bg-gold/15 text-gold border-gold/30",
  icv_local_content: "bg-sage/15 text-sage border-sage/30",
  esg_sustainability: "bg-sage/15 text-sage border-sage/30",
  regulatory_change: "bg-sage/15 text-sage border-sage/30",
  geopolitical: "bg-terracotta/15 text-terracotta border-terracotta/30",
  other: "bg-muted text-ink-muted border-border",
};

export function RiskTypePill({
  type,
  size = "sm",
  className,
}: {
  type: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  const { t } = useTranslation();
  const slug: RiskTypeSlug =
    type && (RISK_TYPE_SLUGS as readonly string[]).includes(type)
      ? (type as RiskTypeSlug)
      : "other";
  const label = t(`riskTypes.${slug}`, { defaultValue: slug.replace(/_/g, " ") });
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold uppercase tracking-wider",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        PALETTE[slug],
        className,
      )}
      title={label}
    >
      {label}
    </span>
  );
}
