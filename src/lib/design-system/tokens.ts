/**
 * MUSANAD Design System — TypeScript Token Map
 *
 * Type-safe access to the design system tokens declared in src/styles.css.
 * The OKLCH values here mirror the :root block in styles.css. Components should
 * prefer Tailwind utility classes (e.g. `bg-primary`, `text-gold`) which read
 * the same CSS custom properties at runtime; this module exists for the rare
 * cases where a token must be referenced from JavaScript (e.g. dynamic chart
 * colors, inline styles for SVG, runtime theme decisions).
 *
 * Source of truth: design-tokens.json (Pass 7 Lovable extraction).
 * Locked by the Design System Agent — do not edit ad-hoc.
 */

export type TokenScope = 'light' | 'dark';

// ─── Color tokens ─────────────────────────────────────────────────────────────

export const colors = {
  light: {
    // Ink — warm navy neutrals
    ink: 'oklch(0.22 0.04 255)',
    inkMuted: 'oklch(0.45 0.025 255)',
    inkSubtle: 'oklch(0.62 0.018 255)',
    inkDark: 'oklch(0.96 0.005 100)',

    // Surfaces
    background: 'oklch(0.985 0.004 95)',
    surface: 'oklch(0.965 0.006 95)',
    card: 'oklch(1 0 0)',
    popover: 'oklch(1 0 0)',
    border: 'oklch(0.91 0.008 95)',
    input: 'oklch(0.91 0.008 95)',
    ring: 'oklch(0.72 0.11 75)',

    // Brand accent — gold
    gold: 'oklch(0.72 0.12 78)',
    goldHover: 'oklch(0.66 0.13 76)',
    goldTint: 'oklch(0.95 0.04 85)',

    // Status — sage (success / signed)
    sage: 'oklch(0.66 0.08 155)',
    sageTint: 'oklch(0.95 0.03 155)',
    sageInk: 'oklch(0.36 0.07 155)',

    // Status — amber (warning / pending)
    amber: 'oklch(0.78 0.13 75)',
    amberTint: 'oklch(0.96 0.05 80)',
    amberInk: 'oklch(0.42 0.12 60)',

    // Status — terracotta (error / destructive)
    terracotta: 'oklch(0.62 0.14 35)',
    terracottaTint: 'oklch(0.95 0.03 35)',
    terracottaInk: 'oklch(0.38 0.13 32)',

    // Status — slate (regulatory / neutral info)
    slate: 'oklch(0.55 0.04 240)',
    slateTint: 'oklch(0.94 0.012 240)',
    slateInk: 'oklch(0.32 0.04 240)',

    // Status — plum (resubmission / amended)
    plum: 'oklch(0.52 0.11 320)',
    plumTint: 'oklch(0.95 0.025 320)',
    plumInk: 'oklch(0.34 0.10 320)',
  },
  dark: {
    ink: 'oklch(0.96 0.005 95)',
    inkMuted: 'oklch(0.72 0.018 255)',
    inkSubtle: 'oklch(0.55 0.018 255)',
    inkDark: 'oklch(0.96 0.005 95)',

    background: 'oklch(0.16 0.02 255)',
    surface: 'oklch(0.20 0.025 255)',
    card: 'oklch(0.22 0.025 255)',
    popover: 'oklch(0.22 0.025 255)',
    border: 'oklch(1 0 0 / 10%)',
    input: 'oklch(1 0 0 / 12%)',
    ring: 'oklch(0.78 0.12 78)', // gold in dark

    gold: 'oklch(0.78 0.12 78)',
    goldHover: 'oklch(0.84 0.13 78)',
    goldTint: 'oklch(0.32 0.06 78)',

    sage: 'oklch(0.74 0.10 155)',
    sageTint: 'oklch(0.30 0.05 155)',
    sageInk: 'oklch(0.86 0.08 155)',

    amber: 'oklch(0.82 0.13 75)',
    amberTint: 'oklch(0.32 0.07 70)',
    amberInk: 'oklch(0.88 0.10 80)',

    terracotta: 'oklch(0.72 0.14 35)',
    terracottaTint: 'oklch(0.30 0.07 35)',
    terracottaInk: 'oklch(0.86 0.10 35)',

    slate: 'oklch(0.70 0.04 240)',
    slateTint: 'oklch(0.28 0.03 240)',
    slateInk: 'oklch(0.86 0.03 240)',

    plum: 'oklch(0.66 0.11 320)',
    plumTint: 'oklch(0.28 0.06 320)',
    plumInk: 'oklch(0.86 0.08 320)',
  },
} as const;

// ─── Semantic mapping — the 12 mandatory shadcn-style tokens ──────────────────

export const semantic = {
  // CSS variable references — resolve at runtime against :root or .dark
  primary: 'var(--primary)',
  primaryForeground: 'var(--primary-foreground)',
  secondary: 'var(--secondary)',
  secondaryForeground: 'var(--secondary-foreground)',
  accent: 'var(--accent)',
  accentForeground: 'var(--accent-foreground)',
  muted: 'var(--muted)',
  mutedForeground: 'var(--muted-foreground)',
  destructive: 'var(--destructive)',
  destructiveForeground: 'var(--destructive-foreground)',
  background: 'var(--background)',
  foreground: 'var(--foreground)',
  // Bonus surface tokens
  card: 'var(--card)',
  cardForeground: 'var(--card-foreground)',
  popover: 'var(--popover)',
  popoverForeground: 'var(--popover-foreground)',
  border: 'var(--border)',
  input: 'var(--input)',
  ring: 'var(--ring)',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const fonts = {
  sans: 'Inter, system-ui, sans-serif',
  arabic: '"IBM Plex Sans Arabic", system-ui, sans-serif',
  arabicDisplay: '"Aref Ruqaa", serif', // ceremonial — signing pages, certificates
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const;

// ─── Border radius — 6 levels ─────────────────────────────────────────────────

export const radii = {
  sm: '6px',
  DEFAULT: '8px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  '2xl': '28px',
} as const;

// ─── Animations ───────────────────────────────────────────────────────────────

export const animations = {
  fadeIn: 'fadeIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
  slideUp: 'slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1)',
  scalePress: 'scalePress 100ms cubic-bezier(0.16, 1, 0.3, 1)',
  blink: 'blink 530ms steps(2, start) infinite',
} as const;

// ─── Charts ───────────────────────────────────────────────────────────────────

export const charts = {
  light: [
    'oklch(0.72 0.12 78)',  // gold
    'oklch(0.66 0.08 155)', // sage
    'oklch(0.55 0.04 240)', // slate
    'oklch(0.62 0.14 35)',  // terracotta
    'oklch(0.52 0.11 320)', // plum
  ],
  dark: [
    'oklch(0.78 0.12 78)',
    'oklch(0.74 0.10 155)',
    'oklch(0.70 0.04 240)',
    'oklch(0.72 0.14 35)',
    'oklch(0.66 0.11 320)',
  ],
} as const;

// ─── Aggregate export ─────────────────────────────────────────────────────────

export const tokens = {
  colors,
  semantic,
  fonts,
  radii,
  animations,
  charts,
} as const;

export type Tokens = typeof tokens;
export type ColorTokens = typeof colors.light;
export type SemanticTokens = typeof semantic;
export type FontTokens = typeof fonts;
export type RadiusTokens = typeof radii;
export type AnimationTokens = typeof animations;

export default tokens;
