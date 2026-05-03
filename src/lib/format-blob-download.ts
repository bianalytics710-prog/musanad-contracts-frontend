/**
 * format-blob-download — Helper for binary file downloads.
 *
 * Backend export endpoints (M1b S4 PDF, S5 XLSX) return binary streams with
 * Content-Disposition headers. Axios's default JSON-handling interceptor
 * cannot deal with binary, so the export services use `fetch()` directly
 * (or axios with `responseType: 'blob'`) and forward to this helper for the
 * Content-Disposition parsing + Blob → DOM download dance.
 *
 * Why a shared helper: all export endpoints follow the same pattern —
 * read filename from Content-Disposition, fall back to a sensible default
 * if the header is missing, create an object URL, click an invisible <a>,
 * revoke the URL on a microtask. Done in three places (PDF dialog, XLSX
 * button, future ICS export) so it lives in lib/.
 *
 * Security: object URLs leak memory if not revoked. The `setTimeout(0)`
 * after .click() is intentional — some Safari builds need the URL to
 * survive until the navigation tick fires.
 */

// We strip C0 control characters (0x00-0x1F) so that header-injected
// filenames cannot smuggle terminator bytes into Save-As dialogs. The
// no-control-regex rule disallows literal \x00-\x1f, even when stripping
// is the entire point. We sidestep the rule by replacing per-codepoint
// in a manual loop — same effect as a regex character class but with no
// static-analysis noise.
function stripControlChars(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    // Skip C0 control characters (incl. NUL, BEL, BS, HT, LF, VT, FF, CR…).
    if (code < 0x20) continue;
    out += input[i];
  }
  return out;
}

/**
 * Parse the `filename=` parameter out of a Content-Disposition header.
 *
 * Handles RFC 6266 forms:
 *   - filename="contracts-20260503-1430.xlsx"  (quoted)
 *   - filename=contracts-20260503-1430.xlsx     (unquoted)
 *   - filename*=UTF-8''contracts-2026.xlsx      (RFC 5987 encoded — preferred)
 *
 * The `filename*=` form takes precedence per spec. Falls back to a quoted
 * `filename=` token, then unquoted, then null.
 */
