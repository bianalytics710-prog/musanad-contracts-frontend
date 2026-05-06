import { Search, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/lib/design-system/theme-provider";
import { useCommandPalette } from "./CommandPalette";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export function TopBar() {
  const { t, i18n } = useTranslation();
  const { locale, setLocale } = useTheme();
  const { open: openPalette } = useCommandPalette();

  const onSearchClick = () => openPalette();

  const toggleLang = () => {
    const next = locale === "ar" ? "en" : "ar";
    setLocale(next);
    void i18n.changeLanguage(next);
  };

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card px-4 md:px-6"
      style={{
        paddingTop: "max(0px, env(safe-area-inset-top))",
        minHeight: "calc(3rem + env(safe-area-inset-top))",
      }}
    >
      <div className="text-sm text-ink-muted">{/* breadcrumbs slot */}</div>
      <div className="flex items-center gap-2">
        <button
          onClick={onSearchClick}
          className="hidden items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-xs text-ink-subtle hover:text-ink md:inline-flex"
          aria-label={t("common.search", { defaultValue: "Search" })}
        >
          <Search className="h-3.5 w-3.5" />
          <span>{isMac ? "⌘" : "Ctrl"} K</span>
        </button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onSearchClick}
          aria-label={t("common.search", { defaultValue: "Search" })}
          className="md:hidden"
        >
          <Search className="h-4 w-4" />
        </Button>
        <NotificationBell />
        <Button variant="ghost" size="sm" onClick={toggleLang} className="font-mono text-xs">
          <Languages className="me-1 h-3.5 w-3.5" />
          {locale === "ar" ? "ع" : "EN"}
        </Button>
      </div>
    </header>
  );
}
