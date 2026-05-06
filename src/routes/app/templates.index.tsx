import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Search, FileStack, Languages, TrendingUp, ArrowRight, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { templatesService, type TemplateListItem } from "@/services/api/m_parity.service";
import { useDebounce } from "@/hooks/useDebounce";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { TemplatePreviewDialog } from "@/features/templates/components/TemplatePreviewDialog";

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
  const debounced = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["templates", debounced, contractType],
    queryFn: () =>
      templatesService.list({
        contractType: contractType || undefined,
        q: debounced || undefined,
        limit: 200,
      }),
    staleTime: 60_000,
  });

  const items = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const totalUsage = items.reduce((s, t) => s + t.usageCount, 0);

  const types = Array.from(new Set(items.map((it) => it.contractType))).sort();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("templates.title", { defaultValue: "Contract templates" })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("templates.subtitle", {
            defaultValue: "Re-usable contract templates aligned with UAE law.",
          })}
        </p>
      </header>

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
              {tp.replace(/_/g, " ")}
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
                <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                  {tpl.contractType.replace(/_/g, " ")}
                </span>
                {tpl.language === "bilingual" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-gold/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gold">
                    <Languages className="h-3 w-3" />
                    AR · EN
                  </span>
                )}
              </div>
              <Link
                to="/app/templates/$id"
                params={{ id: String(tpl.id) }}
                className="mt-2 text-sm font-semibold text-ink hover:text-gold"
              >
                {isAr && tpl.nameAr ? tpl.nameAr : tpl.nameEn}
              </Link>
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
              <div className="mt-3 flex flex-wrap gap-1">
                {tpl.regulatoryTags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-subtle"
                  >
                    {tag.replace(/_/g, " ")}
                  </span>
                ))}
                {tpl.regulatoryTags.length > 2 && (
                  <span className="font-mono text-[10px] text-ink-subtle">
                    +{tpl.regulatoryTags.length - 2}
                  </span>
                )}
              </div>
              <p className="mt-2 font-mono text-[11px] text-ink-subtle">
                {t("templates.usedNTimes", {
                  defaultValue: "Used {{count}} times",
                  count: tpl.usageCount,
                })}
              </p>
              <div className="mt-auto flex items-center gap-2 pt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPreviewTemplate(tpl)}
                  className="flex-1"
                >
                  <Eye className="me-1.5 h-3.5 w-3.5" />
                  {t("templates.preview.cta", { defaultValue: "Preview" })}
                </Button>
                <Link
                  to="/app/contracts/compose"
                  search={{ template_id: tpl.id }}
                  className="flex-1"
                >
                  <Button
                    type="button"
                    size="sm"
                    className="w-full bg-gold text-ink hover:bg-gold-hover"
                  >
                    {t("templates.useTemplate.short", { defaultValue: "Use template" })}
                    <ArrowRight className="ms-1.5 h-3.5 w-3.5 rtl:rotate-180" />
                  </Button>
                </Link>
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
    </motion.div>
  );
}
