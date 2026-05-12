# M11 / CR-D0 — Document Ingestion Pipeline — Frontend

Generated: 2026-05-12T00:00:00Z
Status: Complete — shipped 2026-05-12

---

## Pages

| Page | Route | Auth | Permission | Description |
|---|---|---|---|---|
| Admin Ingestion Queue | `/app/admin/ingestion-queue` | Protected | `document.review` OR `ingestion_queue.read` | Paginated queue of low-confidence OCR pages awaiting human review. platform_admin + legal_counsel + Super Admin only. |
| Contract Detail (extended) | `/app/contracts/:id` | Protected | `contract.read.*` (any) | Existing page extended with `DocumentTabExtension` component in the Attachments tab area. No new route file — extension is conditional inside `contracts.$id.tsx`. |

---

## Components and State

### admin.ingestion-queue.tsx

**Route file**: `src/routes/app/admin.ingestion-queue.tsx`
**Purpose**: Ingestion review queue — admin monitor of all low-confidence pages awaiting confirm/correct/reject.

**API calls**:

| Service method | Endpoint | When called |
|---|---|---|
| `adminIngestionQueueService.list(params)` | `GET /api/v1/admin/ingestion-queue` | On mount; when filter chips change; on pagination change |
| `adminIngestionQueueService.resolve(id, payload)` | `POST /api/v1/admin/ingestion-queue/:id/resolve` | When reviewer clicks Confirm / Correct / Reject in IngestionReviewPanel |

**React Query**:

| Query key | Purpose | Invalidated by |
|---|---|---|
| `['admin-ingestion-queue', filters]` | Paginated review queue list | resolve mutation success |

**Key state**: `reviewStatus` filter chip (All / pending_auto / pending_human / resolved / rejected); pagination (page, limit); `selectedQueueId` (opens IngestionReviewPanel panel).

---

### IngestionStatusBadge.tsx

**File**: `src/components/contracts/IngestionStatusBadge.tsx`
**Purpose**: Inline badge displaying current ingestion status with a 3 s polling loop while status is `pending` or `extracting`. Stops polling on terminal status (`complete`, `failed`, `partial`).

**API calls**:

| Service method | Endpoint | When called |
|---|---|---|
| `documentIngestionService.getStatus(contractId, versionId)` | `GET /api/v1/contracts/:id/versions/:vId/ingestion-status` | On mount (immediate) + every 3 s while status is pending or extracting |

**React Query**:

| Query key | Purpose | Invalidated by |
|---|---|---|
| `['ingestion-status', contractId, versionId]` | Ingestion status poll | Manual invalidation after manual ingest trigger; natural stale on refetchInterval |

**Key state**: `refetchInterval` — set to `3000` when `ingestionStatus IN ('pending', 'extracting')`, `false` otherwise (stops polling).

**Status display**:

| ingestionStatus | Badge text (EN) | Badge colour |
|---|---|---|
| `pending` | Pending extraction | neutral |
| `extracting` | Extracting... | blue / animated |
| `complete` | Extracted in Xs · Y pages · engine | green |
| `failed` | Extraction failed | red |
| `partial` | Partially extracted | amber |

---

### DocumentTabExtension.tsx

**File**: `src/components/contracts/DocumentTabExtension.tsx`
**Purpose**: Extension panel within the Contract Detail Attachments tab. Conditionally rendered only when the contract has a current_version_id with ingestion data. Shows the IngestionStatusBadge, a "View extracted text" button (triggers signed URL fetch), and a `lowConfidencePageCount` indicator.

**API calls**:

| Service method | Endpoint | When called |
|---|---|---|
| `documentIngestionService.getSignedUrl(contractId, versionId)` | `GET /api/v1/contracts/:id/versions/:vId/extracted-text` | On "View extracted text" click (lazy — not on mount) |

**React Query**:

| Query key | Purpose | Invalidated by |
|---|---|---|
| `['extracted-text-url', contractId, versionId]` | Signed URL for extracted text artifact | Automatic on stale (staleTime: 50_000 ms — 10 s margin before 60 s TTL) |

**Key state**: `showExtractedText` (boolean — controls the text viewer modal).

**Important**: The `extractedTextUri` Storage path is never exposed in the UI. Only the signed URL returned by the BE is shown / used. The signed URL is cached in React Query with `staleTime: 50_000` (50 s) so re-opens within the TTL window skip the re-fetch. After 50 s, a new signed URL is fetched automatically.

---

### IngestionReviewPanel.tsx

**File**: `src/components/admin/IngestionReviewPanel.tsx`
**Purpose**: Full review panel for a single ingestion_review_queue row. Opened from the admin queue list. Shows Tesseract confidence, Tesseract text (if present), gpt-4o text (if Vision ran), and action buttons (Confirm / Correct / Reject).

