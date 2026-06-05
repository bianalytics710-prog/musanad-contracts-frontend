import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Languages,
  LogOut,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { useAuthStore, selectUser, selectRefreshToken, selectHasPermission } from "@/store/auth.store";
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
import { ADMIN_GROUPS, ADMIN_SUB_NAV, CLAUSES_SUB_NAV, modulesForEffectiveSet, modulesForRole, type AdminGroupKey } from "@/config/sidebar";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { sidebarOrderService } from "@/services/api/sidebar-order.service";

function getInitials(firstName: string | undefined, lastName: string | undefined): string {
  const first = firstName?.[0] ?? "";
  // OqoodAI rebrand 2026-06-01 — Emirati family names typically use "Al X"
  // patterns. Take the X letter (after "Al ") rather than the redundant
  // leading A, so "Aisha Al Nahyan" reads "AN" not "AA".
  let last = lastName?.[0] ?? "";
  const ln = (lastName ?? "").trim();
  if (/^Al\s+\S/i.test(ln)) {
    const m = ln.match(/^Al\s+(\S)/i);
    if (m && m[1]) last = m[1];
  }
  return (first + last).toUpperCase() || "U";
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore(selectUser);
  const refreshToken = useAuthStore(selectRefreshToken);
  const logoutAction = useAuthStore((s) => s.logout);
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Gate the Clauses → Review queue sub-nav. Only legal_counsel + platform_admin
  // hold clause.review, so drafters and everyone else shouldn't see the link.
  const canReviewClauses = useAuthStore(selectHasPermission("clause.review"));
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

  // CR-W: use effectiveModules from auth payload when available; fall back to
  // static role mapping for backward-compat (e.g. tokens minted before CR-V).
  //
  // platform_admin is a tech-ops role whose sidebar is the admin workbench
  // only. Bypass effectiveModules for this role so the static ROLE_MODULES
  // restriction (["admin"]) is authoritative — even when the BE auth payload
  // still ships the wider legacy module set.
  const roleName = user?.role.name;

  // Mig 539 — fetch the per-role sidebar order override map. Cached 5 min
  // so navigation between pages doesn't re-hit the API. platform_admin is
  // explicitly excluded from this feature (their sidebar is the static
  // ["admin"] list managed by ADMIN_SUB_NAV).
  const { data: orderMap } = useQuery({
    queryKey: ["sidebarRoleOrderMap"],
    queryFn: () => sidebarOrderService.getOrder(),
    enabled: !!user && roleName !== "platform_admin",
    staleTime: 5 * 60 * 1000,
  });
  const orderOverride = roleName && orderMap ? orderMap[roleName] : undefined;

  // Admin sidebar — per-group collapse state. All groups expanded by default;
  // user toggles persist in localStorage so the choice survives reload.
  const ADMIN_GROUPS_STORAGE_KEY = "sidebar.adminGroupsExpanded.v1";
  const [adminGroupsExpanded, setAdminGroupsExpanded] = useState<
    Record<AdminGroupKey, boolean>
  >(() => {
    const defaults = Object.fromEntries(
      ADMIN_GROUPS.map((g) => [g.key, true]),
    ) as Record<AdminGroupKey, boolean>;
    if (typeof window === "undefined") return defaults;
    try {
      const raw = window.localStorage.getItem(ADMIN_GROUPS_STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<Record<AdminGroupKey, boolean>>;
      // Merge so newly-added groups stay expanded even if the stored map predates them.
      return { ...defaults, ...parsed };
    } catch {
      return defaults;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        ADMIN_GROUPS_STORAGE_KEY,
        JSON.stringify(adminGroupsExpanded),
      );
    } catch {
      /* localStorage quota / disabled — ignore */
    }
  }, [adminGroupsExpanded]);
  const toggleAdminGroup = (key: AdminGroupKey) =>
    setAdminGroupsExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const items = roleName === "platform_admin"
    ? modulesForRole("platform_admin")
    : user?.effectiveModules?.length
      ? modulesForEffectiveSet(user.effectiveModules, orderOverride)
      : modulesForRole(roleName);

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
          {/* OqoodAI mark (small navy O + nib monogram) */}
          <img
            src={brand.logo.monogram}
            alt=""
            width={24}
            height={24}
            className="block shrink-0"
            aria-hidden="true"
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
                <div className="mt-1 ms-4 space-y-3 border-s border-white/10 ps-2">
                  {ADMIN_GROUPS.map((group) => {
                    const groupItems = ADMIN_SUB_NAV.filter((s) => s.group === group.key);
                    if (groupItems.length === 0) return null;
                    const expanded = adminGroupsExpanded[group.key] ?? true;
                    const panelId = `admin-group-${group.key}`;
                    return (
                      <div key={group.key} className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => toggleAdminGroup(group.key)}
                          aria-expanded={expanded}
                          aria-controls={panelId}
                          className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 pb-0.5 pt-1 text-start font-mono text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 transition-colors hover:bg-white/5 hover:text-sidebar-foreground/70"
                        >
                          <span className="truncate">
                            {t(group.labelKey, { defaultValue: group.defaultLabel })}
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-3 w-3 shrink-0 transition-transform duration-200",
                              expanded ? "rotate-0" : "-rotate-90",
                            )}
                            aria-hidden="true"
                          />
                        </button>
                        {expanded && (
                          <ul id={panelId} className="space-y-0.5">
                            {groupItems.map((sub) => {
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
                      </div>
                    );
                  })}
                </div>
              )}
              {/* M12 — Clauses sub-nav (review queue) when on a /app/clauses/* route.
                  Gated by clause.review so drafters / recipients don't see it. */}
              {isClauses && onClausesRoute && !collapsed && canReviewClauses && (
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
              {/* R38 (Rashid audit 2026-06-01) — Settings used to be a
                  disabled no-op. Wire it to the profile/notification-
                  preferences surface that every authed user has. */}
              <DropdownMenuItem
                onClick={() => void navigate({ to: "/app/profile/notification-preferences" })}
              >
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
