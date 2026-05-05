import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  header?: ReactNode;
  className?: string;
}

export function SurfaceCard({ children, header, className }: Props) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      {header && (
        <div className="mb-3 border-b border-border pb-3 text-sm font-semibold text-ink">
          {header}
        </div>
      )}
      {children}
    </div>
  );
}
