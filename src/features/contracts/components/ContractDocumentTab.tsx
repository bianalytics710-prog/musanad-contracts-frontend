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
import { useMemo, useState, useId } from "react";
import { useTranslation } from "react-i18next";
import { Search, Hash } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import type { Contract } from "@/types/entities/contract.types";

interface ContractDocumentTabProps {
  contract: Contract;
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

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>;
  const parts: Array<{ kind: "text" | "hit"; value: string }> = [];
  const lowerText = text.toLowerCase();
  const lowerQ = query.toLowerCase();
  let cursor = 0;
  while (cursor < text.length) {
    const idx = lowerText.indexOf(lowerQ, cursor);
    if (idx === -1) {
      parts.push({ kind: "text", value: text.slice(cursor) });
      break;
    }
    if (idx > cursor) parts.push({ kind: "text", value: text.slice(cursor, idx) });
    parts.push({ kind: "hit", value: text.slice(idx, idx + query.length) });
    cursor = idx + query.length;
  }
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "hit" ? (
          <mark key={i} className="rounded bg-gold/40 px-0.5 text-ink">
            {p.value}
          </mark>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </>
  );
}

export function ContractDocumentTab({ contract }: ContractDocumentTabProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const searchId = useId();

  const enClauses = useMemo(() => parseClauses(contract.bodyEn ?? null), [contract.bodyEn]);
  const arClauses = useMemo(() => parseClauses(contract.bodyAr ?? null), [contract.bodyAr]);

  const tocEn = useMemo(
    () => enClauses.filter((c) => c.heading.length > 0),
    [enClauses],
  );

  if (!contract.bodyEn && !contract.bodyAr) {
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

      <div className="grid gap-4 lg:grid-cols-2">
        {contract.bodyEn && (
          <DocumentColumn
            label={t("contracts.fields.bodyEn")}
            dir="ltr"
            clauses={enClauses}
            query={debouncedQuery}
          />
        )}
        {contract.bodyAr && (
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
