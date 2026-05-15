/**
 * AddEvidenceDialog — S-K-7. Upload evidence (file metadata only here;
 * actual file body upload is BE-handled via Supabase Storage).
 *
 * Two-step UX:
 *   1. user picks a local file via <input type="file"> — UI displays
 *      size + name + mime;
 *   2. on submit we POST metadata to /risk-cases/:id/evidence — the BE
 *      pre-uploads the file body to Supabase Storage and the fn binds the
 *      resulting fileUri to the risk_case_attachment row.
 *
 * 50 MB cap (AC-SK7-02).
 */
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, FileText, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { riskCaseService } from '@/services/api/risk-case.service';
import { translateApiError } from '@/lib/translate-api-error';

const MAX_BYTES = 52_428_800; // 50 MB

interface Props {
  open: boolean;
  onClose: () => void;
  caseId: number;
}

// DEFECT-CRKL-INTV-1 / WARN-3 — multipart upload moved to
// riskCaseService.uploadEvidence (A7 compliance: apiClient lives only in
// the service layer). The dialog now consumes the typed service method.

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1_048_576).toFixed(1)} MB`;
}

export function AddEvidenceDialog({ open, onClose, caseId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('no_file');
      return riskCaseService.uploadEvidence(caseId, file);
    },
    onSuccess: () => {
      toast.success(t('riskCases.toasts.evidenceUploaded'));
      void qc.invalidateQueries({ queryKey: ['riskCase', caseId] });
      setFile(null);
      setErr(null);
      onClose();
    },
    onError: (e: unknown) =>
      toast.error(translateApiError(e, t, 'riskCases.errors.evidenceUploadFailed')),
  });

  const handleFile = (f: File | null) => {
    setErr(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size <= 0) {
      setErr(t('riskCases.errors.evidenceEmpty'));
      return;
    }
    if (f.size > MAX_BYTES) {
      setErr(t('riskCases.errors.evidenceTooBig'));
      return;
    }
    setFile(f);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErr(t('riskCases.errors.evidenceRequired'));
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('riskCases.evidence.title')}</DialogTitle>
          <DialogDescription>{t('riskCases.evidence.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div
            className="rounded-lg border-2 border-dashed border-border bg-surface p-6 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0] ?? null;
              handleFile(f);
            }}
          >
            <Upload className="mx-auto h-8 w-8 text-ink-muted" aria-hidden="true" />
            <p className="mt-2 text-sm text-ink-muted">
              {t('riskCases.evidence.dropHint')}
            </p>
            <input
              ref={fileInputRef}
              id="rc-evidence-file"
              type="file"
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              aria-label={t('riskCases.evidence.fileLabel')}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => fileInputRef.current?.click()}
            >
              {t('riskCases.evidence.browse')}
            </Button>
            <p className="mt-2 text-xs text-ink-muted">
              {t('riskCases.evidence.maxSize', { size: '50 MB' })}
            </p>
          </div>

          {file && (
            <div className="flex items-center justify-between rounded-md border border-border bg-card p-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-ink-muted">{formatBytes(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleFile(null)}
                aria-label={t('riskCases.evidence.removeFile')}
                className="rounded p-1 text-ink-muted hover:bg-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {err && (
            <p role="alert" className="text-sm text-error">
              {err}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending || !file}>
              {mutation.isPending ? t('common.uploading') : t('riskCases.actions.uploadEvidence')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
