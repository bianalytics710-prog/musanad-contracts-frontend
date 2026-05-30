/**
 * SemanticTooltip — shared recharts Tooltip wrapper (CR-R; reused by CR-S and CR-T).
 *
 * Applies the Musanad semantic token palette to every recharts Tooltip so all
 * charts share the same visual style without repeating contentStyle objects.
 *
 * Supports three currency hints:
 *   'aed'         → formatAedCompact() from dashboard-primitives
 *   'usd-per-bbl' → formatUsdPerBbl() (defined here, re-exported)
 *   'pct'         → 1 decimal place + '%'
 *
 * When i18n.language === 'ar', adds dir="rtl" to the outer wrapper.
 *
 * Standards:
 *   C13 — var(--color-*) semantic tokens, no raw hex
 *   T3  — no hardcoded strings (label/value formatted by callers)
 *   T5  — RTL-aware via dir attr
 *   T7  — no `any` type (extends TooltipProps<ValueType, NameType>)
 */
import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  type TooltipProps,
} from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { formatAedCompact } from '@/features/dashboards/components/dashboard-primitives';

// ─── formatUsdPerBbl ──────────────────────────────────────────────────────────
// Re-exported so CR-S / CR-T can import from this file without touching
// dashboard-primitives (which is owned by the dashboard features slice).

export function formatUsdPerBbl(value: number | null | undefined): string {
  if (value == null) return '—';
  const n = typeof value === 'string' ? parseFloat(value as string) : value;
  if (isNaN(n)) return '—';
  return `$${n.toFixed(2)}/bbl`;
}

export function formatPct(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '—';
  const n = typeof value === 'string' ? parseFloat(value as string) : value;
  if (isNaN(n)) return '—';
  return `${n.toFixed(decimals)}%`;
}

// ─── SemanticTooltip ──────────────────────────────────────────────────────────

export interface SemanticTooltipProps extends Omit<TooltipProps<ValueType, NameType>, 'formatter'> {
  /**
   * Hint that selects the default value formatter when no explicit `formatter`
   * prop is passed:
   *   'aed'         → formatAedCompact (default)
   *   'usd-per-bbl' → formatUsdPerBbl
   *   'pct'         → formatPct (1 decimal)
   */
  currencyHint?: 'aed' | 'usd-per-bbl' | 'pct';
  /**
   * Optional custom formatter — overrides currencyHint when supplied.
   * Signature matches recharts Tooltip `formatter`.
   */
  formatter?: TooltipProps<ValueType, NameType>['formatter'];
}

export function SemanticTooltip({
  currencyHint = 'aed',
  formatter,
  ...props
}: SemanticTooltipProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const defaultFormatter = (value: ValueType): [string, string] => {
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    let formatted: string;
    if (currencyHint === 'usd-per-bbl') {
      formatted = formatUsdPerBbl(num);
    } else if (currencyHint === 'pct') {
      formatted = formatPct(num);
    } else {
      formatted = formatAedCompact(num);
    }
    return [formatted, ''];
  };

  return (
    <Tooltip
      contentStyle={{
        backgroundColor: 'var(--color-card)',
        borderColor: 'var(--color-border)',
        borderRadius: '6px',
        fontSize: '12px',
        color: 'var(--color-ink)',
        direction: isRtl ? 'rtl' : 'ltr',
      }}
      labelStyle={{ color: 'var(--color-ink)', fontWeight: 600 }}
      itemStyle={{ color: 'var(--color-ink-muted)' }}
      formatter={formatter ?? defaultFormatter}
      {...props}
    />
  );
}
