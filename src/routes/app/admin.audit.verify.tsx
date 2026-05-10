/**
 * /app/admin/audit/verify — Audit chain integrity verification.
 * Gated: audit.verify permission (Super Admin + platform_admin only).
 */
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AuditVerifyPanel } from '@/components/admin/AuditVerifyPanel';
import { useAuthStore } from '@/store/auth.store';

export const Route = createFileRoute('/app/admin/audit/verify')({
  component: () => (
    <ErrorBoundary>
      <AuditVerifyView />
    </ErrorBoundary>
  ),
});

function AuditVerifyView() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const hasPermission =
    user?.permissions.includes('audit.verify') ?? false;

  if (!hasPermission) {
    return (
      <div className="mx-auto w-full max-w-[960px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t('common.forbidden', {
              defaultValue: 'You do not have permission to access this page.',
            })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[960px] space-y-4 p-6"
    >
      <header>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-gold" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t('admin.audit.verify.title', { defaultValue: 'Audit chain verification' })}
          </h1>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {t('admin.audit.verify.subtitle', {
            defaultValue:
              'Walk every audit_log row and verify the SHA-256 hash chain is intact. Reports the first integrity break if detected.',
          })}
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card p-6">
        <AuditVerifyPanel />
      </div>
    </motion.div>
  );
}
