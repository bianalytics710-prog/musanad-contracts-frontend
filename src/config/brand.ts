/**
 * MUSANAD — Brand configuration.
 *
 * Single source of truth for all white-label brand strings, marks, and product
 * metadata. To rebrand for a different customer, edit ONLY this file.
 */

export const brand = {
  /** Latin product name. */
  name: "Musanad",
  /** Arabic product name. */
  nameArabic: "مُسَنَد",
  /** English meaning of the Arabic root. */
  meaning: "supported, backed by",
  /** Short tagline (English). */
  tagline: "Contract Lifecycle Management for the UAE",
  /** Short tagline (Arabic). */
  taglineArabic: "إدارة دورة حياة العقود لدولة الإمارات",
  /** Long-form descriptor. */
  description:
    "Enterprise contract lifecycle management, industry-agnostic, UAE-first. Drafting, approval, signing, and regulatory intelligence in one workspace.",
  /** Owner / vendor name (shown in footer, legal pages). */
  vendor: "Musanad Technologies FZ-LLC",
  /** Primary support address. */
  supportEmail: "support@musanad.app",
  /** Marketing website. */
  website: "https://musanad.app",
  /** Logo mark — small gold dot rendered next to the wordmark. */
  mark: {
    color: "var(--color-gold)",
    size: 6, // px
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
