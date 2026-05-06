import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Search,
  Quote,
  ScrollText,
  Star,
  Copy,
  Plus,
  ExternalLink,
  Languages as LanguagesIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  clausesService,
  type ClauseListItem,
  type ClauseDetail,
} from "@/services/api/m_parity.service";
import { useDebounce } from "@/hooks/useDebounce";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { cn } from "@/lib/utils";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import { CreateClauseDialog } from "@/features/m_parity/components/CreateEntityDialogs";

export const Route = createFileRoute("/app/clauses/")({
  component: () => (
    <ErrorBoundary>
      <ClausesMasterDetailView />
    </ErrorBoundary>
  ),
});

const FAV_STORAGE_KEY = "musanad_clause_favourites_v1";

function loadFavourites(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(FAV_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter((x) => Number.isInteger(x)));
    return new Set();
  } catch {
    return new Set();
  }
}

function saveFavourites(set: Set<number>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify([...set]));
}

type LanguageMode = "en" | "ar" | "bilingual";
type ClauseTab = "body" | "commentary";

function ClausesMasterDetailView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [variant, setVariant] = useState<"" | "standard" | "alternative" | "fallback">("");
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [favourites, setFavourites] = useState<Set<number>>(() => loadFavourites());
  const [createOpen, setCreateOpen] = useState(false);
  const canCreate = useAuthStore(selectHasPermission("contract.edit"));
  const debounced = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["clauses", debounced, variant],
    queryFn: () =>
      clausesService.list({
        variant: variant || undefined,
        q: debounced || undefined,
        limit: 200,
      }),
    staleTime: 60_000,
  });

  const items = data?.data ?? [];

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of items) counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    let out = items;
    if (category) out = out.filter((c) => c.category === category);
    if (showFavouritesOnly) out = out.filter((c) => favourites.has(c.id));
    return out;
  }, [items, category, showFavouritesOnly, favourites]);

  // Auto-select first clause when filter changes and current selection isn't visible.
  useEffect(() => {
    if (selectedId && filtered.some((c) => c.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  // Listen for related-variant pill clicks (custom event from the detail panel).
  useEffect(() => {
    const handler = (e: WindowEventMap["musanad:select-clause"]) => {
      setSelectedId(e.detail.id);
    };
    window.addEventListener("musanad:select-clause", handler);
    return () => window.removeEventListener("musanad:select-clause", handler);
  }, []);

  const toggleFavourite = useCallback((id: number) => {
    setFavourites((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavourites(next);
      return next;
    });
  }, []);

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
      className="mx-auto w-full max-w-[1400px] space-y-4 p-6"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("clauses.title", { defaultValue: "Clause library" })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("clauses.subtitle", {
              defaultValue:
                "Re-usable clauses with standard / alternative / fallback variants.",
            })}
          </p>
        </div>
        {canCreate && (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("clauses.create.cta", { defaultValue: "New clause" })}
          </Button>
        )}
      </header>
      <CreateClauseDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Quote className="h-4 w-4 text-gold" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("clauses.stats.total", { defaultValue: "Clauses" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">{items.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-ink-subtle" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("clauses.stats.categories", { defaultValue: "Categories" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {categoryCounts.size}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-ink-subtle" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("clauses.stats.favourites", { defaultValue: "Favourites" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {favourites.size}
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Categories sidebar */}
        <aside className="space-y-1">
          <CategoryButton
            active={category === "" && !showFavouritesOnly}
            onClick={() => {
              setCategory("");
              setShowFavouritesOnly(false);
            }}
            label={t("common.all", { defaultValue: "All" })}
            count={items.length}
          />
          <CategoryButton
            active={showFavouritesOnly}
            onClick={() => {
              setShowFavouritesOnly((v) => !v);
              setCategory("");
            }}
            label={t("clauses.favourites", { defaultValue: "Favourites" })}
            count={favourites.size}
            icon={<Star className="h-3 w-3 fill-current text-gold" />}
          />
          <div className="my-2 border-t border-border" />
          {[...categoryCounts.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cat, count]) => (
              <CategoryButton
                key={cat}
                active={category === cat && !showFavouritesOnly}
                onClick={() => {
                  setCategory((prev) => (prev === cat ? "" : cat));
                  setShowFavouritesOnly(false);
                }}
                label={cat.replace(/_/g, " ")}
                count={count}
              />
            ))}
        </aside>

        {/* Clause list */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
            <div className="relative min-w-[200px] flex-1">
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
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <p className="text-sm text-ink-muted">
                {t("clauses.empty", { defaultValue: "No clauses match the filter." })}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "flex w-full items-start gap-3 p-3 text-start transition hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      selectedId === c.id && "bg-surface",
                    )}
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
                    </div>
                    <span className="font-mono text-[11px] text-ink-subtle">
                      {c.usageCount}×
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail pane */}
        <ClauseDetailPanel
          clauseId={selectedId}
          listItems={items}
          favourites={favourites}
          onToggleFavourite={toggleFavourite}
        />
      </div>
    </motion.div>
  );
}

