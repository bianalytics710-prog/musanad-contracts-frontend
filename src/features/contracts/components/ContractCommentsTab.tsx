/**
 * ContractCommentsTab — contract detail "Comments" tab.
 *
 * 687 — Redline review loop. On top of the flat free-chat thread this now
 * surfaces ANCHORED redline comments left by reviewers (Legal Counsel /
 * Contract Approver) from the Document tab, and re-activates the thread
 * affordances the DB always supported but the UI had dropped (v611.4):
 *
 *   - Anchor chip on redline comments ("⚓ Termination — '…quote…'") with a
 *     "View in document" link that jumps to the clause on the Document tab.
 *   - Reply (threaded via parent_id) so the drafter can respond in-line.
 *   - Mark done (resolve) / Reopen so the round-trip has a clear state.
 *   - A "Redlines" filter pill + a resolved "Done" badge.
 *
 * Free-text (general) comments keep working exactly as before.
 *
 * Body text is SENSITIVE — no console logs.
 */
import { useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MessageCircle,
  Trash2,
  Hash,
  CornerDownRight,
  CheckCircle2,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
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
  /** 687 — jump to a clause on the Document tab (set by ContractDetail). */
  onJumpToClause?: (clauseId: string) => void;
}

// 687 — re-add the Redlines pill alongside All / Mine. "Unresolved" +
// "Mentions me" stay retired (mention routing still isn't wired E2E).
const FILTERS: ContractCommentFilter[] = ["all", "redlines", "mine"];

