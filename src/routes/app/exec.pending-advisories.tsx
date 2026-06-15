/**
 * /app/exec/pending-advisories — Phase 2 (2026-06-15).
 *
 * Executive's inbox for advisory drafts routed by Legal Counsel for review.
 * Each row offers View / Modify / Approve. Approving hands the draft back
 * to LC with status='approved'. Modifying saves edited EN/AR text + also
 * flips to 'approved' (modify = approve+edit in one step per Phase 2 spec).
 *
 * Permission: advisory.draft.review (executive role granted via mig 673).
 */
import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Eye,
  FileEdit,
  Save,
  ThumbsUp,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { advisoryDraftsService, type PendingAdvisoryRow } from '@/services/api/advisory-drafts.service';
import { formatDateTime } from '@/utils/datetime';

export const Route = createFileRoute('/app/exec/pending-advisories')({
  component: () => (
    <ErrorBoundary>
      <PendingAdvisoriesPage />
    </ErrorBoundary>
  ),
});

function PendingAdvisoriesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [previewRow, setPreviewRow] = useState<PendingAdvisoryRow | null>(null);
  const [modifyRow, setModifyRow] = useState<PendingAdvisoryRow | null>(null);

  const listQuery = useQuery({
    queryKey: ['execPendingAdvisories'],
    queryFn: () => advisoryDraftsService.pendingForExecutive(),
    staleTime: 15_000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => advisoryDraftsService.execApprove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['execPendingAdvisories'] });
      toast.success(
        t('exec.pendingAdvisories.approvedToast', {
          defaultValue: 'Approved — handed back to Legal Counsel for dispatch.',
        }),
      );
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const rows = listQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t('exec.pendingAdvisories.title', { defaultValue: 'Pending Advisories' })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t('exec.pendingAdvisories.subtitle', {
            defaultValue:
              'Advisory drafts Legal Counsel has routed for your review. Approve as-is, modify and approve, or open the contract to see the full context.',
          })}
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : listQuery.isError ? (
            <div className="flex items-center gap-2 p-6 text-sm text-[var(--terracotta)]">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              {t('exec.pendingAdvisories.loadError', { defaultValue: "Couldn't load pending advisories." })}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-muted">
              <CheckCircle2 className="mx-auto h-6 w-6 text-[var(--sage)]" aria-hidden />
              <p className="mt-2">
                {t('exec.pendingAdvisories.empty', {
                  defaultValue: 'No advisories awaiting your review.',
                })}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface">
                  <tr className="text-left">
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('exec.pendingAdvisories.cols.notice', { defaultValue: 'Notice' })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('exec.pendingAdvisories.cols.contract', { defaultValue: 'Contract' })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('exec.pendingAdvisories.cols.routedBy', { defaultValue: 'Routed by' })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('exec.pendingAdvisories.cols.routedAt', { defaultValue: 'Routed' })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle text-center">
                      {t('exec.pendingAdvisories.cols.action', { defaultValue: 'Action' })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/60 hover:bg-surface/50">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-ink">{row.templateDisplayEn || row.draftType}</div>
                        {row.linkedRiskCaseId && (
                          <div className="text-[11px] text-ink-muted">
                            {t('exec.pendingAdvisories.fromCase', {
                              defaultValue: 'From risk case #{{id}}',
                              id: row.linkedRiskCaseId,
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-xs">
                        <div className="font-mono text-ink">{row.contractNumber}</div>
                        {row.counterpartyName && (
                          <div className="text-ink-muted">{row.counterpartyName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-ink-muted">
                        {row.createdByName ?? '—'}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-ink-muted whitespace-nowrap font-mono">
                        {row.routedAt ? formatDateTime(row.routedAt, { showTime: false }) : '—'}
                      </td>
                      <td className="px-4 py-3 align-top text-center">
                        {/* 2026-06-15 — Single View action per row; the
                            preview dialog hosts Modify + Approve so the
                            user reads the notice before acting. */}
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setPreviewRow(row)}
                          data-testid={`pending-view-${row.id}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t('common.view', { defaultValue: 'View' })}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {previewRow && (
        <PreviewDialog
          open
          onOpenChange={(o) => { if (!o) setPreviewRow(null); }}
          row={previewRow}
          onApprove={() => {
            approveMutation.mutate(previewRow.id);
            setPreviewRow(null);
          }}
          approvePending={approveMutation.isPending}
          onPickModify={() => {
            setModifyRow(previewRow);
            setPreviewRow(null);
          }}
        />
      )}

      {modifyRow && (
        <ModifyDialog
          open
          onOpenChange={(o) => { if (!o) setModifyRow(null); }}
          row={modifyRow}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['execPendingAdvisories'] });
            setModifyRow(null);
            toast.success(
              t('exec.pendingAdvisories.modifiedToast', {
                defaultValue: 'Saved + approved. Legal Counsel notified.',
              }),
            );
          }}
        />
      )}
    </div>
  );
}

function PreviewDialog({
  open,
  onOpenChange,
  row,
  onApprove,
  approvePending,
  onPickModify,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: PendingAdvisoryRow;
  onApprove: () => void;
  approvePending: boolean;
  onPickModify: () => void;
}) {
  const { t } = useTranslation();
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const bodyEn = row.finalTextEn ?? row.generatedTextEn;
  const bodyAr = row.finalTextAr ?? row.generatedTextAr;
  const body = lang === 'en' ? bodyEn : bodyAr;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{row.templateDisplayEn || row.draftType}</DialogTitle>
          <DialogDescription>
            {t('exec.pendingAdvisories.preview.description', {
              defaultValue: 'Read the full rendered notice, then approve as-is or modify before approval.',
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-1 pb-2">
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`rounded px-2 py-0.5 text-[10px] ${lang === 'en' ? 'bg-surface text-ink' : 'text-ink-muted'}`}
          >EN</button>
          <button
            type="button"
            onClick={() => setLang('ar')}
            disabled={!bodyAr}
            className={`rounded px-2 py-0.5 text-[10px] ${lang === 'ar' ? 'bg-surface text-ink' : 'text-ink-muted'}`}
          >AR</button>
        </div>
        <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface/40 p-4 text-xs text-ink">
          {body || t('common.empty', { defaultValue: '(empty)' })}
        </pre>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onPickModify}
            data-testid="preview-modify"
          >
            <Edit3 className="h-3.5 w-3.5" />
            {t('exec.pendingAdvisories.modify', { defaultValue: 'Modify' })}
          </Button>
          <Button
            type="button"
            disabled={approvePending}
            onClick={onApprove}
            data-testid="preview-approve"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            {t('exec.pendingAdvisories.approve', { defaultValue: 'Approve' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModifyDialog({
  open,
  onOpenChange,
  row,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: PendingAdvisoryRow;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [bodyEn, setBodyEn] = useState(row.finalTextEn ?? row.generatedTextEn);
  const [bodyAr, setBodyAr] = useState(row.finalTextAr ?? row.generatedTextAr ?? '');

  const modifyMutation = useMutation({
    mutationFn: () => advisoryDraftsService.execModify(row.id, {
      modifiedTextEn: bodyEn,
      modifiedTextAr: bodyAr || undefined,
    }),
    onSuccess: () => onSaved(),
    onError: (e) => toast.error(
      t('exec.pendingAdvisories.modify.error', {
        defaultValue: "Couldn't save: {{msg}}",
        msg: (e as Error).message,
      }),
    ),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {t('exec.pendingAdvisories.modify.title', { defaultValue: 'Modify advisory' })}
          </DialogTitle>
          <DialogDescription>
            {t('exec.pendingAdvisories.modify.description', {
              defaultValue:
                'Edit the notice text. Saving will approve the modified version and notify Legal Counsel.',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`rounded px-2 py-0.5 text-[10px] ${lang === 'en' ? 'bg-surface text-ink' : 'text-ink-muted'}`}
            >EN</button>
            <button
              type="button"
              onClick={() => setLang('ar')}
              className={`rounded px-2 py-0.5 text-[10px] ${lang === 'ar' ? 'bg-surface text-ink' : 'text-ink-muted'}`}
            >AR</button>
          </div>
          {lang === 'en' ? (
            <textarea
              value={bodyEn}
              onChange={(e) => setBodyEn(e.target.value)}
              className="min-h-[300px] w-full rounded-md border border-input bg-background p-3 font-mono text-xs leading-relaxed text-ink shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              dir="ltr"
              data-testid="modify-textarea-en"
            />
          ) : (
            <textarea
              value={bodyAr}
              onChange={(e) => setBodyAr(e.target.value)}
              className="min-h-[300px] w-full rounded-md border border-input bg-background p-3 font-mono text-xs leading-relaxed text-ink shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              dir="rtl"
              data-testid="modify-textarea-ar"
            />
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            type="button"
            disabled={modifyMutation.isPending || !bodyEn.trim()}
            onClick={() => modifyMutation.mutate()}
            data-testid="modify-save"
          >
            <Save className="h-3.5 w-3.5" />
            {t('exec.pendingAdvisories.modify.save', { defaultValue: 'Save + approve' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
