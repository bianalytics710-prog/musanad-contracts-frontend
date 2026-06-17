/**
 * 690 — OriginBadge. Renders a small Internal / External pill so a reader can
 * tell at a glance whether a risk case was triggered by one of our own systems
 * (internal — SAP/ServiceNow/Primavera/…) or by an outside OSINT signal
 * (external — sanctions/weather/commodity/…).
 *
 *   Internal → sage tone + Building2 icon
 *   External → gold tone + Globe icon
 *
 * Origin is derived server-side (correlation → signal kind); this is display-only.
 */
import { useTranslation } from 'react-i18next';
import { Building2, Globe, PencilLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RiskOrigin } from '@/types/risk-case.types';

interface OriginBadgeProps {
  origin: RiskOrigin | null | undefined;
  size?: 'sm' | 'md';
  className?: string;
}

export function OriginBadge({ origin, size = 'sm', className }: OriginBadgeProps) {
  const { t } = useTranslation();
  // null/undefined defaults to external (legacy OSINT cases).
  const variant: RiskOrigin = origin ?? 'external';
  const Icon = variant === 'internal' ? Building2 : variant === 'manual' ? PencilLine : Globe;
  const label =
    variant === 'internal'
      ? t('riskCases.origin.internal', { defaultValue: 'Internal' })
      : variant === 'manual'
        ? t('riskCases.origin.manual', { defaultValue: 'Manual' })
        : t('riskCases.origin.external', { defaultValue: 'External' });
  const tone =
    variant === 'internal'
      ? 'border-sage/40 bg-sage/15 text-sage'
      : variant === 'manual'
        ? 'border-border bg-muted text-ink-muted'
        : 'border-gold/40 bg-gold/15 text-gold';
  const hint =
    variant === 'internal'
      ? t('riskCases.origin.internalHint', {
          defaultValue: 'Triggered by an internal system signal (e.g. SAP, ServiceNow, Primavera).',
        })
      : variant === 'manual'
        ? t('riskCases.origin.manualHint', {
            defaultValue: 'Logged manually by a user — no automated signal.',
          })
        : t('riskCases.origin.externalHint', {
            defaultValue: 'Triggered by an external OSINT signal (e.g. sanctions, weather, commodity).',
          });

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-semibold uppercase tracking-wider',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        tone,
        className,
      )}
      title={hint}
    >
      <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} aria-hidden />
      {label}
    </span>
  );
}
