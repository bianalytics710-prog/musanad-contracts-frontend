/**
 * OqoodAI — Brand configuration.
 *
 * Single source of truth for all white-label brand strings, marks, and product
 * metadata. To rebrand for a different customer, edit ONLY this file.
 *
 * Rebranded 2026-06-01: Musanad → OqoodAI (see project-artifacts/qa/
 * OQOODAI_REBRAND_REPORT.md). Aspects intentionally preserved: persona email
 * addresses (*@musanad.local), repo names, package.json names.
 */

export const brand = {
  /** Latin product name. */
  name: "OqoodAI",
  /** Arabic product name (rendered Latin to match the logo wordmark). */
  nameArabic: "OqoodAI",
  /** English meaning of the Arabic root. */
  meaning: "contract, agreement (Arabic عقود)",
  /** Short tagline (English). */
  tagline: "Global Technology. Local Trust.",
  /** Short tagline (Arabic). */
  taglineArabic: "تقنية عالمية. ثقة محلية.",
  /** Long-form descriptor. */
  description:
    "Enterprise contract lifecycle management, industry-agnostic, UAE-first. Drafting, approval, signing, and regulatory intelligence in one workspace.",
  /** Owner / vendor name (shown in footer, legal pages). */
  vendor: "OqoodAI Technologies FZ-LLC",
  /** Primary support address. */
  supportEmail: "support@oqood.ai",
  /** Marketing website. */
  website: "https://oqood.ai",
  /** Logo mark — small gold dot rendered next to the wordmark. */
  mark: {
    color: "var(--color-gold)",
    size: 6, // px
  },
  /** Public SVG logo paths. */
  logo: {
    wordmark: "/oqoodai-logo.svg",
    monogram: "/oqoodai-mark.svg",
    favicon: "/favicon.svg",
  },
  /** Wordmark typography. */
  wordmark: {
    family: "Inter, system-ui, sans-serif",
    weight: 500,
    size: 18, // px
    letterSpacing: "-0.3px",
  },
  /** Locales enabled in the product. */
  locales: ["en", "ar"] as const,
  /** Default locale on first load. */
  defaultLocale: "en" as const,
  /** UAE-focused defaults. */
  region: {
    country: "AE",
    timeZone: "Asia/Dubai",
    currency: "AED",
  },
} as const;

export type Brand = typeof brand;
export type Locale = (typeof brand.locales)[number];
