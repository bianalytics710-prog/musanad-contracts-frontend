/**
 * Authenticated landing — minimal "welcome" dashboard placeholder.
 *
 * Feature modules (M1+) replace this with their dashboard surface.
 * Demonstrates: auth-store-backed user data, three-states pattern
 * (loading/empty/error are trivially "loaded" for store data),
 * formatDateTime usage, and i18n keys.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { selectUser, useAuthStore } from "@/store/auth.store";
import { formatDateTime } from "@/utils/datetime";

export const Route = createFileRoute("/app/")({
  component: AppDashboard,
});

function AppDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);

  // Empty/error states for the auth slice are unreachable at this layer
  // (the parent _app route guarantees `user` exists), but we still
  // defend against a partially-hydrated store.
  if (!user) {
    return (
      <div role="status" className="p-6 text-sm text-ink-muted">
        {t("common.loading", { defaultValue: "Loading…" })}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-5xl space-y-6 p-6"
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("dashboard.welcome", { name: user.firstName })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("dashboard.welcomeSubtitle")}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.account")}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">{t("dashboard.role")}</dt>
                <dd className="font-medium text-ink">{user.role.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">{t("dashboard.permissions")}</dt>
                <dd className="font-medium text-ink">{user.permissions.length}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.session")}</CardTitle>
            <CardDescription>{t("dashboard.sessionSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink">
              {t("dashboard.signedInAs", {
                first: user.firstName,
                last: user.lastName,
              })}
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              {t("dashboard.now")}: {formatDateTime(new Date().toISOString())}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.foundation")}</CardTitle>
            <CardDescription>{t("dashboard.foundationSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-muted">{t("dashboard.foundationBody")}</p>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
