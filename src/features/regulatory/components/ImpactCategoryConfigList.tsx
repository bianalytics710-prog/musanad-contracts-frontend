/**
 * ImpactCategoryConfigList (S14 — admin variant) — admin-facing list of
 * impact categories with edit affordances.
 *
 * Mode: new. There's no Lovable equivalent; admin lookup management was
 * deferred in Lovable (Q1 of M4 gate2-decisions.md). M5 introduces this
 * surface.
 *
 * AC-S14-01 — sort by displayOrder ASC.
 * AC-S14-02 — show active flag.
 * AC-S14-03 — show severityScale; AC-S14-04 — show sources.
 * AC-S14-05 — JWT-only list endpoint. The "edit" affordance gate is the
 *             FE-side `config.manage` permission check (BE re-gates).
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Plus, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { translateApiError } from "@/lib/translate-api-error";
import { selectHasPermission, useAuthStore } from "@/store/auth.store";
import { useImpactCategoryList } from "@/features/regulatory/hooks/useRegulatory";
import type { ImpactCategory } from "@/types/entities/regulatory.types";
import { ImpactCategoryConfigForm } from "./ImpactCategoryConfigForm";

export function ImpactCategoryConfigList() {
  const { t } = useTranslation();
  const canManage = useAuthStore(selectHasPermission("config.manage"));
  const [editTarget, setEditTarget] = useState<ImpactCategory | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useImpactCategoryList({ includeInactive });

  const categories = (data?.data ?? []).slice().sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("regulatory.impactCategory.list.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("regulatory.impactCategory.list.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            {t("regulatory.impactCategory.list.includeInactive")}
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label={t("common.retry")}
          >
            <RefreshCw className="h-4 w-4" />
            {t("common.retry")}
          </Button>
          {canManage && (
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {t("regulatory.impactCategory.list.createButton")}
            </Button>
          )}
        </div>
      </header>

      <Card>
        <CardContent className="pt-6">
          {isError ? (
            <div
              role="alert"
              className="rounded-md border border-terracotta/30 bg-terracotta-tint/30 p-4 text-sm text-terracotta-ink"
            >
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                {translateApiError(error, t)}
              </div>
            </div>
          ) : isLoading ? (
            <div role="status" aria-busy="true" className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-12 w-full animate-pulse rounded-md bg-muted/30"
                />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-muted">
              {t("regulatory.impactCategory.list.empty")}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="py-2 pe-3 text-start">
                    {t("regulatory.impactCategory.fields.displayOrder")}
                  </th>
                  <th className="py-2 pe-3 text-start">
                    {t("regulatory.impactCategory.fields.key")}
                  </th>
                  <th className="py-2 pe-3 text-start">
                    {t("regulatory.impactCategory.fields.nameEn")}
                  </th>
                  <th className="py-2 pe-3 text-start">
                    {t("regulatory.impactCategory.fields.nameAr")}
                  </th>
                  <th className="py-2 pe-3 text-start">
                    {t("regulatory.impactCategory.fields.severityScale")}
                  </th>
                  <th className="py-2 pe-3 text-start">
                    {t("regulatory.impactCategory.fields.active")}
                  </th>
                  <th className="py-2 text-end">
                    <span className="sr-only">{t("common.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pe-3 font-mono text-xs">
                      {c.displayOrder}
                    </td>
                    <td className="py-2 pe-3 font-mono text-xs">{c.key}</td>
                    <td className="py-2 pe-3">{c.nameEn}</td>
                    <td className="py-2 pe-3" dir="rtl" lang="ar">
                      {c.nameAr}
                    </td>
                    <td className="py-2 pe-3">
                      <div className="flex flex-wrap gap-1">
                        {c.severityScale.map((s) => (
                          <span
                            key={s}
                            className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-ink-muted"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 pe-3">
                      {c.active ? (
                        <span className="rounded-md bg-sage-tint/40 px-2 py-0.5 text-xs text-sage-ink">
                          {t("regulatory.impactCategory.activeBadge")}
                        </span>
                      ) : (
                        <span className="rounded-md bg-muted/40 px-2 py-0.5 text-xs text-ink-muted">
                          {t("regulatory.impactCategory.inactiveBadge")}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-end">
                      {canManage && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditTarget(c)}
                          aria-label={t(
                            "regulatory.impactCategory.list.editAction",
                            { key: c.key },
                          )}
                        >
                          {t("common.edit")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <ImpactCategoryConfigForm
        existing={null}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      {editTarget && (
        <ImpactCategoryConfigForm
          existing={editTarget}
          open={editTarget !== null}
          onClose={() => setEditTarget(null)}
        />
      )}
    </motion.div>
  );
}
