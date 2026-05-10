/**
 * IcvStatusBadge — semantic-token visual for IcvStatus.
 *
 * Per R-PA7 lesson C13:
 *   certified  → sage
 *   pending    → amber
 *   downgraded → plum
 *   expired    → terracotta
 *   none       → ink-subtle (gray)
 */
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  Clock,
  ArrowDownCircle,
  XCircle,
  Circle,
} from "lucide-react";
import type { IcvStatus } from "@/types/entities/party-graph.types";

const TONE_CLASS: Record<IcvStatus, string> = {
  certified: "bg-sage/15 text-sage",
  pending: "bg-amber/15 text-amber-ink",
  downgraded: "bg-plum/15 text-plum-ink",
  expired: "bg-terracotta/15 text-terracotta",
  none: "bg-ink/5 text-ink-subtle",
};

const ICON: Record<IcvStatus, React.ComponentType<{ className?: string }>> = {
  certified: CheckCircle2,
  pending: Clock,
  downgraded: ArrowDownCircle,
  expired: XCircle,
  none: Circle,
};

const I18N_KEY: Record<IcvStatus, string> = {
  certified: "parties.icv.certified",
  pending: "parties.icv.pending",
  downgraded: "parties.icv.downgraded",
  expired: "parties.icv.expired",
  none: "parties.icv.none",
};

export interface IcvStatusBadgeProps {
  status: IcvStatus;
  /** Optional ICV percentage to display alongside the label. */
  pct?: number | null;
  showLabel?: boolean;
  className?: string;
}

export function IcvStatusBadge({
  status,
  pct,
  showLabel = true,
  className,
}: IcvStatusBadgeProps) {
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
      <span>
        {label}
        {typeof pct === "number" ? ` · ${pct}%` : ""}
      </span>
    </span>
  );
}