export function ContractCommentsTab({ contractId, onJumpToClause }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const user = useAuthStore(selectUser);
  // 687 — gate the composer on a permission roles actually hold. There is no
  // seeded `contract.comment.write` (the old gate was dead for everyone); the
  // BE authorises comment endpoints on READ_ANY. Allow internal
  // reviewers/authors (LC + approver via approval.act, drafter + LC via
  // contract.edit); external recipients have neither → stay read-only (R27).
  const canActOnApproval = useAuthStore(selectHasPermission("approval.act"));
  const canEditContract = useAuthStore(selectHasPermission("contract.edit"));
  const canWriteComment = canActOnApproval || canEditContract;
  const isRecipientOnly = user?.role?.name === "contract_recipient";
  const [filter, setFilter] = useState<ContractCommentFilter>("all");
  const [body, setBody] = useState("");
  // 687 — reply composer target (parent comment id) + its draft text.
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const queryKey = useMemo(() => ["comments", contractId, filter] as const, [contractId, filter]);
  const { data, isLoading, isError, error, refetch } = useQuery<ContractComment[], ApiError>({
    queryKey,
    queryFn: () => contractCommentService.list(contractId, filter),
    staleTime: 15_000,
  });

  const comments = data ?? [];

  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: ["comments", contractId] }),
    [qc, contractId],
  );

  const createMutation = useMutation({
    mutationFn: (payload: { body: string; parentId?: number | null }) =>
      contractCommentService.create(contractId, payload),
    onSuccess: () => {
      setBody("");
      setReplyTo(null);
      setReplyBody("");
      void invalidate();
    },
    onError: (err: ApiError) => {
      toast.error(translateApiError(err, t, "errors.comment.createFailed"));
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (commentId: number) => contractCommentService.resolve(contractId, commentId),
    onSuccess: () => {
      toast.success(t("contracts.comments.toastResolved", { defaultValue: "Marked done" }));
      void invalidate();
    },
    onError: (err: ApiError) => toast.error(translateApiError(err, t, "errors.comment.resolveFailed")),
  });

  const reopenMutation = useMutation({
    mutationFn: (commentId: number) => contractCommentService.reopen(contractId, commentId),
    onSuccess: () => {
      toast.success(t("contracts.comments.toastReopened", { defaultValue: "Reopened" }));
      void invalidate();
    },
    onError: (err: ApiError) => toast.error(translateApiError(err, t, "errors.comment.reopenFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => contractCommentService.remove(contractId, commentId),
    onSuccess: () => {
      toast.success(t("contracts.comments.toastDeleted", { defaultValue: "Comment deleted" }));
      void invalidate();
    },
    onError: (err: ApiError) => {
      toast.error(translateApiError(err, t, "errors.comment.deleteFailed"));
    },
  });

  const submit = useCallback(() => {
    const trimmed = body.trim();
    if (!trimmed) return;
    createMutation.mutate({ body: trimmed, parentId: null });
  }, [body, createMutation]);

  const submitReply = useCallback(
    (parentId: number) => {
      const trimmed = replyBody.trim();
      if (!trimmed) return;
      createMutation.mutate({ body: trimmed, parentId });
    },
    [replyBody, createMutation],
  );

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
                defaultValue: f === "all" ? "All" : f === "mine" ? "Mine" : "Redlines",
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
              {filter === "redlines"
                ? t("contracts.comments.emptyRedlinesTitle", { defaultValue: "No redline comments" })
                : t("contracts.comments.emptyTitle", { defaultValue: "No comments yet" })}
            </h3>
            <p className="max-w-md text-xs text-ink-muted">
              {filter === "redlines"
                ? t("contracts.comments.emptyRedlinesBody", {
                    defaultValue:
                      "Select text on the Document tab to pin a comment to a clause for the drafter to address.",
                  })
                : isRecipientOnly
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
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                currentUserId={user?.id ?? null}
                canWrite={canWriteComment}
                replyOpen={replyTo === c.id}
                replyBody={replyBody}
                onReplyToggle={() => {
                  setReplyTo((prev) => (prev === c.id ? null : c.id));
                  setReplyBody("");
                }}
                onReplyBody={setReplyBody}
                onReplySubmit={() => submitReply(c.id)}
                replyPending={createMutation.isPending}
                onResolve={() => resolveMutation.mutate(c.id)}
                onReopen={() => reopenMutation.mutate(c.id)}
                resolvePending={resolveMutation.isPending || reopenMutation.isPending}
                onDelete={() => deleteMutation.mutate(c.id)}
                deletePending={deleteMutation.isPending}
                onJumpToClause={onJumpToClause}
              />
            ))}
          </ul>
        )}

        {/* Composer — only when the caller has contract.comment.write. */}
        {canWriteComment && (
          <div className="rounded-md border border-border bg-card p-3">
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

interface CommentItemProps {
  comment: ContractComment;
  currentUserId: number | null;
  canWrite: boolean;
  replyOpen: boolean;
  replyBody: string;
  onReplyToggle: () => void;
  onReplyBody: (v: string) => void;
  onReplySubmit: () => void;
  replyPending: boolean;
  onResolve: () => void;
  onReopen: () => void;
  resolvePending: boolean;
  onDelete: () => void;
  deletePending: boolean;
  onJumpToClause?: (clauseId: string) => void;
}

function CommentItem({
  comment: c,
  currentUserId,
  canWrite,
  replyOpen,
  replyBody,
  onReplyToggle,
  onReplyBody,
  onReplySubmit,
  replyPending,
  onResolve,
  onReopen,
  resolvePending,
  onDelete,
  deletePending,
  onJumpToClause,
}: CommentItemProps) {
  const { t } = useTranslation();
  const authorName = c.createdBy
    ? `${c.createdBy.firstName} ${c.createdBy.lastName}`
    : t("contracts.comments.unknownAuthor", { defaultValue: "Unknown" });
  const initials = c.createdBy
    ? `${(c.createdBy.firstName?.[0] ?? "").toUpperCase()}${(c.createdBy.lastName?.[0] ?? "").toUpperCase()}`
    : "??";
  const isMine = currentUserId === c.createdBy?.id;
  const isRedline = c.commentKind === "redline";
  const isResolved = !!c.resolvedAt;

  return (
    <li
      className={`rounded-md border p-3 ${
        isRedline ? "border-gold/40 bg-gold/5" : "border-border bg-card"
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
            {isRedline && (
              <span className="inline-flex items-center rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-medium text-gold-ink">
                {t("contracts.comments.redlineBadge", { defaultValue: "Redline" })}
              </span>
            )}
            {isResolved && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sage/15 px-1.5 py-0.5 text-[10px] font-medium text-sage">
                <CheckCircle2 className="h-3 w-3" />
                {t("contracts.comments.doneBadge", { defaultValue: "Done" })}
                {c.resolvedByUser ? ` · ${c.resolvedByUser.firstName}` : ""}
              </span>
            )}
          </div>

          {/* 687 — anchor chip for redline comments. */}
          {isRedline && (c.anchorClauseHeading || c.anchorQuote || c.anchorClauseId) && (
            <div className="mt-1.5 rounded-md border border-border bg-surface p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  <Hash className="h-3 w-3" />
                  {c.anchorClauseHeading ||
                    c.anchorClauseId ||
                    t("contracts.comments.anchorPreamble", { defaultValue: "Preamble" })}
                  {c.anchorVersionNumber != null && (
                    <span className="ms-1 normal-case text-ink-subtle">
                      · v{c.anchorVersionNumber}
                    </span>
                  )}
                </span>
                {c.anchorClauseId && onJumpToClause && (
                  <button
                    type="button"
                    onClick={() => onJumpToClause(c.anchorClauseId!)}
                    className="inline-flex items-center gap-1 text-[11px] text-gold-ink hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {t("contracts.comments.viewInDocument", { defaultValue: "View in document" })}
                  </button>
                )}
              </div>
              {c.anchorQuote && (
                <p className="mt-1 line-clamp-3 border-s-2 border-gold ps-2 text-xs italic text-ink-muted">
                  “{c.anchorQuote}”
                </p>
              )}
            </div>
          )}

          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{c.body}</p>

          {/* Replies */}
          {c.replies.length > 0 && (
            <ul className="mt-2 space-y-2 border-s border-border ps-3">
              {c.replies.map((r) => (
                <li key={r.id}>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                    <span className="font-medium text-ink">
                      {r.createdBy
                        ? `${r.createdBy.firstName} ${r.createdBy.lastName}`
                        : t("contracts.comments.unknownAuthor", { defaultValue: "Unknown" })}
                    </span>
                    <span>·</span>
                    <span>{formatDateTime(r.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-ink">{r.body}</p>
                </li>
              ))}
            </ul>
          )}

          {/* Actions */}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {canWrite && (
              <button
                type="button"
                onClick={onReplyToggle}
                className="inline-flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
              >
                <CornerDownRight className="h-3 w-3" />
                {t("contracts.comments.reply", { defaultValue: "Reply" })}
              </button>
            )}
            {/* Mark done / Reopen — surfaced on redline threads. */}
            {canWrite && isRedline && !isResolved && (
              <button
                type="button"
                onClick={onResolve}
                disabled={resolvePending}
                className="inline-flex items-center gap-1 text-xs text-sage transition-colors hover:underline disabled:opacity-50"
              >
                <CheckCircle2 className="h-3 w-3" />
                {t("contracts.comments.markDone", { defaultValue: "Mark done" })}
              </button>
            )}
            {canWrite && isRedline && isResolved && (
              <button
                type="button"
                onClick={onReopen}
                disabled={resolvePending}
                className="inline-flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" />
                {t("contracts.comments.reopen", { defaultValue: "Reopen" })}
              </button>
            )}
            {isMine && (
              <button
                type="button"
                onClick={onDelete}
                disabled={deletePending}
                className="inline-flex items-center gap-1 text-xs text-destructive transition-colors hover:underline disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                {t("common.delete")}
              </button>
            )}
          </div>

          {/* Inline reply composer */}
          {replyOpen && canWrite && (
            <div className="mt-2">
              <textarea
                value={replyBody}
                onChange={(e) => onReplyBody(e.target.value)}
                rows={2}
                autoFocus
                placeholder={t("contracts.comments.replyPlaceholder", {
                  defaultValue: "Write a reply…",
                })}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <div className="mt-1 flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={onReplyToggle}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={onReplySubmit}
                  disabled={!replyBody.trim() || replyPending}
                >
                  {replyPending ? t("common.saving") : t("contracts.comments.reply", { defaultValue: "Reply" })}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export default ContractCommentsTab;
