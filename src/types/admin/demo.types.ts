/**
 * M10 / CR-C — Demo data purge types (FE adapter).
 * Source: .claude/workspace/current-module/types.ts § 3
 */

export type DataClassification = 'demo' | 'pilot' | 'production';

export const DATA_CLASSIFICATIONS: ReadonlyArray<DataClassification> = [
  'demo',
  'pilot',
  'production',
] as const;

export interface DemoPurgeRequest {
  confirmToken?: string;
  dryRun?: boolean;
}

export interface DemoPurgeDetailRow {
  tableName: string;
  rowsDeleted: number;
}

export interface DemoPurgeResult {
  success: true;
  tablesPurged: string[];
  rowsDeleted: number;
  details: Record<string, number>;
  dryRun: boolean;
}

export interface DataClassificationSummaryRow {
  tableName: string;
  demo: number;
  pilot: number;
  production: number;
  total: number;
}

export interface DataClassificationSummary {
  summary: DataClassificationSummaryRow[];
  totals: {
    demo: number;
    pilot: number;
    production: number;
    total: number;
  };
}