interface CategoryButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
}

function CategoryButton({ active, onClick, label, count, icon }: CategoryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        active
          ? "bg-gold/10 font-medium text-ink"
          : "text-ink-muted hover:bg-surface hover:text-ink",
      )}
    >
      <span className="inline-flex items-center gap-1.5 truncate">
        {icon}
        {label}
      </span>
      <span className="font-mono text-[10px] text-ink-subtle">{count}</span>
    </button>
  );
}

interface ClauseDetailPanelProps {
  clauseId: number | null;
  listItems: ClauseListItem[];
  favourites: Set<number>;
  onToggleFavourite: (id: number) => void;
}

function ClauseDetailPanel({
  clauseId,
  listItems,
  favourites,
  onToggleFavourite,
}: ClauseDetailPanelProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const navigate = useNavigate();
  const [tab, setTab] = useState<ClauseTab>("body");
  const [language, setLanguage] = useState<LanguageMode>("bilingual");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["clause", clauseId],
    queryFn: () => clausesService.getById(clauseId!),
    enabled: clauseId !== null,
    staleTime: 60_000,
  });

  // Reset tab when clause changes.
  useEffect(() => {
    setTab("body");
  }, [clauseId]);

  const relatedVariants = useMemo(() => {
    if (!data) return [];
    return listItems.filter(
      (c) => c.category === data.category && c.id !== data.id,
    );
  }, [data, listItems]);

  const isFav = data ? favourites.has(data.id) : false;

  const copyClause = useCallback(
    async (mode: "copy" | "insert") => {
      if (!data) return;
      const text =
        language === "en"
          ? data.bodyEn
          : language === "ar"
            ? data.bodyAr ?? ""
            : `${data.bodyEn}${data.bodyAr ? `\n\n— — —\n\n${data.bodyAr}` : ""}`;
      try {
        await navigator.clipboard.writeText(text);
        if (mode === "insert") {
          toast.success(
            t("clauses.detail.insertToast", {
              defaultValue: "Clause copied — paste into your draft body.",
            }),
          );
          void navigate({ to: "/app/contracts/compose" });
        } else {
          toast.success(
            t("clauses.detail.copyToast", { defaultValue: "Clause copied to clipboard." }),
          );
        }
      } catch {
        toast.error(
          t("clauses.detail.copyFailed", { defaultValue: "Could not copy clause." }),
        );
      }
    },
    [data, language, navigate, t],
  );

  if (clauseId === null) {
    return (
      <aside className="rounded-lg border border-dashed border-border bg-card/50 p-6 text-center text-xs text-ink-subtle">
        {t("clauses.detail.empty", {
          defaultValue: "Select a clause to see its body and metadata.",
        })}
      </aside>
    );
  }

  if (isLoading) {
    return (
      <aside className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="h-6 w-48 animate-pulse rounded bg-surface" />
        <div className="h-32 animate-pulse rounded bg-surface" />
      </aside>
    );
  }

  if (isError || !data) {
    return (
      <aside className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">
        {t("clauses.detail.loadError", { defaultValue: "Failed to load clause." })}
      </aside>
    );
  }

  const showEn = language === "en" || language === "bilingual";
  const showAr = (language === "ar" || language === "bilingual") && data.bodyAr;

  return (
    <aside className="rounded-lg border border-border bg-card">
      <header className="border-b border-border p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                {data.category.replace(/_/g, " ")}
              </span>
              <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                {data.variant}
              </span>
              <span className="font-mono text-[10px] text-ink-subtle">
                {data.usageCount}× used
              </span>
            </div>
            <h2 className="mt-2 text-base font-semibold text-ink">{data.titleEn}</h2>
            {data.titleAr && (
              <p className="mt-0.5 text-xs text-ink-muted" dir="rtl">
                {data.titleAr}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onToggleFavourite(data.id)}
            aria-label={
              isFav
                ? t("clauses.detail.unfavourite", { defaultValue: "Remove from favourites" })
                : t("clauses.detail.favourite", { defaultValue: "Add to favourites" })
            }
          >
            <Star
              className={cn(
                "h-4 w-4",
                isFav ? "fill-current text-gold" : "text-ink-muted",
              )}
            />
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-gold text-ink hover:bg-gold-hover"
            onClick={() => copyClause("insert")}
          >
            <Plus className="me-1.5 h-3.5 w-3.5" />
            {t("clauses.detail.insertIntoDraft", { defaultValue: "Insert into draft" })}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => copyClause("copy")}>
            <Copy className="me-1.5 h-3.5 w-3.5" />
            {t("clauses.detail.copy", { defaultValue: "Copy clause" })}
          </Button>
        </div>
      </header>

      <div className="border-b border-border px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" className="flex gap-1">
            <TabPill active={tab === "body"} onClick={() => setTab("body")}>
              {t("clauses.detail.tabs.body", { defaultValue: "Body" })}
            </TabPill>
            <TabPill active={tab === "commentary"} onClick={() => setTab("commentary")}>
              {t("clauses.detail.tabs.commentary", { defaultValue: "Legal commentary" })}
            </TabPill>
          </div>
          <div className="ms-auto inline-flex items-center gap-1 rounded-md border border-border bg-surface p-0.5 text-[11px]">
            <LanguagesIcon className="ms-1.5 h-3 w-3 text-ink-subtle" />
            <LanguagePill active={language === "en"} onClick={() => setLanguage("en")}>
              EN
            </LanguagePill>
            <LanguagePill active={language === "ar"} onClick={() => setLanguage("ar")}>
              AR
            </LanguagePill>
            <LanguagePill
              active={language === "bilingual"}
              onClick={() => setLanguage("bilingual")}
            >
              {t("clauses.detail.bilingual", { defaultValue: "Bilingual" })}
            </LanguagePill>
          </div>
        </div>
      </div>

      <div className="p-4">
        {tab === "body" ? (
          <div className="space-y-3">
            {showEn && (
              <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-md bg-surface p-3 text-xs text-ink">
                {data.bodyEn}
              </pre>
            )}
            {showAr && (
              <pre
                className="max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-md bg-surface p-3 text-xs text-ink"
                dir="rtl"
              >
                {data.bodyAr}
              </pre>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {showEn && data.legalCommentaryEn && (
              <pre className="whitespace-pre-wrap rounded-md bg-surface p-3 text-xs text-ink">
                {data.legalCommentaryEn}
              </pre>
            )}
            {showAr && data.legalCommentaryAr && (
              <pre
                className="whitespace-pre-wrap rounded-md bg-surface p-3 text-xs text-ink"
                dir="rtl"
              >
                {data.legalCommentaryAr}
              </pre>
            )}
            {!data.legalCommentaryEn && !data.legalCommentaryAr && (
              <p className="text-xs text-ink-subtle">
                {t("clauses.detail.noCommentary", {
                  defaultValue: "No legal commentary available for this clause.",
                })}
              </p>
            )}
          </div>
        )}
      </div>

      {relatedVariants.length > 0 && (
        <footer className="border-t border-border px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("clauses.detail.relatedVariants", { defaultValue: "Related variants" })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {relatedVariants.map((rv) => (
              <button
                key={rv.id}
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("musanad:select-clause", { detail: { id: rv.id } }),
                  )
                }
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-1 font-mono text-[10px] text-ink-muted hover:border-gold hover:text-ink"
              >
                <ExternalLink className="h-3 w-3" />
                <span>{rv.variant}</span>
                <span className="text-ink-subtle">·</span>
                <span className="truncate max-w-[160px]">
                  {isAr && rv.titleAr ? rv.titleAr : rv.titleEn}
                </span>
              </button>
            ))}
          </div>
        </footer>
      )}
    </aside>
  );
}

function TabPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        active ? "bg-gold/10 text-ink font-medium" : "text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function LanguagePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        active ? "bg-gold text-ink" : "text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

// Wire the related-variant pills' custom event back into the master-detail
// view so clicking a related variant swaps the selected clause without a
// full route navigation.
declare global {
  interface WindowEventMap {
    "musanad:select-clause": CustomEvent<{ id: number }>;
  }
}
