import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Languages,
  LogOut,
  Settings,
} from "lucide-react";

import { useTranslation } from "react-i18next";
import { useAuthStore, selectUser, selectRefreshToken } from "@/store/auth.store";
import { useTheme } from "@/lib/design-system/theme-provider";
import { authService } from "@/services/api/auth.service";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ADMIN_SUB_NAV, CLAUSES_SUB_NAV, modulesForRole } from "@/config/sidebar";
import { useNavigate } from "@tanstack/react-router";

function getInitials(firstName: string | undefined, lastName: string | undefined): string {
  const first = firstName?.[0] ?? "";
  const last = lastName?.[0] ?? "";
  return (first + last).toUpperCase() || "U";
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore(selectUser);
  const refreshToken = useAuthStore(selectRefreshToken);
  const logoutAction = useAuthStore((s) => s.logout);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { resolvedTheme, toggleTheme, locale, setLocale } = useTheme();
  const navigate = useNavigate();

  const toggleLang = () => {
    const next = locale === "ar" ? "en" : "ar";
    setLocale(next);
    void i18n.changeLanguage(next);
  };

  const handleSignOut = async () => {
    try {
      if (refreshToken) await authService.logout({ refreshToken });
    } catch {
      // best-effort
    } finally {
      logoutAction();
      void navigate({ to: "/auth/login" });
    }
  };

  const items = modulesForRole(user?.role.name);

  const initials = getInitials(user?.firstName, user?.lastName);
  const fullName = user ? `${user.firstName} ${user.lastName}` : "";

  return (
    <aside
      className={cn(
        "fixed inset-y-0 start-0 z-30 hidden flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex h-14 items-center justify-between px-4">
        <Link to="/app" className="flex items-center gap-2">
          <span
            className="block rounded-full bg-gold"
            style={{ width: brand.mark.size, height: brand.mark.size }}
          />
          {!collapsed && (
            <span
              className="text-[18px] font-medium tracking-tight"
              style={{ letterSpacing: brand.wordmark.letterSpacing }}
            >
              {brand.name}
            </span>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="rounded p-1 text-sidebar-foreground/60 hover:bg-white/10 hover:text-sidebar-foreground"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {items.map((item) => {
          const Icon = item.icon;
          const isAdmin = item.key === "admin";
          const isClauses = item.key === "clauses";
          const onAdminRoute = path === "/app/admin" || path.startsWith("/app/admin/");
          const onClausesRoute = path === "/app/clauses" || path.startsWith("/app/clauses/");
          const active = isAdmin
            ? path === item.to
            : path === item.to || path.startsWith(item.to + "/");
          const highlight = isAdmin ? onAdminRoute : active;

          return (
            <div key={item.key}>
              <Link
                to={item.to}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  highlight ? "bg-white/15" : "hover:bg-white/10",
                )}
              >
                {highlight && (
                  <span className="absolute inset-y-1 start-0 w-0.5 rounded-full bg-gold" />
                )}
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && (
                  <span className="font-medium">
                    {t(item.labelKey, { defaultValue: item.defaultLabel })}
                  </span>
                )}
              </Link>

              {isAdmin && onAdminRoute && !collapsed && (
                <ul className="mt-1 ms-4 space-y-0.5 border-s border-white/10 ps-2">
                  {ADMIN_SUB_NAV.map((sub) => {
                    const subActive = path === sub.to;
                    const SubIcon = sub.icon;
                    return (
                      <li key={sub.to}>
                        <Link
                          to={sub.to}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                            subActive
                              ? "bg-gold/20 text-white font-medium"
                              : "text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground",
                          )}
                        >
                          <SubIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {t(sub.labelKey, { defaultValue: sub.defaultLabel })}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              {/* M12 — Clauses sub-nav (review queue) when on a /app/clauses/* route */}
              {isClauses && onClausesRoute && !collapsed && (
                <ul className="mt-1 ms-4 space-y-0.5 border-s border-white/10 ps-2">
                  {CLAUSES_SUB_NAV.map((sub) => {
                    const subActive = path === sub.to || path.startsWith(sub.to + "/");
                    const SubIcon = sub.icon;
                    return (
                      <li key={sub.to}>
                        <Link
                          to={sub.to}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                            subActive
                              ? "bg-gold/20 text-white font-medium"
                              : "text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground",
                          )}
                        >
                          <SubIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {t(sub.labelKey, { defaultValue: sub.defaultLabel })}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {user && (
        <div className="border-t border-white/10 p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg p-2 text-start hover:bg-white/10",
                  collapsed && "justify-center",
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-gold text-ink text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{fullName}</div>
                    <div className="truncate text-xs text-sidebar-foreground/60">
                      {t(`roles.${user.role.name}`, { defaultValue: user.role.name })}
                    </div>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56">
              <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleTheme}>
                {resolvedTheme === "light" ? (
                  <Moon className="me-2 h-4 w-4" />
                ) : (
                  <Sun className="me-2 h-4 w-4" />
                )}
                {t("common.theme", { defaultValue: "Toggle theme" })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleLang}>
                <Languages className="me-2 h-4 w-4" />
                {t("common.language", { defaultValue: "Language" })} ({locale === "ar" ? "ع" : "EN"})
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Settings className="me-2 h-4 w-4" />
                {t("common.settings", { defaultValue: "Settings" })}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="me-2 h-4 w-4" />
                {t("common.signOut", { defaultValue: "Sign out" })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </aside>
  );
}
