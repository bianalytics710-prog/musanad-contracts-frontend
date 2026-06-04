/**
 * M22 — destructive confirmation for batch rollback. Typed token + reason.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { migrationService } from '@/services/api/migration.service';

interface Props {
  batchId: number;
  open: boolean;
  onClose: () => void;
  onRolledBack: () => void;
}

export function RollbackConfirmDialog({ batchId, open, onClose, onRolledBack }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const expectedToken = `ROLLBACK_BATCH_${batchId}`;
  const [token, setToken] = useState('');
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: async () => migrationService.rollbackBatch(batchId, reason),
    onSuccess: (r) => {
      toast.success(
        t('admin.migration.rollback.success', {
          defaultValue: 'Rolled back {{n}} contract(s).',
          n: r.contractsRolledBack,
        }),
      );
      void queryClient.invalidateQueries({ queryKey: ['m22.batch', batchId] });
      void queryClient.invalidateQueries({ queryKey: ['m22.batch.records', batchId] });
      void queryClient.invalidateQueries({ queryKey: ['m22.batches'] });
      onClose();
      onRolledBack();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${t('admin.migration.rollback.failed', { defaultValue: 'Rollback failed.' })} — ${msg}`);
    },
  });

  if (!open) return null;
  const enabled = token === expectedToken && reason.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <h3 className="text-base font-semibold text-ink">
          {t('admin.migration.rollback.title', { defaultValue: 'Roll back this batch?' })}
        </h3>
        <p className="mt-2 text-sm text-ink-muted">
          {t('admin.migration.rollback.body', {
            defaultValue: 'Imported contracts will be soft-marked inactive. Source files in Drive remain untouched. This is reversible only by a fresh import.',
          })}
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink-muted">
              {t('admin.migration.rollback.reasonLabel', { defaultValue: 'Reason' })}
            </span>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1"
              required
              placeholder={t('admin.migration.rollback.reasonPlaceholder', {
                defaultValue: 'e.g. wrong folder; legal hold on rerun',
              })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink-muted">
              {t('admin.migration.rollback.tokenLabel', { defaultValue: 'Confirmation token' })}
            </span>
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-1 font-mono"
              placeholder={expectedToken}
            />
            <span className="mt-1 block text-[10px] text-ink-subtle">
              {t('admin.migration.rollback.tokenHint', {
                defaultValue: 'Type exactly: {{token}}',
                token: expectedToken,
              })}
            </span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!enabled || mutation.isPending}
            className="bg-danger text-white hover:bg-danger/90"
          >
            {mutation.isPending
              ? t('admin.migration.rollback.pending', { defaultValue: 'Rolling back…' })
              : t('admin.migration.rollback.confirm', { defaultValue: 'Roll back' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
