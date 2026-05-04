/**
 * RegulatoryImpactPanel (M4 — S4).
 *
 * Mode: REGENERATE — minimal stub UI for the M4 stateless path.
 * The Lovable RegulatoryRadar (543 lines) reads from a regulatory_update
 * table that doesn't exist yet (deferred to M5 per Q1 of gate2-decisions.md).
 * Per memory feedback_regenerate_when_lovable_too_coupled.md, regenerate
 * a small UI that exercises what IS implementable today: the BE endpoint
 * POST /api/v1/ai/regulatory-impact accepts a stateless payload.
 *
 * Full DB-backed regulatory radar lands with M5.
 *
 * Scope (M4):
 *   - User pastes regulator + regulation title + description.
 *   - Selects mode (explain | amendment).
 *   - Optionally adds 1..5 sample contracts (free-form).
 *   - Streams the AI response.
 *
 * Caller is expected to wire this behind a feature flag at a sandboxed
 * route until M5 lands.
 *
 * SECURITY:
 *   - summaryEn is SENSITIVE — flows through fetch body only; never logged.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAiRegulatoryImpactSseStream } from "@/features/ai/hooks/useAiRegulatoryImpactSseStream";
import type {
  AiLanguage,
  AiRegulatoryImpactMode,
  AiRegulatoryImpactSampleContract,
} from "@/types/entities/ai.types";

const MODES: ReadonlyArray<AiRegulatoryImpactMode> = ["explain", "amendment"];

interface Props {
  language: AiLanguage;
}

export function RegulatoryImpactPanel({ language }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<AiRegulatoryImpactMode>("explain");
  const [regulator, setRegulator] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [summaryEn, setSummaryEn] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [output, setOutput] = useState("");

  const { isStreaming, start, abort } = useAiRegulatoryImpactSseStream({
    onToken: (delta) => setOutput((p) => p + delta),
    onDone: () => {
      // Nothing to do.
    },
    onError: (err) => {
      toast.error(
        err.message ??
          t("ai.errors.streamFailed", { defaultValue: "Streaming failed" }),
      );
    },
  });

  const trigger = () => {
    if (regulator.trim().length === 0 || titleEn.trim().length === 0) {
      toast.error(t("ai.regulatory.requiredFields"));
      return;
    }
    setOutput("");
    const sampleContracts: AiRegulatoryImpactSampleContract[] = [];
    void start({
      mode,
      regulator,
      referenceNumber: referenceNumber || undefined,
      titleEn,
      summaryEn: summaryEn || undefined,
      affectedClauseCategories: [],
      sampleContracts,
      language,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          {t("ai.regulatory.title")}
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("ai.regulatory.deferredNote")}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          role="tablist"
          aria-label={t("ai.regulatory.modeAriaLabel") ?? "Mode"}
          className="flex items-center gap-1.5"
        >
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                mode === m
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
              aria-selected={mode === m}
              aria-pressed={mode === m}
            >
              {t(`ai.regulatory.modes.${m}`)}
            </button>
          ))}
        </div>

        <div>
          <label
            className="block text-xs font-medium text-foreground"
            htmlFor="ai-reg-regulator"
          >
            {t("ai.regulatory.fields.regulator")}
          </label>
          <input
            id="ai-reg-regulator"
            type="text"
            value={regulator}
            onChange={(e) => setRegulator(e.target.value)}
            maxLength={200}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div>
          <label
            className="block text-xs font-medium text-foreground"
            htmlFor="ai-reg-title"
          >
            {t("ai.regulatory.fields.titleEn")}
          </label>
          <input
            id="ai-reg-title"
            type="text"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            maxLength={500}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div>
          <label
            className="block text-xs font-medium text-foreground"
            htmlFor="ai-reg-ref"
          >
            {t("ai.regulatory.fields.referenceNumber")}
          </label>
          <input
            id="ai-reg-ref"
            type="text"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            maxLength={120}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div>
          <label
            className="block text-xs font-medium text-foreground"
            htmlFor="ai-reg-summary"
          >
            {t("ai.regulatory.fields.summary")}
          </label>
          <textarea
            id="ai-reg-summary"
            rows={5}
            value={summaryEn}
            onChange={(e) => setSummaryEn(e.target.value)}
            maxLength={8000}
            placeholder={t("ai.regulatory.fields.summaryPlaceholder")}
            className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2">
          {isStreaming ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => abort()}
            >
              <Square className="me-1 h-3.5 w-3.5" aria-hidden />
              {t("ai.regulatory.stop")}
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={trigger}>
              <Sparkles className="me-1 h-3.5 w-3.5" aria-hidden />
              {t("ai.regulatory.run")}
            </Button>
          )}
        </div>

        <div
          className="min-h-32 rounded-md border border-border bg-muted/30 p-3 text-sm"
          aria-live="polite"
          dir={language === "ar" ? "rtl" : "ltr"}
        >
          {output.length === 0 && !isStreaming ? (
            <p className="text-xs text-muted-foreground">
              {t("ai.regulatory.output.empty")}
            </p>
          ) : (
            <p className="whitespace-pre-line text-foreground">
              {output}
              {isStreaming && (
                <span
                  className="ms-0.5 inline-block h-4 w-[2px] -translate-y-[1px] bg-primary align-middle"
                  aria-hidden
                />
              )}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
