import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  variant?: "default" | "risk" | "warning";
  className?: string;
}

export function StatCard({ label, value, delta, variant = "default", className }: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        variant === "risk" && "border-l-2 border-l-terracotta",
        variant === "warning" && "border-l-2 border-l-amber",
        className,
      )}
    >
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div className="font-mono text-2xl font-semibold tracking-tight text-ink">{value}</div>
      {delta && <div className="mt-1 font-mono text-xs text-ink-subtle">{delta}</div>}
    </div>
  );
}
