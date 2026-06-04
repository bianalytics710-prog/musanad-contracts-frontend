/**
 * M22 / CR-MIG-DRIVE — migration service (FE).
 *
 * Wraps /api/v1/integrations/* + /api/v1/migration/* + /api/v1/admin/migration/*.
 * Per A7: apiClient lives only in the service layer.
 */
import apiClient from '@/lib/api-client';

// ============================================================
// Types
// ============================================================

export type ConnectorStatus = 'available' | 'coming_soon' | 'deprecated';
export type ConnectorProvider =
  | 'google_drive' | 'sharepoint' | 'onedrive' | 'box' | 'dropbox'
  | 'email_imap' | 'sftp' | 'ivalua' | 'sap_ariba';

export interface ConnectorCatalogEntry {
  provider: ConnectorProvider;
  displayName: string;
  tagline: string | null;
  status: ConnectorStatus;
  phase: 1 | 2 | 3;
  logoKey: string | null;
  sortOrder: number;
  isConnected: boolean;
}

export interface ExternalConnection {
  id: number;
  provider: ConnectorProvider;
  displayName: string;
  sourceResourceId: string;
  sourceResourceLabel: string | null;
  oauthScopes: string[] | null;
  connectedByUserId: number | null;
  connectedAt: string;
  lastSyncedAt: string | null;
  oauthExpiresAt: string | null;
  status: 'connecting' | 'connected' | 'token_expired' | 'disconnected' | 'error';
  errorMessage: string | null;
  isActive: boolean;
}

export interface MigrationBatchSummary {
  id: number;
  connectionId: number;
  connectionDisplayName: string;
  connectionProvider: ConnectorProvider;
  triggeredByUserId: number | null;
  triggerKind: 'manual' | 'scheduled' | 'webhook';
  status: 'queued' | 'in_progress' | 'completed' | 'completed_with_errors' | 'rolled_back' | 'failed';
  filesDiscovered: number;
  filesImported: number;
  filesReview: number;
  filesFailed: number;
  filesSkippedDuplicate: number;
  startedAt: string;
  completedAt: string | null;
  rolledBackAt: string | null;
}

export interface MigrationRecord {
  id: number;
  sourceFileId: string;
  sourceFileName: string | null;
  sourceFileMime: string | null;
  sourceFileSizeBytes: number | null;
  sourceFileModifiedAt: string | null;
  sourceFileSha256: string | null;
  status: string;
  duplicateOfRecordId: number | null;
  contractId: number | null;
  contractVersionId: number | null;
  ingestionReviewQueueId: number | null;
  confidenceScoreAvg: string | null;
  extractedFieldCount: number | null;
  errorMessage: string | null;
  importedAt: string | null;
  createdAt: string;
}

export interface PurgePreview {
  dryRun: boolean;
  counts: Record<string, number>;
  totalRows: number;
}

// ============================================================
// Service
// ============================================================

export const migrationService = {
  // Catalog + connections
  async listConnectorCatalog(): Promise<ConnectorCatalogEntry[]> {
    const r = await apiClient.get<{ success: boolean; data: ConnectorCatalogEntry[] }>(
      '/api/v1/integrations/connectors',
    );
    return r.data.data;
  },
  async listConnections(): Promise<ExternalConnection[]> {
    const r = await apiClient.get<{ success: boolean; data: ExternalConnection[] }>(
      '/api/v1/integrations/connections',
    );
    return r.data.data;
  },
  async disconnect(id: number): Promise<void> {
    await apiClient.delete(`/api/v1/integrations/connections/${id}`);
  },

  // Google Drive OAuth
  async buildGoogleAuthUrl(args: { returnPath?: string; folderId?: string }): Promise<{ url: string; state: string }> {
    const r = await apiClient.post<{ success: boolean; data: { url: string; state: string } }>(
      '/api/v1/integrations/google-drive/auth-url',
      args,
    );
    return r.data.data;
  },

  // Batches
  async createBatch(connectionId: number): Promise<{ id: number }> {
    const r = await apiClient.post<{ success: boolean; data: { id: number } }>(
      '/api/v1/migration/batches',
      { connectionId },
    );
    return r.data.data;
  },
  async listBatches(args: { limit?: number; offset?: number } = {}): Promise<{ rows: MigrationBatchSummary[]; total: number }> {
    const r = await apiClient.get<{ success: boolean; data: { rows: MigrationBatchSummary[]; total: number } }>(
      '/api/v1/migration/batches',
      { params: args },
    );
    return r.data.data;
  },
  async getBatch(id: number): Promise<MigrationBatchSummary> {
    const r = await apiClient.get<{ success: boolean; data: MigrationBatchSummary }>(
      `/api/v1/migration/batches/${id}`,
    );
    return r.data.data;
  },
  async listBatchRecords(id: number, args: { status?: string; limit?: number; offset?: number } = {}): Promise<{ rows: MigrationRecord[]; total: number }> {
    const r = await apiClient.get<{ success: boolean; data: { rows: MigrationRecord[]; total: number } }>(
      `/api/v1/migration/batches/${id}/records`,
      { params: args },
    );
    return r.data.data;
  },
  async getBatchProgress(id: number): Promise<{
    status: string;
    terminal: boolean;
    counts: { discovered: number; imported: number; review: number; failed: number; skippedDuplicate: number };
  }> {
    const r = await apiClient.get<{ success: boolean; data: {
      status: string;
      terminal: boolean;
      counts: { discovered: number; imported: number; review: number; failed: number; skippedDuplicate: number };
    } }>(`/api/v1/migration/batches/${id}/progress`);
    return r.data.data;
  },
  async rollbackBatch(id: number, reason: string): Promise<{ contractsRolledBack: number; batchId: number }> {
    const r = await apiClient.post<{ success: boolean; data: { contractsRolledBack: number; batchId: number } }>(
      `/api/v1/migration/batches/${id}/rollback`,
      { reason, confirmToken: `ROLLBACK_BATCH_${id}` },
    );
    return r.data.data;
  },
  async getCoverageReport(id: number): Promise<unknown> {
    const r = await apiClient.get<{ success: boolean; data: unknown }>(
      `/api/v1/migration/batches/${id}/coverage-report`,
    );
    return r.data.data;
  },

  // Purge (admin)
  async purgePreview(): Promise<PurgePreview> {
    const r = await apiClient.post<{ success: boolean; data: PurgePreview }>(
      '/api/v1/admin/migration/purge-all/preview',
      {},
    );
    return r.data.data;
  },
  async purgeExecute(confirmToken: string): Promise<PurgePreview> {
    const r = await apiClient.post<{ success: boolean; data: PurgePreview }>(
      '/api/v1/admin/migration/purge-all',
      { confirmToken, acknowledgementChecked: true },
    );
    return r.data.data;
  },
};
