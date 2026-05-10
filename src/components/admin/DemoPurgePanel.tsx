/**
 * DemoPurgePanel — dry-run + double-confirm purge flow.
 * Includes DataClassificationSummaryTable.
 * Super Admin only — caller must gate rendering.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminDemoService } from '@/services/api/admin/demo.service';
import { DataClassificationSummaryTable } from './DataClassificationSummaryTable';
import { useFocusTrap } from '@/components/common/useFocusTrap';
import { translateApiError } from '@/lib/translate-api-error';
import { toast } from 'sonner';
import type { DemoPurgeResult } from '@/types/admin/demo.types';

export function DemoPurgePanel() {
  const { t } = useTranslation();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmToken, setConfirmToken] = useState('');
  const [dryRunResult, setDryRunResult] = useState<DemoPurgeResult | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, showConfirmModal);

  const todayToken = `PURGE_DEMO_DATA_${new Date().toISOString().slice(0, 10)}`;

  const summaryQuery = useQuery({
    queryKey: ['adminDemo', 'summary'],
    queryFn: () => adminDemoService.dataClassificationSummary(),
    staleTime: 30_000,
  });

  const dryRunMutation = useMutation({
    mutationFn: () => adminDemoService.purge({ dryRun: true }),
    onSuccess: (data) => {
      setDryRunResult(data);
      setShowConfirmModal(true);
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'admin.demoPurge.errors.dryRunFailed'));
    },
  });

  const purgeMutation = useMutation({
    mutationFn: () => adminDemoService.purge({ confirmToken, dryRun: false }),
    onSuccess: (data) => {
      toast.success(
        t('admin.demoPurge.toast.success', {
          defaultValue: 'Purged {{count}} demo rows across {{tables}} tables.',
          count: data.rowsDeleted,
          tables: data.tablesPurged.length,
        }),
      );
      setShowConfirmModal(false);
      setConfirmToken('');
      setDryRunResult(null);
      void summaryQuery.refetch();
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'admin.demoPurge.errors.purgeFailed'));
    },
  });

  const tokenValid = confirmToken === todayToken;

  return (
    <div className="space-y-6">
      {/* Summary table */}
      {summaryQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-surface" aria-hidden />
          ))}
        </div>
      ) : summaryQuery.isError ? (
        <div className="rounded-md border border-terracotta/40 bg-terracotta/10 px-3 py-2 text-sm text-terracotta">
          {t('common.errorLoading', { defaultValue: 'Failed to load data.' })}
        </div>
      ) : summaryQuery.data ? (
        <DataClassificationSummaryTable summary={summaryQuery.data} />
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => dryRunMutation.mutate()}
          disabled={dryRunMutation.isPending}
        >
          {dryRunMutation.isPending ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t('admin.demoPurge.dryRunRunning', { defaultValue: 'Running dry-run…' })}
            </>
          ) : (
            t('admin.demoPurge.dryRunButton', { defaultValue: 'Run dry-run' })
          )}
        </Button>
      </div>

      {/* Double-confirm modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="purge-modal-title"
            className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" />
              <div className="flex-1">
                <h2
                  id="purge-modal-title"
                  className="text-lg font-semibold text-ink"
                >
                  {t('admin.demoPurge.modal.title', {
                    defaultValue: 'Confirm demo data purge',
                  })}
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {t('admin.demoPurge.modal.description', {
                    defaultValue:
                      'This will permanently delete all demo-classified rows. This action cannot be undone.',
                  })}
                </p>
              </div>
            </div>

            {dryRunResult && (
              <div className="mt-4 rounded-md border border-border bg-surface/50 px-3 py-2">
                <p className="text-sm font-medium text-ink">
                  {t('admin.demoPurge.modal.dryRunPreview', {
                    defaultValue: 'Dry-run preview: {{count}} rows across {{tables}} tables',
                    count: dryRunResult.rowsDeleted,
                    tables: dryRunResult.tablesPurged.length,
                  })}
                </p>
                {dryRunResult.tablesPurged.length > 0 && (
                  <p className="mt-1 font-mono text-xs text-ink-muted">
                    {dryRunResult.tablesPurged.join(', ')}
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 space-y-2">
              <label
                htmlFor="purge-confirm-token"
                className="block text-sm font-medium text-ink"
              >
                {t('admin.demoPurge.modal.tokenLabel', {
                  defaultValue: 'Type the confirmation token to proceed:',
                })}
              </label>
              <p className="font-mono text-xs text-ink-muted">{todayToken}</p>
              <Input
                id="purge-confirm-token"
                value={confirmToken}
                onChange={(e) => setConfirmToken(e.target.value)}
                placeholder={todayToken}
                className="font-mono text-sm"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmToken('');
                }}
                disabled={purgeMutation.isPending}
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                onClick={() => purgeMutation.mutate()}
                disabled={!tokenValid || purgeMutation.isPending}
                className="bg-terracotta text-white hover:bg-terracotta/90"
              >
                {purgeMutation.isPending ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t('admin.demoPurge.modal.purging', { defaultValue: 'Purging…' })}
                  </>
                ) : (
                  <>
                    <Trash2 className="me-2 h-4 w-4" />
                    {t('admin.demoPurge.modal.confirmButton', {
                      defaultValue: 'Purge demo data',
                    })}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
