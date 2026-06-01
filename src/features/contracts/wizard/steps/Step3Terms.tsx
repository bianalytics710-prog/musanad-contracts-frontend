/**
 * Step3Terms — Compose Wizard Step 3 (Clauses / Body).
 *
 * AC-S1-04: bodyEn + bodyAr freeform editors paired with a working clause
 * library picker (D28 — Dana Drafter audit fix 2026-06-01).
 *
 * Previously this step shipped two deferred placeholders:
 *   - "AI drafting lands with the AI Features module."
 *   - "Clause library lands with the Clauses module."
 * Both modules have shipped — the placeholders made the drafter persona's
 * core workflow read as stubbed. The AI placeholder has been removed (AI
 * assistance for drafters is delivered via the floating Risk Assistant
 * panel on every page; resurfacing an inline stub here only added noise).
 * The clause library is now a real picker — fetches from /api/v1/clauses,
 * lets the drafter filter by category, click "Insert into English body",
 * and the clause text is appended to the bodyEn textarea below.
 *
 * T13: bodyEn and bodyAr are SENSITIVE. The wizard parent (ComposeWizard)
 * clears them from React state on unmount via the FE-C1 pattern.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { BookText, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { humanizeLabel } from "@/features/dashboards/components/dashboard-primitives";
import { clausesService } from "@/services/api/m_parity.service";
import { composeStep3Schema, type ComposeStep3FormData } from "../compose-wizard-schemas";
import type { ComposeWizardStep3ClausesBody } from "@/types/entities/payment-schedule.types";

interface Step3TermsProps {
  value: ComposeWizardStep3ClausesBody;
  onChange: (next: ComposeWizardStep3ClausesBody) => void;
  disabled?: boolean;
}

export function Step3Terms({ value, onChange, disabled = false }: Step3TermsProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");

  const form = useForm<ComposeStep3FormData>({
    resolver: zodResolver(composeStep3Schema) as never,
    mode: "onBlur",
    defaultValues: {
      bodyEn: value.bodyEn ?? null,
      bodyAr: value.bodyAr ?? null,
    },
  });

  const watched = form.watch();
  useEffect(() => {
    onChange({
      bodyEn:
        typeof watched.bodyEn === "string" && watched.bodyEn.trim() === ""
          ? null
          : (watched.bodyEn ?? null),
      bodyAr:
        typeof watched.bodyAr === "string" && watched.bodyAr.trim() === ""
          ? null
          : (watched.bodyAr ?? null),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched.bodyEn, watched.bodyAr]);

  const textareaClass = cn(
    "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    "disabled:cursor-not-allowed disabled:opacity-50",
  );

  // D28 — clause library wiring.
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const clausesQuery = useQuery({
    queryKey: ["compose-step3-clauses", category, query],
    queryFn: () =>
      clausesService.list({
        category: category || undefined,
        q: query || undefined,
        limit: 50,
      }),
    staleTime: 60_000,
  });
  const clauses = clausesQuery.data?.data ?? [];
  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const c of clauses) {
      if (c.category) seen.add(c.category);
    }
    return Array.from(seen).sort();
  }, [clauses]);

  // The list endpoint returns ClauseListItem (no body) — fetch the full
  // clause detail on insert click. Cached per clause id so repeat inserts
  // hit the cache.
  const [insertingId, setInsertingId] = useState<number | null>(null);
  async function insertClause(clauseId: number, labelEn: string) {
    setInsertingId(clauseId);
    try {
      const detail = await clausesService.getById(clauseId);
      const bodyText = detail.bodyEn ?? "";
      if (!bodyText) return;
      const prev = form.getValues("bodyEn") ?? "";
      const sep = prev && !prev.endsWith("\n") ? "\n\n" : prev ? "\n" : "";
      form.setValue("bodyEn", `${prev}${sep}${bodyText.trim()}`, {
        shouldValidate: true,
        shouldDirty: true,
      });
      setLastInserted(labelEn);
    } finally {
      setInsertingId(null);
    }
  }
  const [lastInserted, setLastInserted] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* D28 — Clause library: real picker + insert into bodyEn */}
      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-2">
            <BookText className="h-4 w-4 text-gold" aria-hidden="true" />
            <h3 className="text-base font-semibold text-ink">
              {t("contracts.compose.steps.step3.clausesTitle")}
            </h3>
          </div>
          <p className="text-xs text-ink-muted">
            {t("contracts.compose.steps.step3.clausesHelp", {
              defaultValue:
                "Insert standard / alternative / fallback clauses from the library into the contract body.",
            })}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("clauseLibrary.searchPlaceholder", {
                  defaultValue: "Search clauses…",
                })}
                disabled={disabled}
                className="ps-7"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={disabled}
              className={cn(
                "h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              aria-label={t("clauseLibrary.categoryAria", {
                defaultValue: "Filter by category",
              })}
            >
              <option value="">{t("common.all", { defaultValue: "All categories" })}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {humanizeLabel(c)}
                </option>
              ))}
            </select>
          </div>

          {clausesQuery.isLoading ? (
            <div className="space-y-1.5" aria-hidden>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-surface" />
              ))}
            </div>
          ) : clauses.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-ink-muted">
              {t("contracts.compose.steps.step3.clausesEmpty", {
                defaultValue: "No clauses match.",
              })}
            </p>
          ) : (
            <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {clauses.map((c) => {
                const title = isAr && c.titleAr ? c.titleAr : c.titleEn;
                return (
                  <li
                    key={c.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-border bg-surface/40 p-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-card px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                          {humanizeLabel(String(c.variant ?? ""))}
                        </span>
                        <span className="rounded-full bg-card px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                          {humanizeLabel(String(c.category ?? ""))}
                        </span>
                        <span className="truncate text-ink">{title}</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={disabled || insertingId === c.id}
                      onClick={() => void insertClause(c.id, c.titleEn ?? "")}
                    >
                      {insertingId === c.id
                        ? t("contracts.compose.steps.step3.inserting", {
                            defaultValue: "Inserting…",
                          })
                        : t("contracts.compose.steps.step3.insertCta", {
                            defaultValue: "Insert",
                          })}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <p aria-live="polite" className="sr-only">
            {lastInserted
              ? t("contracts.compose.steps.step3.clauseInserted", {
                  defaultValue: "{{label}} inserted into the English body.",
                  label: lastInserted,
                })
              : ""}
          </p>
        </CardContent>
      </Card>

      {/* Body editors */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <header>
            <h2 className="text-base font-semibold text-ink">
              {t("contracts.compose.steps.step3.bodyTitle")}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              {t("contracts.compose.steps.step3.bodySubtitle")}
            </p>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="compose-bodyEn" className="block text-xs font-medium text-ink-muted">
                {t("contracts.fields.bodyEn")}
              </label>
              <textarea
                id="compose-bodyEn"
                {...form.register("bodyEn")}
                disabled={disabled}
                rows={12}
                className={cn(textareaClass, "mt-1 font-mono")}
                spellCheck={false}
              />
              <p className="mt-1 text-[11px] text-ink-subtle">{t("contracts.fields.bodyHelp")}</p>
            </div>

            <div>
              <label htmlFor="compose-bodyAr" className="block text-xs font-medium text-ink-muted">
                {t("contracts.fields.bodyAr")}
              </label>
              <textarea
                id="compose-bodyAr"
                {...form.register("bodyAr")}
                disabled={disabled}
                rows={12}
                dir="rtl"
                className={cn(textareaClass, "mt-1 font-mono")}
                spellCheck={false}
              />
              <p className="mt-1 text-[11px] text-ink-subtle">{t("contracts.fields.bodyHelp")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Step3Terms;
