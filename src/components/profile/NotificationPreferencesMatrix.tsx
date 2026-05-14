/**
 * NotificationPreferencesMatrix — 7-kinds × 4-channels toggle grid.
 *
 * M16 / CR-H — T1 service, T2 React Query, T3 i18n, T5 tokens, T6 a11y D7 scope,
 * T7 type-safe, T12 formatDateTime (n/a for toggles), C13 no hex.
 */
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notificationPreferencesService } from '@/services/api/notification-preferences.service';
import { translateApiError } from '@/lib/translate-api-error';
import type {
  NotificationKindPref,
  NotificationChannelPref,
  PriorityMin,
  NotificationSubscriptionCell,
} from '@/types/notification-preferences.types';
import {
  NOTIFICATION_KINDS_PREF,
  NOTIFICATION_CHANNELS_PREF,
  PRIORITY_MIN_OPTIONS,
} from '@/types/notification-preferences.types';

const QUERY_KEY = 'notificationPreferences';

export function NotificationPreferencesMatrix() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => notificationPreferencesService.list(),
    staleTime: 60_000,
  });

  const setMutation = useMutation({
    mutationFn: notificationPreferencesService.set,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success(t('profile.notificationPreferences.toast.saved'));
    },
    onError: (err: unknown) => {
      toast.error(
        translateApiError(err, t, 'profile.notificationPreferences.errors.saveFailed'),
      );
    },
  });

  const cells = data?.data ?? [];

  function getCell(
    kind: NotificationKindPref,
    channel: NotificationChannelPref,
  ): NotificationSubscriptionCell | undefined {
    return cells.find((c) => c.notificationKind === kind && c.channel === channel);
  }

  function handleToggle(kind: NotificationKindPref, channel: NotificationChannelPref) {
    const cell = getCell(kind, channel);
    const current = cell?.enabled ?? true;
    setMutation.mutate({
      notificationKind: kind,
      channel,
      enabled: !current,
      priorityMin: cell?.priorityMin ?? 'high',
    });
  }

  function handlePriorityChange(
    kind: NotificationKindPref,
    channel: NotificationChannelPref,
    priorityMin: PriorityMin,
  ) {
    const cell = getCell(kind, channel);
    setMutation.mutate({
      notificationKind: kind,
      channel,
      enabled: cell?.enabled ?? true,
      priorityMin,
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="flex items-center gap-3 rounded-lg border border-error/30 bg-error/5 p-4"
        role="alert"
      >
        <AlertTriangle className="h-5 w-5 text-error" aria-hidden="true" />
        <p className="text-sm text-error">
          {(error as Error)?.message ?? t('common.error')}
        </p>
        <Button variant="ghost" size="sm" onClick={() => void refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        {t('profile.notificationPreferences.description')}
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-surface">
            <tr>
              <th scope="col" className="w-48 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {t('profile.notificationPreferences.columns.kind')}
              </th>
              {NOTIFICATION_CHANNELS_PREF.map((ch) => (
                <th
                  key={ch}
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-ink-muted"
                >
                  {t(`profile.notificationPreferences.channels.${ch}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {NOTIFICATION_KINDS_PREF.map((kind) => (
              <tr key={kind} className="hover:bg-surface/50 transition-colors">
                <th scope="row" className="px-4 py-4 text-left text-sm font-medium text-ink">
                  {t(`profile.notificationPreferences.kinds.${kind}`)}
                </th>
                {NOTIFICATION_CHANNELS_PREF.map((ch) => {
                  const cell = getCell(kind, ch);
                  const enabled = cell?.enabled ?? true;
                  const priorityMin = cell?.priorityMin ?? 'high';
                  const cellId = `pref-${kind}-${ch}`;
                  const priorityId = `priority-${kind}-${ch}`;

                  return (
                    <td key={ch} className="px-4 py-4">
                      <div className="flex flex-col items-center gap-2">
                        {/* Toggle */}
                        <label
                          htmlFor={cellId}
                          className="relative inline-flex cursor-pointer items-center"
                          aria-label={t('profile.notificationPreferences.toggleLabel', {
                            kind: t(`profile.notificationPreferences.kinds.${kind}`),
                            channel: t(`profile.notificationPreferences.channels.${ch}`),
                          })}
                        >
                          <input
                            type="checkbox"
                            id={cellId}
                            checked={enabled}
                            onChange={() => handleToggle(kind, ch)}
                            disabled={setMutation.isPending}
                            className="sr-only peer"
                          />
                          <div className="h-5 w-9 rounded-full border border-border bg-muted transition-colors peer-checked:bg-primary peer-disabled:opacity-50 peer-focus:ring-2 peer-focus:ring-primary peer-focus:ring-offset-1" />
                          <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                        </label>

                        {/* Priority min select — only meaningful when enabled */}
                        <div>
                          <label htmlFor={priorityId} className="sr-only">
                            {t('profile.notificationPreferences.priorityMinLabel')}
                          </label>
                          <select
                            id={priorityId}
                            value={priorityMin}
                            onChange={(e) =>
                              handlePriorityChange(kind, ch, e.target.value as PriorityMin)
                            }
                            disabled={!enabled || setMutation.isPending}
                            className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40"
                          >
                            {PRIORITY_MIN_OPTIONS.map((p) => (
                              <option key={p} value={p}>
                                {t(`profile.notificationPreferences.priorities.${p}`)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-muted">
        {t('profile.notificationPreferences.priorityNote')}
      </p>
    </div>
  );
}