**Note on sensitive field exposure**: `tesseract_text` and `gpt4o_text` are excluded from the `fn_ingestion_review_queue_list` response (list endpoint sensitivity control). The panel fetches a separate detail endpoint (or receives them from a focused `GET /admin/ingestion-queue/:id` call) when opened — full text only shown in the review context, never in the list.

**useFocusTrap**: Wired consistent with all destructive/review modals in the app (M3 SignatureDialog, CR-C DemoPurgePanel pattern).

**Actions**:

- **Confirm** → `{ action: 'confirm' }` → final_text = COALESCE(gpt4o_text, tesseract_text); status = resolved.
- **Correct** → `{ action: 'correct', correctedText: '<reviewer input>' }` → final_text = correctedText; status = resolved. Requires non-empty `correctedText` (validated client-side + server-side).
- **Reject** → `{ action: 'reject' }` → final_text = NULL; status = rejected.

On success: invalidates `['admin-ingestion-queue', ...]` query; closes panel; shows success toast.

---

## Service Layer

### document-ingestion.service.ts

File: `src/services/document-ingestion.service.ts`

| Method | Endpoint | Returns | Note |
|---|---|---|---|
| `getStatus(contractId, versionId)` | `GET /api/v1/contracts/:id/versions/:vId/ingestion-status` | `IngestionStatus` | Uses `unwrap<IngestionStatus>()` — BE wraps in `{success, data, requestId}` envelope. |
| `getSignedUrl(contractId, versionId)` | `GET /api/v1/contracts/:id/versions/:vId/extracted-text` | `SignedUrlResponse` | Uses `unwrap<SignedUrlResponse>()`. Returns 409 if status not `complete`. |
| `triggerManualIngest(contractId, versionId)` | `POST /api/v1/contracts/:id/versions/:vId/ingest` | `IngestTriggerResponse` | Uses `unwrap<IngestTriggerResponse>()`. Super Admin only. |

### admin-ingestion-queue.service.ts

File: `src/services/admin-ingestion-queue.service.ts`

| Method | Endpoint | Returns | Note |
|---|---|---|---|
| `list(params)` | `GET /api/v1/admin/ingestion-queue` | `{ data: QueueItem[], pagination }` | Bare `return data` — BE spreads pagination envelope directly (not wrapped). |
| `resolve(id, payload)` | `POST /api/v1/admin/ingestion-queue/:id/resolve` | `ResolveResponse` | Uses `unwrap<ResolveResponse>()`. |

**Critical pattern note**: `list()` uses bare `return data` because the BE controller spreads the fn_ pagination output (`{ data: [...], pagination: {...} }`) directly in the response body. All other CR-D0 service methods use `unwrap<T>()` because the BE wraps the response in `{ success: true, data: T, requestId }`. Mixing these incorrectly was BR1-equivalent (CRITICAL) defect caught during FE integration.

---

## TypeScript Types

### document-ingestion.types.ts

From `src/types/document-ingestion.types.ts`:

| Type | Description |
|---|---|
| `ExtractionEngine` | Union enum: `'digital_pdf' \| 'tesseract' \| 'gpt4o_vision' \| 'mammoth_docx' \| 'mixed'` |
| `IngestionStatus` | Response shape from GET /ingestion-status: contractVersionId, ingestionStatus, pageCount, ocrUsed, ocrConfidenceAvg, extractionEngine, extractedAt, lowConfidencePageCount |
| `SignedUrlResponse` | Response shape from GET /extracted-text: signedUrl, expiresAt, extractionEngine, pageCount, ocrConfidenceAvg |
| `IngestTriggerResponse` | Response from POST /ingest: contractVersionId, ingestionStatus, queuedAt, alreadyInProgress |

### admin-ingestion-queue.types.ts (FE)

From `src/types/document-ingestion.types.ts` (also used for admin surfaces):

| Type | Description |
|---|---|
| `ReviewStatus` | Union enum: `'pending_auto' \| 'pending_human' \| 'resolved' \| 'rejected'` |
| `QueueItem` | Single ingestion_review_queue row from list endpoint (excludes tesseract_text + gpt4o_text) |
| `ResolvePayload` | `{ action: 'confirm' \| 'correct' \| 'reject'; correctedText?: string }` |
| `ResolveResponse` | `{ queueId, reviewStatus, finalText, reviewedAt }` |
| `M11_SENSITIVE_FIELD_EXTENSIONS` | Array of 11 Pino redact path strings (both snake_case + camelCase variants) for logger.util.ts |

---

## i18n Keys Added

