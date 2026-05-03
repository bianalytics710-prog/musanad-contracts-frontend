/**
 * Musanad — translate ApiError to a localized user-facing message.
 *
 * Codex FE-C5 fix: BE error messages (e.g. raw text from a fn_ exception
 * or a generic "Database operation failed") sometimes leak through the
 * API contract. We never want to render server-side English (or any
 * untranslated text) directly to the user.
 *
 * Strategy:
 *   1. Map ApiError.code → stable i18n key (`errors.<code>`).
 *   2. For VALIDATION_ERROR with details.field, prefer field-specific
 *      keys (`errors.fields.<fieldName>`) when they exist, falling back
 *      to a generic validation message.
 *   3. For unknown codes / non-ApiError errors, return the localized
 *      generic fallback `errors.generic`.
 *
 * BE remains the source of truth — this helper only translates the
 * user-visible surface. Logs/correlation IDs are unaffected.
 */
import type { TFunction } from "i18next";
import { ApiError } from "@/lib/api-client";

// Known BE error codes mapped to i18n keys under the `errors` namespace.
// Mirrors the codes emitted by errorMiddleware.ts on the backend.
const CODE_TO_KEY: Record<string, string> = {
  UNAUTHORIZED: "errors.unauthorized",
  FORBIDDEN: "errors.forbidden",
  NOT_FOUND: "errors.notFound",
  CONFLICT: "errors.conflict",
  UNPROCESSABLE_ENTITY: "errors.unprocessable",
  INTERNAL: "errors.server",
  SERVER_ERROR: "errors.server",
  TIMEOUT: "errors.timeout",
  NETWORK_ERROR: "errors.network",
  NO_REFRESH_TOKEN: "errors.unauthorized",
  HTTP_ERROR: "errors.generic",
  RATE_LIMITED: "errors.rate_limited",
  TOO_MANY_REQUESTS: "errors.rate_limited",
};

/**
 * Read details.field from an ApiError safely. Validation errors put
 * the offending property name there (per backend `validationError`
 * helper). Returns undefined when not present or not a string.
 */
function extractField(details: ApiError["details"]): string | undefined {
  if (!details || typeof details !== "object") return undefined;
  const f = (details as { field?: unknown }).field;
  return typeof f === "string" && f.length > 0 ? f : undefined;
}

/**
 * Returns true when the t() lookup found a real translation (i.e. the
 * returned value is not the key itself). i18next returns the key when
 * a translation is missing — we use that to decide whether to fall back.
 */
function hasTranslation(t: TFunction, key: string): boolean {
  return t(key, { defaultValue: "__MISSING__" }) !== "__MISSING__";
}

/**
 * Translate any unknown error (typically ApiError, but tolerates plain
 * Error / unknown shapes) into a localized human-facing string.
 *
 * @param err     The thrown value from a service/mutation/query.
 * @param t       react-i18next TFunction (always pass from useTranslation).
 * @param fallbackKey Optional override for the generic fallback key.
 *                Defaults to `errors.generic`.
 */
/**
 * Map an HTTP status to the per-namespace suffix we look up before the
 * generic `errors.<code>` table. Lets a caller pass
 * `fallbackKey="errors.export.failed"` and have us check
 * `errors.export.unauthorized` (401), `errors.export.forbidden` (403),
 * `errors.export.rate_limited` (429) before falling back. F-FE-M2.
 */
function statusToNamespacedSuffix(status: number): string | null {
  switch (status) {
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 422:
      return "unprocessable";
    case 429:
      return "rate_limited";
    default:
      return status >= 500 ? "server" : null;
  }
}

/**
 * If `fallbackKey` looks like `errors.<feature>.<x>` (e.g.
 * `errors.export.failed`), derive the namespaced lookup root
 * (`errors.export`) so we can try `errors.export.<suffix>` for the
 * status-specific message before the generic table.
 */
function deriveNamespacePrefix(fallbackKey: string): string | null {
  const parts = fallbackKey.split(".");
  if (parts.length < 3) return null;
  // `errors.export.failed` → `errors.export`
  return parts.slice(0, -1).join(".");
}

export function translateApiError(
  err: unknown,
  t: TFunction,
  fallbackKey = "errors.generic",
): string {
  if (err instanceof ApiError) {
    // VALIDATION_ERROR: field-specific message wins when available.
    if (err.code === "VALIDATION_ERROR") {
      const field = extractField(err.details);
      if (field) {
        const fieldKey = `errors.fields.${field}`;
        if (hasTranslation(t, fieldKey)) return t(fieldKey);
      }
      return t("errors.validation");
    }

    // F-FE-M2: per-namespace lookup. When the caller passes a
    // namespaced fallback like `errors.export.failed`, prefer
    // `errors.export.<suffix>` keyed off the HTTP status. Falls
    // through to the generic CODE_TO_KEY map otherwise.
    const namespacePrefix = deriveNamespacePrefix(fallbackKey);
    if (namespacePrefix) {
      const suffix = statusToNamespacedSuffix(err.status);
      if (suffix) {
        const namespacedKey = `${namespacePrefix}.${suffix}`;
        if (hasTranslation(t, namespacedKey)) return t(namespacedKey);
      }
    }

    // 401/403/404/409/422/500 mapped via the code table.
    const mapped = CODE_TO_KEY[err.code];
    if (mapped && hasTranslation(t, mapped)) return t(mapped);

    // Last-resort: localised generic. We deliberately do NOT surface
    // err.message here — it may contain raw server text.
    return t(fallbackKey);
  }

  // Non-ApiError throws (network glitch outside axios, programmer error,
  // etc.) — always render the localized fallback.
  return t(fallbackKey);
}

export default translateApiError;
