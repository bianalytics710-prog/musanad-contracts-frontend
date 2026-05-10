/**
 * /app/admin/branding — Branding editor (logo, colors, footer).
 */
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Palette } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { BrandingEditor } from '@/components/admin/BrandingEditor';
import { adminBrandingService } from '@/services/api/admin/branding.service';
import { useAuthStore } from '@/store/auth.store';

export const Route = createFileRoute('/app/admin/branding')({
  component: () => (
    <ErrorBoundary>
      <AdminBrandingView />
    </ErrorBoundary>
  ),
});

function AdminBrandingView() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const hasPermission = user?.permissions.includes('branding.manage') ?? false;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['adminBranding'],
    queryFn: () => adminBrandingService.get(),
    staleTime: 60_000,
    enabled: hasPermission,
  });

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
          <Palette className="h-5 w-5 text-gold" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t('admin.branding.title', { defaultValue: 'Branding' })}
          </h1>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {t('admin.branding.subtitle', {
            defaultValue:
              'Customize the logo, colors, and footer text for this tenant.',
          })}
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-surface" aria-hidden />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-ink-muted">
            {t('common.errorLoading', { defaultValue: 'Failed to load branding config.' })}
          </p>
          <button
            className="mt-3 text-xs text-gold underline"
            onClick={() => void refetch()}
          >
            {t('common.retry', { defaultValue: 'Retry' })}
          </button>
        </div>
      ) : data ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <BrandingEditor config={data} />
        </div>
      ) : null}
    </motion.div>
  );
}
