import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Search, Quote, ScrollText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { clausesService } from "@/services/api/m_parity.service";
import { useDebounce } from "@/hooks/useDebounce";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

export const Route = createFileRoute("/app/clauses/")({
  component: () => (
    <ErrorBoundary>
      <ClausesListView />
    </ErrorBoundary>
  ),
});

function ClausesListView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [variant, setVariant] = useState<"" | "standard" | "alternative" | "fallback">("");
  const debounced = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["clauses", debounced, category, variant],
    queryFn: () =>
      clausesService.list({
        category: category || undefined,
        variant: variant || undefined,
        q: debounced || undefined,
        limit: 200,
      }),
    staleTime: 60_000,
  });

  const items = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const categories = Array.from(new Set(items.map((c) => c.category))).sort();

  const variantTone: Record<string, string> = {
    standard: "bg-sage/15 text-sage",
    alternative: "bg-amber/15 text-amber-ink",
    fallback: "bg-terracotta/15 text-terracotta",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("clauses.title", { defaultValue: "Clause library" })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("clauses.subtitle", {
            defaultValue:
              "Re-usable clauses with standard / alternative / fallback variants.",
          })}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Quote className="h-4 w-4 text-gold" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("clauses.stats.total", { defaultValue: "Clauses" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">{total}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-ink-subtle" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("clauses.stats.categories", { defaultValue: "Categories" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {categories.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
            {t("clauses.stats.usage", { defaultValue: "Total usage" })}
          </p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {items.reduce((s, c) => s + c.usageCount, 0)}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("clauses.searchPlaceholder", {
              defaultValue: "Search clauses…",
            })}
            className="ps-9"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">
            {t("clauses.allCategories", { defaultValue: "All categories" })}
          </option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={variant}
          onChange={(e) => setVariant(e.target.value as typeof variant)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">
            {t("clauses.allVariants", { defaultValue: "All variants" })}
          </option>
          <option value="standard">Standard</option>
          <option value="alternative">Alternative</option>
          <option value="fallback">Fallback</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-surface" aria-hidden />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t("clauses.empty", { defaultValue: "No clauses match the filter." })}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                to="/app/clauses/$id"
                params={{ id: String(c.id) }}
                className="flex items-start gap-3 p-3 transition hover:bg-surface"
              >
                <span
                  className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                    variantTone[c.variant] ?? ""
                  }`}
                >
                  {c.variant}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {c.category.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-sm text-ink">
                    {isAr && c.titleAr ? c.titleAr : c.titleEn}
                  </p>
                  {c.regulatoryRefs.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.regulatoryRefs.slice(0, 3).map((r) => (
                        <span
                          key={r}
                          className="rounded-full bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-subtle"
                        >
                          {r.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="font-mono text-[11px] text-ink-subtle">
                  {c.usageCount}× used
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
