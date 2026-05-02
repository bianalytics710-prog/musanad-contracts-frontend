import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./en.json";
import ar from "./ar.json";
import { brand } from "../config/brand";

let initialized = false;

// BUG-A02: canonical localStorage key for the user's language preference.
// We migrate any legacy "musanad_locale" value to this key on init.
export const LOCALE_STORAGE_KEY = "musanad_lang";
const LEGACY_LOCALE_STORAGE_KEY = "musanad_locale";

function migrateLegacyLocaleKey() {
  if (typeof window === "undefined") return;
  try {
    const current = localStorage.getItem(LOCALE_STORAGE_KEY);
    const legacy = localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY);
    if (!current && legacy) {
      localStorage.setItem(LOCALE_STORAGE_KEY, legacy);
    }
    if (legacy !== null) {
      localStorage.removeItem(LEGACY_LOCALE_STORAGE_KEY);
    }
  } catch {
    // ignore — private browsing or storage disabled.
  }
}

export function initI18n() {
  if (initialized || i18n.isInitialized) return i18n;
  initialized = true;

  const isBrowser = typeof window !== "undefined";
  if (isBrowser) migrateLegacyLocaleKey();
  const chain = isBrowser ? i18n.use(LanguageDetector) : i18n;

  chain.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    lng: isBrowser ? undefined : brand.defaultLocale, // Force default on SSR for stable hydration
    fallbackLng: brand.defaultLocale,
    supportedLngs: brand.locales as unknown as string[],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ["localStorage"],
    },
  });

  if (typeof document !== "undefined") {
    applyLocaleToDocument(i18n.language);
    i18n.on("languageChanged", applyLocaleToDocument);
  }

  return i18n;
}

export function applyLocaleToDocument(lng: string) {
  if (typeof document === "undefined") return;
  const lang = lng?.startsWith("ar") ? "ar" : "en";
  const dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
}

export default i18n;
