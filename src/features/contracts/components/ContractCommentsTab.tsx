/**
 * ContractCommentsTab — R4 audit gap 8.2.1.
 *
 * Lovable parity:
 *   - Filter pills: All / Unresolved / Mine / Mentions me
 *   - Each comment renders body + author + relative time + Reply + Resolve
 *   - Replies render inline beneath the parent
 *   - Composer at bottom with placeholder "Press ⌘+Enter to send · @ to mention"
 *
 * The composer extracts @-mentions client-side as a simple display hint
 * (free-text "@firstname"). User-id resolution for proper mentions is a
 * later refinement; the BE accepts mentionedUserIds[] but we send [] for
 * now until we wire a /users mention picker. Filter "Mentions me" only
 * matches when a future writer puts the user's id into mentionedUserIds.
 */
import { useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, MessageCircle, Reply, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  contractCommentService,
  type ContractComment,
  type ContractCommentFilter,
} from "@/services/api/contract-comment.service";
import { formatDateTime } from "@/utils/datetime";
import { useAuthStore, selectHasPermission, selectUser } from "@/store/auth.store";
import { translateApiError } from "@/lib/translate-api-error";
import type { ApiError } from "@/lib/api-client";

interface Props {
  contractId: number;
}

// R27 (Rashid audit 2026-06-01) — Recipient lacks contract.comment.write.
// The composer should not render a writable textarea + Send button if the
// caller can't post. The list-mode rendering stays the same so signers can
// still READ comments their counterparty left.

const FILTERS: ContractCommentFilter[] = ["all", "unresolved", "mine", "mentions_me"];

