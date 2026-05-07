/**
 * /app/regulations — R-LC7 Impact Watch.
 *
 * Replaces the M_parity-S4 "Coming soon" placeholder with the full
 * multi-source intelligence surface mirroring Lovable's /regulations page.
 *   - 5 category filters (Regulatory / Commodity / Supply / Geopolitical /
 *     Market & Financial)
 *   - List of signals with severity badges
 *   - Detail panel: Title / dates / clause categories / Explain with AI /
 *     Suggest amendment language / Impacted contracts table
 *   - Per-row actions: Mark reviewed
 *   - Per-signal actions: Notify drafters / Bulk amend
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Search,
  AlertTriangle,
  Sparkles,
  Bell,
  GitBranch,
  CheckCircle2,
  ArrowRight,
  Truck,
  Globe,
  TrendingUp,
  Scale,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  impactSignalService,
  type ImpactCategory,
  type ImpactSignalListItem,
  type ImpactSignalAiExplainResponse,
  type ImpactSignalAiAmendmentResponse,
} from "@/services/api/impact-signal.service";
import { useDebounce } from "@/hooks/useDebounce";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { formatDate, formatHijriDate } from "@/utils/datetime";
import { translateApiError } from "@/lib/translate-api-error";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";

export const Route = createFileRoute("/app/regulations")({
  component: () => (
    <ErrorBoundary>
      <ImpactWatchView />
    </ErrorBoundary>
  ),
});

const CATEGORY_TONE: Record<ImpactCategory, string> = {
  regulatory: "bg-gold/15 text-gold",
  commodity_prices: "bg-amber-tint/40 text-amber-ink",
  supply_chain: "bg-sage-tint text-sage-ink",
  geopolitical: "bg-terracotta-tint text-terracotta-ink",
  market_financial: "bg-plum-tint text-plum-ink",
};

const CATEGORY_ICON: Record<ImpactCategory, React.ComponentType<{ className?: string }>> = {
  regulatory: Scale,
  commodity_prices: TrendingUp,
  supply_chain: Truck,
  geopolitical: Globe,
  market_financial: Sparkles,
};

const CATEGORIES: Array<{ key: ImpactCategory | "all"; labelKey: string; defaultLabel: string }> = [
  { key: "all", labelKey: "all", defaultLabel: "All" },
  { key: "regulatory", labelKey: "regulatory", defaultLabel: "Regulatory" },
  { key: "commodity_prices", labelKey: "commodity", defaultLabel: "Commodity Prices" },
  { key: "supply_chain", labelKey: "supply", defaultLabel: "Supply Chain" },
  { key: "geopolitical", labelKey: "geopolitical", defaultLabel: "Geopolitical" },
  { key: "market_financial", labelKey: "market", defaultLabel: "Market & Financial" },
];

const SEVERITY_TONE: Record<string, string> = {
  critical: "bg-terracotta text-card",
  major: "bg-terracotta/80 text-card",
  high: "bg-amber-tint text-amber-ink",
  elevated: "bg-amber-tint text-amber-ink",
  moderate: "bg-amber-tint/60 text-amber-ink",
  shifting: "bg-amber-tint/60 text-amber-ink",
  volatile: "bg-amber-tint/80 text-amber-ink",
  sharp_move: "bg-terracotta/30 text-terracotta-ink",
  medium: "bg-amber-tint/60 text-amber-ink",
  low: "bg-sage-tint text-sage-ink",
  stable: "bg-sage-tint text-sage-ink",
  minor: "bg-sage-tint/80 text-sage-ink",
};

function ImpactWatchView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ImpactCategory | "all">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const debounced = useDebounce(search, 300);
  const qc = useQueryClient();
  const canEdit = useAuthStore(selectHasPermission("contract.edit"));

  const { data: list, isLoading: listLoading } = useQuery({
    queryKey: ["impact-signals", debounced, category],
    queryFn: () =>
      impactSignalService.list({
        category: category === "all" ? undefined : category,
        q: debounced || undefined,
      }),
    staleTime: 60_000,
  });

  const items = list?.data ?? [];
  const selectedItem = useMemo(
    () => (selectedId == null ? null : items.find((i) => i.id === selectedId) ?? null),
    [items, selectedId],
  );

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["impact-signal", selectedId],
    queryFn: () => impactSignalService.getById(selectedId as number),
    enabled: typeof selectedId === "number" && selectedId > 0,
    staleTime: 30_000,
  });

  const markReviewed = useMutation({
    mutationFn: (linkId: number) => impactSignalService.markReviewed(linkId),
    onSuccess: () => {
      toast.success(t("impactWatch.markReviewed.success", { defaultValue: "Marked reviewed" }));
      void qc.invalidateQueries({ queryKey: ["impact-signal", selectedId] });
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  const notifyMutation = useMutation({
    mutationFn: () => impactSignalService.notifyDrafters(selectedId as number),
    onSuccess: (r) => {
      toast.success(
        t("impactWatch.notify.success", {
          count: r.notified,
          defaultValue: `Notified ${r.notified} drafters`,
        }),
      );
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  const bulkAmendMutation = useMutation({
    mutationFn: () => impactSignalService.bulkAmend(selectedId as number),
    onSuccess: (r) => {
      toast.success(
        t("impactWatch.bulkAmend.success", {
          count: r.amended,
          defaultValue: `Amendment initiated for ${r.amended} contracts`,
        }),
      );
      void qc.invalidateQueries({ queryKey: ["impact-signal", selectedId] });
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  // R-LC7-D1 — Impact Watch AI dialogs (Explain + Suggest amendment).
  const [explainResult, setExplainResult] = useState<ImpactSignalAiExplainResponse | null>(null);
  const [amendmentResult, setAmendmentResult] = useState<ImpactSignalAiAmendmentResponse | null>(
    null,
  );

  const explainMutation = useMutation({
    mutationFn: () =>
      impactSignalService.explainWithAi(selectedId as number, isAr ? "ar" : "en"),
    onSuccess: (r) => setExplainResult(r),
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  const amendmentMutation = useMutation({
    mutationFn: () =>
      impactSignalService.suggestAmendment(selectedId as number, {
        language: isAr ? "ar" : "en",
      }),
    onSuccess: (r) => setAmendmentResult(r),
    onError: (e) => toast.error(translateApiError(e, t)),
  });

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
            {t("impactWatch.title", { defaultValue: "Impact Watch" })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("impactWatch.subtitle", {
              defaultValue:
                "Multi-source intelligence — regulatory, commodity, supply chain, geopolitical and market signals affecting your contracts.",
            })}
          </p>
        </div>
        <Link
          to="/app/regulatory-radar"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface"
        >
          {t("impactWatch.openRadar", { defaultValue: "Open radar" })}
          <ArrowRight className="h-3 w-3 rtl:rotate-180" />
        </Link>
      </header>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("impactWatch.searchPlaceholder", {
              defaultValue: "Search title…",
            })}
            className="ps-9"
          />
        </div>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              category === c.key
                ? "bg-gold text-ink"
                : "border border-border bg-surface text-ink-muted hover:border-gold"
            }`}
          >
            {t(`impactWatch.category.${c.labelKey}`, { defaultValue: c.defaultLabel })}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Signal list (2/5) */}
        <section className="lg:col-span-2">
          {listLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-surface" aria-hidden />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <p className="text-sm text-ink-muted">
                {t("impactWatch.empty", { defaultValue: "No impact signals match the filter." })}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => (
                <SignalListRow
                  key={it.id}
                  item={it}
                  selected={selectedId === it.id}
                  onSelect={() => setSelectedId(it.id)}
                  isAr={isAr}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Detail panel (3/5) */}
        <section className="lg:col-span-3">
          {!selectedItem ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <p className="text-sm text-ink-muted">
                {t("impactWatch.selectHint", {
                  defaultValue: "Select a signal to inspect details and impacted contracts.",
                })}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-ink-subtle">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${CATEGORY_TONE[selectedItem.category]}`}
                    >
                      {(() => {
                        const Icon = CATEGORY_ICON[selectedItem.category];
                        return <Icon className="h-3 w-3" />;
                      })()}
                      {t(`impactWatch.category.${selectedItem.category}`, { defaultValue: selectedItem.category })}
                    </span>
                    <span className="font-mono">{selectedItem.source}</span>
                    <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase ${SEVERITY_TONE[selectedItem.severity] ?? "bg-muted text-ink-muted"}`}>
                      {selectedItem.severity}
                    </span>
                    <span className="font-mono">{selectedItem.extId}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-ink">
                    {isAr && selectedItem.titleAr ? selectedItem.titleAr : selectedItem.titleEn}
                  </h2>
                  <div className="mt-2 grid gap-2 text-xs text-ink-muted sm:grid-cols-3">
                    <DateRow label={t("impactWatch.date.published", { defaultValue: "Published" })} iso={selectedItem.publishedDate} />
                    <DateRow label={t("impactWatch.date.effective", { defaultValue: "Effective" })} iso={selectedItem.effectiveDate} />
                    <DateRow label={t("impactWatch.date.compliance", { defaultValue: "Compliance deadline" })} iso={selectedItem.complianceDeadline} />
                  </div>
                  {selectedItem.descriptionEn && (
                    <p className="mt-3 text-sm text-ink">
                      {isAr && selectedItem.descriptionAr ? selectedItem.descriptionAr : selectedItem.descriptionEn}
                    </p>
                  )}
                  {selectedItem.affectedClauseCategories.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
                        {t("impactWatch.affectedClauseCategories", { defaultValue: "Affected clause categories" })}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {selectedItem.affectedClauseCategories.map((c) => (
                          <span key={c} className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] text-ink-muted">
                            {c.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={explainMutation.isPending}
                  onClick={() => explainMutation.mutate()}
                >
                  <Sparkles className="me-1.5 h-3.5 w-3.5" />
                  {explainMutation.isPending
                    ? t("impactWatch.explainAI.loading", { defaultValue: "Explaining…" })
                    : t("impactWatch.explainAI", { defaultValue: "Explain with AI" })}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={amendmentMutation.isPending}
                  onClick={() => amendmentMutation.mutate()}
                >
                  <GitBranch className="me-1.5 h-3.5 w-3.5" />
                  {amendmentMutation.isPending
                    ? t("impactWatch.suggestLanguage.loading", { defaultValue: "Drafting…" })
                    : t("impactWatch.suggestLanguage", { defaultValue: "Suggest amendment language" })}
                </Button>
              </div>

              <div className="mt-5 border-t border-border/60 pt-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                    <AlertTriangle className="h-4 w-4 text-gold" />
                    {t("impactWatch.impactedContracts", { defaultValue: "Impacted contracts" })}
                  </h3>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={notifyMutation.isPending || detailLoading}
                        onClick={() => notifyMutation.mutate()}
                      >
                        <Bell className="me-1.5 h-3.5 w-3.5" />
                        {t("impactWatch.notifyDrafters", { defaultValue: "Notify drafters" })}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={bulkAmendMutation.isPending || detailLoading}
                        onClick={() => bulkAmendMutation.mutate()}
                      >
                        <GitBranch className="me-1.5 h-3.5 w-3.5" />
                        {t("impactWatch.bulkAmend", { defaultValue: "Bulk amend" })}
                      </Button>
                    </div>
                  )}
                </div>
                {detailLoading ? (
                  <div className="h-16 animate-pulse rounded-lg bg-surface" aria-hidden />
                ) : !detail || detail.impactedContracts.length === 0 ? (
                  <p className="text-xs text-ink-muted">
                    {t("impactWatch.noImpactedContracts", { defaultValue: "No contracts linked to this signal yet." })}
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-ink-subtle">
                        <tr>
                          <th className="px-3 py-2 text-start">
                            {t("impactWatch.col.contract", { defaultValue: "Contract #" })}
                          </th>
                          <th className="px-3 py-2 text-start">
                            {t("impactWatch.col.title", { defaultValue: "Title" })}
                          </th>
                          <th className="px-3 py-2 text-end">
                            {t("impactWatch.col.impact", { defaultValue: "Impact" })}
                          </th>
                          <th className="px-3 py-2">
                            {t("impactWatch.col.status", { defaultValue: "Status" })}
                          </th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.impactedContracts.map((c) => (
                          <tr key={c.id} className="border-b border-border/40">
                            <td className="px-3 py-2 font-mono text-xs text-ink-muted">
                              <Link
                                to="/app/contracts/$id"
                                params={{ id: String(c.contractId) }}
                                className="hover:underline"
                              >
                                {c.contractNumber}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-xs text-ink">{c.titleEn}</td>
                            <td className="px-3 py-2 text-end font-mono text-xs text-ink">
                              {c.impactScore}
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                                {c.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-end">
                              {c.status === "pending" && canEdit && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={markReviewed.isPending}
                                  onClick={() => markReviewed.mutate(c.id)}
                                >
                                  <CheckCircle2 className="me-1.5 h-3 w-3" />
                                  {t("impactWatch.markReviewed", { defaultValue: "Mark reviewed" })}
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* R-LC7-D1 — Explain with AI dialog */}
      <Dialog
        open={explainResult !== null}
        onOpenChange={(open) => {
          if (!open) setExplainResult(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>
              {t("impactWatch.explainAI", { defaultValue: "Explain with AI" })}
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.titleEn ?? ""}
            </DialogDescription>
          </DialogHeader>
          {explainResult && (
            <div className="space-y-4 text-sm">
              <section>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  {t("impactWatch.explainAI.summary", { defaultValue: "Summary" })}
                </h4>
                <p className="text-ink">{explainResult.summary}</p>
              </section>
              <section>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  {t("impactWatch.explainAI.whyItMatters", { defaultValue: "Why it matters" })}
                </h4>
                <p className="text-ink">{explainResult.whyItMatters}</p>
              </section>
              {explainResult.perContractImpacts.length > 0 && (
                <section>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                    {t("impactWatch.explainAI.perContract", {
                      defaultValue: "Per-contract impact",
                    })}
                  </h4>
                  <ul className="space-y-2">
                    {explainResult.perContractImpacts.map((c) => (
                      <li
                        key={c.contractId}
                        className="rounded-md border border-border/60 bg-surface p-3"
                      >
                        <div className="font-mono text-xs text-ink-muted">{c.contractNumber}</div>
                        <div className="mt-0.5 text-sm text-ink">{c.explanation}</div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <p className="text-[10px] italic text-ink-subtle">
                {t("impactWatch.aiDisclaimer", {
                  defaultValue:
                    "AI-generated guidance — verify with counsel before action.",
                })}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* R-LC7-D1 — Suggest amendment language dialog */}
      <Dialog
        open={amendmentResult !== null}
        onOpenChange={(open) => {
          if (!open) setAmendmentResult(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>
              {t("impactWatch.suggestLanguage", { defaultValue: "Suggest amendment language" })}
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.titleEn ?? ""}
            </DialogDescription>
          </DialogHeader>
          {amendmentResult && (
            <div className="space-y-4 text-sm">
              {amendmentResult.amendmentSnippets.map((s, idx) => (
                <section
                  key={idx}
                  className="rounded-md border border-border/60 bg-surface p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-card px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                      {s.clauseAnchor}
                    </span>
                  </div>
                  <p className="mb-2 text-xs text-ink-muted">{s.rationale}</p>
                  <pre className="whitespace-pre-wrap rounded bg-card p-2 font-mono text-xs text-ink">
                    {s.suggestedText}
                  </pre>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="mt-2 h-7 px-2 text-xs"
                    onClick={() => {
                      void navigator.clipboard.writeText(s.suggestedText);
                      toast.success(
                        t("impactWatch.suggestLanguage.copied", {
                          defaultValue: "Copied to clipboard",
                        }),
                      );
                    }}
                  >
                    {t("impactWatch.suggestLanguage.copy", { defaultValue: "Copy" })}
                  </Button>
                </section>
              ))}
              <p className="text-[10px] italic text-ink-subtle">
                {t("impactWatch.aiDisclaimer", {
                  defaultValue:
                    "AI-generated guidance — verify with counsel before action.",
                })}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function SignalListRow({
  item,
  selected,
  onSelect,
  isAr,
}: {
  item: ImpactSignalListItem;
  selected: boolean;
  onSelect: () => void;
  isAr: boolean;
}) {
  const { t } = useTranslation();
  const Icon = CATEGORY_ICON[item.category];
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full flex-col items-start gap-1 rounded-lg border p-3 text-start transition-colors ${
          selected
            ? "border-gold bg-gold/5"
            : "border-border bg-card hover:border-gold/50"
        }`}
      >
        <div className="flex w-full items-center gap-2 text-[10px] uppercase tracking-wider text-ink-subtle">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${CATEGORY_TONE[item.category]}`}>
            <Icon className="h-3 w-3" />
            {t(`impactWatch.category.${item.category}`, { defaultValue: item.category })}
          </span>
          <span className={`rounded-full px-2 py-0.5 font-mono ${SEVERITY_TONE[item.severity] ?? "bg-muted text-ink-muted"}`}>
            {item.severity}
          </span>
          <span className="ms-auto font-mono">{formatDate(item.publishedDate)}</span>
        </div>
        <p className="text-sm font-medium text-ink">
          {isAr && item.titleAr ? item.titleAr : item.titleEn}
        </p>
        <p className="text-[11px] text-ink-muted">
          {item.source} · {item.impactedContractCount}{" "}
          {t("impactWatch.impactedContractsCount", { defaultValue: "impacted contracts" })}
        </p>
      </button>
    </li>
  );
}

function DateRow({ label, iso }: { label: string; iso: string | null }) {
  if (!iso) {
    return (
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle">{label}</p>
        <p className="text-xs text-ink-subtle">—</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle">{label}</p>
      <p className="font-mono text-xs text-ink">{formatDate(iso)}</p>
      <p className="font-mono text-[10px] text-ink-subtle">{formatHijriDate(iso)}</p>
    </div>
  );
}
