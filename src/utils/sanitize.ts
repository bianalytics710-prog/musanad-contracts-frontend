/**
 * Musanad — HTML sanitisation helper.
 *
 * Centralised wrapper for the rare cases we render server-supplied HTML
 * (e.g. AI-generated previews, regulatory-impact summaries). All such
 * cases MUST funnel through this module — never `dangerouslySetInnerHTML`
 * with raw input.
 *
 * For M0 we expose a minimal allow-list sanitiser. M1 will swap in DOMPurify
 * once we ship the relevant feature surfaces; the API stays stable.
 */

const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "br",
  "code",
  "em",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "ul",
]);

const ALLOWED_ATTRS = new Set(["href", "title", "rel", "target"]);

/**
 * Escapes raw text for safe interpolation into HTML attributes / text.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Returns an HTML string with disallowed tags/attributes stripped.
 *
 * The implementation is intentionally minimal for M0. Feature modules
 * that render rich content (e.g. AI-drafted clauses) will switch this
 * over to DOMPurify with an allow-list configured from the design
 * system. Until then, prefer plain text + react interpolation.
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";
  const doc =
    typeof DOMParser !== "undefined"
      ? new DOMParser().parseFromString(input, "text/html")
      : null;
  if (!doc) return escapeHtml(input);

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const toRemove: Element[] = [];
  let node: Node | null = walker.currentNode;
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (!ALLOWED_TAGS.has(el.tagName.toLowerCase())) {
        toRemove.push(el);
      } else {
        for (const attr of Array.from(el.attributes)) {
          if (!ALLOWED_ATTRS.has(attr.name.toLowerCase())) {
            el.removeAttribute(attr.name);
          }
        }
      }
    }
    node = walker.nextNode();
  }
  for (const el of toRemove) {
    el.replaceWith(...Array.from(el.childNodes));
  }
  return doc.body.innerHTML;
}
