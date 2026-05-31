import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStore, selectUser } from "@/store/auth.store";
import { modulesForRole } from "@/config/sidebar";
import { PageLayout } from "@/components/patterns";
// K43 fix — humanize the role-name kicker so /app/more no longer shows
// the raw role slug (e.g. "compliance_esg") above the page title.
import { humanizeLabel } from "@/features/dashboards/components/dashboard-primitives";

export const Route = createFileRoute("/app/more")({
  component: MorePage,
});

function MorePage() {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);
  const items = modulesForRole(user?.role.name);

  return (
    <PageLayout title={t("nav.more", { defaultValue: "More" })} kicker={humanizeLabel(user?.role.name)}>
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              to={item.to}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition hover:border-gold"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-ink-muted" />
                <span className="font-medium text-ink">
                  {t(item.labelKey, { defaultValue: item.defaultLabel })}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-ink-subtle" />
            </Link>
          );
        })}
      </div>
    </PageLayout>
  );
}
