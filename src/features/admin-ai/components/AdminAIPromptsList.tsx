/**
 * AdminAIPromptsList (M4 — S13).
 *
 * NEW — no Lovable precedent. Renders the 6 ai_prompt rows with their
 * default model, rate limits, and feature flags (supports_streaming,
 * public_endpoint). Read-only in M4 — editing deferred per requirements.
 *
 * Permission: ai.observability.read.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { translateApiError } from "@/lib/translate-api-error";
import { ApiError } from "@/lib/api-client";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import { useAdminAiPromptsList } from "@/features/admin-ai/hooks/useAdminAi";
import type { AiPromptListQuery } from "@/types/entities/ai.types";

export function AdminAIPromptsList() {
  const { t, i18n } = useTranslation();
  const hasPermission = useAuthStore(selectHasPermission("ai.observability.read"));
  const [includeInactive, setIncludeInactive] = useState(false);

  const query: AiPromptListQuery = { includeInactive };
  const { data, isLoading, isError, error, refetch, isFetching } =
    useAdminAiPromptsList(query, { enabled: hasPermission });

  if (!hasPermission) {
    return (
      <div className="mx-auto w-full max-w-[960px] p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t("admin.ai.prompts.forbidden")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = data?.data ?? [];
  const isAr = i18n.language.startsWith("ar");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("admin.ai.prompts.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("admin.ai.prompts.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-medium text-foreground">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            {t("admin.ai.prompts.includeInactive")}
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label={t("common.retry")}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            {t("common.retry")}
          </Button>
        </div>
      </header>

      {isLoading && (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-20 w-full animate-pulse rounded bg-muted"
            />
          ))}
        </div>
      )}

      {isError && (
        <Card role="alert" className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            <p>{translateApiError(error as ApiError, t)}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-2 font-medium underline-offset-2 hover:underline"
            >
              {t("common.retry")}
            </button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("admin.ai.prompts.empty")}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((p) => (
            <Card key={p.promptId}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-mono text-sm font-semibold text-foreground">
                    {p.promptId}
                  </h3>
                  <FlagsRow prompt={p} />
                </div>
                <p
                  className="text-sm text-muted-foreground"
                  dir={isAr ? "rtl" : "ltr"}
                >
                  {isAr && p.descriptionAr ? p.descriptionAr : p.descriptionEn}
                </p>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <FieldRow
                    label={t("admin.ai.prompts.field.defaultModel")}
                    value={p.defaultModel}
                  />
                  <FieldRow
                    label={t("admin.ai.prompts.field.defaultTemperature")}
                    value={p.defaultTemperature.toString()}
                  />
                  <FieldRow
                    label={t("admin.ai.prompts.field.defaultMaxTokens")}
                    value={p.defaultMaxTokens.toLocaleString()}
                  />
                  <FieldRow
                    label={t("admin.ai.prompts.field.defaultTtlSeconds")}
                    value={p.defaultTtlSeconds.toLocaleString()}
                  />
                  <FieldRow
                    label={t("admin.ai.prompts.field.rateLimitHour")}
                    value={`${p.rateLimitPerUserPerHour}/h`}
                  />
                  <FieldRow
                    label={t("admin.ai.prompts.field.rateLimitDay")}
                    value={`${p.rateLimitPerUserPerDay}/d`}
                  />
                  <FieldRow
                    label={t("admin.ai.prompts.field.promptFile")}
                    value={p.promptFilePath}
                    monospace
                  />
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function FieldRow({
  label,
  value,
  monospace,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={monospace ? "font-mono" : undefined}>{value}</dd>
    </>
  );
}

function FlagsRow({
  prompt,
}: {
  prompt: {
    supportsStreaming: boolean;
    supportsToolCall: boolean;
    publicEndpoint: boolean;
    isActive: boolean;
  };
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {prompt.isActive ? (
        <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
          {t("admin.ai.prompts.flag.active")}
        </span>
      ) : (
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {t("admin.ai.prompts.flag.inactive")}
        </span>
      )}
      {prompt.supportsStreaming && (
        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          {t("admin.ai.prompts.flag.streaming")}
        </span>
      )}
      {prompt.supportsToolCall && (
        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          {t("admin.ai.prompts.flag.toolCall")}
        </span>
      )}
      {prompt.publicEndpoint && (
        <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
          {t("admin.ai.prompts.flag.public")}
        </span>
      )}
    </div>
  );
}
