/**
 * M22 / CR-MIG-DRIVE — 9-tile connector grid.
 *
 * - Drive tile (status='available') opens OAuth flow on click.
 * - Other tiles show a tooltip "Available in pilot — contact us" and don't
 *   initiate any flow (AC-14).
 * - Already-connected tiles show a "Connected" pill + click → connections page.
 */
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, Lock } from 'lucide-react';
import { migrationService, type ConnectorCatalogEntry } from '@/services/api/migration.service';
import { Button } from '@/components/ui/button';

interface Props {
  onConnectDrive: () => void;
}

export function ConnectorPickerGrid({ onConnectDrive }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['m22.connectors'],
    queryFn: () => migrationService.listConnectorCatalog(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-surface" />
        ))}
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-error" role="alert">
        {t('admin.migration.picker.error', { defaultValue: 'Could not load connector catalog.' })}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="list"
      aria-label={t('admin.migration.picker.label', { defaultValue: 'Source connectors' })}
    >
      {data.map((c) => (
        <ConnectorTile
          key={c.provider}
          c={c}
          onConnectDrive={onConnectDrive}
          onOpenConnections={() => void navigate({ to: '/app/admin/migration/connections' })}
        />
      ))}
    </div>
  );
}

function ConnectorTile({
  c,
  onConnectDrive,
  onOpenConnections,
}: {
  c: ConnectorCatalogEntry;
  onConnectDrive: () => void;
  onOpenConnections: () => void;
}) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(false);
  const isAvailable = c.status === 'available';
  const isConnected = c.isConnected;

  return (
    <div
      role="listitem"
      className={`relative flex flex-col gap-3 rounded-lg border p-5 transition-shadow ${
        isAvailable ? 'border-border bg-card hover:shadow-md' : 'border-border bg-surface/60'
      }`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-start justify-between gap-3">
        <ProviderLogo provider={c.provider} />
        <StatusPill connected={isConnected} status={c.status} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-ink">{c.displayName}</h3>
        {c.tagline && <p className="mt-1 text-xs text-ink-muted">{c.tagline}</p>}
      </div>
      <div className="mt-auto flex items-center gap-2">
        {isConnected && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenConnections}
            className="gap-1.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            {t('admin.migration.picker.openConnections', { defaultValue: 'Open' })}
          </Button>
        )}
        {!isConnected && isAvailable && (
          <Button type="button" size="sm" onClick={onConnectDrive} className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            {t('admin.migration.picker.connect', { defaultValue: 'Connect' })}
          </Button>
        )}
        {!isAvailable && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-ink-muted">
            <Lock className="h-3 w-3" />
            {t('admin.migration.picker.comingSoon', { defaultValue: 'Coming soon' })}
          </span>
        )}
      </div>
      {!isAvailable && hover && (
        <div
          role="tooltip"
          className="pointer-events-none absolute inset-x-3 -bottom-7 z-10 rounded-md border border-border bg-card px-3 py-1.5 text-[11px] text-ink-muted shadow-md"
        >
          {t('admin.migration.picker.pilotHint', {
            defaultValue: 'Available in pilot — contact us',
          })}
        </div>
      )}
    </div>
  );
}

function StatusPill({ connected, status }: { connected: boolean; status: string }) {
  const { t } = useTranslation();
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-success">
        <CheckCircle2 className="h-3 w-3" />
        {t('admin.migration.picker.statusConnected', { defaultValue: 'Connected' })}
      </span>
    );
  }
  if (status === 'available') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink">
        {t('admin.migration.picker.statusAvailable', { defaultValue: 'Available' })}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-muted">
      {t('admin.migration.picker.statusComing', { defaultValue: 'Soon' })}
    </span>
  );
}

/** Tiny logo placeholder — coloured initials per provider so we don't have to ship 9 SVGs. */
function ProviderLogo({ provider }: { provider: string }) {
  const map: Record<string, { bg: string; fg: string; letter: string }> = {
    google_drive:   { bg: 'bg-[var(--gold)]/15',         fg: 'text-[var(--gold)]',         letter: 'G' },
    sharepoint:     { bg: 'bg-[var(--sage)]/15',         fg: 'text-[var(--sage)]',         letter: 'S' },
    onedrive:       { bg: 'bg-[var(--sage)]/15',         fg: 'text-[var(--sage)]',         letter: 'O' },
    box:            { bg: 'bg-[var(--terracotta)]/15',   fg: 'text-[var(--terracotta)]',   letter: 'B' },
    dropbox:        { bg: 'bg-[var(--sage)]/15',         fg: 'text-[var(--sage)]',         letter: 'D' },
    email_imap:     { bg: 'bg-[var(--gold)]/15',         fg: 'text-[var(--gold)]',         letter: '@' },
    sftp:           { bg: 'bg-[var(--terracotta)]/15',   fg: 'text-[var(--terracotta)]',   letter: 'F' },
    ivalua:         { bg: 'bg-[var(--terracotta)]/15',   fg: 'text-[var(--terracotta)]',   letter: 'I' },
    sap_ariba:      { bg: 'bg-[var(--sage)]/15',         fg: 'text-[var(--sage)]',         letter: 'A' },
  };
  const m = map[provider] ?? { bg: 'bg-surface', fg: 'text-ink-muted', letter: '?' };
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-10 w-10 items-center justify-center rounded-md font-mono text-base font-semibold ${m.bg} ${m.fg}`}
    >
      {m.letter}
    </span>
  );
}
