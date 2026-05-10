/**
 * SmtpConfigForm — SMTP server config form + test-send action.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminEmailConfigService } from '@/services/api/admin/email-config.service';
import { translateApiError } from '@/lib/translate-api-error';
import { toast } from 'sonner';
import { formatDateTime } from '@/utils/datetime';
import type { SmtpConfig, EmailConfigPatchDto, SmtpEncryption } from '@/types/admin/email-config.types';
import { SMTP_ENCRYPTIONS } from '@/types/admin/email-config.types';

interface Props {
  config: SmtpConfig;
}

export function SmtpConfigForm({ config }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<EmailConfigPatchDto>({
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    smtpEncryption: config.smtpEncryption,
    authUser: config.authUser,
    authPassRef: '', // write-only — blank = keep existing
    fromAddress: config.fromAddress,
    fromNameEn: config.fromNameEn,
    fromNameAr: config.fromNameAr,
    replyTo: config.replyTo,
    dailySendLimit: config.dailySendLimit,
    enabled: config.enabled,
  });
  const [showTestOverride, setShowTestOverride] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');

  const saveMutation = useMutation({
    mutationFn: () => {
      // Only send authPassRef if non-empty (per spec: empty = keep existing)
      const payload: EmailConfigPatchDto = { ...draft };
      if (!payload.authPassRef) delete payload.authPassRef;
      return adminEmailConfigService.patch(payload);
    },
    onSuccess: () => {
      toast.success(t('admin.emailConfig.toast.saved', { defaultValue: 'Email config saved.' }));
      setDraft((d) => ({ ...d, authPassRef: '' }));
      void queryClient.invalidateQueries({ queryKey: ['adminEmailConfig'] });
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'admin.emailConfig.errors.saveFailed'));
    },
  });

  const testMutation = useMutation({
    mutationFn: () =>
      adminEmailConfigService.testSend(
        showTestOverride && testRecipient ? { recipient: testRecipient } : undefined,
      ),
    onSuccess: (result) => {
      toast.success(
        t('admin.emailConfig.toast.testSent', {
          defaultValue: 'Test email sent to {{recipient}} in {{ms}} ms.',
          recipient: result.recipient,
          ms: result.deliveryMs,
        }),
      );
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'admin.emailConfig.errors.testFailed'));
    },
  });

  const setField = <K extends keyof EmailConfigPatchDto>(
    key: K,
    value: EmailConfigPatchDto[K],
  ) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  return (
    <div className="space-y-6">
      {/* SMTP connection */}
      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-2 text-sm font-medium text-ink">
          {t('admin.emailConfig.sections.connection', { defaultValue: 'SMTP connection' })}
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="smtp-host" className="block text-sm font-medium text-ink">
              {t('admin.emailConfig.fields.smtpHost', { defaultValue: 'SMTP host' })}
            </label>
            <Input
              id="smtp-host"
              value={draft.smtpHost ?? ''}
              onChange={(e) => setField('smtpHost', e.target.value)}
              placeholder="smtp.example.com"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="smtp-port" className="block text-sm font-medium text-ink">
              {t('admin.emailConfig.fields.smtpPort', { defaultValue: 'Port' })}
            </label>
            <Input
              id="smtp-port"
              type="number"
              min={1}
              max={65535}
              value={draft.smtpPort ?? ''}
              onChange={(e) => setField('smtpPort', Number(e.target.value))}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="smtp-encryption" className="block text-sm font-medium text-ink">
              {t('admin.emailConfig.fields.encryption', { defaultValue: 'Encryption' })}
            </label>
            <select
              id="smtp-encryption"
              value={draft.smtpEncryption ?? 'tls'}
              onChange={(e) => setField('smtpEncryption', e.target.value as SmtpEncryption)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-ink"
            >
              {SMTP_ENCRYPTIONS.map((enc) => (
                <option key={enc} value={enc}>
                  {enc.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      {/* Auth */}
      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-2 text-sm font-medium text-ink">
          {t('admin.emailConfig.sections.auth', { defaultValue: 'Authentication' })}
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="smtp-auth-user" className="block text-sm font-medium text-ink">
              {t('admin.emailConfig.fields.authUser', { defaultValue: 'Username' })}
            </label>
            <Input
              id="smtp-auth-user"
              value={draft.authUser ?? ''}
              onChange={(e) => setField('authUser', e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="smtp-auth-pass" className="block text-sm font-medium text-ink">
              {t('admin.emailConfig.fields.authPass', { defaultValue: 'Password' })}
            </label>
            <Input
              id="smtp-auth-pass"
              type="password"
              value={draft.authPassRef ?? ''}
              onChange={(e) => setField('authPassRef', e.target.value)}
              placeholder={
                config.authPassRefSet
                  ? t('admin.emailConfig.passPlaceholderSet', {
                      defaultValue: 'Configured — leave blank to keep current',
                    })
                  : t('admin.emailConfig.passPlaceholderNotSet', {
                      defaultValue: 'Not configured',
                    })
              }
              autoComplete="new-password"
            />
            <p className="text-xs text-ink-subtle">
              {config.authPassRefSet
                ? t('admin.emailConfig.passStatus.set', {
                    defaultValue: 'A password is currently configured.',
                  })
                : t('admin.emailConfig.passStatus.notSet', {
                    defaultValue: 'No password configured.',
                  })}
            </p>
          </div>
        </div>
      </fieldset>

      {/* Sender */}
      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-2 text-sm font-medium text-ink">
          {t('admin.emailConfig.sections.sender', { defaultValue: 'Sender' })}
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="smtp-from" className="block text-sm font-medium text-ink">
              {t('admin.emailConfig.fields.fromAddress', { defaultValue: 'From address' })}
            </label>
            <Input
              id="smtp-from"
              type="email"
              value={draft.fromAddress ?? ''}
              onChange={(e) => setField('fromAddress', e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="smtp-reply-to" className="block text-sm font-medium text-ink">
              {t('admin.emailConfig.fields.replyTo', { defaultValue: 'Reply-To' })}
            </label>
            <Input
              id="smtp-reply-to"
              type="email"
              value={draft.replyTo ?? ''}
              onChange={(e) => setField('replyTo', e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="smtp-from-en" className="block text-sm font-medium text-ink">
              {t('admin.emailConfig.fields.fromNameEn', { defaultValue: 'Sender name (EN)' })}
            </label>
            <Input
              id="smtp-from-en"
              value={draft.fromNameEn ?? ''}
              onChange={(e) => setField('fromNameEn', e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="smtp-from-ar" className="block text-sm font-medium text-ink">
              {t('admin.emailConfig.fields.fromNameAr', { defaultValue: 'Sender name (AR)' })}
            </label>
            <Input
              id="smtp-from-ar"
              dir="rtl"
              value={draft.fromNameAr ?? ''}
              onChange={(e) => setField('fromNameAr', e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      {/* Limits + toggle */}
      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-2 text-sm font-medium text-ink">
          {t('admin.emailConfig.sections.limits', { defaultValue: 'Limits & status' })}
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="smtp-daily-limit" className="block text-sm font-medium text-ink">
              {t('admin.emailConfig.fields.dailyLimit', { defaultValue: 'Daily send limit' })}
            </label>
            <Input
              id="smtp-daily-limit"
              type="number"
              min={1}
              max={1000000}
              value={draft.dailySendLimit ?? ''}
              onChange={(e) => setField('dailySendLimit', Number(e.target.value))}
            />
          </div>

          <div className="flex items-end pb-1">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={draft.enabled ?? false}
                onChange={(e) => setField('enabled', e.target.checked)}
                className="h-4 w-4 rounded border-border accent-gold"
              />
              <span className="text-sm text-ink">
                {t('admin.emailConfig.fields.enabled', { defaultValue: 'Email sending enabled' })}
              </span>
            </label>
          </div>
        </div>
      </fieldset>

      {/* Actions */}
      <div className="flex flex-wrap items-start gap-4">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t('common.saving', { defaultValue: 'Saving…' })}
            </>
          ) : (
            t('common.save', { defaultValue: 'Save' })
          )}
        </Button>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="me-2 h-4 w-4" />
              )}
              {t('admin.emailConfig.testSendButton', { defaultValue: 'Send test email' })}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="smtp-test-override"
              checked={showTestOverride}
              onChange={(e) => setShowTestOverride(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-gold"
            />
            <label htmlFor="smtp-test-override" className="text-xs text-ink-subtle">
              {t('admin.emailConfig.testSendToOther', {
                defaultValue: 'Send to other address?',
              })}
            </label>
          </div>

          {showTestOverride && (
            <Input
              id="smtp-test-recipient"
              type="email"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder={t('admin.emailConfig.testRecipientPlaceholder', {
                defaultValue: 'recipient@example.com',
              })}
              className="max-w-xs"
              aria-label={t('admin.emailConfig.testRecipientLabel', {
                defaultValue: 'Test email recipient',
              })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
