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
  if (typeof document !== "undefined") {
    const lang = document.documentElement.lang;
    if (lang === "ar") return "ar-AE";
    if (lang === "en") return "en-AE";
  }
  // brand.defaultLocale is one of brand.locales — currently ["en", "ar"].
  // We compare via string equality to keep the type narrowing local.
  return (brand.defaultLocale as string) === "ar" ? "ar-AE" : "en-AE";
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
