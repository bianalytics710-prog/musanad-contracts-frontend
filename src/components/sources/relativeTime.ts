/**
 * Lightweight relative-time helper for source-health timestamps.
 * Uses the runtime's Intl.RelativeTimeFormat so we keep i18n parity
 * (Arabic locale renders Eastern Arabic numerals + Arabic words).
 *
 * Returns "just now" for < 30s, otherwise the largest sensible unit.
 */

function getActiveLocale(): string {
  if (typeof document !== "undefined") {
    const lang = document.documentElement.lang;
    if (lang === "ar") return "ar-AE";
    if (lang === "en") return "en-AE";
  }
  return "en-AE";
}

const UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: "year", seconds: 60 * 60 * 24 * 365 },
  { unit: "month", seconds: 60 * 60 * 24 * 30 },
  { unit: "week", seconds: 60 * 60 * 24 * 7 },
  { unit: "day", seconds: 60 * 60 * 24 },
  { unit: "hour", seconds: 60 * 60 },
  { unit: "minute", seconds: 60 },
  { unit: "second", seconds: 1 },
];

export function formatRelative(
  utcString: string | null | undefined,
  options?: { locale?: string; nowFallback?: string },
): string {
  if (!utcString) return "—";
  const date = new Date(utcString);
  if (Number.isNaN(date.getTime())) return "—";

  const locale = options?.locale ?? getActiveLocale();
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);

  if (Math.abs(diffSec) < 30) {
    return options?.nowFallback ?? "just now";
  }

  for (const { unit, seconds } of UNITS) {
    if (Math.abs(diffSec) >= seconds || unit === "second") {
      const value = Math.round(diffSec / seconds);
      try {
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
        return rtf.format(value, unit);
      } catch {
        // Fall back to a simple English string.
        const abs = Math.abs(value);
        const past = value < 0;
        return past ? `${abs} ${unit}${abs === 1 ? "" : "s"} ago` : `in ${abs} ${unit}${abs === 1 ? "" : "s"}`;
      }
    }
  }
  return "—";
}
