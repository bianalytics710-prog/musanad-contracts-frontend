/**
 * DocumentTabExtension — wraps inside ContractDetail's "Document" tab.
 *
 * Adds ingestion status state to the Document tab:
 *   - complete  → toggle bar: Original (existing content) | Extracted text
 *   - partial   → amber banner "AI assisted on N pages — Click to review"
 *   - pending / extracting → progress placeholder
 *   - failed    → error notice with Retry button (document.ingest permission only)
 *   - null/undefined → renders children unchanged (no ingestion data yet)
 *
 * The "Original" view renders `children` (existing ContractDocumentTab).
 * The "Extracted text" view fetches the signed URL and renders the text file.
 *
 * A7: all HTTP via documentIngestionService (imported from service file).
 * C13: semantic tokens only.
 * C14: internal nav uses <Link> (the partial banner links use router Link).
 */
import { useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  FileText,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { documentIngestionService } from '@/services/api/document-ingestion.service';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { translateApiError } from '@/lib/translate-api-error';
import type { IngestionStatus, ExtractionEngine } from '@/types/document-ingestion.types';

interface DocumentTabExtensionProps {
  contractId: number;
  versionId: number;
  ingestionStatus: IngestionStatus | null | undefined;
  extractionEngine?: ExtractionEngine | null;
  pageCount?: number | null;
  lowConfidencePageCount?: number;
  /** The original document view (ContractDocumentTab). */
  children: React.ReactNode;
}

type ViewMode = 'original' | 'extracted';

export function DocumentTabExtension({
  contractId,
  versionId,
  ingestionStatus,
  extractionEngine,
  pageCount,
  lowConfidencePageCount = 0,
  children,
}: DocumentTabExtensionProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('original');
  const tabGroupId = useId();
  const canIngest = useAuthStore(selectHasPermission('document.ingest'));
  const queryClient = useQueryClient();

  // Signed URL query — only enabled when user switches to "Extracted text" view
  // and ingestion is complete. staleTime: 50s (BE TTL is 60s, margin for safety).
  const signedUrlQuery = useQuery({
    queryKey: ['extractedTextUrl', contractId, versionId],
    queryFn: () => documentIngestionService.getExtractedTextSignedUrl(contractId, versionId),
    enabled: viewMode === 'extracted' && ingestionStatus === 'complete',
    staleTime: 50_000,
    retry: false,
  });

  // Manual re-ingest mutation (document.ingest permission — Super Admin only).
  const reingestMutation = useMutation({
    mutationFn: () => documentIngestionService.manualIngest(contractId, versionId),
    onSuccess: () => {
      toast.success(
        t('contracts.upload.extraction.retryQueued', {
          defaultValue: 'Re-extraction queued. The document is being processed.',
        }),
      );
      void queryClient.invalidateQueries({
        queryKey: ['ingestionStatus', contractId, versionId],
      });
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t));
    },
  });

  // When no ingestion data exists, render children unchanged.
  if (!ingestionStatus) {
    return <>{children}</>;
  }

  // ── Pending / Extracting → progress placeholder ─────────────────────────
  if (ingestionStatus === 'pending' || ingestionStatus === 'extracting') {
    return (
      <div className="space-y-4">
        {/* O15: distinguish "queued" (pending) from "in progress" (extracting)
            so the reader doesn't see "Extracting…" + "no body text yet" as a
            self-contradiction. */}
        <div className="flex items-center gap-2 rounded-lg border border-sage/30 bg-sage/10 px-4 py-3 text-sm text-sage">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          <span>
            {ingestionStatus === 'pending'
              ? t('contracts.documentTab.queued', {
                  defaultValue: 'Document text extraction queued — the page body will populate once the ingestion worker picks this up.',
                })
              : t('contracts.documentTab.extracting', {
                  defaultValue: 'Extracting document text… The body text will appear here when complete.',
                })}
          </span>
        </div>
        {children}
      </div>
    );
  }

  // ── Failed → error notice ────────────────────────────────────────────────
  if (ingestionStatus === 'failed') {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" />
          <div className="flex-1">
            <p className="font-medium text-terracotta">
              {t('contracts.documentTab.extractionFailed', {
                defaultValue: 'Text extraction failed.',
              })}
            </p>
            {canIngest && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 h-auto px-0 text-terracotta hover:text-terracotta"
                onClick={() => reingestMutation.mutate()}
                disabled={reingestMutation.isPending}
              >
                {reingestMutation.isPending ? (
                  <Loader2 className="me-1 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="me-1 h-3 w-3" />
                )}
                {t('contracts.upload.extraction.retry', { defaultValue: 'Retry extraction' })}
              </Button>
            )}
          </div>
        </div>
        {children}
      </div>
    );
  }

  // ── Partial → amber banner ───────────────────────────────────────────────
  if (ingestionStatus === 'partial') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="flex-1">
            {t('contracts.documentTab.partialBanner', {
              defaultValue: 'AI assisted on {{count}} pages — review recommended.',
              count: lowConfidencePageCount,
            })}
          </span>
          <Link
            to="/app/admin/ingestion-queue"
            search={{ contractVersionId: versionId }}
            className="font-medium text-amber-700 underline-offset-2 hover:underline"
          >
            {t('contracts.documentTab.reviewLink', { defaultValue: 'Review' })}
          </Link>
        </div>
        {children}
      </div>
    );
  }

  // ── Complete → toggle bar: Original | Extracted text ────────────────────
  return (
    <div className="space-y-4">
      {/* Toggle bar */}
      <div
        role="tablist"
        aria-label={t('contracts.documentTab.viewToggleLabel', {
          defaultValue: 'Document view',
        })}
        className="inline-flex rounded-lg border border-border bg-surface p-0.5"
      >
        <button
          type="button"
          role="tab"
          id={`${tabGroupId}-original`}
          aria-selected={viewMode === 'original'}
          aria-controls={`${tabGroupId}-panel`}
          onClick={() => setViewMode('original')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'original'
              ? 'bg-card text-ink shadow-sm'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          {t('contracts.documentTab.original', { defaultValue: 'Original' })}
        </button>
        <button
          type="button"
          role="tab"
          id={`${tabGroupId}-extracted`}
          aria-selected={viewMode === 'extracted'}
          aria-controls={`${tabGroupId}-panel`}
          onClick={() => setViewMode('extracted')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'extracted'
              ? 'bg-card text-ink shadow-sm'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          {t('contracts.documentTab.extractedText', { defaultValue: 'Extracted text' })}
          {pageCount != null && (
            <span className="ml-1 rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] text-gold">
              {pageCount}p
            </span>
          )}
        </button>
      </div>

      {/* Panel */}
      <div
        id={`${tabGroupId}-panel`}
        role="tabpanel"
        aria-labelledby={viewMode === 'original' ? `${tabGroupId}-original` : `${tabGroupId}-extracted`}
      >
        {viewMode === 'original' ? (
          children
        ) : (
          <ExtractedTextView
            contractId={contractId}
            versionId={versionId}
            signedUrlQuery={signedUrlQuery}
            extractionEngine={extractionEngine}
          />
        )}
      </div>
    </div>
  );
}

// ── Internal: Extracted text panel ──────────────────────────────────────────

interface ExtractedTextViewProps {
  contractId: number;
  versionId: number;
  signedUrlQuery: {
    data: unknown;
    isLoading: boolean;
    isError: boolean;
  };
  extractionEngine?: ExtractionEngine | null;
}

function ExtractedTextView({
  signedUrlQuery,
  extractionEngine,
}: ExtractedTextViewProps) {
  const { t } = useTranslation();

  // Fetch the actual text content from the signed URL
  const textQuery = useQuery({
    queryKey: ['extractedTextContent', (signedUrlQuery.data as { signedUrl?: string })?.signedUrl],
    queryFn: async () => {
      const url = (signedUrlQuery.data as { signedUrl: string }).signedUrl;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch extracted text');
      return res.text();
    },
    enabled: !!(signedUrlQuery.data as { signedUrl?: string })?.signedUrl,
    staleTime: 50_000,
    retry: false,
  });

  if (signedUrlQuery.isLoading || textQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-ink-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('contracts.documentTab.loadingExtracted', {
          defaultValue: 'Loading extracted text…',
        })}
      </div>
    );
  }

  if (signedUrlQuery.isError || textQuery.isError) {
    return (
      <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-4 text-sm text-terracotta">
        {t('contracts.documentTab.extractedLoadError', {
          defaultValue: 'Failed to load extracted text.',
        })}
      </div>
    );
  }

  const text = textQuery.data as string | undefined;

  if (!text) {
    return (
      <div className="py-8 text-center text-sm text-ink-muted">
        {t('contracts.documentTab.extractedEmpty', {
          defaultValue: 'No extracted text available.',
        })}
      </div>
    );
  }

  const engineLabel = extractionEngine
    ? t(`contracts.documentTab.engine.${extractionEngine}`, { defaultValue: extractionEngine })
    : null;

  return (
    <div className="space-y-3">
      {engineLabel && (
        <p className="text-[11px] text-ink-subtle">
          {t('contracts.documentTab.extractedVia', {
            defaultValue: 'Extracted via {{engine}}',
            engine: engineLabel,
          })}
        </p>
      )}
      <div className="rounded-lg border border-border bg-card p-4">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">
          {text}
        </pre>
      </div>
    </div>
  );
}
