/**
 * Unit test — F-FE-M2: translateApiError per-namespace lookup for export
 * errors.
 *
 * Before F-FE-M2, every export error toast collapsed to either the generic
 * `errors.<code>` table or the feature-specific fallback string passed by
 * the caller. There was no way to distinguish "401 on export" from "401 on
 * any other call", and 429 fell through to the catch-all "Something went
 * wrong" because RATE_LIMITED wasn't in the code map at all.
 *
 * The fix routes the lookup as:
 *   1. If `fallbackKey` is `errors.<feature>.<x>` (e.g. `errors.export.failed`),
 *      derive the namespace prefix `errors.export` and try
 *      `errors.export.<httpStatusSuffix>` first.
 *   2. Otherwise fall through to the generic CODE_TO_KEY table.
 *   3. Otherwise fall through to the supplied fallback key.
 *
 * This test exercises all three paths and asserts the lookups resolve to
 * stable i18n keys / translated strings.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { initI18n } from "@/i18n";
import i18n from "i18next";
import { ApiError } from "@/lib/api-client";
import { translateApiError } from "@/lib/translate-api-error";

beforeAll(() => {
  // initI18n is idempotent (guards on `initialized`/`isInitialized`); we
  // call it explicitly so direct `i18n.t(...)` lookups in the assertions
  // resolve real translations rather than `undefined`.
  initI18n();
});

describe("translateApiError — F-FE-M2 export-namespace routing", () => {
  // Real i18n is initialised; assert against the resolved English string so
  // we don't lock to a specific key shape that might shift around. The
  // expected text comes from `src/i18n/en.json` — see the `errors.export`
  // and `errors.<code>` blocks.

  it("UNAUTHORIZED + namespace=export → resolves to errors.export.unauthorized", () => {
    const err = new ApiError({
      status: 401,
      code: "UNAUTHORIZED",
      message: "expired",
    });
    const out = translateApiError(err, i18n.t.bind(i18n), "errors.export.failed");
    // From en.json: errors.export.unauthorized = "Your session has expired. Please refresh and try again."
    expect(out).toBe(i18n.t("errors.export.unauthorized"));
    // And critically NOT the generic errors.unauthorized text.
    expect(out).not.toBe(i18n.t("errors.unauthorized"));
  });

  it("RATE_LIMITED + namespace=export → resolves to errors.export.rate_limited (namespaced wins over generic)", () => {
    const err = new ApiError({
      status: 429,
      code: "RATE_LIMITED",
      message: "rate limit",
    });
    const out = translateApiError(err, i18n.t.bind(i18n), "errors.export.failed");
    // The namespaced lookup is preferred — `errors.export.rate_limited` exists.
    expect(out).toBe(i18n.t("errors.export.rate_limited"));
  });

  it("RATE_LIMITED with no namespace → resolves to generic errors.rate_limited", () => {
    const err = new ApiError({
      status: 429,
      code: "RATE_LIMITED",
      message: "rate limit",
    });
    // Default fallback is `errors.generic` (no namespace prefix derivable).
    const out = translateApiError(err, i18n.t.bind(i18n));
    expect(out).toBe(i18n.t("errors.rate_limited"));
  });

  it("Unmapped code + namespace=export → falls back to errors.export.failed", () => {
    const err = new ApiError({
      status: 418,
      code: "I_AM_A_TEAPOT",
      message: "no",
    });
    const out = translateApiError(err, i18n.t.bind(i18n), "errors.export.failed");
    expect(out).toBe(i18n.t("errors.export.failed"));
  });
});
