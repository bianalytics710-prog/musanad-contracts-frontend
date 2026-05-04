/**
 * AdminAIRequestsList (M4 — S11).
 *
 * NEW — no Lovable precedent. Admin observability page rendering
 * GET /api/v1/admin/ai/requests with filters (user, prompt, outcome,
 * date range). Pagination 50 per page (server max 200).
 *
 * Permission: ai.observability.read (BE-enforced; FE check is informational).
 *
 * SECURITY:
 *   - errorMessage column is already redacted at write time per AC-S10-07.
 *     We display it but never re-log.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { translateApiError } from "@/lib/translate-api-error";
import { ApiError } from "@/lib/api-client";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import { formatDateTime } from "@/utils/datetime";
import { useAdminAiRequestsList } from "@/features/admin-ai/hooks/useAdminAi";
import {
  AI_REQUEST_OUTCOME_VALUES,
  M4_PROMPT_IDS,
  type AiRequestLogListQuery,
  type AiRequestOutcome,
  type M4PromptId,
} from "@/types/entities/ai.types";

const PAGE_SIZE = 50;

export function AdminAIRequestsList() {
  const { t } = useTranslation();
  const hasPermission = useAuthStore(selectHasPermission("ai.observability.read"));

  const [page, setPage] = useState(1);
  const [actorUserIdInput, setActorUserIdInput] = useState("");
  const [promptIdFilter, setPromptIdFilter] = useState<M4PromptId | "">("");
  const [outcomeFilter, setOutcomeFilter] = useState<AiRequestOutcome | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const debouncedActor = useDebounce(actorUserIdInput, 300);

  const query: AiRequestLogListQuery = useMemo(() => {
    const parsed = debouncedActor ? Number(debouncedActor) : NaN;
    return {
      page,
      limit: PAGE_SIZE,
      actorUserId:
        Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
      promptId: promptIdFilter || undefined,
      outcome: outcomeFilter || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    };
  }, [page, debouncedActor, promptIdFilter, outcomeFilter, fromDate, toDate]);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useAdminAiRequestsList(query, { enabled: hasPermission });

  if (!hasPermission) {
    return (
      <div className="mx-auto w-full max-w-[960px] p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t("admin.ai.requests.forbidden")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const items = data?.data ?? [];
  const pagination = data?.pagination;

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
            {t("admin.ai.requests.title")}
          </h1>
          {pagination && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t("admin.ai.requests.totalCount", { count: pagination.total })}
            </p>
          )}
        </div>
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
      </header>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label
              htmlFor="ai-req-actor"
              className="block text-xs font-medium text-foreground"
            >
              {t("admin.ai.requests.filters.actor")}
            </label>
            <input
              id="ai-req-actor"
              type="number"
              min={1}
              value={actorUserIdInput}
              onChange={(e) => {
                setActorUserIdInput(e.target.value);
                setPage(1);
              }}
              placeholder={t("admin.ai.requests.filters.actorPlaceholder")}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label
              htmlFor="ai-req-prompt"
              className="block text-xs font-medium text-foreground"
            >
              {t("admin.ai.requests.filters.prompt")}
            </label>
            <select
              id="ai-req-prompt"
              value={promptIdFilter}
              onChange={(e) => {
                const v = e.target.value;
                setPromptIdFilter(
                  (M4_PROMPT_IDS as readonly string[]).includes(v)
                    ? (v as M4PromptId)
                    : "",
                );
                setPage(1);
              }}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">{t("common.all")}</option>
              {M4_PROMPT_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="ai-req-outcome"
              className="block text-xs font-medium text-foreground"
            >
              {t("admin.ai.requests.filters.outcome")}
            </label>
            <select
              id="ai-req-outcome"
              value={outcomeFilter}
              onChange={(e) => {
                const v = e.target.value;
                setOutcomeFilter(
                  (AI_REQUEST_OUTCOME_VALUES as readonly string[]).includes(v)
                    ? (v as AiRequestOutcome)
                    : "",
                );
                setPage(1);
              }}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">{t("common.all")}</option>
              {AI_REQUEST_OUTCOME_VALUES.map((o) => (
                <option key={o} value={o}>
                  {t(`admin.ai.requests.outcome.${o}`, { defaultValue: o })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="ai-req-from"
              className="block text-xs font-medium text-foreground"
            >
              {t("admin.ai.requests.filters.fromDate")}
            </label>
            <input
              id="ai-req-from"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label
              htmlFor="ai-req-to"
              className="block text-xs font-medium text-foreground"
            >
              {t("admin.ai.requests.filters.toDate")}
            </label>
            <input
              id="ai-req-to"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-12 w-full animate-pulse rounded bg-muted"
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

      {!isLoading && !isError && items.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("admin.ai.requests.empty")}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">{t("admin.ai.requests.col.createdAt")}</th>
                  <th className="px-3 py-2">{t("admin.ai.requests.col.prompt")}</th>
                  <th className="px-3 py-2">{t("admin.ai.requests.col.actor")}</th>
                  <th className="px-3 py-2">{t("admin.ai.requests.col.outcome")}</th>
                  <th className="px-3 py-2">{t("admin.ai.requests.col.cache")}</th>
                  <th className="px-3 py-2">{t("admin.ai.requests.col.tokens")}</th>
                  <th className="px-3 py-2">{t("admin.ai.requests.col.latency")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{row.promptId}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.actor
                        ? `${row.actor.fullName} (#${row.actor.id})`
                        : t("admin.ai.requests.noActor")}
                    </td>
                    <td className="px-3 py-2">
                      <OutcomeBadge outcome={row.outcome} />
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.cacheHit ? t("common.yes") : t("common.no")}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.tokensInput ?? 0} / {row.tokensOutput ?? 0}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.latencyMs ?? "—"} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t("admin.ai.requests.pageOf", {
              page: pagination.page,
              total: pagination.totalPages,
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t("common.back")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages || isFetching}
              onClick={() =>
                setPage((p) => Math.min(pagination.totalPages, p + 1))
              }
            >
              {t("common.next")}
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function OutcomeBadge({ outcome }: { outcome: AiRequestOutcome }) {
  const { t } = useTranslation();
  const styles =
    outcome === "success"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : outcome === "error" || outcome === "timeout"
        ? "bg-destructive/10 text-destructive"
        : outcome === "rate_limited"
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium ${styles}`}
    >
      {t(`admin.ai.requests.outcome.${outcome}`, { defaultValue: outcome })}
    </span>
  );
}
