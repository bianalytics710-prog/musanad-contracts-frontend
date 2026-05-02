/**
 * AppLayout — authenticated app shell.
 *
 * Header (Musanad mark + locale switch + theme toggle + user menu) plus
 * a content slot. Skeleton only — feature modules add a sidebar nav.
 *
 * The user menu reads from the auth store (no extra fetch). On logout
 * we POST /auth/logout to blacklist the refresh token, then clear the
 * store regardless of the network outcome (best-effort behaviour).
 */
import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Languages, LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { useTheme } from "@/lib/design-system/theme-provider";
import { selectRefreshToken, selectUser, useAuthStore } from "@/store/auth.store";
import { authService } from "@/services/api/auth.service";

export interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { resolvedTheme, toggleTheme, locale, setLocale } = useTheme();
  const user = useAuthStore(selectUser);
  const refreshToken = useAuthStore(selectRefreshToken);
  const logoutAction = useAuthStore((s) => s.logout);

  const isAr = locale === "ar";

  const handleToggleLocale = () => {
    const next = isAr ? "en" : "ar";
    setLocale(next);
    void i18n.changeLanguage(next);
  };

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await authService.logout({ refreshToken });
      }
    } catch {
      // Best-effort — even if the server call fails (network, 401, etc.)
      // we still clear the local session so the user can sign in again.
    } finally {
      logoutAction();
      navigate({ to: "/auth/login" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <Link to="/app" className="flex items-center gap-2">
            <span
              className="block rounded-full bg-gold"
              style={{ width: brand.mark.size, height: brand.mark.size }}
            />
            <span
              className="text-[18px] font-medium tracking-tight text-ink"
              style={{ letterSpacing: "-0.3px" }}
            >
              {brand.name}
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleLocale}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs text-ink-muted transition hover:border-gold hover:text-ink"
              aria-label={t("common.toggleLanguage", { defaultValue: "Toggle language" })}
            >
              <Languages className="h-3.5 w-3.5" />
              {isAr ? "EN" : "ع"}
            </button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={t("common.toggleTheme", { defaultValue: "Toggle theme" })}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            {user && (
              <div className="flex items-center gap-2 ps-2">
                <div className="text-end">
                  <div className="text-sm font-medium text-ink">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                    {user.role.name}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  aria-label={t("common.signOut", { defaultValue: "Sign out" })}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px]">{children}</main>
    </div>
  );
}

export default AppLayout;
