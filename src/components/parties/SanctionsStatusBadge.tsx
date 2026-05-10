/**
 * SanctionsStatusBadge — semantic-token visual for SanctionsStatus.
 *
 * Per R-PA7 lesson C13 (no raw hex):
 *   clean        → sage   (success)
 *   flagged      → amber  (warning)
 *   sanctioned   → terracotta (destructive)
 *   under_review → slate  (neutral info)
 */
import { useTranslation } from "react-i18next";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  ShieldQuestion,
} from "lucide-react";
import type { SanctionsStatus } from "@/types/entities/party-graph.types";

const TONE_CLASS: Record<SanctionsStatus, string> = {
  clean: "bg-sage/15 text-sage",
  flagged: "bg-amber/15 text-amber-ink",
  sanctioned: "bg-terracotta/15 text-terracotta",
  under_review: "bg-slate/15 text-slate-ink",
};

const ICON: Record<
  SanctionsStatus,
  React.ComponentType<{ className?: string }>
> = {
  clean: ShieldCheck,
  flagged: ShieldAlert,
  sanctioned: ShieldOff,
  under_review: ShieldQuestion,
};

const I18N_KEY: Record<SanctionsStatus, string> = {
  clean: "parties.sanctions.clean",
  flagged: "parties.sanctions.flagged",
  sanctioned: "parties.sanctions.sanctioned",
  under_review: "parties.sanctions.underReview",
};

export interface SanctionsStatusBadgeProps {
  status: SanctionsStatus;
  /** When false, render only a colored dot (compact contexts). */
  showLabel?: boolean;
  className?: string;
}

export function SanctionsStatusBadge({
  status,
  showLabel = true,
  className,
}: SanctionsStatusBadgeProps) {
  const { t } = useTranslation();
  const Icon = ICON[status];
  const tone = TONE_CLASS[status];
  const label = t(I18N_KEY[status]);

  if (!showLabel) {
    return (
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${tone.split(" ")[0]} ${className ?? ""}`}
        aria-label={label}
        title={label}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tone} ${className ?? ""}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}
