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

  // O14: status-specific tooltip explaining what each chip means, so a
  // standalone "Pending" chip (no engine/confidence yet) still conveys its
  // semantics. Engine + confidence are appended when present.
  const statusTooltip: Record<IngestionStatus, string> = {
    pending: t('contracts.ingestionStatus.pendingTitle', { defaultValue: 'Document text extraction queued — waiting for the ingestion worker.' }),
    extracting: t('contracts.ingestionStatus.extractingTitle', { defaultValue: 'Document text extraction in progress.' }),
    complete: t('contracts.ingestionStatus.completeTitle', { defaultValue: 'Document text extracted and indexed.' }),
    failed: t('contracts.ingestionStatus.failedTitle', { defaultValue: 'Extraction failed — manual review required.' }),
    partial: t('contracts.ingestionStatus.partialTitle', { defaultValue: 'Extraction partially succeeded — some clauses may need manual review.' }),
  };

  const tooltipParts: string[] = [statusTooltip[status]];
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
