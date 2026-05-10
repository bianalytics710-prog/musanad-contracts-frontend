/**
 * AuditVerifyPanel — verify button + progress + result display.
 * Used by /app/admin/audit/verify.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminAuditChainService } from '@/services/api/admin/audit-chain.service';
import type { AuditChainVerifyResult } from '@/types/admin/audit-chain.types';
import { translateApiError } from '@/lib/translate-api-error';

export function AuditVerifyPanel() {
  const { t } = useTranslation();
  const [result, setResult] = useState<AuditChainVerifyResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const verifyMutation = useMutation({
    mutationFn: () => adminAuditChainService.verifyChain(),
    onSuccess: (data) => {
      setResult(data);
      setApiError(null);
    },
    onError: (err: unknown) => {
      setApiError(translateApiError(err, t, 'admin.audit.verify.errors.failed'));
      setResult(null);
    },
  });

  const isPending = verifyMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          onClick={() => verifyMutation.mutate()}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t('admin.audit.verify.running', { defaultValue: 'Verifying…' })}
            </>
          ) : (
            t('admin.audit.verify.runButton', { defaultValue: 'Verify integrity now' })
          )}
        </Button>
        {isPending && (
          <p className="text-sm text-ink-muted">
            {t('admin.audit.verify.nfrNote', {
              defaultValue: 'This may take up to 30 seconds for large audit logs.',
            })}
          </p>
        )}
      </div>

      {apiError && (
        <div className="flex items-start gap-2 rounded-md border border-terracotta/40 bg-terracotta/10 px-3 py-2 text-sm text-terracotta">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{apiError}</p>
        </div>
      )}

      {result && (
        <div
          className={`rounded-lg border p-4 ${
            result.verified
              ? 'border-sage/40 bg-sage/10'
              : 'border-terracotta/40 bg-terracotta/10'
          }`}
        >
          <div className="flex items-center gap-2">
            {result.verified ? (
              <ShieldCheck className="h-5 w-5 text-sage" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-terracotta" />
            )}
            <p className="font-medium text-ink">
              {result.verified
                ? t('admin.audit.verify.result.clean', {
                    defaultValue: 'Audit chain is intact',
                  })
                : t('admin.audit.verify.result.broken', {
                    defaultValue: 'Audit chain integrity failure detected',
                  })}
            </p>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                {t('admin.audit.verify.result.rowsWalked', { defaultValue: 'Rows walked' })}
              </dt>
              <dd className="font-mono text-ink">
                {result.rowsWalked.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                {t('admin.audit.verify.result.elapsedMs', { defaultValue: 'Elapsed' })}
              </dt>
              <dd className="font-mono text-ink">{result.elapsedMs} ms</dd>
            </div>
            {!result.verified && result.brokenAtSeq !== null && (
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t('admin.audit.verify.result.brokenAtSeq', {
                    defaultValue: 'First mismatch at seq',
                  })}
                </dt>
                <dd className="font-mono text-terracotta">{result.brokenAtSeq}</dd>
              </div>
            )}
            {!result.verified && result.error && (
              <div className="col-span-2 sm:col-span-3">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t('admin.audit.verify.result.errorType', { defaultValue: 'Error type' })}
                </dt>
                <dd className="font-mono text-terracotta">{result.error}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
