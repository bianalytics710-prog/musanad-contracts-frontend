import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Sun, Moon, Languages, Bell, User2, Shield } from "lucide-react";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { useTheme } from "@/lib/design-system/theme-provider";
import { useAuthStore, selectUser } from "@/store/auth.store";

export const Route = createFileRoute("/app/settings")({
  component: () => (
    <ErrorBoundary>
      <SettingsView />
    </ErrorBoundary>
  ),
});

function SettingsView() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore(selectUser);
  const { theme, toggleTheme, locale, setLocale } = useTheme();

  const handleSetLocale = (next: "en" | "ar") => {
    setLocale(next);
    void i18n.changeLanguage(next);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[800px] space-y-4 p-6"
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("settings.title", { defaultValue: "Settings" })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("settings.subtitle", {
            defaultValue: "Personalize your workspace experience.",
          })}
        </p>
      </header>

      {/* Profile */}
      {user && (
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <User2 className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-semibold text-ink">
              {t("settings.profile.title", { defaultValue: "Profile" })}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-gold/15 font-mono text-lg font-semibold text-gold">
              {user.firstName[0]}
              {user.lastName[0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium text-ink">
                {user.firstName} {user.lastName}
              </p>
              <p className="font-mono text-xs text-ink-muted">{user.email}</p>
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                <Shield className="h-3 w-3" />
                {user.role.name.replace(/_/g, " ")}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Appearance */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-1 text-sm font-semibold text-ink">
          {t("settings.appearance.title", { defaultValue: "Appearance" })}
        </h2>
        <p className="mb-4 text-xs text-ink-muted">
          {t("settings.appearance.subtitle", {
            defaultValue: "Theme and locale preferences are stored locally per device.",
          })}
        </p>

        <div className="space-y-3">
          {/* Theme toggle */}
          <div className="flex items-center justify-between rounded-md border border-border bg-surface p-3">
            <div className="flex items-center gap-2">
              {theme === "dark" ? (
                <Moon className="h-4 w-4 text-gold" />
              ) : (
                <Sun className="h-4 w-4 text-gold" />
              )}
              <div>
                <p className="text-sm font-medium text-ink">
                  {t("settings.theme.label", { defaultValue: "Theme" })}
                </p>
                <p className="text-xs text-ink-muted">
                  {theme === "dark"
                    ? t("settings.theme.dark", { defaultValue: "Dark mode active" })
                    : t("settings.theme.light", { defaultValue: "Light mode active" })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-gold"
            >
              {t("settings.theme.toggle", { defaultValue: "Toggle" })}
            </button>
          </div>

          {/* Locale */}
          <div className="flex items-center justify-between rounded-md border border-border bg-surface p-3">
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-gold" />
              <div>
                <p className="text-sm font-medium text-ink">
                  {t("settings.locale.label", { defaultValue: "Language" })}
                </p>
                <p className="text-xs text-ink-muted">
                  {locale === "ar"
                    ? "العربية (RTL)"
                    : "English (LTR)"}
                </p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => handleSetLocale("en")}
                className={`rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                  locale === "en"
                    ? "bg-gold text-ink"
                    : "border border-border bg-card text-ink-muted hover:border-gold"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => handleSetLocale("ar")}
                className={`rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                  locale === "ar"
                    ? "bg-gold text-ink"
                    : "border border-border bg-card text-ink-muted hover:border-gold"
                }`}
              >
                ع
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Notifications (placeholder) */}
      <section className="rounded-lg border border-dashed border-border bg-muted/30 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Bell className="h-4 w-4 text-ink-muted" />
          <h2 className="text-sm font-semibold text-ink-muted">
            {t("settings.notifications.title", { defaultValue: "Notifications" })}
          </h2>
        </div>
        <p className="text-xs text-ink-subtle">
          {t("settings.notifications.coming", {
            defaultValue:
              "In-app notifications, email digests, and per-event subscriptions coming in the notifications module.",
          })}
        </p>
      </section>
    </motion.div>
  );
}