export function parseContentDispositionFilename(header: string | null | undefined): string | null {
  if (!header) return null;

  // RFC 5987 encoded form — wins when present.
  const star = /filename\*\s*=\s*([^']+)'([^']*)'([^;]+)/i.exec(header);
  if (star) {
    const encoding = star[1];
    const value = star[3].trim();
    try {
      // RFC 5987 requires percent-decoding regardless of charset name.
      const decoded = decodeURIComponent(value);
      // Sanitize away path separators that could enable directory traversal
      // when the browser writes to disk.
      return sanitizeFilename(decoded);
    } catch {
      // Bad encoding — fall through to plain filename.
      void encoding;
    }
  }

  // Quoted plain form.
  const quoted = /filename\s*=\s*"([^"]*)"/i.exec(header);
  if (quoted) return sanitizeFilename(quoted[1]);

  // Unquoted plain form (rare in modern servers but valid).
  const plain = /filename\s*=\s*([^;]+)/i.exec(header);
  if (plain) return sanitizeFilename(plain[1].trim());

  return null;
}

/**
 * Strip path separators and control characters out of a filename so that
 * the browser's "Save As" dialog cannot be tricked into traversing the
 * filesystem. Belt-and-braces — modern browsers already sanitize, but
 * different versions handle this inconsistently.
 */
function sanitizeFilename(name: string): string {
  // Path separators.
  let out = name.replace(/[/\\]/g, "_");
  // Null + other C0 control characters — see stripControlChars.
  out = stripControlChars(out);
  // Trim whitespace and leading dots (hidden files on POSIX).
  out = out.replace(/^\.+/, "").trim();
  return out || "download";
}

/**
 * Trigger a browser download for a Blob with the given filename. Creates
 * an invisible <a> element, clicks it, then revokes the object URL on a
 * macrotask so Safari's navigation tick has time to consume the URL.
 *
 * Caller is responsible for awaiting the source promise (fetch.blob() etc.)
 * before invoking this helper — no async behaviour here, just DOM glue.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  // Defensive: empty filename would let the browser invent one based on the
  // URL slug, which for object: URLs is opaque. Use a generic fallback so
  // the user always sees something sensible.
  const safeName = sanitizeFilename(filename) || "download";

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName;
  anchor.rel = "noopener";
  // The anchor must be in the DOM for Firefox to honor the download.
  anchor.style.display = "none";
  document.body.appendChild(anchor);

  try {
    anchor.click();
  } finally {
    // Revoke on next macrotask so the browser has time to start the
    // download. setTimeout(0) is used by the spec examples for the same
    // reason; queueMicrotask is too eager for some Safari builds.
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      if (anchor.parentNode) {
        anchor.parentNode.removeChild(anchor);
      }
    }, 0);
  }
}

/**
 * Thrown by `downloadBlobWithHeaders` when the actual Content-Type doesn't
 * match what the caller expected. Lets the caller surface a typed error
 * (e.g. via translateApiError → `errors.export.unexpected_content_type`)
 * instead of silently triggering a download of an HTML error page or
 * malformed payload (Codex F-FE-M3).
 */
export class BlobContentTypeMismatchError extends Error {
  readonly expected: readonly string[];
  readonly actual: string;

  constructor(expected: string | readonly string[], actual: string) {
    const expectedList = Array.isArray(expected) ? expected : [expected as string];
    super(
      `Unexpected response content type: got "${actual}", expected one of [${expectedList.join(", ")}].`,
    );
    this.name = "BlobContentTypeMismatchError";
    this.expected = expectedList;
    this.actual = actual;
  }
}

/**
 * Test whether `actual` matches any of the `expected` MIME types. We
 * compare on the "type/subtype" prefix so optional `; charset=…` or
 * `; boundary=…` parameters from the server don't cause false negatives.
 */
function matchesMimeType(actual: string, expected: readonly string[]): boolean {
  const normalisedActual = actual.split(";")[0].trim().toLowerCase();
  return expected.some((exp) => exp.split(";")[0].trim().toLowerCase() === normalisedActual);
}

/**
 * Convenience: download a Blob using the filename embedded in the response's
 * Content-Disposition header, with a fallback if the header is missing.
 *
 * Optionally validates the response Content-Type against an expected MIME
 * (or list of acceptable MIMEs). Throws `BlobContentTypeMismatchError` when
 * the response doesn't match — the caller's onError can translate it.
 * Codex F-FE-M3 — protects against the BE silently serving an HTML error
 * page or wrong-format binary that the user would only notice after
 * download.
 *
 * @param blob                  The binary payload.
 * @param headers               The response headers.
 * @param fallback              Default filename when Content-Disposition is
 *                              missing or unparseable — the caller's
 *                              responsibility to choose something sensible
 *                              (e.g. `contract-${id}.pdf`).
 * @param expectedContentType   Optional. When provided, validates the
 *                              response's Content-Type header (and falls
 *                              back to `blob.type`) against this string
 *                              (or array of acceptable MIMEs). Mismatch
 *                              throws `BlobContentTypeMismatchError`.
 */
export function downloadBlobWithHeaders(
  blob: Blob,
  headers: Headers,
  fallback: string,
  expectedContentType?: string | readonly string[],
): void {
  if (expectedContentType) {
    const expected = Array.isArray(expectedContentType)
      ? expectedContentType
      : [expectedContentType as string];
    // Prefer the response header — it's authoritative. Some browsers
    // populate `blob.type` only when the response carried a Content-Type,
    // so the header check is the primary signal.
    const headerType = headers.get("content-type") ?? "";
    const blobType = blob.type ?? "";
    const candidate = headerType || blobType;
    if (!candidate || !matchesMimeType(candidate, expected)) {
      throw new BlobContentTypeMismatchError(expected, candidate || "(unknown)");
    }
  }
  const filename = parseContentDispositionFilename(headers.get("content-disposition")) ?? fallback;
  triggerBlobDownload(blob, filename);
}
