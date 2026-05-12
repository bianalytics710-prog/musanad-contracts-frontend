/**
 * IngestionStatusBadge — compact badge for ingestion_status column in
 * contract detail header. 5 visual states per IngestionStatus enum.
 *
 * C13: semantic tokens only (var(--gold)/var(--sage)/var(--terracotta)/amber-500).
 */
import { useTranslation } from 'react-i18next';
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import type { IngestionStatus, ExtractionEngine } from '@/types/document-ingestion.types';

interface IngestionStatusBadgeProps {
  status: IngestionStatus;
  engine?: ExtractionEngine | null;
  confidence?: number | null;
  className?: string;
}

export function IngestionStatusBadge({
  status,
  engine,
  confidence,
  className = '',
}: IngestionStatusBadgeProps) {
  const { t } = useTranslation();

  const config: Record<
    IngestionStatus,
    {
      icon: React.ReactNode;
      label: string;
      colorClass: string;
    }
  > = {
    pending: {
      icon: <Clock className="h-3 w-3" />,
      label: t('contracts.ingestionStatus.pending', { defaultValue: 'Pending' }),
      colorClass: 'text-ink-muted border-border',
    },
    extracting: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: t('contracts.ingestionStatus.extracting', { defaultValue: 'Extracting' }),
      colorClass: 'text-sage border-sage/40 bg-sage/10',
    },
    complete: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: t('contracts.ingestionStatus.complete', { defaultValue: 'Extracted' }),
      colorClass: 'text-gold border-gold/40 bg-gold/10',
    },
    failed: {
      icon: <XCircle className="h-3 w-3" />,
      label: t('contracts.ingestionStatus.failed', { defaultValue: 'Extraction failed' }),
      colorClass: 'text-terracotta border-terracotta/40 bg-terracotta/10',
    },
    partial: {
      icon: <AlertTriangle className="h-3 w-3" />,
      label: t('contracts.ingestionStatus.partial', { defaultValue: 'Partial — review needed' }),
      colorClass: 'text-amber-600 border-amber-500/40 bg-amber-50',
    },
  };

  const { icon, label, colorClass } = config[status];

  const tooltipParts: string[] = [];
  if (engine) {
    tooltipParts.push(
      `${t('contracts.ingestionStatus.engine', { defaultValue: 'Engine' })}: ${engine}`,
    );
  }
  if (confidence != null) {
    tooltipParts.push(
      `${t('contracts.ingestionStatus.confidence', { defaultValue: 'Confidence' })}: ${Math.round(confidence * 100)}%`,
    );
  }
  const tooltip = tooltipParts.join(' · ');

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${colorClass} ${className}`}
      title={tooltip || undefined}
      aria-label={`${label}${tooltip ? ` — ${tooltip}` : ''}`}
    >
      {icon}
      {label}
    </span>
  );
}
