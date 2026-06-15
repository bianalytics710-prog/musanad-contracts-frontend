/**
 * 2026-06-15 — Confirm-send dialog with editable recipient + Cc rows (Phase 1).
 *
 * Resolver query (fn_advisory_recipient_resolve) seeds the primary To
 * field. Layla can:
 *   - edit the To address
 *   - add 0..N Cc rows via "+ Add Cc"
 *   - remove any Cc row
 * Basic '@' validation per row. On Send, primary → recipientAddress;
 * additional rows → additionalRecipients[] (mig 675).
 *
 * Modes:
 *   - send_directly       : POST /advisory-drafts/:id/send-directly
 *   - send_after_review   : POST /advisory-drafts/:id/send-after-review
 *   - resend              : POST /advisory-drafts/:id/resend
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Send, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { advisoryDraftsService } from '@/services/api/advisory-drafts.service';

export interface ConfirmSendDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contractId: number;
  draftId: number;
  mode: 'send_directly' | 'send_after_review' | 'resend';
  onSent: () => void;
}

function isValidEmail(s: string): boolean {
  return /@/.test(s.trim()) && s.trim().length > 3;
}

export function ConfirmSendDialog({
  open,
  onOpenChange,
  contractId,
  draftId,
  mode,
  onSent,
}: ConfirmSendDialogProps) {
  const { t } = useTranslation();

  const recipientQuery = useQuery({
    queryKey: ['advisoryRecipient', contractId],
    queryFn: () => advisoryDraftsService.resolveRecipient(contractId),
    enabled: open,
  });

  const [toAddress, setToAddress] = useState('');
  const [toName, setToName] = useState('');
  const [ccRows, setCcRows] = useState<Array<{ address: string; name: string }>>([]);

  // Seed once when the resolver lands. Reset state every time the dialog
  // re-opens so back-to-back sends to different drafts start clean.
  useEffect(() => {
    if (open && recipientQuery.data) {
      setToAddress(recipientQuery.data.recipientAddress);
      setToName(recipientQuery.data.recipientName);
      setCcRows([]);
    }
  }, [open, recipientQuery.data]);

  const ccValid = useMemo(
    () => ccRows.every((r) => !r.address || isValidEmail(r.address)),
    [ccRows],
  );
  const canSend = isValidEmail(toAddress) && ccValid;

  const sendMutation = useMutation({
    mutationFn: () => {
      const payload = {
        recipientAddress: toAddress.trim(),
        recipientName: toName.trim() || undefined,
        additionalRecipients: ccRows
          .filter((r) => isValidEmail(r.address))
          .map((r) => ({ address: r.address.trim(), name: r.name.trim() || undefined })),
      };
      if (mode === 'send_directly')     return advisoryDraftsService.sendDirectly(draftId, payload);
      if (mode === 'send_after_review') return advisoryDraftsService.sendAfterReview(draftId, payload);
      return advisoryDraftsService.resend(draftId, payload);
    },
    onSuccess: () => onSent(),
    onError: (e) => toast.error(
      t('contracts.notices.confirm.error', {
        defaultValue: "Couldn't send: {{msg}}",
        msg: (e as Error).message,
      }),
    ),
  });

  const addCc = () => setCcRows((rows) => [...rows, { address: '', name: '' }]);
  const removeCc = (idx: number) => setCcRows((rows) => rows.filter((_, i) => i !== idx));
  const updateCc = (idx: number, field: 'address' | 'name', v: string) =>
    setCcRows((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: v } : r)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'resend'
              ? t('contracts.notices.confirm.resendTitle', { defaultValue: 'Resend notice' })
              : t('contracts.notices.confirm.title', { defaultValue: 'Send notice' })}
          </DialogTitle>
          <DialogDescription>
            {t('contracts.notices.confirm.description', {
              defaultValue: 'Confirm the recipient — edit or add others if needed.',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {recipientQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : recipientQuery.isError || !recipientQuery.data ? (
            <div className="rounded-md border border-[var(--terracotta)]/30 bg-[var(--terracotta)]/5 p-3 text-xs text-[var(--terracotta)]">
              {t('contracts.notices.confirm.recipientError', {
                defaultValue: "Couldn't resolve recipient. Add one below to proceed.",
              })}
            </div>
          ) : null}

          {/* Primary To row */}
          <div>
            <label htmlFor="cs-to" className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
              {t('contracts.notices.confirm.to', { defaultValue: 'To' })}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                id="cs-to-name"
                placeholder={t('contracts.notices.confirm.namePlaceholder', { defaultValue: 'Name (optional)' })}
                value={toName}
                onChange={(e) => setToName(e.target.value)}
                className="col-span-1 h-9 text-sm"
              />
              <Input
                id="cs-to"
                type="email"
                placeholder={t('contracts.notices.confirm.emailPlaceholder', { defaultValue: 'email@example.com' })}
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                aria-invalid={toAddress.length > 0 && !isValidEmail(toAddress)}
                className="col-span-2 h-9 text-sm"
                data-testid="cs-to-address"
              />
            </div>
            {recipientQuery.data?.source && (
              <div className="mt-1 text-[10px] uppercase tracking-wider text-ink-subtle">
                {recipientQuery.data.source === 'party_contact'
                  ? t('contracts.notices.confirm.sourceParty', { defaultValue: 'Source: counterparty contact' })
                  : recipientQuery.data.source === 'signer'
                  ? t('contracts.notices.confirm.sourceSigner', { defaultValue: 'Source: contract signer' })
                  : t('contracts.notices.confirm.sourceFallback', { defaultValue: 'Source: demo fallback (no contact on record)' })}
              </div>
            )}
          </div>

          {/* Cc rows */}
          {ccRows.map((row, idx) => (
            <div key={idx}>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                {t('contracts.notices.confirm.cc', { defaultValue: 'Cc' })}
              </label>
              <div className="grid grid-cols-[1fr_2fr_auto] gap-2">
                <Input
                  placeholder={t('contracts.notices.confirm.namePlaceholder', { defaultValue: 'Name (optional)' })}
                  value={row.name}
                  onChange={(e) => updateCc(idx, 'name', e.target.value)}
                  className="h-9 text-sm"
                />
                <Input
                  type="email"
                  placeholder={t('contracts.notices.confirm.emailPlaceholder', { defaultValue: 'email@example.com' })}
                  value={row.address}
                  onChange={(e) => updateCc(idx, 'address', e.target.value)}
                  aria-invalid={row.address.length > 0 && !isValidEmail(row.address)}
                  className="h-9 text-sm"
                  data-testid={`cs-cc-address-${idx}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCc(idx)}
                  aria-label={t('contracts.notices.confirm.removeCc', { defaultValue: 'Remove Cc' })}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}

          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addCc}
              data-testid="cs-add-cc"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('contracts.notices.confirm.addCc', { defaultValue: 'Add Cc' })}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            type="button"
            disabled={!canSend || sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
            data-testid="confirm-send"
          >
            <Send className="h-3.5 w-3.5" />
            {mode === 'resend'
              ? t('contracts.notices.confirm.resendButton', { defaultValue: 'Resend' })
              : t('contracts.notices.confirm.sendButton', { defaultValue: 'Send' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
