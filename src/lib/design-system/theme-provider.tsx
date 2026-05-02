/**
 * MUSANAD Design System — Theme Provider
 *
 * Manages two orthogonal concerns:
 *  1. Dark mode — toggles `class="dark"` on <html>. Persisted to localStorage.
 *     Honors `prefers-color-scheme` on first visit.
 *  2. RTL / locale — toggles `dir="rtl"` and `lang="ar"` on <html> when the
 *     active i18n locale is Arabic. Reads locale from i18next (which is the
 *     project's i18n library per project.config.json) and falls back to a
 *     prop for environments without i18next initialized yet.
 *
 * Lightweight — no `next-themes` dependency. Works with any React 19 app.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'system';
export type Direction = 'ltr' | 'rtl';
export type Locale = 'en' | 'ar';

export interface ThemeContextValue {
  /** Resolved theme actually applied to the DOM (never 'system'). */
  resolvedTheme: 'light' | 'dark';
  /** User-chosen theme preference — may be 'system'. */
  theme: ThemeMode;
  /** Sets the theme preference and persists to localStorage. */
  setTheme: (theme: ThemeMode) => void;
  /** Toggles light <-> dark (resolves 'system' first). */
  toggleTheme: () => void;
  /** Current text direction — derived from locale. */
  direction: Direction;
  /** Current locale. */
  locale: Locale;
  /** Sets locale (and writes dir/lang to <html>). */
  setLocale: (locale: Locale) => void;
}

interface ThemeProviderProps {
  children: ReactNode;
  /** Initial theme preference. Defaults to 'system'. */
  defaultTheme?: ThemeMode;
  /** Initial locale. Defaults to 'en'. */
  defaultLocale?: Locale;
  /** localStorage key for theme persistence. */
  storageKey?: string;
  /** localStorage key for locale persistence. Mirrors Lovable's `musanad_lang`. */
  localeStorageKey?: string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const RTL_LOCALES: ReadonlySet<Locale> = new Set(['ar']);

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredTheme(key: string): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(key);
  return v === 'light' || v === 'dark' || v === 'system' ? v : null;
}

function readStoredLocale(key: string): Locale | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(key);
  return v === 'en' || v === 'ar' ? v : null;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  defaultLocale = 'en',
  storageKey = 'musanad_theme',
  localeStorageKey = 'musanad_lang',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(
    () => readStoredTheme(storageKey) ?? defaultTheme,
  );
  const [locale, setLocaleState] = useState<Locale>(
    () => readStoredLocale(localeStorageKey) ?? defaultLocale,
  );
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => getSystemTheme());

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? systemTheme : theme;
  const direction: Direction = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';

  // Listen for OS-level color scheme changes when in 'system' mode.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemTheme(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Apply theme class to <html>.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  // Apply dir + lang to <html> from locale.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('dir', direction);
    root.setAttribute('lang', locale);
  }, [direction, locale]);

  const setTheme = useCallback(
    (next: ThemeMode) => {
      setThemeState(next);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, next);
      }
    },
    [storageKey],
  );

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(localeStorageKey, next);
      }
    },
    [localeStorageKey],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      resolvedTheme,
      theme,
      setTheme,
      toggleTheme,
      direction,
      locale,
      setLocale,
    }),
    [resolvedTheme, theme, setTheme, toggleTheme, direction, locale, setLocale],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() must be used inside <ThemeProvider>.');
  }
  return ctx;
}

export default ThemeProvider;
