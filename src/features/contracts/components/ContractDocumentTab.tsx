/**
 * ContractDocumentTab — side-by-side EN+AR contract body view with anchored
 * clause headings and "Find in document" search.
 *
 * Lovable's contract detail "Document" tab uses an h3 per clause heading
 * (parsed from `## ` lines in the body markdown) and lets the user jump
 * to anchors by id. We do the same: split each body into clause segments
 * keyed off `^##\s+...$` lines, render h3 headers with id + visible anchor.
 *
 * Find: a debounced text input highlights the first occurrence on each side.
 *
 * Body text is SENSITIVE — no console logs.
 */
import React, { useMemo, useState, useId } from "react";
import { useTranslation } from "react-i18next";
import { Search, Hash, History, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDateTime } from "@/utils/datetime";
import type { Contract, ContractVersion } from "@/types/entities/contract.types";

interface ContractDocumentTabProps {
  contract: Contract;
  /** v616 — when present, render this historical version's body instead
   *  of the live contract body. Shows a banner + Back-to-current. */
  historicalVersion?: ContractVersion | null;
  /** Caller-supplied handler for the Back-to-current link. */
  onBackToCurrent?: () => void;
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
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!text) return null;

  const inlineNodes = renderInlineMarkdown(text);

  if (!query.trim()) {
    return <>{inlineNodes}</>;
  }

  // Re-walk over the rendered tree applying the highlight to text fragments only.
  return <>{highlightNodes(inlineNodes, query)}</>;
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

function highlightNodes(nodes: React.ReactNode[], query: string): React.ReactNode[] {
  const lowerQ = query.toLowerCase();
  return nodes.map((node, i) => {
    if (typeof node !== "string") return <span key={`mh-${i}`}>{node}</span>;
    const out: React.ReactNode[] = [];
    const lowerText = node.toLowerCase();
    let cursor = 0;
    while (cursor < node.length) {
      const idx = lowerText.indexOf(lowerQ, cursor);
      if (idx === -1) {
        out.push(node.slice(cursor));
        break;
      }
      if (idx > cursor) out.push(node.slice(cursor, idx));
      out.push(
        <mark key={`mh-${i}-${idx}`} className="rounded bg-gold/40 px-0.5 text-ink">
          {node.slice(idx, idx + query.length)}
        </mark>,
      );
      cursor = idx + query.length;
    }
    return <span key={`mh-${i}`}>{out}</span>;
  });
}

export function ContractDocumentTab({
  contract,
  historicalVersion,
  onBackToCurrent,
}: ContractDocumentTabProps) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const searchId = useId();

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
    <div className="space-y-4">
      {/* v616 — historical-version banner. Shown only when the parent
          renders this tab with a historicalVersion override (i.e. the
          drafter clicked "View this version" on the Versions tab). */}
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

      <div className={`grid gap-4 ${showBoth ? 'lg:grid-cols-2' : ''}`}>
        {showEn && (
          <DocumentColumn
            label={t("contracts.fields.bodyEn")}
            dir="ltr"
            clauses={enClauses}
            query={debouncedQuery}
          />
        )}
        {showAr && (
          <DocumentColumn
            label={t("contracts.fields.bodyAr")}
            dir="rtl"
            clauses={arClauses}
            query={debouncedQuery}
          />
        )}
      </div>
    </div>
  );
}

interface DocumentColumnProps {
  label: string;
  dir: "ltr" | "rtl";
  clauses: ClauseSegment[];
  query: string;
}

function DocumentColumn({ label, dir, clauses, query }: DocumentColumnProps) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">{label}</p>
        <div dir={dir} className="space-y-4 text-sm leading-relaxed text-ink">
          {clauses.map((c) =>
            c.heading ? (
              <section key={c.id} id={c.id} className="scroll-mt-24">
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
                </h3>
                {c.body && (
                  <pre className="mt-1 whitespace-pre-wrap font-sans text-sm text-ink">
                    <HighlightedText text={c.body} query={query} />
                  </pre>
                )}
              </section>
            ) : c.body ? (
              <pre
                key={c.id}
                className="whitespace-pre-wrap font-sans text-sm text-ink"
              >
                <HighlightedText text={c.body} query={query} />
              </pre>
            ) : null,
          )}
        </div>
      </CardContent>
    </Card>
  );
}
