/**
 * ChartCard — shared chart container (CR-R; reused by CR-S and CR-T).
 *
 * Provides a consistent card frame for all recharts visualisations:
 *   - Header: title (text-sm font-semibold) + optional subtitle + right-aligned slot
 *   - Body: framer-motion entrance (matching existing route animation)
 *   - Loading state: animate-pulse skeleton
 *   - Empty state: AlertCircle icon + message
 *
 * Standards:
 *   C13 — semantic tokens only (no raw hex / no raw oklch literals)
 *   T3  — all strings via t() (emptyLabel is caller-translated before passing in)
 *   T5  — logical Tailwind classes (me-/ms-/ps-/pe-) for RTL support
 */
import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

export interface ChartCardProps {
  /** Card heading — caller must pass a translated string (t('...')). */
  title: string;
  /** Optional subtitle rendered in ink-muted below the title. */
  subtitle?: string;
  /** Right-aligned slot — e.g. a legend badge, filter chip, or icon. */
  right?: ReactNode;
  /** When true renders a skeleton pulse instead of children. */
  loading?: boolean;
  /** When true renders an empty-state message instead of children. */
  empty?: boolean;
  /** Translated "no data" label shown in empty state (default uses title). */
  emptyLabel?: string;
  /** Height of the chart body in pixels (default 280). */
  height?: number;
  children: ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  right,
  loading = false,
  empty = false,
  emptyLabel,
  height = 280,
  children,
}: ChartCardProps) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </header>

      {loading ? (
        /* Skeleton placeholder */
        <div
          style={{ height }}
          className="animate-pulse rounded-md bg-surface"
          aria-hidden="true"
        />
      ) : empty ? (
        /* Empty state */
        <div
          style={{ height }}
          className="flex flex-col items-center justify-center gap-2"
          role="status"
        >
          <AlertCircle className="h-6 w-6 text-ink-subtle" aria-hidden="true" />
          <p className="text-xs text-ink-muted">
            {emptyLabel ?? title}
          </p>
        </div>
      ) : (
        /* Chart body with entrance animation */
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{ height }}
        >
          {children}
        </motion.div>
      )}
    </section>
  );
}
