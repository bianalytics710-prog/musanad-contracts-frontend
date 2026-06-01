/**
 * Musanad — Date/time formatting utility.
 *
 * Single helper used by every component that displays a timestamp.
 * - Always converts UTC ISO-8601 input to the project display timezone
 *   (Asia/Dubai by default, configurable via VITE_DISPLAY_TIMEZONE).
 * - Localises to the active i18n locale ("en" | "ar") — Arabic uses the
 *   ar-AE locale to render Eastern Arabic numerals where appropriate.
 * - Uses native Intl.DateTimeFormat. No date-fns timezone dance needed.
 */

import { brand } from "@/config/brand";

const DEFAULT_TIMEZONE = "Asia/Dubai";

export interface FormatDateTimeOptions {
  /** Show the date portion. Default: true. */
  showDate?: boolean;
  /** Show the time portion. Default: true. */
  showTime?: boolean;
  /** Override the runtime locale (otherwise inferred from i18next or brand). */
  locale?: string;
  /** Override the display timezone (otherwise VITE_DISPLAY_TIMEZONE or Asia/Dubai). */
  timezone?: string;
  /** When true, includes seconds in the time portion. Default: false. */
  includeSeconds?: boolean;
}

function getDisplayTimezone(): string {
  const env = import.meta.env.VITE_DISPLAY_TIMEZONE as string | undefined;
  if (env && env.trim() !== "") return env;
  return DEFAULT_TIMEZONE;
}

function getActiveLocale(): string {
  // R43 (Rashid audit 2026-06-01) — force `nu-arab` (Arabic-Indic digits)
  // when the runtime locale is AR. Plain `ar-AE` defaults to Latin digits
  // on V8, producing "01 يونيو 2026" alongside Hijri "١٥" — mixed scripts.
  // The Unicode extension `-u-nu-arab` picks Arabic-Indic across the board.
  if (typeof document !== "undefined") {
    const lang = document.documentElement.lang;
    if (lang === "ar") return "ar-AE-u-nu-arab";
    if (lang === "en") return "en-AE";
  }
  return (brand.defaultLocale as string) === "ar" ? "ar-AE-u-nu-arab" : "en-AE";
}

/**
 * Formats a UTC ISO-8601 date string for display.
 *
 * @param utcString - ISO-8601 date string. Returns "—" when input is null/undefined/empty.
 * @param options - Optional formatting overrides.
 * @returns Localised, timezone-adjusted display string.
 */
export function formatDateTime(
  utcString: string | null | undefined,
  options: FormatDateTimeOptions = {},
): string {
  if (!utcString) return "—";

  const date = new Date(utcString);
  if (Number.isNaN(date.getTime())) return "—";

  const showDate = options.showDate ?? true;
  const showTime = options.showTime ?? true;
  const includeSeconds = options.includeSeconds ?? false;
  const timezone = options.timezone ?? getDisplayTimezone();
  const locale = options.locale ?? getActiveLocale();

  const fmtOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
  };

  if (showDate) {
    fmtOptions.year = "numeric";
    fmtOptions.month = "short";
    fmtOptions.day = "2-digit";
  }

  if (showTime) {
    fmtOptions.hour = "2-digit";
    fmtOptions.minute = "2-digit";
    if (includeSeconds) fmtOptions.second = "2-digit";
    fmtOptions.hour12 = false;
  }

  try {
    return new Intl.DateTimeFormat(locale, fmtOptions).format(date);
  } catch {
    // Locale not supported in this runtime — fall back to ISO truncation.
    return date.toISOString().replace("T", " ").slice(0, includeSeconds ? 19 : 16);
  }
}

/**
 * Convenience helper for date-only formatting.
 */
export function formatDate(utcString: string | null | undefined, locale?: string): string {
  return formatDateTime(utcString, { showDate: true, showTime: false, locale });
}

/**
 * R3 audit 8.1.2 — Hijri (Islamic Umm al-Qura) calendar formatter.
 * P50 — Pari Polish: locale-aware rendering. EN actor sees "Dhuʻl-Hijjah 14, 1447 AH";
 * AR actor sees "‏١٤ ذو الحجة ١٤٤٧ هـ" (Eastern Arabic numerals + Arabic month + AH glyph).
 * Falls back to plain "islamic" calendar then "—" when the runtime can't render either.
 */
export function formatHijriDate(utcString: string | null | undefined): string {
  if (!utcString) return "—";
  const date = new Date(utcString);
  if (Number.isNaN(date.getTime())) return "—";
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  // P50: use AR locale when the active UI locale is AR so the month renders in Arabic script.
  const baseLocale = getActiveLocale().startsWith("ar") ? "ar-SA" : "en";
  for (const calendar of ["islamic-umalqura", "islamic"] as const) {
    try {
      const out = new Intl.DateTimeFormat(`${baseLocale}-u-ca-${calendar}`, opts).format(date);
      // Intl already appends an era marker on most engines (e.g. "1447 AH" / "1447 هـ").
      // Add the EN suffix only if it's missing AND we're rendering in English.
      if (baseLocale === "en" && !/\bAH\b/.test(out)) return `${out} AH`;
      return out;
    } catch {
      // try next
    }
  }
  return "—";
}

/**
 * Convenience helper for time-only formatting.
 */
export function formatTime(
  utcString: string | null | undefined,
  options?: { locale?: string; includeSeconds?: boolean },
): string {
  return formatDateTime(utcString, {
    showDate: false,
    showTime: true,
    locale: options?.locale,
    includeSeconds: options?.includeSeconds,
  });
}
