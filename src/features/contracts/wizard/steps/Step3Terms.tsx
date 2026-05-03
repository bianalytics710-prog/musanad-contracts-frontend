/**
 * Step3Terms — Compose Wizard Step 3 (Clauses / Body).
 *
 * AC-S1-04: bodyEn + bodyAr freeform editors. AI Drafting Panel and clause
 * library are visible-but-DISABLED placeholders with banner text — these
 * features land in the AI Features and Clauses modules respectively.
 *
 * T13: bodyEn and bodyAr are SENSITIVE. The wizard parent (ComposeWizard)
 * clears them from React state on unmount via the FE-C1 pattern. localStorage
 * persistence (useComposeDraft) intentionally KEEPS the body so accidental
 * reloads don't lose draft work — see useComposeDraft.ts header for the
 * security rationale. clearComposeDraft() removes the entry on success.
 */
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles, BookText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { composeStep3Schema, type ComposeStep3FormData } from "../compose-wizard-schemas";
import type { ComposeWizardStep3ClausesBody } from "@/types/entities/payment-schedule.types";

interface Step3TermsProps {
  value: ComposeWizardStep3ClausesBody;
  onChange: (next: ComposeWizardStep3ClausesBody) => void;
  disabled?: boolean;
}

export function Step3Terms({ value, onChange, disabled = false }: Step3TermsProps) {
  const { t } = useTranslation();

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

  return (
    <div className="space-y-4">
      {/* Deferred AI panel */}
      <Card>
        <CardContent className="space-y-2 p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
            <h3 className="text-base font-semibold text-ink">
              {t("contracts.compose.steps.step3.aiPanelTitle")}
            </h3>
          </div>
          <div
            className="rounded-md border border-dashed border-border bg-surface/40 p-4 text-xs text-ink-muted"
            role="note"
            aria-disabled="true"
          >
            {t("contracts.compose.steps.step3.aiDeferredHelp")}
          </div>
        </CardContent>
      </Card>

      {/* Deferred clause library */}
      <Card>
        <CardContent className="space-y-2 p-6">
          <div className="flex items-center gap-2">
            <BookText className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
            <h3 className="text-base font-semibold text-ink">
              {t("contracts.compose.steps.step3.clausesTitle")}
            </h3>
          </div>
          <div
            className="rounded-md border border-dashed border-border bg-surface/40 p-4 text-xs text-ink-muted"
            role="note"
            aria-disabled="true"
          >
            {t("contracts.compose.steps.step3.clausesDeferredHelp")}
          </div>
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
