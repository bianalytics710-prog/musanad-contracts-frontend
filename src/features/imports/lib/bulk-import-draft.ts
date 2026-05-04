/**
 * Musanad — Bulk-import draft persistence (M1c).
 *
 * Persists the user's pre-flight bulk-import configuration (status mode,
 * default counterparty, default contract type, threshold sliders) to
 * localStorage so a refresh mid-config does not lose work.
 *
 * F-FE-M1 envelope shape: { state, _savedAt } with eviction-on-read past
 * DRAFT_TTL_MS. Mirrors the M1b useComposeDraft.ts pattern verbatim — same
 * helper module, different storage key / state shape.
 *
 * NB: We do NOT persist the `File[]` itself. Browsers cannot serialise
 * File objects to localStorage; the user must re-select files after a
 * reload. Only configuration + the in-progress batchId are persisted.
 */

const STORAGE_KEY = "musanad_bulk_import_draft";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

import type {
  ImportBatchStatusMode,
} from "@/types/entities/import-batch.types";

/** What we persist between refreshes. Files cannot be persisted by browsers. */
export interface BulkImportDraftState {
  statusMode: ImportBatchStatusMode;
  defaultContractType: string | null;
  defaultCounterpartyId: number | null;
  /** When set: the user has already initiated a batch and is mid-run. */
  batchId: number | null;
}

interface PersistedDraft {
  state: BulkImportDraftState;
  _savedAt: number;
}

function isPersisted(value: unknown): value is PersistedDraft {
  return (
    typeof value === "object" &&
    value !== null &&
    "_savedAt" in value &&
    typeof (value as { _savedAt: unknown })._savedAt === "number" &&
    "state" in value &&
    typeof (value as { state: unknown }).state === "object" &&
    (value as { state: unknown }).state !== null
  );
}

export function defaultBulkImportDraftState(): BulkImportDraftState {
  return {
    statusMode: "auto",
    defaultContractType: null,
    defaultCounterpartyId: null,
    batchId: null,
  };
}

/**
 * Read with eviction-on-read for stale (>24h) entries AND legacy bare-state
 * entries that lack the F-FE-M1 envelope (FE-R2-001 mitigation — evict
 * legacy keys without restoring; the cost of losing a config is low).
 */
export function readBulkImportDraft(): BulkImportDraftState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);

    if (isPersisted(parsed)) {
      if (Date.now() - parsed._savedAt > DRAFT_TTL_MS) {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Quota / private mode — non-fatal.
        }
        return null;
      }
      return parsed.state;
    }

    // Legacy bare-state shape (pre-envelope) — evict + return null.
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // non-fatal
    }
    return null;
  } catch {
    // Malformed JSON / quota — return null and let caller seed defaults.
    return null;
  }
}

export function writeBulkImportDraft(state: BulkImportDraftState): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: PersistedDraft = { state, _savedAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Quota exceeded — non-fatal; draft simply does not survive refresh.
  }
}

export function clearBulkImportDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // non-fatal
  }
}
