/**
 * RiskCaseEvidenceList — attachment metadata list with signed-URL-aware
 * download. The list itself shows file metadata (name / size / uploader /
 * uploadedAt). Download is on-demand: clicking the row fetches the
 * signedUrl pair (TTL 60s) and opens it in a new tab.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { riskCaseService } from '@/services/api/risk-case.service';
import { translateApiError } from '@/lib/translate-api-error';
import { formatDateTime } from '@/utils/datetime';
import type { RiskCaseAttachment } from '@/types/risk-case.types';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1_048_576).toFixed(1)} MB`;
}

interface Props {
  caseId: number;
  attachments: RiskCaseAttachment[];
}

export function RiskCaseEvidenceList({ caseId, attachments }: Props) {
  const { t } = useTranslation();
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleDownload = async (attachmentId: number) => {
    setBusyId(attachmentId);
    try {
      const detail = await riskCaseService.getEvidence(caseId, attachmentId);
      if (detail.signedUrl) {
        window.open(detail.signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        toast.error(t('riskCases.errors.signedUrlMissing'));
      }
    } catch (e) {
      toast.error(translateApiError(e, t, 'riskCases.errors.downloadFailed'));
    } finally {
      setBusyId(null);
    }
  };

  if (attachments.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm text-ink-muted">{t('riskCases.evidence.empty')}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {attachments.map((a) => (
        <li
          key={a.id}
          className="flex items-center justify-between rounded-md border border-border bg-card p-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink" title={a.fileName}>
                {a.fileName}
              </p>
              <p className="text-xs text-ink-muted">
                {formatBytes(a.fileBytes)} · {a.uploadedByName ?? t('riskCases.evidence.unknownUploader')} ·{' '}
                {formatDateTime(a.uploadedAt, { showTime: true })}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void handleDownload(a.id)}
            disabled={busyId === a.id}
            aria-label={t('riskCases.evidence.download')}
          >
            <Download className="me-1 h-3.5 w-3.5" aria-hidden="true" />
            {busyId === a.id ? t('common.loading') : t('riskCases.evidence.download')}
          </Button>
        </li>
      ))}
    </ul>
  );
}
