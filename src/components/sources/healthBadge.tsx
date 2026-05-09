/**
 * HealthStateBadge — shared visual + i18n token mapping for HealthState.
 *
 * Per the M7 brief + R-PA7 lesson C13 (no raw hex):
 *   healthy      → var(--sage)
 *   degraded     → var(--gold)       (amber tone in design system)
 *   failing      → var(--terracotta) (red tone)
 *   unauthorised → ink-subtle        (gray)
 */
import { useTranslation } from "react-i18next";
import { Activity, AlertTriangle, ShieldOff, ServerCrash } from "lucide-react";
import type { HealthState } from "@/types/entities/osint.types";

const TONE_CLASS: Record<HealthState, string> = {
  healthy: "bg-sage/15 text-sage",
  degraded: "bg-gold/15 text-gold",
  failing: "bg-terracotta/15 text-terracotta",
  unauthorised: "bg-ink/5 text-ink-subtle",
};

const ICON: Record<HealthState, React.ComponentType<{ className?: string }>> = {
  healthy: Activity,
  degraded: AlertTriangle,
  failing: ServerCrash,
  unauthorised: ShieldOff,
};

export function healthLabelKey(state: HealthState): string {
  return `admin.sources.health.state.${state}`;
}

export interface HealthStateBadgeProps {
  state: HealthState;
  /** Show the icon + label (true) or just a colored dot (false). */
  showLabel?: boolean;
  className?: string;
}

export function HealthStateBadge({
  state,
  showLabel = true,
  className,
}: HealthStateBadgeProps) {
  const { t } = useTranslation();
  const Icon = ICON[state];
  const tone = TONE_CLASS[state];
  const label = t(healthLabelKey(state), {
    defaultValue:
      state === "healthy"
        ? "Healthy"
        : state === "degraded"
          ? "Degraded"
          : state === "failing"
            ? "Failing"
            : "Unauthorised",
  });

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
