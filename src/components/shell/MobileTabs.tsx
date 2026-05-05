import { Link, useRouterState } from "@tanstack/react-router";
import { Home, FileText, CheckCircle2, LayoutGrid, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/app", icon: Home, key: "nav.home", defaultLabel: "Home" },
  { to: "/app/contracts", icon: FileText, key: "nav.contracts", defaultLabel: "Contracts" },
  { to: "/app/approvals", icon: CheckCircle2, key: "nav.approvals", defaultLabel: "Approvals" },
  { to: "/app/dashboards/insights", icon: LayoutGrid, key: "nav.insights", defaultLabel: "Insights" },
  { to: "/app/more", icon: MoreHorizontal, key: "nav.more", defaultLabel: "More" },
] as const;

export function MobileTabs() {
  const { t } = useTranslation();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card md:hidden"
      style={{
        paddingBottom: "max(0px, env(safe-area-inset-bottom))",
        minHeight: "calc(4rem + env(safe-area-inset-bottom))",
      }}
    >
      {TABS.map((tab) => {
        const active =
          path === tab.to ||
          (tab.to !== "/app" && path.startsWith(tab.to)) ||
          (tab.to === "/app" && path === "/app");
        const Icon = tab.icon;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "tap-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px]",
              active ? "text-gold" : "text-ink-subtle",
            )}
          >
            <Icon className={cn("h-5 w-5", active && "text-gold")} />
            <span className={cn(active && "font-medium text-ink")}>
              {t(tab.key, { defaultValue: tab.defaultLabel })}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