export function ContractCommentsTab({ contractId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const user = useAuthStore(selectUser);
  // R27 — gate the composer on the actual write permission.
  const canWriteComment = useAuthStore(selectHasPermission("contract.comment.write"));
  const isRecipientOnly = user?.role?.name === "contract_recipient";
  const [filter, setFilter] = useState<ContractCommentFilter>("all");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: number; author: string } | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const queryKey = useMemo(() => ["comments", contractId, filter] as const, [contractId, filter]);
  const { data, isLoading, isError, error, refetch } = useQuery<ContractComment[], ApiError>({
    queryKey,
    queryFn: () => contractCommentService.list(contractId, filter),
    staleTime: 15_000,
  });

  const comments = data ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: { body: string; parentId?: number | null }) =>
      contractCommentService.create(contractId, payload),
    onSuccess: () => {
      setBody("");
      setReplyTo(null);
      void qc.invalidateQueries({ queryKey: ["comments", contractId] });
    },
    onError: (err: ApiError) => {
      toast.error(translateApiError(err, t, "errors.comment.createFailed"));
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (commentId: number) => contractCommentService.resolve(contractId, commentId),
    onSuccess: () => {
      toast.success(
        t("contracts.comments.toastResolved", { defaultValue: "Comment resolved" }),
      );
      void qc.invalidateQueries({ queryKey: ["comments", contractId] });
    },
    onError: (err: ApiError) => {
      toast.error(translateApiError(err, t, "errors.comment.resolveFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => contractCommentService.remove(contractId, commentId),
    onSuccess: () => {
      toast.success(t("contracts.comments.toastDeleted", { defaultValue: "Comment deleted" }));
      void qc.invalidateQueries({ queryKey: ["comments", contractId] });
    },
    onError: (err: ApiError) => {
      toast.error(translateApiError(err, t, "errors.comment.deleteFailed"));
    },
  });

  const submit = useCallback(() => {
    const trimmed = body.trim();
    if (!trimmed) return;
    createMutation.mutate({ body: trimmed, parentId: replyTo?.id ?? null });
  }, [body, replyTo, createMutation]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {/* Filter pills */}
        <div role="tablist" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              type="button"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-gold/20 text-ink"
                  : "border border-border text-ink-muted hover:bg-surface"
              }`}
            >
              {t(`contracts.comments.filter.${f}`, {
                defaultValue:
                  f === "all"
                    ? "All"
                    : f === "unresolved"
                      ? "Unresolved"
                      : f === "mine"
                        ? "Mine"
                        : "Mentions me",
              })}
            </button>
          ))}
        </div>

        {/* Thread */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-surface" aria-hidden="true" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p>{translateApiError(error, t, "errors.comment.loadFailed")}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => void refetch()}
            >
              {t("common.retry")}
            </Button>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <MessageCircle className="h-8 w-8 text-ink-subtle" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-ink">
              {t("contracts.comments.emptyTitle", { defaultValue: "No comments yet" })}
            </h3>
            <p className="max-w-md text-xs text-ink-muted">
              {/* R26 (Rashid audit 2026-06-01) — empty-state copy is
                  audience-aware. For Recipient the "drafter" framing is
                  wrong (external signer doesn't escalate internally);
                  surface a signer-appropriate prompt instead. */}
              {isRecipientOnly
                ? t("contracts.comments.emptyBodyRecipient", {
                    defaultValue:
                      "No comments on this contract. Comments left by the counterparty's team will appear here.",
                  })
                : t("contracts.comments.emptyBody", {
                    defaultValue:
                      "Add a comment to flag a question for the drafter or document a decision.",
                  })}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => {
              const authorName = c.createdBy
                ? `${c.createdBy.firstName} ${c.createdBy.lastName}`
                : t("contracts.comments.unknownAuthor", { defaultValue: "Unknown" });
              const initials = c.createdBy
                ? `${(c.createdBy.firstName?.[0] ?? "").toUpperCase()}${(c.createdBy.lastName?.[0] ?? "").toUpperCase()}`
                : "??";
              const isMine = user?.id === c.createdBy?.id;
              const isResolved = c.resolvedAt !== null;
              return (
                <li
                  key={c.id}
                  className={`rounded-md border p-3 ${
                    isResolved ? "border-border bg-surface/50 opacity-75" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/20 font-mono text-[10px] font-medium text-gold-ink">
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                        <span className="font-medium text-ink">{authorName}</span>
                        <span>·</span>
                        <span>{formatDateTime(c.createdAt)}</span>
                        {isResolved && (
                          <span className="ms-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            {t("contracts.comments.resolvedBadge", { defaultValue: "Resolved" })}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{c.body}</p>
                      <div className="mt-2 flex items-center gap-2">
                        {!isResolved && (
                          <button
                            type="button"
                            onClick={() => {
                              setReplyTo({ id: c.id, author: authorName });
                              composerRef.current?.focus();
                            }}
                            className="inline-flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
                          >
                            <Reply className="h-3 w-3" />
                            {t("contracts.comments.reply", { defaultValue: "Reply" })}
                          </button>
                        )}
                        {!isResolved && (
                          <button
                            type="button"
                            onClick={() => resolveMutation.mutate(c.id)}
                            disabled={resolveMutation.isPending}
                            className="inline-flex items-center gap-1 text-xs text-primary transition-colors hover:underline"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {t("contracts.comments.resolve", { defaultValue: "Resolve" })}
                          </button>
                        )}
                        {isMine && (
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(c.id)}
                            disabled={deleteMutation.isPending}
                            className="inline-flex items-center gap-1 text-xs text-destructive transition-colors hover:underline"
                          >
                            <Trash2 className="h-3 w-3" />
                            {t("common.delete")}
                          </button>
                        )}
                      </div>

                      {/* Replies */}
                      {c.replies.length > 0 && (
                        <ul className="mt-3 space-y-2 border-s-2 border-border ps-3">
                          {c.replies.map((r) => {
                            const replyAuthor = r.createdBy
                              ? `${r.createdBy.firstName} ${r.createdBy.lastName}`
                              : t("contracts.comments.unknownAuthor", { defaultValue: "Unknown" });
                            return (
                              <li key={r.id} className="rounded-sm bg-surface/40 px-2 py-1.5">
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                                  <span className="font-medium text-ink">{replyAuthor}</span>
                                  <span>·</span>
                                  <span>{formatDateTime(r.createdAt)}</span>
                                </div>
                                <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink">
                                  {r.body}
                                </p>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* R27 (Rashid audit 2026-06-01) — only render the composer when
            the caller actually has contract.comment.write. Recipient
            sees the read-only feed only. */}
        {canWriteComment && (
          <div className="rounded-md border border-border bg-card p-3">
            {replyTo && (
              <div className="mb-2 flex items-center justify-between rounded-sm bg-surface/40 px-2 py-1 text-[11px] text-ink-muted">
                <span>
                  {t("contracts.comments.replyingTo", {
                    author: replyTo.author,
                    defaultValue: `Replying to ${replyTo.author}`,
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="text-ink-subtle transition-colors hover:text-ink"
                >
                  {t("common.cancel")}
                </button>
              </div>
            )}
            <textarea
              ref={composerRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t("contracts.comments.composerPlaceholder", {
                defaultValue: "Press ⌘+Enter to send · @ to mention",
              })}
              rows={3}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="mt-2 flex items-center justify-end">
              <Button
                type="button"
                size="sm"
                onClick={submit}
                disabled={!body.trim() || createMutation.isPending}
              >
                {createMutation.isPending
                  ? t("common.saving")
                  : t("contracts.comments.send", { defaultValue: "Send" })}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ContractCommentsTab;
