/**
 * ContractDocumentTab — side-by-side EN+AR contract body view with anchored
 * clause headings, "Find in document" search, and (687) inline REDLINE
 * commenting for reviewers (Legal Counsel / Contract Approver).
 *
 * Lovable's contract detail "Document" tab uses an h3 per clause heading
 * (parsed from `## ` lines in the body markdown) and lets the user jump
 * to anchors by id. We do the same: split each body into clause segments
 * keyed off `^##\s+...$` lines, render h3 headers with id + visible anchor.
 *
 * 687 — Redline mode: when `canRedline` is set, selecting text inside a
 * clause surfaces a floating "Comment" button. The reviewer types a note and
 * it is saved as a redline comment anchored to {clauseId, heading, quote,
 * side, versionNumber}. Each clause shows a marker badge with its open /
 * done redline counts; clicking it jumps to the Comments tab. The parent can
 * also request a scroll-to-clause (e.g. from a comment's "View in document").
 *
 * Find: a debounced text input highlights the first occurrence on each side.
 *
 * Body text is SENSITIVE — no console logs.
 */
import React, { useMemo, useState, useId, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Hash, History, ArrowLeft, MessageSquarePlus, MessageSquare, CheckCircle2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDateTime } from "@/utils/datetime";
import {
  contractCommentService,
  type ContractComment,
} from "@/services/api/contract-comment.service";
import { translateApiError } from "@/lib/translate-api-error";
import type { ApiError } from "@/lib/api-client";
import type { Contract, ContractVersion } from "@/types/entities/contract.types";

interface ContractDocumentTabProps {
  contract: Contract;
  /** v616 — when present, render this historical version's body instead
   *  of the live contract body. Shows a banner + Back-to-current. */
  historicalVersion?: ContractVersion | null;
  /** Caller-supplied handler for the Back-to-current link. */
  onBackToCurrent?: () => void;
  // ─── 687 redline props (all optional → tab still works standalone) ───
  /** Enable select-text-to-comment. Off when viewing a historical version
   *  or when the caller lacks contract.comment.write. */
  canRedline?: boolean;
  /** contract.currentVersion — stamped onto new redline anchors. */
  currentVersionNumber?: number;
  /** When set, scroll that clause into view + flash it, then call onScrolled. */
  scrollToClauseId?: string | null;
  onScrolled?: () => void;
  /** Clicking a clause's comment badge — parent switches to the Comments tab. */
  onViewClauseInComments?: (clauseId: string) => void;
}

interface ClauseSegment {
  /** Slug-style anchor id, unique within the body. */
  id: string;
  /** Heading text (without `## ` prefix). Empty string for the preamble. */
  heading: string;
  /** Body text below the heading until the next heading. */
  body: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "section";
}

