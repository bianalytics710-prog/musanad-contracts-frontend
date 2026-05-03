/**
 * Unit test — F-FE-M3: downloadBlobWithHeaders rejects responses whose
 * Content-Type does not match the expected MIME.
 *
 * If a misconfigured BE — or an intermediary CDN error page — returns 200
 * with `text/html`, the legacy helper would happily save the HTML as
 * `contract-42.pdf`. The user only notices when the PDF reader chokes on
 * `<html>`. Defense-in-depth: the helper now accepts an optional
 * `expectedContentType` parameter and throws `BlobContentTypeMismatchError`
 * on mismatch — the caller's onError can translate that via
 * `translateApiError(err, t, 'errors.export.failed')`.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { BlobContentTypeMismatchError, downloadBlobWithHeaders } from "@/lib/format-blob-download";

describe("downloadBlobWithHeaders — F-FE-M3 expectedContentType validation", () => {
  beforeEach(() => {
    // Stub URL.createObjectURL / revokeObjectURL since jsdom does not
    // implement them. Only relevant for the (negative-tested) happy-path —
    // our mismatch test should THROW before reaching DOM glue.
    vi.stubGlobal(
      "URL",
      Object.assign({}, URL, {
        createObjectURL: vi.fn(() => "blob:fake"),
        revokeObjectURL: vi.fn(),
      }),
    );
  });

  it("throws BlobContentTypeMismatchError when response Content-Type is text/html and PDF was expected", () => {
    const html = new Blob(["<html><body>error page</body></html>"], { type: "text/html" });
    const headers = new Headers({
      "content-type": "text/html",
      "content-disposition": 'attachment; filename="contract-42.pdf"',
    });

    expect(() =>
      downloadBlobWithHeaders(html, headers, "contract-42.pdf", "application/pdf"),
    ).toThrow(BlobContentTypeMismatchError);

    // Verify the typed error carries the diagnostic context (callers may
    // surface this in dev logs / toasts).
    try {
      downloadBlobWithHeaders(html, headers, "contract-42.pdf", "application/pdf");
    } catch (err) {
      expect(err).toBeInstanceOf(BlobContentTypeMismatchError);
      const typed = err as BlobContentTypeMismatchError;
      expect(typed.expected).toEqual(["application/pdf"]);
      expect(typed.actual).toBe("text/html");
    }
  });

  it("does NOT throw when Content-Type matches (sanity)", () => {
    const pdf = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: "application/pdf" });
    const headers = new Headers({
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="contract-42.pdf"',
    });

    expect(() =>
      downloadBlobWithHeaders(pdf, headers, "contract-42.pdf", "application/pdf"),
    ).not.toThrow();
  });
});
