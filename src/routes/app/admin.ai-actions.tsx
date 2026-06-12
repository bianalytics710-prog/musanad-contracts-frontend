/**
 * /app/admin/ai-actions — Platform Admin AI Chat Action catalog.
 *
 * Lists the seeded action_registry rows (mig 633) and exposes the per-tenant
 * enable/disable toggle (mig 634).
 *
 * Permission: system.config.manage (platform_admin grant).
 */
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sparkles, Wrench, Eye, ShieldAlert } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { aiActionsAdminService } from '@/services/api/ai-actions-admin.service';
import type { ChatActionCatalogRow } from '@/types/entities/chat-orchestrator.types';

export const Route = createFileRoute('/app/admin/ai-actions')({
  component: () => (
    <ErrorBoundary>
      <AiActionsAdminPage />
    </ErrorBoundary>
  ),
});

function AiActionsAdminPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canManage = useAuthStore(selectHasPermission('system.config.manage'));

  const { data: rows = [], isLoading, isError } = useQuery<ChatActionCatalogRow[]>({
    queryKey: ['adminAiActions'],
    queryFn: () => aiActionsAdminService.list(),
    enabled: canManage,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ code, enabled }: { code: string; enabled: boolean }) =>
      aiActionsAdminService.toggle(code, enabled),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.enabled
          ? t('admin.aiActions.toast.enabled', { defaultValue: 'Action enabled for this tenant' })
          : t('admin.aiActions.toast.disabled', { defaultValue: 'Action disabled for this tenant' }),
      );
      void queryClient.invalidateQueries({ queryKey: ['adminAiActions'] });
    },
    onError: () => toast.error(t('common.error', { defaultValue: 'Action failed' })),
  });

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-amber/30 bg-amber/10 p-4 text-sm text-ink">
          {t('admin.aiActions.permissionRequired', {
            defaultValue: 'You need system.config.manage to view AI actions.',
          })}
        </div>
      </div>
    );
  }

  const writeActions = rows.filter((r) => r.kind === 'write_action');
  const resolvers = rows.filter((r) => r.kind === 'resolver');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1200px] space-y-6 p-6"
    >
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" aria-hidden />
          <h1 className="text-2xl font-semibold text-ink">
            {t('admin.aiActions.title', { defaultValue: 'AI chat actions' })}
          </h1>
        </div>
        <p className="text-sm text-ink-muted">
          {t('admin.aiActions.subtitle', {
            defaultValue:
              'Actions the floating chatbot can propose on behalf of the user. Toggle write-actions on/off per tenant. Resolvers are always on (read-only helpers used internally).',
          })}
        </p>
      </header>

      {isLoading && <div className="h-32 animate-pulse rounded-md bg-muted" />}
      {isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {t('common.error', { defaultValue: 'Failed to load actions.' })}
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <Section
            title={t('admin.aiActions.writeActionsTitle', { defaultValue: 'Write actions' })}
            description={t('admin.aiActions.writeActionsDescription', {
              defaultValue:
                'These actions create or modify data. The user always sees a confirmation card before they run.',
            })}
            icon={<ShieldAlert className="h-4 w-4 text-terracotta" aria-hidden />}
          >
            <ActionTable
              rows={writeActions}
              showToggle
              onToggle={(code, next) => toggleMutation.mutate({ code, enabled: next })}
              pendingCode={toggleMutation.isPending ? toggleMutation.variables?.code : undefined}
            />
          </Section>

          <Section
            title={t('admin.aiActions.resolversTitle', { defaultValue: 'Resolvers' })}
            description={t('admin.aiActions.resolversDescription', {
              defaultValue:
                'Read-only helpers the model calls during a conversation to disambiguate names, contracts, and counterparties.',
            })}
            icon={<Wrench className="h-4 w-4 text-sage" aria-hidden />}
          >
            <ActionTable rows={resolvers} showToggle={false} />
          </Section>
        </>
      )}
    </motion.div>
  );
}

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">{title}</h2>
      </div>
      <p className="text-xs text-ink-muted">{description}</p>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">{children}</div>
    </section>
  );
}

function ActionTable({
  rows,
  showToggle,
  onToggle,
  pendingCode,
}: {
  rows: ChatActionCatalogRow[];
  showToggle: boolean;
  onToggle?: (code: string, next: boolean) => void;
  pendingCode?: string;
}) {
  const { t } = useTranslation();
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border bg-surface">
        <tr className="text-left">
          {(['code', 'label', 'permission', 'sort', 'status'] as const).map((c) => (
            <th
              key={c}
              scope="col"
              className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
            >
              {t(`admin.aiActions.col.${c}`, { defaultValue: c })}
            </th>
          ))}
          {showToggle && (
            <th scope="col" className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t('admin.aiActions.col.toggle', { defaultValue: 'Toggle' })}
            </th>
          )}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.length === 0 && (
          <tr>
            <td colSpan={showToggle ? 6 : 5} className="px-3 py-4 text-center text-xs text-ink-muted">
              {t('admin.aiActions.empty', { defaultValue: 'No actions registered.' })}
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.code} className={r.effectiveEnabled ? '' : 'opacity-60'}>
            <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
            <td className="px-3 py-2 text-xs font-medium text-ink">{r.label}</td>
            <td className="px-3 py-2 font-mono text-[11px] text-ink-muted">{r.requiredPermission}</td>
            <td className="px-3 py-2 text-xs">{r.sortOrder}</td>
            <td className="px-3 py-2 text-xs">
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                  r.effectiveEnabled
                    ? 'bg-sage/15 text-sage'
                    : 'bg-terracotta/15 text-terracotta'
                }`}
              >
                <Eye className="h-3 w-3" aria-hidden />
                {r.effectiveEnabled
                  ? t('admin.aiActions.status.enabled', { defaultValue: 'Enabled' })
                  : t('admin.aiActions.status.disabled', { defaultValue: 'Disabled' })}
                {r.tenantOverride !== null && (
                  <span className="ms-1 font-mono text-[9px] text-ink-muted">
                    {t('admin.aiActions.status.tenantOverride', { defaultValue: 'tenant override' })}
                  </span>
                )}
              </span>
            </td>
            {showToggle && (
              <td className="px-3 py-2 text-xs">
                <button
                  type="button"
                  data-testid={`ai-action-toggle-${r.code}`}
                  data-enabled={r.effectiveEnabled ? 'true' : 'false'}
                  onClick={() => onToggle?.(r.code, !r.effectiveEnabled)}
                  disabled={pendingCode === r.code}
                  className={`rounded px-3 py-1 text-xs font-medium transition ${
                    r.effectiveEnabled
                      ? 'bg-terracotta/15 text-terracotta hover:bg-terracotta/25'
                      : 'bg-sage/15 text-sage hover:bg-sage/25'
                  } disabled:opacity-50`}
                >
                  {r.effectiveEnabled
                    ? t('admin.aiActions.disableBtn', { defaultValue: 'Disable' })
                    : t('admin.aiActions.enableBtn', { defaultValue: 'Enable' })}
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
