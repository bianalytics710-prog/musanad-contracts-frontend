/**
 * /app/admin/tenants — Tenant list (platform_admin + Super Admin).
 */
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { TenantList } from '@/components/admin/TenantList';
import { useAuthStore } from '@/store/auth.store';

export const Route = createFileRoute('/app/admin/tenants')({
  component: () => (
    <ErrorBoundary>
      <AdminTenantsView />
    </ErrorBoundary>
  ),
});

function AdminTenantsView() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const hasPermission = user?.permissions.includes('tenant.read') ?? false;

  if (!hasPermission) {
    return (
      <div className="mx-auto w-full max-w-[1400px] p-6">
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
      className="mx-auto w-full max-w-[1400px] space-y-4 p-6"
    >
      <header>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-gold" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t('admin.tenants.title', { defaultValue: 'Tenants' })}
          </h1>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {t('admin.tenants.subtitle', {
            defaultValue: 'Configured tenants for this deployment. v1 ships with the ADNOC tenant.',
          })}
        </p>
      </header>

      <TenantList />
    </motion.div>
  );
}