function parseClauses(body: string | null): ClauseSegment[] {
  if (!body) return [];
  const lines = body.split(/\r?\n/);
  const segments: ClauseSegment[] = [];
  let currentHeading = "";
  let currentBody: string[] = [];
  const seen = new Map<string, number>();

  const pushSegment = () => {
    if (currentHeading === "" && currentBody.every((l) => l.trim() === "")) return;
    const baseSlug = currentHeading ? slugify(currentHeading) : "preamble";
    const count = seen.get(baseSlug) ?? 0;
    seen.set(baseSlug, count + 1);
    const id = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
    segments.push({
      id,
      heading: currentHeading,
      body: currentBody.join("\n").trim(),
    });
  };

  for (const line of lines) {
    const m = /^##\s+(.+)$/.exec(line.trim());
    if (m) {
      pushSegment();
      currentHeading = m[1];
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  pushSegment();
  return segments;
}

/**
 * Render inline-markdown-bearing text with optional search highlighting.
 * Handles **bold**, *italic*, and `code` markers that ship in contract bodies
 * authored as Markdown. Falls back to plain text rendering when no markers
 * are present, so previously-clean bodies are unaffected.
 */
function HighlightedText({
  text,
  query,
  highlights,
}: {
  text: string;
  query: string;
  /** 687 — redline anchor quotes to paint light-yellow (persistent). */
  highlights?: string[];
}) {
  if (!text) return null;

  const inlineNodes = renderInlineMarkdown(text);

  const matchers: HighlightMatcher[] = [];
  if (query.trim()) {
    matchers.push({ needle: query.trim().toLowerCase(), className: "rounded bg-gold/40 px-0.5 text-ink" });
  }
  for (const h of highlights ?? []) {
    const n = h.trim().toLowerCase();
    // 687 — light-yellow (app amber-tint) marks the exact commented passage.
    if (n) matchers.push({ needle: n, className: "rounded bg-amber-tint px-0.5 text-ink" });
  }

  if (matchers.length === 0) {
    return <>{inlineNodes}</>;
  }

  // Re-walk over the rendered tree applying highlights to text fragments only.
  return <>{highlightNodesMulti(inlineNodes, matchers)}</>;
}

/**
 * Minimal inline-markdown renderer covering the markers that actually
 * appear in our contract bodies. Order matters: bold first (uses **), then
 * italic (single *), then `code`. We deliberately do NOT touch block-level
 * markdown (headings, lists, blockquotes) because the body is already wrapped
 * in `whitespace-pre-wrap` and the clause parser handles section structure.
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Regex: bold, italic, code. Each capture group is matched non-greedily.
  const pattern = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  let keyCounter = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > cursor) {
      out.push(text.slice(cursor, m.index));
    }
    if (m[2] != null) {
      out.push(<strong key={`md-b-${keyCounter++}`}>{m[2]}</strong>);
    } else if (m[4] != null) {
      out.push(<em key={`md-i-${keyCounter++}`}>{m[4]}</em>);
    } else if (m[6] != null) {
      out.push(
        <code key={`md-c-${keyCounter++}`} className="rounded bg-surface px-1 font-mono text-[0.85em]">
          {m[6]}
        </code>,
      );
    }
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) {
    out.push(text.slice(cursor));
  }
  return out;
}

interface HighlightMatcher {
  /** lower-cased needle to search for within each text fragment. */
  needle: string;
  /** Tailwind classes for the <mark> wrapper. */
  className: string;
}

/**
 * Highlight one or more needles across the rendered string fragments in a
 * single pass. At each cursor position the earliest match across all matchers
 * wins (non-overlapping), so search highlighting (gold) and redline-anchor
 * highlighting (amber/light-yellow) coexist without double-wrapping.
 */
function highlightNodesMulti(
  nodes: React.ReactNode[],
  matchers: HighlightMatcher[],
): React.ReactNode[] {
  return nodes.map((node, i) => {
    if (typeof node !== "string") return <span key={`mh-${i}`}>{node}</span>;
    const lowerText = node.toLowerCase();
    const out: React.ReactNode[] = [];
    let cursor = 0;
    let k = 0;
    while (cursor < node.length) {
      let best: { start: number; end: number; className: string } | null = null;
      for (const m of matchers) {
        if (!m.needle) continue;
        const idx = lowerText.indexOf(m.needle, cursor);
        if (idx !== -1 && (best === null || idx < best.start)) {
          best = { start: idx, end: idx + m.needle.length, className: m.className };
        }
      }
      if (!best) {
        out.push(node.slice(cursor));
        break;
      }
      if (best.start > cursor) out.push(node.slice(cursor, best.start));
      out.push(
        <mark key={`mh-${i}-${k++}`} className={best.className}>
          {node.slice(best.start, best.end)}
        </mark>,
      );
      cursor = best.end;
    }
    return <span key={`mh-${i}`}>{out}</span>;
  });
}

/** Per-clause redline tallies, keyed by clause id. */
interface ClauseTally {
  open: number;
  done: number;
}

/** What the floating "Comment" button needs to know about the selection. */
interface PendingSelection {
  quote: string;
  clauseId: string;
  heading: string;
  side: "en" | "ar";
  top: number;
  left: number;
}

export function ContractDocumentTab({
  contract,
  historicalVersion,
  onBackToCurrent,
  canRedline = false,
  currentVersionNumber,
  scrollToClauseId,
  onScrolled,
  onViewClauseInComments,
}: ContractDocumentTabProps) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const searchId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  // 687 — redline mode is only meaningful on the live body, never a snapshot.
  const redlineEnabled = canRedline && !historicalVersion;

  // v616 — when a historical version is selected, swap in its body. Live
  // edits to `contract.bodyEn/Ar` do not affect this view because we read
  // from the immutable contract_version row.
  const effectiveBodyEn = historicalVersion ? historicalVersion.bodyEn : contract.bodyEn;
  const effectiveBodyAr = historicalVersion ? historicalVersion.bodyAr : contract.bodyAr;

  const enClauses = useMemo(() => parseClauses(effectiveBodyEn ?? null), [effectiveBodyEn]);
  const arClauses = useMemo(() => parseClauses(effectiveBodyAr ?? null), [effectiveBodyAr]);

  // P29: default to active-locale only when both EN+AR exist (was always-both → duplication).
  const isAr = i18n.language?.startsWith('ar');
  const hasBoth = !!effectiveBodyEn && !!effectiveBodyAr;
  const [showBoth, setShowBoth] = useState(false);
  const showEn = (showBoth ? true : !isAr) && !!effectiveBodyEn;
  const showAr = (showBoth ? true : isAr) && !!effectiveBodyAr;

  const tocEn = useMemo(
    () => enClauses.filter((c) => c.heading.length > 0),
    [enClauses],
  );

  // ─── 687 — redline comments for this contract (drives markers) ───────────
  // Shares the React Query cache with ContractCommentsTab (same key + filter).
  const { data: comments } = useQuery<ContractComment[], ApiError>({
    queryKey: ["comments", contract.id, "all"],
    queryFn: () => contractCommentService.list(contract.id, "all"),
    staleTime: 15_000,
  });

  const tallyByClause = useMemo(() => {
    const map = new Map<string, ClauseTally>();
    for (const c of comments ?? []) {
      if (c.commentKind !== "redline" || !c.anchorClauseId) continue;
      const cur = map.get(c.anchorClauseId) ?? { open: 0, done: 0 };
      if (c.resolvedAt) cur.done += 1;
      else cur.open += 1;
      map.set(c.anchorClauseId, cur);
    }
    return map;
  }, [comments]);

  // 687 — the quoted passages of OPEN redlines, per clause + side, so the
  // Document tab can paint the exact commented text light-yellow. Resolved
  // comments drop out (the clause badge still shows the done count).
  const quotesByClause = useMemo(() => {
    const map = new Map<string, { en: string[]; ar: string[] }>();
    for (const c of comments ?? []) {
      if (c.commentKind !== "redline" || c.resolvedAt) continue;
      if (!c.anchorClauseId || !c.anchorQuote) continue;
      const cur = map.get(c.anchorClauseId) ?? { en: [], ar: [] };
      (c.anchorSide === "ar" ? cur.ar : cur.en).push(c.anchorQuote);
      map.set(c.anchorClauseId, cur);
    }
    return map;
  }, [comments]);

  // ─── 687 — text-selection → floating comment button ──────────────────────
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [note, setNote] = useState("");

  const createMutation = useMutation({
    mutationFn: (payload: {
      body: string;
      anchorClauseId: string;
      anchorClauseHeading: string;
      anchorQuote: string;
      anchorSide: "en" | "ar";
    }) =>
      contractCommentService.create(contract.id, {
        body: payload.body,
        commentKind: "redline",
        anchorClauseId: payload.anchorClauseId,
        anchorClauseHeading: payload.anchorClauseHeading || null,
        anchorQuote: payload.anchorQuote,
        anchorSide: payload.anchorSide,
        anchorVersionNumber: currentVersionNumber ?? null,
      }),
    onSuccess: () => {
      toast.success(
        t("contracts.document.redline.added", { defaultValue: "Comment added to clause" }),
      );
      setComposerOpen(false);
      setPending(null);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["comments", contract.id] });
    },
    onError: (err: ApiError) => {
      toast.error(translateApiError(err, t, "errors.comment.createFailed"));
    },
  });

  const captureSelection = useCallback(() => {
    if (!redlineEnabled) return;
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!sel || sel.rangeCount === 0 || text.length === 0) {
      setPending((p) => (composerOpen ? p : null));
      return;
    }
    // Climb from the selection anchor to the nearest clause wrapper.
    let node: Node | null = sel.anchorNode;
    let el: HTMLElement | null =
      node && node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null);
    const clauseEl = el?.closest<HTMLElement>("[data-clause-id]") ?? null;
    if (!clauseEl) {
      setPending(null);
      return;
    }
    const clauseId = clauseEl.dataset.clauseId ?? "";
    const heading = clauseEl.dataset.clauseHeading ?? "";
    const side = (clauseEl.dataset.clauseSide as "en" | "ar") ?? "en";
    // Viewport coords — the button is position:fixed so it sits over the
    // live selection regardless of positioned/transformed ancestors.
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setPending({
      quote: text.slice(0, 2000),
      clauseId,
      heading,
      side,
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, [redlineEnabled, composerOpen]);

  // Dismiss the floating button on scroll/resize (its position goes stale).
  useEffect(() => {
    if (!pending || composerOpen) return;
    const dismiss = () => setPending(null);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [pending, composerOpen]);

  // ─── Parent-requested scroll-to-clause (from a comment's "View in doc") ───
  useEffect(() => {
    if (!scrollToClauseId) return;
    const el = rootRef.current?.querySelector<HTMLElement>(
      `[data-clause-id="${CSS.escape(scrollToClauseId)}"]`,
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-gold", "rounded-md");
      window.setTimeout(() => el.classList.remove("ring-2", "ring-gold", "rounded-md"), 2200);
    }
    onScrolled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToClauseId]);

  if (!effectiveBodyEn && !effectiveBodyAr) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-ink-subtle">
          {t("contracts.detail.document.empty", {
            defaultValue: "This contract has no body text yet.",
          })}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" ref={rootRef}>
      {/* v616 — historical-version banner. */}
      {historicalVersion && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/40 bg-gold/10 p-3">
          <div className="flex items-start gap-2 text-sm text-ink">
            <History className="mt-0.5 h-4 w-4 shrink-0 text-gold-ink" aria-hidden="true" />
            <div>
              <p className="font-medium">
                {t("contracts.detail.document.historicalBanner.title", {
                  defaultValue: "Viewing version {{n}}",
                  n: historicalVersion.versionNumber,
                })}
              </p>
              <p className="text-xs text-ink-muted">
                {t("contracts.detail.document.historicalBanner.subtitle", {
                  defaultValue: "Created {{when}}{{by}}. Read-only snapshot.",
                  when: formatDateTime(historicalVersion.createdAt),
                  by: historicalVersion.changedBy
                    ? ` · ${historicalVersion.changedBy.firstName} ${historicalVersion.changedBy.lastName}`
                    : "",
                })}
              </p>
            </div>
          </div>
          {onBackToCurrent && (
            <Button type="button" size="sm" variant="outline" onClick={onBackToCurrent}>
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("contracts.detail.document.historicalBanner.back", {
                defaultValue: "Back to current",
              })}
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("contracts.detail.document.findPlaceholder", {
              defaultValue: "Find in document…",
            })}
            className="ps-9"
          />
        </div>
        <p className="text-[11px] text-ink-subtle">
          {t("contracts.detail.document.clauseCount", {
            defaultValue: "{{count}} clause sections",
            count: tocEn.length,
          })}
        </p>
        {hasBoth && (
          <label className="ms-auto inline-flex items-center gap-2 text-[11px] text-ink-muted">
            <input
              type="checkbox"
              checked={showBoth}
              onChange={(e) => setShowBoth(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border"
            />
            {t("contracts.detail.document.showBilingual", { defaultValue: "Show EN + AR side-by-side" })}
          </label>
        )}
      </div>

      {/* 687 — redline hint banner so reviewers know the affordance exists. */}
      {redlineEnabled && (
        <div className="flex items-center gap-2 rounded-md border border-gold/30 bg-gold/5 px-3 py-2 text-[11px] text-ink-muted">
          <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-gold-ink" aria-hidden="true" />
          <span>
            {t("contracts.document.redline.hint", {
              defaultValue:
                "Select any text in the contract to attach a comment to that clause, then use Action → Request resubmission to send it back to the drafter.",
            })}
          </span>
        </div>
      )}

      {tocEn.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t("contracts.detail.document.toc", { defaultValue: "On this page" })}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {tocEn.map((c) => (
                <li key={c.id}>
                  <a
                    href={`#${c.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 font-mono text-[10px] text-ink-muted hover:border-gold hover:text-ink"
                  >
                    <Hash className="h-3 w-3" />
                    {c.heading}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div
        className={`grid gap-4 ${showBoth ? 'lg:grid-cols-2' : ''}`}
        onMouseUp={redlineEnabled ? captureSelection : undefined}
      >
        {showEn && (
          <DocumentColumn
            label={t("contracts.fields.bodyEn")}
            dir="ltr"
            side="en"
            clauses={enClauses}
            query={debouncedQuery}
            tallyByClause={tallyByClause}
            quotesByClause={quotesByClause}
            onClauseBadge={onViewClauseInComments}
          />
        )}
        {showAr && (
          <DocumentColumn
            label={t("contracts.fields.bodyAr")}
            dir="rtl"
            side="ar"
            clauses={arClauses}
            query={debouncedQuery}
            tallyByClause={tallyByClause}
            quotesByClause={quotesByClause}
            onClauseBadge={onViewClauseInComments}
          />
        )}
      </div>

      {/* 687 — floating "Comment" button anchored to the live selection. */}
      {redlineEnabled && pending && !composerOpen && (
        <button
          type="button"
          style={{ position: "fixed", top: pending.top, left: pending.left, transform: "translate(-50%, -100%)" }}
          className="z-40 inline-flex items-center gap-1 rounded-full border border-gold bg-card px-3 py-1.5 text-xs font-medium text-ink shadow-lg hover:bg-gold/10"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setComposerOpen(true);
            setNote("");
          }}
        >
          <MessageSquarePlus className="h-3.5 w-3.5 text-gold-ink" />
          {t("contracts.document.redline.commentCta", { defaultValue: "Comment" })}
        </button>
      )}

      {/* 687 — redline composer modal. */}
      {composerOpen && pending && (
        <RedlineComposer
          pending={pending}
          note={note}
          onNote={setNote}
          pendingSubmit={createMutation.isPending}
          onCancel={() => {
            setComposerOpen(false);
            setPending(null);
            setNote("");
          }}
          onSubmit={() => {
            const trimmed = note.trim();
            if (!trimmed) return;
            createMutation.mutate({
              body: trimmed,
              anchorClauseId: pending.clauseId,
              anchorClauseHeading: pending.heading,
              anchorQuote: pending.quote,
              anchorSide: pending.side,
            });
          }}
        />
      )}
    </div>
  );
}

interface DocumentColumnProps {
  label: string;
  dir: "ltr" | "rtl";
  side: "en" | "ar";
  clauses: ClauseSegment[];
  query: string;
  tallyByClause: Map<string, ClauseTally>;
  quotesByClause: Map<string, { en: string[]; ar: string[] }>;
  onClauseBadge?: (clauseId: string) => void;
}

function DocumentColumn({ label, dir, side, clauses, query, tallyByClause, quotesByClause, onClauseBadge }: DocumentColumnProps) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">{label}</p>
        <div dir={dir} className="space-y-4 text-sm leading-relaxed text-ink">
          {clauses.map((c) => {
            const tally = tallyByClause.get(c.id);
            const quotes = quotesByClause.get(c.id)?.[side];
            return (
              <section
                key={c.id}
                id={c.heading ? c.id : undefined}
                data-clause-id={c.id}
                data-clause-heading={c.heading}
                data-clause-side={side}
                className="scroll-mt-24 transition-[box-shadow]"
              >
                {c.heading ? (
                  <h3 className="group flex items-baseline gap-1 text-base font-semibold text-ink">
                    <a
                      href={`#${c.id}`}
                      className="text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="anchor"
                    >
                      <Hash className="h-3 w-3" />
                    </a>
                    <span>
                      <HighlightedText text={c.heading} query={query} />
                    </span>
                    <ClauseBadge tally={tally} clauseId={c.id} onClick={onClauseBadge} />
                  </h3>
                ) : (
                  tally && (
                    <div className="mb-1">
                      <ClauseBadge tally={tally} clauseId={c.id} onClick={onClauseBadge} />
                    </div>
                  )
                )}
                {c.body && (
                  <pre className="mt-1 whitespace-pre-wrap font-sans text-sm text-ink">
                    <HighlightedText text={c.body} query={query} highlights={quotes} />
                  </pre>
                )}
              </section>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/** Small per-clause marker — open (gold) + done (sage) redline counts. */
function ClauseBadge({
  tally,
  clauseId,
  onClick,
}: {
  tally?: ClauseTally;
  clauseId: string;
  onClick?: (clauseId: string) => void;
}) {
  const { t } = useTranslation();
  if (!tally || (tally.open === 0 && tally.done === 0)) return null;
  return (
    <button
      type="button"
      onClick={() => onClick?.(clauseId)}
      title={t("contracts.document.redline.badgeTitle", {
        defaultValue: "{{open}} open · {{done}} done — view comments",
        open: tally.open,
        done: tally.done,
      })}
      className="ms-2 inline-flex items-center gap-1 rounded-full border border-border bg-surface px-1.5 py-0.5 align-middle text-[10px] font-medium text-ink-muted hover:border-gold hover:text-ink"
    >
      {tally.open > 0 ? (
        <>
          <MessageSquare className="h-3 w-3 text-gold-ink" />
          {tally.open}
        </>
      ) : (
        <CheckCircle2 className="h-3 w-3 text-sage" />
      )}
      {tally.done > 0 && tally.open > 0 && (
        <span className="text-sage">· {tally.done}✓</span>
      )}
    </button>
  );
}

/** 687 — modal to compose a redline comment for the captured selection. */
function RedlineComposer({
  pending,
  note,
  onNote,
  pendingSubmit,
  onCancel,
  onSubmit,
}: {
  pending: PendingSelection;
  note: string;
  onNote: (v: string) => void;
  pendingSubmit: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pendingSubmit) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">
            {t("contracts.document.redline.composerTitle", { defaultValue: "Add a comment" })}
          </h2>
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} disabled={pendingSubmit} aria-label={t("common.close")}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 rounded-md border border-border bg-surface p-2.5">
          {pending.heading && (
            <p className="mb-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              <Hash className="h-3 w-3" />
              {pending.heading}
            </p>
          )}
          <p className="line-clamp-3 border-s-2 border-gold ps-2 text-xs italic text-ink-muted">
            “{pending.quote}”
          </p>
        </div>

        <label className="mt-3 block text-xs font-medium text-ink-muted" htmlFor="redline-note">
          {t("contracts.document.redline.noteLabel", { defaultValue: "What needs to change?" })}
        </label>
        <textarea
          id="redline-note"
          autoFocus
          value={note}
          onChange={(e) => onNote(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder={t("contracts.document.redline.notePlaceholder", {
            defaultValue: "Describe the change you want the drafter to make…",
          })}
          className="mt-1 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />

        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pendingSubmit}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={onSubmit} disabled={!note.trim() || pendingSubmit}>
            {pendingSubmit ? t("common.saving") : t("contracts.document.redline.save", { defaultValue: "Add comment" })}
          </Button>
        </div>
      </div>
    </div>
  );
}
