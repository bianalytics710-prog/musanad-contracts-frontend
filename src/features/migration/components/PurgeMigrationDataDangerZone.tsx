/**
 * M22 — DEDICATED DANGER ZONE: hard-purge of all migration-imported data.
 * INDEPENDENT of the CR-J "Reset demo data" button.
 *
 * Permission gate: migration.purge.all  (defence-in-depth — FE check
 * mirrors BE check, page also gates the section's render at all).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { migrationService } from '@/services/api/migration.service';

export function PurgeMigrationDataDangerZone() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [ack, setAck] = useState(false);

  // Preview counts — refreshed on every mount + after every purge.
  const { data: preview } = useQuery({
    queryKey: ['m22.purge.preview'],
    queryFn: () => migrationService.purgePreview(),
    staleTime: 0,
  });

  const today = new Date().toISOString().slice(0, 10);
  const expectedToken = `PURGE_MIGRATION_${today}`;

  const mutation = useMutation({
    mutationFn: async () => migrationService.purgeExecute(expectedToken),
    onSuccess: (r) => {
      toast.success(
        t('admin.migration.purge.success', {
          defaultValue: 'Purged {{contracts}} contracts, {{batches}} batches.',
          contracts: r.counts.contract ?? 0,
          batches: r.counts.migrationBatch ?? 0,
        }),
      );
      void queryClient.invalidateQueries({ queryKey: ['m22.purge.preview'] });
      void queryClient.invalidateQueries({ queryKey: ['m22.batches'] });
      void queryClient.invalidateQueries({ queryKey: ['m22.connectors'] });
      setOpen(false);
      setToken('');
      setAck(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${t('admin.migration.purge.failed', { defaultValue: 'Purge failed.' })} — ${msg}`);
    },
  });

  const enabled = token === expectedToken && ack;
  const contracts = preview?.counts?.contract ?? 0;
  const batches   = preview?.counts?.migrationBatch ?? 0;
  const irq       = preview?.counts?.ingestionReviewQueue ?? 0;

  return (
    <section
      aria-labelledby="m22-danger-zone-heading"
      className="rounded-lg border border-danger/40 bg-danger/5 p-6"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-danger" aria-hidden="true" />
        <div className="flex-1">
          <h2 id="m22-danger-zone-heading" className="text-base font-semibold text-ink">
            {t('admin.migration.purge.title', { defaultValue: 'Danger zone — purge all migration data' })}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            {t('admin.migration.purge.body', {
              defaultValue:
                'Currently in the system: {{batches}} migration batches, {{contracts}} imported contracts, {{irq}} review-queue rows. None of your OAuth connections will be affected.',
              batches, contracts, irq,
            })}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-danger text-white hover:bg-danger/90"
        >
          {t('admin.migration.purge.cta', { defaultValue: 'Purge all migration data' })}
        </Button>
        <span className="text-[10px] uppercase tracking-wider text-ink-muted">
          {t('admin.migration.purge.note', {
            defaultValue: 'Independent of the demo Reset button. OAuth connections survive.',
          })}
        </span>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="m22-purge-dialog-title"
        >
          <div className="w-full max-w-md rounded-lg border border-danger/40 bg-card p-6 shadow-xl">
            <h3 id="m22-purge-dialog-title" className="text-base font-semibold text-ink">
              {t('admin.migration.purge.confirmTitle', { defaultValue: 'Confirm migration purge' })}
            </h3>
            <p className="mt-2 text-sm text-ink-muted">
              {t('admin.migration.purge.confirmBody', {
                defaultValue:
                  'About to hard-delete {{contracts}} contracts, {{batches}} batches, plus child rows. OAuth connections will be kept. This cannot be undone via the UI.',
                contracts, batches,
              })}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-xs font-medium text-ink-muted">
                  {t('admin.migration.purge.tokenLabel', { defaultValue: 'Confirmation token' })}
                </span>
                <Input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="mt-1 font-mono"
                  placeholder={expectedToken}
                  autoFocus
                />
                <span className="mt-1 block text-[10px] text-ink-subtle">
                  {t('admin.migration.purge.tokenHint', {
                    defaultValue: 'Type exactly: {{token}}',
                    token: expectedToken,
                  })}
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-danger"
                />
                {t('admin.migration.purge.ack', {
                  defaultValue: 'I understand this cannot be undone via the UI.',
                })}
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setOpen(false); setToken(''); setAck(false); }}>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={!enabled || mutation.isPending}
                className="bg-danger text-white hover:bg-danger/90"
              >
                {mutation.isPending
                  ? t('admin.migration.purge.pending', { defaultValue: 'Purging…' })
                  : t('admin.migration.purge.confirm', { defaultValue: 'Purge now' })}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
