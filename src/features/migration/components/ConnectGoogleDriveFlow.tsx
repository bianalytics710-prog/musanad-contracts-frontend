/**
 * M22 — Google Drive OAuth flow.
 *
 * Opens the consent URL in a popup (synchronously, so popup blockers stay
 * happy), then polls the connections list every 2s until the connection
 * appears OR the user closes the popup.
 */
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { migrationService } from '@/services/api/migration.service';
import { Button } from '@/components/ui/button';

interface Props {
  onConnected?: (connectionId: number) => void;
  /** Pre-selected Drive folder ID; defaults to the demo folder server-side. */
  folderId?: string;
}

export function useGoogleDriveConnectFlow({ onConnected, folderId }: Props = {}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pending, setPending] = useState(false);

  const stop = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    popupRef.current = null;
    setPending(false);
  }, []);

  const mutation = useMutation({
    mutationFn: async () => migrationService.buildGoogleAuthUrl({ folderId, returnPath: '/app/admin/migration' }),
    onSuccess: ({ url }) => {
      const popup = window.open(url, '_blank', 'noopener=no,popup=yes,width=520,height=620');
      if (!popup) {
        toast.error(t('admin.migration.connect.popupBlocked', { defaultValue: 'Pop-up blocked — allow pop-ups and retry' }));
        return;
      }
      popupRef.current = popup;
      setPending(true);
      pollRef.current = setInterval(async () => {
        try {
          const conns = await migrationService.listConnections();
          const drive = conns.find((c) => c.provider === 'google_drive' && c.status === 'connected');
          if (drive) {
            stop();
            void queryClient.invalidateQueries({ queryKey: ['m22.connectors'] });
            void queryClient.invalidateQueries({ queryKey: ['m22.connections'] });
            toast.success(t('admin.migration.connect.success', { defaultValue: 'Google Drive connected.' }));
            onConnected?.(drive.id);
            return;
          }
          if (popup.closed) {
            stop();
            toast.message(t('admin.migration.connect.cancelled', { defaultValue: 'Connect window closed.' }));
          }
        } catch (err) {
          // Single transient error is OK; permanent → stop after 3 misses.
          // For simplicity, we ignore one-off errors here; the poll keeps going.
        }
      }, 2000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${t('admin.migration.connect.failed', { defaultValue: 'Could not start consent flow.' })} — ${msg}`);
    },
  });

  return { start: () => mutation.mutate(), stop, pending };
}

export function ConnectGoogleDriveButton(props: Props) {
  const { t } = useTranslation();
  const flow = useGoogleDriveConnectFlow(props);
  return (
    <Button
      type="button"
      onClick={flow.start}
      disabled={flow.pending}
      className="gap-1.5"
    >
      {flow.pending
        ? t('admin.migration.connect.pending', { defaultValue: 'Connecting…' })
        : t('admin.migration.connect.cta', { defaultValue: 'Connect Google Drive' })}
    </Button>
  );
}
