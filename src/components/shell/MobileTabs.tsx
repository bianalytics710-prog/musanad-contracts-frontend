import { Link, useRouterState } from "@tanstack/react-router";
import { Home, FileText, CheckCircle2, LayoutGrid, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAuthStore, selectUser, selectHasPermission } from "@/store/auth.store";

const ALL_TABS = [
  { to: "/app", icon: Home, key: "nav.home", defaultLabel: "Home", showAlways: true },
  { to: "/app/contracts", icon: FileText, key: "nav.contracts", defaultLabel: "Contracts", showAlways: true },
  { to: "/app/approvals", icon: CheckCircle2, key: "nav.approvals", defaultLabel: "Approvals", requiresPerm: "approval.act" },
  { to: "/app/dashboards/insights", icon: LayoutGrid, key: "nav.insights", defaultLabel: "Insights", showAlways: true },
  { to: "/app/more", icon: MoreHorizontal, key: "nav.more", defaultLabel: "More", showAlways: true },
] as const;

// R39 (Rashid audit 2026-06-01) — role-aware mobile-tab labels so the same
// destination (/app/dashboards/insights → /app/dashboards/recipient) uses
// the same wording as the launcher H1 ("My contracts" not "Insights").
// Falls through to the default label for roles not in this map.
const ROLE_TAB_LABEL_OVERRIDES: Record<string, Partial<Record<string, string>>> = {
  contract_recipient: {
    "nav.insights": "My contracts",
  },
};

export function MobileTabs() {
  const { t } = useTranslation();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const user = useAuthStore(selectUser);
  const canApprove = useAuthStore(selectHasPermission("approval.act"));

  // E48 fix — desktop sidebar correctly hides "Approvals" for roles without
  // approval.act perm (e.g. Eman Executive). The mobile tab strip was
  // showing the link unconditionally → 403 on tap. Gate it on the same
  // permission as the desktop sidebar.
  const TABS = ALL_TABS.filter((tab) => {
    if ("showAlways" in tab && tab.showAlways) return true;
    if ("requiresPerm" in tab && tab.requiresPerm === "approval.act") return !!user && canApprove;
    return true;
  });

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
              {(() => {
                const overrides = user?.role?.name
                  ? ROLE_TAB_LABEL_OVERRIDES[user.role.name]
                  : undefined;
                const override = overrides?.[tab.key];
                return t(tab.key, { defaultValue: override ?? tab.defaultLabel });
              })()}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
