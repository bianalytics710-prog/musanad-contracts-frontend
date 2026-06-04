/**
 * Template body parser — splits a contract_template.body_en (or body_ar)
 * string into discrete sections that the Compose Wizard can render and
 * reorder.
 *
 * Templates seeded by mig 498 follow a consistent shape:
 *
 *   # Title
 *
 *   Preamble paragraph(s) ... {{placeholder}} ...
 *
 *   ## 1. First section title
 *
 *   Section body.
 *
 *   ## 2. Second section title
 *
 *   ...
 *
 *   ## N. Last section title
 *
 *   ...
 *
 *   Signed for and on behalf of {{party_a}}        ...
 *   ____________________                            ____________________
 *
 * We extract:
 *   - PREAMBLE   — everything before the first `## N.` heading
 *   - CLAUSES    — one section per `## N. title` block
 *   - SIGNATURE  — trailing block matching /^Signed for and on behalf of|^_{5,}/
 *                  detected at the tail of the last clause body
 *
 * The parser is intentionally tolerant — templates that lack `## N.` headings
 * collapse into a single preamble section.
 *
 * Placeholders ({{token}}) are LEFT INTACT in section bodies. Substitution
 * happens at render time (PlaceholderRenderedBody) so a mid-flow edit to
 * the values in Step 2 reflects without re-parsing.
 */

import type { ComposeBodySection } from "@/types/entities/payment-schedule.types";

const CLAUSE_HEADING_RE = /^## (\d+)\.\s+(.+)$/gm;
const SIGNATURE_TAIL_RE =
  /\n{2,}(Signed for and on behalf of[\s\S]+|_{5,}[\s\S]+)$/m;

interface ParsedBlock {
  kind: "preamble" | "clause" | "signature";
  title: string | null;
  body: string;
}

/**
 * Parse a single-language body into a flat block list. Caller is responsible
 * for stitching EN and AR blocks together (see parseTemplateBodyBilingual).
 */
function parseBlocks(body: string): ParsedBlock[] {
  if (!body || body.trim() === "") return [];

  const headings: Array<{ idx: number; title: string; matchLen: number }> = [];
  let m: RegExpExecArray | null;
  CLAUSE_HEADING_RE.lastIndex = 0;
  while ((m = CLAUSE_HEADING_RE.exec(body)) !== null) {
    headings.push({
      idx: m.index,
      title: (m[2] ?? "").trim(),
      matchLen: m[0].length,
    });
  }

  if (headings.length === 0) {
    return [{ kind: "preamble", title: null, body: body.trim() }];
  }

  const out: ParsedBlock[] = [];

  // PREAMBLE
  const preambleText = body.slice(0, headings[0]!.idx).trim();
  if (preambleText) {
    out.push({ kind: "preamble", title: null, body: preambleText });
  }

  // CLAUSES
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]!;
    const bodyStart = h.idx + h.matchLen;
    const bodyEnd = i + 1 < headings.length ? headings[i + 1]!.idx : body.length;
    out.push({
      kind: "clause",
      title: h.title,
      body: body.slice(bodyStart, bodyEnd).trim(),
    });
  }

  // SIGNATURE — peel off the trailing signature block if present.
  const last = out[out.length - 1];
  if (last && last.kind === "clause") {
    const sig = last.body.match(SIGNATURE_TAIL_RE);
    if (sig && typeof sig.index === "number") {
      const sigText = (sig[1] ?? "").trim();
      last.body = last.body.slice(0, sig.index).trim();
      if (sigText) {
        out.push({ kind: "signature", title: null, body: sigText });
      }
    }
  }

  return out;
}

/**
 * Parse EN and AR bodies together so each section carries both bodyEn and
 * bodyAr where available. AR blocks are paired with EN blocks by index when
 * the kinds line up; mismatched pairs fall back to null on the missing side.
 */
export function parseTemplateBodyBilingual(
  bodyEn: string | null | undefined,
  bodyAr: string | null | undefined,
): ComposeBodySection[] {
  const en = parseBlocks((bodyEn ?? "").trim());
  const ar = parseBlocks((bodyAr ?? "").trim());

  if (en.length === 0 && ar.length === 0) return [];

  const out: ComposeBodySection[] = [];
  const max = Math.max(en.length, ar.length);
  let clauseN = 0;
  for (let i = 0; i < max; i++) {
    const e = en[i];
    const a = ar[i];
    const kind: "preamble" | "clause" | "signature" = e?.kind ?? a?.kind ?? "clause";
    if (kind === "clause") clauseN += 1;
    const id =
      kind === "preamble"
        ? "preamble"
        : kind === "signature"
        ? "signature"
        : `tpl-clause-${clauseN}`;
    const title =
      kind === "clause" ? (e?.title ?? a?.title ?? null) : null;
    const bodyEnPart = e && e.kind === kind ? e.body : "";
    const bodyArPart = a && a.kind === kind ? a.body : null;
    out.push({
      id,
      kind,
      title,
      bodyEn: bodyEnPart,
      bodyAr: bodyArPart,
      source: "template",
      clauseId: null,
    });
  }
  return out;
}

/**
 * Re-numerate the `## N.` headings when sections are reordered or removed,
 * and stitch the body back together for BE submission.
 */
export function assembleBodyFromSections(
  sections: ComposeBodySection[],
  language: "en" | "ar",
): string {
  const parts: string[] = [];
  let clauseN = 0;
  for (const s of sections) {
    const body = (language === "ar" ? s.bodyAr : s.bodyEn) ?? "";
    if (!body.trim()) continue;
    if (s.kind === "preamble" || s.kind === "signature") {
      parts.push(body.trim());
    } else {
      clauseN += 1;
      const title = s.title ?? `Clause ${clauseN}`;
      parts.push(`## ${clauseN}. ${title}\n\n${body.trim()}`);
    }
  }
  return parts.join("\n\n");
}
