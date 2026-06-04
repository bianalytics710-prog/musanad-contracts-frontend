import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Search, FileStack, Languages, TrendingUp, ArrowRight, Eye, Plus, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { templatesService, type TemplateListItem } from "@/services/api/m_parity.service";
import { useDebounce } from "@/hooks/useDebounce";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { TemplatePreviewDialog } from "@/features/templates/components/TemplatePreviewDialog";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import { humanizeLabel } from "@/features/dashboards/components/dashboard-primitives";
import { NewTemplateDialog } from "@/features/templates/components/NewTemplateDialog";
import { useDeleteTemplate, templatesKeys } from "@/features/templates/hooks/useTemplates";
import { ConfirmDialog } from "@/features/imports/components/ConfirmDialog";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/app/templates/")({
  component: () => (
    <ErrorBoundary>
      <TemplatesListView />
    </ErrorBoundary>
  ),
});

function TemplatesListView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const [search, setSearch] = useState("");
  const [contractType, setContractType] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<TemplateListItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // R-LC5 LC-G2 — additional filters: language + sort.
  const [language, setLanguage] = useState<"" | "en" | "ar" | "bilingual">("");
  const [sort, setSort] = useState<"most_used" | "az" | "newest">("most_used");
  const debounced = useDebounce(search, 300);
  const canCreate = useAuthStore(selectHasPermission("contract.edit"));
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteTemplate();
  const [deleteTarget, setDeleteTarget] = useState<TemplateListItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: templatesKeys.list({ contractType, q: debounced, limit: 200 }),
    queryFn: () =>
      templatesService.list({
        contractType: contractType || undefined,
        q: debounced || undefined,
        limit: 200,
      }),
    staleTime: 60_000,
  });

  const rawItems = data?.data ?? [];
  // R-LC5 — language filter + sort applied client-side.
  const items = (() => {
    let list = rawItems;
    if (language) list = list.filter((tpl) => tpl.language === language);
    switch (sort) {
      case "az":
        list = [...list].sort((a, b) => a.nameEn.localeCompare(b.nameEn));
        break;
      case "newest":
        list = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        break;
      default:
        list = [...list].sort((a, b) => b.usageCount - a.usageCount);
    }
    return list;
  })();
  const total = data?.pagination.total ?? 0;
  const totalUsage = items.reduce((s, t) => s + t.usageCount, 0);

  const types = Array.from(new Set(rawItems.map((it) => it.contractType))).sort();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 font-mono text-xs uppercase tracking-wider text-ink-subtle">
            {t("templates.kicker", { defaultValue: "Template library" })}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("templates.title", { defaultValue: "Contract templates" })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("templates.subtitle", {
              defaultValue: "Re-usable contract templates aligned with UAE law.",
            })}
          </p>
        </div>
        {canCreate && (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("templates.create.cta", { defaultValue: "New template" })}
          </Button>
        )}
      </header>
      <NewTemplateDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <FileStack className="h-4 w-4 text-gold" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("templates.stats.total", { defaultValue: "Templates" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">{total}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-ink-subtle" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("templates.stats.types", { defaultValue: "Contract types" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">{types.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-ink-subtle" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("templates.stats.usage", { defaultValue: "Total usage" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">{totalUsage}</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("templates.searchPlaceholder", {
              defaultValue: "Search templates…",
            })}
            className="ps-9"
          />
        </div>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as "" | "en" | "ar" | "bilingual")}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label={t("templates.filter.language", { defaultValue: "Language" })}
        >
          <option value="">{t("templates.filter.allLanguages", { defaultValue: "All languages" })}</option>
          <option value="en">English</option>
          <option value="ar">Arabic</option>
          <option value="bilingual">Bilingual</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "most_used" | "az" | "newest")}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label={t("templates.filter.sort", { defaultValue: "Sort" })}
        >
          <option value="most_used">{t("templates.sort.mostUsed", { defaultValue: "Most used" })}</option>
          <option value="az">{t("templates.sort.az", { defaultValue: "A–Z" })}</option>
          <option value="newest">{t("templates.sort.newest", { defaultValue: "Newest" })}</option>
        </select>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setContractType("")}
            className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              contractType === ""
                ? "bg-gold text-ink"
                : "border border-border bg-surface text-ink-muted hover:border-gold"
            }`}
          >
            {t("common.all", { defaultValue: "All" })}
          </button>
          {types.map((tp) => (
            <button
              key={tp}
              type="button"
              onClick={() => setContractType((prev) => (prev === tp ? "" : tp))}
              className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                contractType === tp
                  ? "bg-gold text-ink"
                  : "border border-border bg-surface text-ink-muted hover:border-gold"
              }`}
            >
              {/* D33 — filter pill labels now humanized via shared helper
                  so the "msa" and "vendor / services" pills match the per-
                  card chips (D32). Falls back to humanizeLabel when the
                  i18n key is missing. */}
              {t(`contractType.${tp}`, { defaultValue: humanizeLabel(tp) })}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-surface" aria-hidden />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t("templates.empty", { defaultValue: "No templates match the filter." })}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((tpl) => (
            <li
              key={tpl.id}
              className="flex h-full flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-gold"
            >
              <div className="flex items-start justify-between gap-2">
                {/* D32 — type chip now passes through humanizeLabel which knows
                    UAE acronyms (NDA / MSA / SLA / EPC / etc.). Previously
                    rendered raw lowercase slugs ("msa" / "nda" / "llc
                    incorporation"). */}
                <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                  {humanizeLabel(tpl.contractType)}
                </span>
                <div className="flex items-center gap-1.5">
                  {tpl.placeholderCount > 0 && (
                    <span className="rounded-md bg-gold/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gold">
                      {tpl.placeholderCount} {t("templates.placeholdersShort", { defaultValue: "ph" })}
                    </span>
                  )}
                  {tpl.language === "bilingual" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-sage-tint px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-sage-ink">
                      <Languages className="h-3 w-3" />
                      AR · EN
                    </span>
                  )}
                </div>
              </div>
              <Link
                to="/app/templates/$id"
                params={{ id: String(tpl.id) }}
                className="mt-2 text-sm font-semibold text-ink hover:text-gold"
              >
                {isAr && tpl.nameAr ? tpl.nameAr : tpl.nameEn}
              </Link>
              {/* D31 — bilingual title duplication removed. The original
                  R-LC5 LC-G3 pattern rendered the Arabic name under the
                  English title in EN mode (and vice versa). Per the Dana
                  audit + E26 fix family: in EN mode only EN; in AR mode
                  only AR; the language toggle is the source of truth. */}
              {tpl.descriptionEn && !isAr && (
                <p className="mt-1 line-clamp-2 text-xs text-ink-muted">
                  {tpl.descriptionEn}
                </p>
              )}
              {tpl.descriptionAr && isAr && (
                <p className="mt-1 line-clamp-2 text-xs text-ink-muted" dir="rtl">
                  {tpl.descriptionAr}
                </p>
              )}
              {/* D34 — tag chips previously rendered as adjacent inline
                  <span> siblings without DOM-level separation, producing
                  textContent like "vendorsla+1" / "ndaconfidentiality".
                  The container still uses flex-wrap + gap visually but
                  each chip is now followed by an sr-only "," so the DOM
                  + screen-reader reading is "vendor, sla, +1" and the
                  visible chips show humanized labels with explicit
                  background pills. */}
              <div className="mt-3 flex flex-wrap gap-1.5" role="list">
                {tpl.regulatoryReference && (
                  <span role="listitem" className="rounded-full bg-amber-tint px-2 py-0.5 font-mono text-[10px] text-amber-ink">
                    {tpl.regulatoryReference}
                  </span>
                )}
                {tpl.regulatoryTags.slice(0, 2).map((tag, idx, arr) => (
                  <span key={tag} role="listitem" className="contents">
                    <span className="rounded-full bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-subtle">
                      {humanizeLabel(tag)}
                    </span>
                    {idx < arr.length - 1 && (
                      <span className="sr-only">, </span>
                    )}
                  </span>
                ))}
                {tpl.regulatoryTags.length > 2 && (
                  <>
                    <span className="sr-only">, </span>
                    <span className="rounded-full bg-surface/60 px-1.5 py-0.5 font-mono text-[10px] text-ink-subtle">
                      +{tpl.regulatoryTags.length - 2}
                    </span>
                  </>
                )}
              </div>
              <p className="mt-2 font-mono text-[11px] text-ink-subtle">
                {t("templates.usedNTimes", {
                  defaultValue: "Used {{count}} times",
                  count: tpl.usageCount,
                })}
              </p>
              <div className="mt-auto flex items-center gap-2 pt-3">
                <Link
                  to="/app/templates/$id"
                  params={{ id: String(tpl.id) }}
                  className="flex-1"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    <Eye className="me-1.5 h-3.5 w-3.5" />
                    {t("templates.preview.cta", { defaultValue: "Preview" })}
                  </Button>
                </Link>
                <Link
                  to="/app/contracts/compose"
                  search={{ template_id: tpl.id }}
                  className="flex-1"
                >
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                  >
                    {t("templates.useTemplate.short", { defaultValue: "Use template" })}
                    <ArrowRight className="ms-1.5 h-3.5 w-3.5 rtl:rotate-180" />
                  </Button>
                </Link>
                {canCreate && (
                  <>
                    <Link
                      to="/app/templates/$id/edit"
                      params={{ id: String(tpl.id) }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-ink-muted transition-colors hover:bg-surface hover:text-ink"
                      aria-label={t("templates.actions.edit", { defaultValue: "Edit" })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(tpl)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-ink-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t("templates.actions.delete", { defaultValue: "Delete" })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <TemplatePreviewDialog
        template={previewTemplate}
        open={previewTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewTemplate(null);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("templates.confirmDeleteTitle", { defaultValue: "Delete template?" })}
        description={t("templates.confirmDeleteDescription", {
          defaultValue:
            "This will hide \"{{name}}\" from the library. Existing contracts that referenced it are unaffected.",
          name: deleteTarget?.nameEn,
        })}
        confirmLabel={t("templates.actions.delete", { defaultValue: "Delete" })}
        destructive
        isPending={deleteMutation.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteMutation.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
            void queryClient.invalidateQueries({ queryKey: templatesKeys.lists() });
          } catch {
            // toast raised by hook
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </motion.div>
  );
}
