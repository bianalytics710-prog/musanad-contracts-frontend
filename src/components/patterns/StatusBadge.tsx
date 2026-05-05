import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Variant =
  | "signed"
  | "pending"
  | "risk"
  | "resubmission"
  | "regulatory"
  | "action";

const variants: Record<Variant, string> = {
  signed: "bg-sage-tint text-sage-ink",
  pending: "bg-amber-tint text-amber-ink",
  risk: "bg-terracotta-tint text-terracotta-ink",
  resubmission: "bg-plum-tint text-plum-ink",
  regulatory: "bg-slate-tint text-slate-ink",
  action: "bg-gold-tint text-gold",
};

interface Props {
  variant?: Variant;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

export function StatusBadge({ variant = "regulatory", dot, children, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
