/**
 * IngestionReviewPanel — per-page review modal for low-confidence ingestion rows.
 *
 * Left side: extracted text (Tesseract or gpt-4o, color-coded by source).
 * Right side: placeholder for source PDF page image (signed URL from BE — future).
 * Three actions: Confirm | Correct (textarea) | Reject.
 *
 * useFocusTrap per D6/accessibility requirement.
 * D7: scope="col" on th headers.
 * C13: semantic tokens only.
 * A7: HTTP via adminIngestionQueueService.
 */
import { useRef, useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Loader2, CheckCircle2, PencilLine, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFocusTrap } from '@/components/common/useFocusTrap';
import { adminIngestionQueueService } from '@/services/api/admin/ingestion-queue.service';
import { translateApiError } from '@/lib/translate-api-error';
import type { IngestionReviewQueueItem } from '@/types/admin/ingestion-queue.types';
import { formatDateTime } from '@/utils/datetime';

interface IngestionReviewPanelProps {
  item: IngestionReviewQueueItem;
  onClose: () => void;
}

type ActionMode = 'idle' | 'correcting';

export function IngestionReviewPanel({ item, onClose }: IngestionReviewPanelProps) {
  const { t, i18n } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const correctedTextareaId = useId();
  const [actionMode, setActionMode] = useState<ActionMode>('idle');
  const [correctedText, setCorrectedText] = useState('');
  const queryClient = useQueryClient();

  useFocusTrap(dialogRef, true);

  interface ResolvePayload {
    queueId: number;
    action: import('@/types/admin/ingestion-queue.types').IngestionReviewAction;
    correctedText?: string;
  }

  const resolveMutation = useMutation({
    mutationFn: ({ queueId, action, correctedText: ct }: ResolvePayload) =>
      adminIngestionQueueService.resolve(queueId, { action, correctedText: ct }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['adminIngestionQueue'] });
      toast.success(
        t('admin.ingestionQueue.resolveSuccess', {
          defaultValue: 'Review decision saved.',
        }),
      );
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t));
    },
  });

  const handleConfirm = () => {
    resolveMutation.mutate({ queueId: item.id, action: 'confirm' });
  };

  const handleCorrect = () => {
    if (!correctedText.trim()) {
      toast.error(
        t('admin.ingestionQueue.correctedTextRequired', {
          defaultValue: 'Please enter the corrected text before saving.',
        }),
      );
      return;
    }
    resolveMutation.mutate({
      queueId: item.id,
      action: 'correct',
      correctedText: correctedText.trim(),
    });
  };

  const handleReject = () => {
    resolveMutation.mutate({ queueId: item.id, action: 'reject' });
  };

  const isAr = i18n.language?.startsWith('ar');
  const contractTitle =
    (isAr && item.contractTitleAr) ? item.contractTitleAr : item.contractTitleEn;

  const isPending = resolveMutation.isPending;
  const isResolved =
    item.reviewStatus === 'resolved' || item.reviewStatus === 'rejected';

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="irp-title"
        className="relative flex w-full max-w-3xl flex-col rounded-xl border border-border bg-card shadow-xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 id="irp-title" className="text-base font-semibold text-ink">
              {t('admin.ingestionQueue.reviewPanelTitle', {
                defaultValue: 'Review page {{page}}',
                page: item.pageNo,
              })}
            </h2>
            <p className="mt-0.5 truncate text-sm text-ink-muted" title={contractTitle}>
              {contractTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', { defaultValue: 'Close' })}
            className="rounded-md p-1 text-ink-subtle hover:bg-surface hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Metadata strip */}
        <div className="flex flex-wrap gap-4 border-b border-border bg-surface/50 px-6 py-2 text-xs text-ink-muted">
          <span>
            {t('admin.ingestionQueue.col.pageNo', { defaultValue: 'Page' })}:{' '}
            <strong className="text-ink">{item.pageNo}</strong>
          </span>
          {item.tesseractConfidence != null && (
            <span>
              {t('admin.ingestionQueue.col.confidence', { defaultValue: 'Confidence' })}:{' '}
              <strong className="text-ink">
                {Math.round(item.tesseractConfidence * 100)}%
              </strong>
            </span>
          )}
          {item.gpt4oUsed && (
            <span className="rounded-full bg-gold/20 px-2 py-0.5 text-gold">
              {t('admin.ingestionQueue.badge.gpt4o', { defaultValue: 'GPT-4o used' })}
            </span>
          )}
          <span>
            {t('admin.ingestionQueue.col.status', { defaultValue: 'Status' })}:{' '}
            <strong className="text-ink">{item.reviewStatus}</strong>
          </span>
          {item.reviewedByName && (
            <span>
              {t('admin.ingestionQueue.col.reviewedBy', { defaultValue: 'Reviewed by' })}:{' '}
              <strong className="text-ink">{item.reviewedByName}</strong>
            </span>
          )}
          {item.reviewedAt && (
            <span>{formatDateTime(item.reviewedAt)}</span>
          )}
        </div>

        {/* Content — extracted text (left) + placeholder for PDF page (right) */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Extracted text column */}
          <div className="flex w-full flex-col overflow-y-auto p-6 md:w-1/2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-subtle">
              {item.gpt4oUsed
                ? t('admin.ingestionQueue.textSourceGpt4o', {
                    defaultValue: 'GPT-4o extracted text',
                  })
                : t('admin.ingestionQueue.textSourceTesseract', {
                    defaultValue: 'Tesseract extracted text',
                  })}
            </p>
            <div
              className={`flex-1 rounded-md border p-3 text-sm ${
                item.gpt4oUsed
                  ? 'border-gold/30 bg-gold/5'
                  : 'border-sage/30 bg-sage/5'
              }`}
            >
              <p className="whitespace-pre-wrap text-ink">
                {t('admin.ingestionQueue.textUnavailable', {
                  defaultValue: 'Extracted text preview not available in list view. Use the admin DB console to review page content.',
                })}
              </p>
            </div>
          </div>

          {/* PDF page placeholder */}
          <div className="hidden w-1/2 flex-col border-l border-border bg-surface/30 p-6 md:flex">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-subtle">
              {t('admin.ingestionQueue.pdfPagePreview', {
                defaultValue: 'Source PDF page',
              })}
            </p>
            <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border text-sm text-ink-subtle">
              {t('admin.ingestionQueue.pdfPreviewUnavailable', {
                defaultValue: 'Page image preview coming in a future release.',
              })}
            </div>
          </div>
        </div>

        {/* Correct textarea */}
        {actionMode === 'correcting' && (
          <div className="border-t border-border px-6 py-4">
            <label
              htmlFor={correctedTextareaId}
              className="mb-1 block text-xs font-medium text-ink-muted"
            >
              {t('admin.ingestionQueue.correctedTextLabel', {
                defaultValue: 'Corrected text',
              })}
            </label>
            <textarea
              id={correctedTextareaId}
              value={correctedText}
              onChange={(e) => setCorrectedText(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-border bg-card p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/40"
              placeholder={t('admin.ingestionQueue.correctedTextPlaceholder', {
                defaultValue: 'Enter the corrected text for this page…',
              })}
              aria-required="true"
            />
          </div>
        )}

        {/* Action footer */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
          {isResolved ? (
            <p className="text-sm text-ink-muted">
              {t('admin.ingestionQueue.alreadyResolved', {
                defaultValue: 'This page has already been reviewed.',
              })}
            </p>
          ) : (
            <>
              {actionMode === 'correcting' ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActionMode('idle');
                      setCorrectedText('');
                    }}
                    disabled={isPending}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCorrect}
                    disabled={isPending || !correctedText.trim()}
                  >
                    {isPending && <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />}
                    {t('admin.ingestionQueue.action.saveCorrection', {
                      defaultValue: 'Save correction',
                    })}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-terracotta hover:text-terracotta"
                    onClick={handleReject}
                    disabled={isPending}
                  >
                    {isPending && <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />}
                    <XCircle className="me-1 h-3.5 w-3.5" />
                    {t('admin.ingestionQueue.action.reject', { defaultValue: 'Reject' })}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActionMode('correcting')}
                    disabled={isPending}
                  >
                    <PencilLine className="me-1 h-3.5 w-3.5" />
                    {t('admin.ingestionQueue.action.correct', { defaultValue: 'Correct' })}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirm}
                    disabled={isPending}
                  >
                    {isPending && <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />}
                    <CheckCircle2 className="me-1 h-3.5 w-3.5" />
                    {t('admin.ingestionQueue.action.confirm', { defaultValue: 'Confirm' })}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
