import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  kicker?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, kicker, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-4 pb-6", className)}>
      <div>
        {kicker && (
          <div className="mb-2 font-mono text-xs uppercase tracking-wider text-ink-subtle">
            {kicker}
          </div>
        )}
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  kicker?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageLayout({
  children,
  title,
  kicker,
  actions,
  className,
}: PageLayoutProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 md:py-8", className)}>
      {title && <PageHeader title={title} kicker={kicker} actions={actions} />}
      {children}
    </div>
  );
}
