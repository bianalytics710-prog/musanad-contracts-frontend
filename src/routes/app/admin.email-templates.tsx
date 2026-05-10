/**
 * /app/admin/email-templates — Notification template list.
 */
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Mail, Pencil, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { adminNotificationTemplatesService } from '@/services/api/admin/notification-templates.service';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/utils/datetime';
import { useAuthStore } from '@/store/auth.store';
import type { NotificationTemplateChannel } from '@/types/admin/notification-templates.types';
import { NOTIFICATION_TEMPLATE_CHANNELS } from '@/types/admin/notification-templates.types';

export const Route = createFileRoute('/app/admin/email-templates')({
  component: () => (
    <ErrorBoundary>
      <AdminEmailTemplatesView />
    </ErrorBoundary>
  ),
});

function AdminEmailTemplatesView() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState<NotificationTemplateChannel | ''>('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const hasPermission =
    user?.permissions.includes('notification.template.manage') ?? false;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['adminNotificationTemplates', { page, search: debouncedSearch, channel }],
    queryFn: () =>
      adminNotificationTemplatesService.list({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        channel: channel || undefined,
      }),
    staleTime: 30_000,
    enabled: hasPermission,
  });

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

  const templates = data?.data ?? [];
  const totalPages = data?.pagination.totalPages ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] space-y-4 p-6"
    >
      <header>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-gold" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t('admin.emailTemplates.title', { defaultValue: 'Email templates' })}
          </h1>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {t('admin.emailTemplates.subtitle', {
            defaultValue: 'Manage notification templates for email, in-app, and integration channels.',
          })}
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <Input
            id="template-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('admin.emailTemplates.searchPlaceholder', {
              defaultValue: 'Search templates…',
            })}
            className="ps-9"
            aria-label={t('admin.emailTemplates.searchLabel', {
              defaultValue: 'Search templates',
            })}
          />
        </div>
        <div className="space-y-0">
          <label htmlFor="template-channel-filter" className="sr-only">
            {t('admin.emailTemplates.channelFilter', { defaultValue: 'Filter by channel' })}
          </label>
          <select
            id="template-channel-filter"
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value as NotificationTemplateChannel | '');
              setPage(1);
            }}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-ink"
          >
            <option value="">
              {t('admin.emailTemplates.allChannels', { defaultValue: 'All channels' })}
            </option>
            {NOTIFICATION_TEMPLATE_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-surface" aria-hidden />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-ink-muted">
            {t('common.errorLoading', { defaultValue: 'Failed to load templates.' })}
          </p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => void refetch()}>
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t('admin.emailTemplates.empty', { defaultValue: 'No templates found.' })}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-ink-subtle">
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.emailTemplates.col.templateId', { defaultValue: 'Template ID' })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.emailTemplates.col.channel', { defaultValue: 'Channel' })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.emailTemplates.col.subject', { defaultValue: 'Subject (EN)' })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.emailTemplates.col.lastModified', { defaultValue: 'Last modified' })}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.emailTemplates.col.actions', { defaultValue: 'Actions' })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {templates.map((tpl) => (
                  <tr
                    key={tpl.id}
                    className="border-t border-border/60 transition-colors hover:bg-surface/40"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-ink">
                      {tpl.templateId}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                        {tpl.channel}
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-ink-muted">
                      <span className="line-clamp-1">
                        {tpl.subjectEn ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                      {tpl.lastModifiedByName ?? '—'} · {formatDateTime(tpl.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to="/app/admin/email-templates/$id"
                        params={{ id: String(tpl.id) }}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gold hover:bg-gold/10"
                      >
                        <Pencil className="h-3 w-3" />
                        {t('common.edit', { defaultValue: 'Edit' })}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('common.previous', { defaultValue: 'Previous' })}
              </Button>
              <span className="text-xs text-ink-subtle">
                {t('common.pageOf', {
                  defaultValue: 'Page {{page}} of {{total}}',
                  page,
                  total: totalPages,
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('common.next', { defaultValue: 'Next' })}
              </Button>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
