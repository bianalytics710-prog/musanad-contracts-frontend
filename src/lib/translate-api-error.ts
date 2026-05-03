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
