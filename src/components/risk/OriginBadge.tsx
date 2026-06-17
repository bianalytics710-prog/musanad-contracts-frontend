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
import { Building2, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RiskOrigin } from '@/types/risk-case.types';

interface OriginBadgeProps {
  origin: RiskOrigin | null | undefined;
  size?: 'sm' | 'md';
  className?: string;
}

export function OriginBadge({ origin, size = 'sm', className }: OriginBadgeProps) {
  const { t } = useTranslation();
  // Treat null/undefined as external (default for OSINT / manual cases).
  const isInternal = origin === 'internal';
  const Icon = isInternal ? Building2 : Globe;
  const label = isInternal
    ? t('riskCases.origin.internal', { defaultValue: 'Internal' })
    : t('riskCases.origin.external', { defaultValue: 'External' });

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-semibold uppercase tracking-wider',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        isInternal
          ? 'border-sage/40 bg-sage/15 text-sage'
          : 'border-gold/40 bg-gold/15 text-gold',
        className,
      )}
      title={
        isInternal
          ? t('riskCases.origin.internalHint', {
              defaultValue: 'Triggered by an internal system signal (e.g. SAP, ServiceNow, Primavera).',
            })
          : t('riskCases.origin.externalHint', {
              defaultValue: 'Triggered by an external OSINT signal (e.g. sanctions, weather, commodity).',
            })
      }
    >
      <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} aria-hidden />
      {label}
    </span>
  );
}
