/**
 * ImportsHeader — shared header chrome for the /app/imports/* routes.
 *
 * Mirrors the design-system pattern used by Contracts / Compose / Templates:
 *   - mono-uppercase kicker above the H1
 *   - text-2xl semibold ink H1
 *   - optional one-line subtitle
 *   - 3-tab subnav linking the sibling routes (Bulk / Review / Manual)
 *   - optional `actions` slot rendered on the right of the header row
 */
import { Link, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

interface ImportsHeaderProps {
  /** H1 text. Already-translated. */
  title: string;
  /** Subtitle, optional. Already-translated. */
  subtitle?: string;
  /** Right-side actions (buttons / links). */
  actions?: ReactNode;
}

interface SubnavTab {
  to: "/app/imports/bulk" | "/app/imports/review-queue" | "/app/imports/manual-entries";
  labelKey: string;
  defaultLabel: string;
}

const TABS: ReadonlyArray<SubnavTab> = [
  {
    to: "/app/imports/bulk",
    labelKey: "import.subnav.bulk",
    defaultLabel: "Bulk import",
  },
  {
    to: "/app/imports/review-queue",
    labelKey: "import.subnav.review",
    defaultLabel: "Review queue",
  },
  {
    to: "/app/imports/manual-entries",
    labelKey: "import.subnav.manual",
    defaultLabel: "Manual entries",
  },
];

export function ImportsHeader({ title, subtitle, actions }: ImportsHeaderProps) {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 font-mono text-xs uppercase tracking-wider text-ink-subtle">
            {t("import.kicker", { defaultValue: "Migration & imports" })}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">{actions}</div>
        )}
      </div>
      <nav
        role="tablist"
        aria-label={t("import.subnav.ariaLabel", {
          defaultValue: "Import sections",
        })}
        className="flex items-center gap-1 border-b border-border"
      >
        {TABS.map((tab) => {
          const active = location.pathname.startsWith(tab.to);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              role="tab"
              aria-selected={active}
              className={
                "relative -mb-px px-4 py-2.5 text-sm font-medium transition-colors " +
                (active
                  ? "border-b-2 border-gold text-ink"
                  : "border-b-2 border-transparent text-ink-muted hover:text-ink")
              }
            >
              {t(tab.labelKey, { defaultValue: tab.defaultLabel })}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export default ImportsHeader;