Total: **69 keys** added to both `en.json` and `ar.json`. **4995/4995 parity** verified post-implementation.

Key namespaces:

| Namespace | Key count | Example keys |
|---|---|---|
| `contracts.ingestion.*` | ~24 | `contracts.ingestion.statusBadge.extracting`, `contracts.ingestion.statusBadge.complete`, `contracts.ingestion.viewExtractedText`, `contracts.ingestion.lowConfidencePages`, `contracts.ingestion.engine.*` |
| `admin.ingestionQueue.*` | ~28 | `admin.ingestionQueue.title`, `admin.ingestionQueue.filterAll`, `admin.ingestionQueue.filterPendingAuto`, `admin.ingestionQueue.filterPendingHuman`, `admin.ingestionQueue.filterResolved`, `admin.ingestionQueue.filterRejected`, `admin.ingestionQueue.resolvePanel.*`, `admin.ingestionQueue.actions.*` |
| `common.extractionEngine.*` | ~5 | `common.extractionEngine.digital_pdf`, `common.extractionEngine.tesseract`, `common.extractionEngine.gpt4o_vision`, `common.extractionEngine.mammoth_docx`, `common.extractionEngine.mixed` |
| `common.*` (additions) | ~12 | Various shared keys for confidence display, page count formatting, and review action labels |

---

## Key UI Decisions

1. **Polling stops on terminal status**: `IngestionStatusBadge` sets `refetchInterval: false` when `ingestionStatus` is `complete`, `failed`, or `partial`. Polling only runs during `pending` and `extracting`. This prevents unnecessary API calls once extraction is done and avoids infinite polling loops that plagued earlier M4 AI insight components.

2. **Sensitive fields excluded from list endpoint**: `tesseract_text` and `gpt4o_text` are not returned by the admin queue list endpoint (`fn_ingestion_review_queue_list` deliberately omits them). Only when a reviewer opens a specific queue item does the full text appear — consistent with the principle that sensitive contract content is exposed on a need-to-see basis, not in bulk list views.

3. **Envelope unwrap is mandatory for all single-resource service calls**: The BE uses `{ success: true, data: T, requestId }` wrapping for all non-list endpoints. CR-D0 exposed that using naked `return response.data` returns the wrapper object, not the inner entity, causing polling to never terminate. All CR-D0 services now use `unwrap<T>(response.data)` (the M4 pattern). Developers extending document-ingestion services must apply the same pattern.

4. **Signed URL stale time at 50 s**: Supabase Storage signed URLs have a 60 s TTL. `staleTime: 50_000` (50 s) gives a 10 s refetch buffer before expiry. Setting `staleTime` too high risks serving an expired URL; too low causes unnecessary re-fetches. 50 s was chosen as the safe midpoint.

5. **Arabic text direction in extracted content viewer**: When displaying extracted text in the `DocumentTabExtension` modal, the component applies `dir="auto"` on the text container. This allows the browser's bidi algorithm to handle mixed EN/AR content correctly without requiring the FE to detect language. Consistent with how `body_ar` content is displayed elsewhere in the contract detail.

---

## Files Owned by This Module

**Frontend routes**:
- `src/routes/app/admin.ingestion-queue.tsx`

**Frontend components (new)**:
- `src/components/contracts/DocumentTabExtension.tsx`
- `src/components/contracts/IngestionStatusBadge.tsx`
- `src/components/admin/IngestionReviewPanel.tsx`

**Frontend services**:
- `src/services/document-ingestion.service.ts`
- `src/services/admin-ingestion-queue.service.ts`

**Frontend types**:
- `src/types/document-ingestion.types.ts`

**Frontend tests**:
- `tests/e2e/CR-D0-upload-extraction.spec.ts` (7 tests; 6 PASS / 1 SKIP — live fixture absent)
- `tests/e2e/CR-D0-admin-ingestion-queue.spec.ts` (10 tests; 6 PASS / 4 FAIL — INFRA-1 auth hydration race, pre-existing)
- `tests/e2e/CR-D0-document-tab.spec.ts` (5 tests; 2 PASS / 3 soft-skip — no contract_version rows in test branch)

**Frontend i18n (extended)**:
- `src/locales/en.json` (+69 keys)
- `src/locales/ar.json` (+69 keys, Arabic translations)

**Frontend modified**:
- `src/routes/app/contracts.$id.tsx` (DocumentTabExtension mounted in Attachments tab)
- App sidebar (Ingestion queue entry under Admin section, platform_admin gate)

---

*Generated: 2026-05-12 | Agent 15 — Documentation Generator | Source: after-state.md, module-M11-test-report.md, decisions/M11.json, BE route + controller files*
