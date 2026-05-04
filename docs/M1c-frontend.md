# M1c — Bulk & Manual Import — Frontend

> **Project:** Musanad Contracts Hub (`musanad-contracts-frontend`)
> **Module:** M1c — Bulk & Manual Import (third sub-module of M1; M0 + M1a + M1b complete and shipped).
> **Generated:** 2026-05-03.
> **Pipeline:** Lovable Modernization v3.2, Mode A (Lovable only). Harden Mode (FE preserve-stack).
> **Status:** Complete. tsc clean (0 errors, full FE codebase). All 5 hardening cycles passed first attempt — 0 regenerate fallbacks.
> **Codex FE round 1:** DEFERRED to CRX-9 — quota exhausted 2026-05-03. Lessons preemptively embedded; rerun from this repo when quota resets ~2026-05-09.

This document is the FE-specific handoff for the developer extending M1c on the frontend. For the BE-side handoff see [`musanad-contracts-backend/docs/M1c-technical-handoff.md`](../../musanad-contracts-backend/docs/M1c-technical-handoff.md). For the OpenAPI surface see [`musanad-contracts-backend/docs/api/openapi.yaml`](../../musanad-contracts-backend/docs/api/openapi.yaml).

---

## 1. Routes (TanStack Start file-based — 5 added)

The FE repo uses TanStack Start file-based routing without underscore-prefixed segments. Lovable's routes lived under `src/routes/_app/`; the v2.6 routes live under `src/routes/app/`. All 4 hardened pages keep their original paths:

| Route file | URL | Story | Source (Lovable) | Fate |
|---|---|---|---|---|
| `src/routes/app/imports.bulk.tsx` | `/app/imports/bulk` | S5 | `src/routes/_app/import.bulk.tsx` (1195 lines) | rebuilt-preserving-visual-idiom |
| `src/routes/app/imports.review-queue.tsx` | `/app/imports/review-queue` | S6 | `src/routes/_app/import.review-queue.tsx` | rebuilt-preserving-visual-idiom |
| `src/routes/app/imports.manual-entries.tsx` | `/app/imports/manual-entries` | S7 | `src/routes/_app/import.manual-entries.tsx` | rebuilt-preserving-visual-idiom |
| `src/routes/app/admin.imports.tsx` | `/app/admin/imports` | S3 | `src/routes/_app/admin.imports.tsx` | rebuilt-preserving-visual-idiom |
| `src/routes/app/admin.imports.$batchId.tsx` | `/app/admin/imports/$batchId` | S4 | _(none — built fresh)_ | regenerate-fresh-no-counterpart |

`routeTree.gen.ts` was auto-regenerated via `@tanstack/router-cli` to register all 5 new routes.

---

## 2. Components (5 hardened from Lovable + 1 regenerated)

| Component | File | Story | Fate | Cycle | Transformations applied |
|---|---|---|---|---|---|
| BulkImportView | `src/features/imports/components/BulkImportView.tsx` | S5 | hardened from Lovable | 1 | T1, T2, T3, T4, T5, T6, T7, T8, T9, T11, T12, T13 (T10 skipped — no search input on this view; debounce applied via useDebounce on the bulk-import draft persistence) |
| ReviewQueueView | `src/features/imports/components/ReviewQueueView.tsx` | S6 | hardened from Lovable | 1 | T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13 (all 13) |
| ManualEntriesView | `src/features/imports/components/ManualEntriesView.tsx` | S7 | hardened from Lovable | 1 | T1, T2, T3, T4, T5, T6, T7, T10, T11, T12, T13 (T8 skipped — list view; manual-entry form is M1a `/app/contracts/new`. T9 skipped — no destructive actions; drafts are completed, not deleted) |
| AdminImportsListView | `src/features/imports/components/AdminImportsListView.tsx` | S3 | hardened from Lovable | 1 | T1, T2, T3, T4, T5, T6, T7, T11, T12, T13 (T8/T9/T10 skipped — list view, no forms / no destructive actions / no free-text search yet) |
| AdminImportBatchDetailView | `src/features/imports/components/AdminImportBatchDetailView.tsx` | S4 | regenerated-fresh-no-counterpart | 1 | T1, T2, T3, T4, T5, T6, T7, T9, T11, T12, T13 (T8 skipped — detail view, no editable form. T10 skipped — no search inputs) |
| ConfirmDialog (shared modal) | `src/features/imports/components/ConfirmDialog.tsx` | shared | hardened from Lovable | 1 | T3, T5, T6, T7, T9, T11 (T1/T2/T4/T8/T10/T12/T13 skipped — pure UI primitive; no data layer / fetching / states / form / search / date / sensitive) |

**0 regenerate fallbacks** — the 5 Lovable counterparts cleared all required transforms on cycle 1. AdminImportBatchDetailView is the only "regenerated" component, but only because it has no Lovable counterpart (S4 drill-down is new in v2.6). All work conformed to v2.6 standards on first build.

---

## 3. 13-item Harden Checklist — applied per component

| ID | Transform | Coverage in M1c |
|---|---|---|
| T1 | Data layer extraction (services + hooks; no fetch in components) | All 5 hardened components route through `src/services/api/import-batch.service.ts` (S1–S4) and `src/services/api/extract-contract-bulk.service.ts` (S8) via `apiClient` (axios + JWT interceptors). BulkImportView uses `apiClient.post` once for the inline-loop fn_contract_create per design (line 1177) — no raw fetch anywhere. |
| T2 | React Query wrapping | `useImportBatches` (list, getById, create, update mutations); `useReviewQueue` (M1a contract list with confidenceMin/Max + status='draft'); inline `useQuery`/`useMutation` for ad-hoc per-component reads. Invalidations chained — create/update batch → invalidates list + getById; M1a contract update/delete in ReviewQueueView → invalidates contract list + review queue. |
| T3 | i18n keys (no hardcoded strings) | 151 EN + 151 AR keys added. All visible strings in JSX use `t('...')`. Spot-check verified in QA Stage 4 C6 — no hardcoded UI strings in any M1c .tsx file. |
| T4 | Three data states (loading / empty / error) | Every data-fetching component shows isLoading skeleton, isError envelope with retry (translateApiError), and empty-state with title/description. ReviewQueueView, AdminImportsListView, AdminImportBatchDetailView, ManualEntriesView all wired. |
| T5 | Token replacement (semantic Tailwind tokens only) | All Lovable hex/rgb usages replaced with M0 design-system semantic tokens (`bg-card`, `text-muted-foreground`, etc.). |
| T6 | Accessibility | Labels on form inputs; aria-label on icon-only buttons (retry, approve/reject, pause/resume/cancel). Modal keyboard navigation provided by Radix Dialog primitives via shadcn (focus trap + Escape close + focus return). |
| T7 | Type safety (`any` removed) | No `any` types in any M1c .ts/.tsx file (QA Stage 4 A4 verified). FE types in `src/types/entities/import-batch.types.ts` mirror BE types verbatim. |
| T8 | Form hygiene (submit disabled during mutation) | BulkImportView startImport guarded by useDoubleSubmitLock; ReviewQueueView onBulkApprove guarded by useDoubleSubmitLock. ManualEntriesView delegates to M1a `/app/contracts/new` (already T8-hardened in M1a). |
| T9 | Destructive confirmation | ConfirmDialog wraps every reject / cancel / soft-delete action. Used by ReviewQueueView reject (AC-S6-05), BulkImportView cancel-batch, AdminImportBatchDetailView cancel-batch. |
| T10 | Debounce on search | ReviewQueueView, ManualEntriesView use `useDebounce(searchInput, 300)`. BulkImportView uses `useDebounce(draft, 300)` for the localStorage-persisted draft. All from `@/hooks/useDebounce`. |
| T11 | Error boundary on routes | Two layers: TanStack Router `defaultErrorComponent` at the router level (`DefaultErrorComponent` in `router.tsx`) AND each M1c route file wraps its View component in `<ErrorBoundary>` from `@/components/common`. |
| T12 | Date/time handling (formatDateTime, Asia/Dubai) | AdminImportsListView and AdminImportBatchDetailView import `formatDateTime` from `@/utils/datetime` and use it for `startedAt` / `completedAt`. No `new Date()` / `.toLocaleDateString()` / dayjs in any M1c component. |
| T13 | Sensitive field protection | `extractedText` is sent to BE via `apiClient` only; never logged client-side; never persisted to localStorage. The bulk-import draft (`bulk-import-draft.ts`) deliberately persists ONLY config + batchId — no extracted text, no body text. |

---

## 4. i18n keys added (151 EN + 151 AR)

Total keys after merge: **3413 EN / 3413 AR** (was 3262 / 3262). EN/AR parity verified at sign-off. Modern Standard Arabic for all AR keys.

| Namespace | Approx count | Purpose |
|---|---|---|
| `import.bulk.*` | ~50 | BulkImportView (drop zone, file list, processing screen, completion summary, pause/resume/cancel controls). Includes `import.bulk.status.*`, `import.bulk.actions.*`, `import.bulk.summary.*`. |
| `import.review.*` | ~35 | ReviewQueueView (filters, confidence range, table headers, inline-edit form labels, approve/reject toasts). Includes `import.review.col.*`, `import.review.confirm*`. |
| `import.manual.*` | ~15 | ManualEntriesView (list of low-confidence drafts, link to M1a manual entry form). |
| `admin.imports.*` | ~40 | AdminImportsListView + AdminImportBatchDetailView (status pills, counter labels, filter selects, drill-down detail rows). Includes `admin.imports.status.*`, `admin.imports.detail.*`. |
| `errors.import.*` | ~11 | Translation map for BE error envelope codes (counter underflow / overflow, invalid status transition, FK violation, duplicate detected). Wired through `translateApiError`. |

---

## 5. Browser-side text extraction (mammoth + pdfjs)

**Per AC-S5-02 / HQ1: extraction runs in the browser.** The backend never sees the file bytes — only the already-extracted text + filename + size.

**File:** `src/features/imports/lib/extract-text.ts`

- DOCX: `mammoth.extractRawText({ arrayBuffer })` — returns plain text. Mammoth is browser-bundled (added a TypeScript ambient declaration `src/types/mammoth-browser.d.ts` because the published `@types/mammoth` cover the Node bundle, not the browser entry).
- PDF: `pdfjs-dist` — pages are iterated and text content concatenated (`getTextContent().items.map(i => i.str).join(' ')`). Worker is loaded from the public CDN at the version pinned in `package.json` to avoid bundling the worker chunk in the main app bundle.
- Plaintext: passthrough.
- Failure envelope: `TextExtractionError` carries `{ kind: 'unsupported' | 'corrupt' | 'too-large' | 'empty', filename, originalError? }` so callers can route per-kind warnings into the per-file processing log without exposing raw exceptions to the UI.

The Lovable original used `any`-typed dynamic imports; v2.6 narrows the surface to a typed shape and adds the error envelope.

---

## 6. Direct-to-Supabase Storage upload (HQ1 ratified)

**File:** `src/features/imports/lib/upload-to-storage.ts`

- Per HQ1, originals are uploaded straight to the existing Supabase 'contracts' bucket via `@supabase/supabase-js` (added to `package.json`). No BE storage abstraction; no attachment table; backend receives only filename + extracted text.
- **Best-effort, non-blocking.** When `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are unset (e.g. local dev without Supabase), `uploadToStorage` returns `null` and the import proceeds with filename-only metadata (`contract.import_filename`). No UX regression — users never see an error toast for missing storage.
- Real attachment integration deferred to a future Attachments module per Q2b. The bucket reference and filename stay on `contract.import_filename` so a future module can stitch attachments back to existing contracts.

---

## 7. State management approach

| Concern | Tool | Reason |
|---|---|---|
| Server state (batches, contracts, lists) | React Query (`@tanstack/react-query`) | M0/M1a/M1b precedent. Cache + invalidations + Suspense-ready. |
| UI state (filter selects, debounce state, modal toggles) | Local component `useState` / `useReducer` | Simple per-view state. |
| Cross-page bulk-import draft (config + batchId, NOT files) | `localStorage` with TTL envelope (24h) | Per F-FE-M1 lesson — every localStorage key uses `{ value, savedAt }` envelope and evicts on read past TTL. Legacy bare-state entries (pre-envelope) are evicted on read without restoration (FE-R2-001 lesson). |
| Auth / user / permission flags | Zustand store (`src/store/auth.store.ts`) | M0 inheritance. |
| Route state (selected batch id, page) | TanStack Router search params | M0 / M1a / M1b precedent. |

**Key file:** `src/features/imports/lib/bulk-import-draft.ts` — `readBulkImportDraft` + `writeBulkImportDraft` with `DRAFT_TTL_MS = 24h`, eviction-on-read for both expired entries AND legacy bare-state entries (FE-R2-001).

**Resume after refresh — limitations.** Browsers cannot persist `File` handles to localStorage. The bulk-import draft preserves config + batchId across refreshes; the user is shown a toast hint to re-select the same files to continue an interrupted batch. The batch status remains `in_progress` on the BE and can be cancelled or completed via the admin drill-down view.

---

## 8. Codex FE lessons embedded (5)

These five lessons from prior Codex FE rounds were proactively embedded in M1c's FE code. CRX-9 (FE Codex round 1 — deferred) may surface incremental findings; lesson coverage is already strong.

| ID | Lesson | Where applied |
|---|---|---|
| **F-FE-001** | NEVER use raw `fetch()` — always go through `apiClient`. | `src/services/api/import-batch.service.ts`, `src/services/api/extract-contract-bulk.service.ts`, `src/features/imports/components/BulkImportView.tsx` `processOne` (uses `apiClient.post` for inline-loop fn_contract_create). |
| **F-FE-002** | Synchronous double-submit lock on Enter / double-click trigger surfaces. | `src/features/imports/hooks/useDoubleSubmitLock.ts` (NEW helper); `BulkImportView.startImport()` (line 165: `const startLock = useDoubleSubmitLock()`); `ReviewQueueView.onBulkApprove()` (line 91: `const bulkLock = useDoubleSubmitLock()`). |
| **F-FE-M1** | localStorage drafts MUST have a TTL envelope `{ value, savedAt }` and eviction-on-read. | `src/features/imports/lib/bulk-import-draft.ts` — `DRAFT_TTL_MS = 24h`, `_savedAt` timestamp, eviction-on-read. |
| **F-FE-M2** | Translate all API errors via `translateApiError`; never display raw `err.response.data`. | All toasts in BulkImportView, ReviewQueueView, ManualEntriesView, AdminImportsListView, AdminImportBatchDetailView use `translateApiError(err, t, fallbackKey)`. |
| **FE-R2-001** | Legacy localStorage drafts (pre-envelope shape) must be evicted on read. | `bulk-import-draft.ts.readBulkImportDraft` removes legacy bare-state entries without restoring. |

---

## 9. FE Codex round 1 deferred — CRX-9

**Status.** BLOCKED 2026-05-03 — Codex quota exhausted during BE round-1 follow-up patches (021/022 + pino redact extension). The FE Codex review is deferred as **CRX-9** to be run from this FE repo when quota resets (estimated ~2026-05-09).

**To run CRX-9 when quota resets:**

```bash
cd C:/Users/azureadmin/projects/musanad-contracts/musanad-contracts-frontend
# from inside the FE repo (Codex picks up CWD as the review scope):
/codex:adversarial-review
```

Pair every Codex review with a follow-up writer/patch agent — the Codex sandbox is read-only via `codex:codex-rescue` (it returns findings inline but cannot write review files).

---

## 10. Service layer

### `src/services/api/import-batch.service.ts`

| Method | Endpoint | Description |
|---|---|---|
| `createImportBatch(data)` | POST `/api/v1/import-batches` | S1 — create batch with totalFiles + config. |
| `updateImportBatch(id, patch)` | PATCH `/api/v1/import-batches/:id` | S2 — apply counter deltas + lifecycle status transitions. |
| `listImportBatches(query)` | GET `/api/v1/import-batches` | S3 — paginated, role-aware. |
| `getImportBatchById(id)` | GET `/api/v1/import-batches/:id` | S4 — full ImportBatch with hydrated initiatedBy UserRef. |

### `src/services/api/extract-contract-bulk.service.ts`

| Method | Endpoint | Description |
|---|---|---|
| `extractContractBulk(payload)` | POST `/api/v1/ai/extract-contract-bulk` | S8 — AI extraction stub. Sends extractedText + filename + fileSize + batchId. Returns deterministic mock `ExtractContractBulkResponse`. **NEVER logs `extractedText` client-side.** |

The service uses the existing `apiClient` (axios) — same interceptor chain as M0/M1a/M1b (JWT injection, 401 → redirect, X-Request-ID propagation).

### Reused services (M1a)

| Method | Endpoint | Used by M1c |
|---|---|---|
| `contractService.list(query)` | GET `/api/v1/contracts` | S4 admin drill-down (importBatchId filter); S6 review queue (importConfidenceMin/Max + status='draft' + admin-side reverse-sort for "oldest first" per AC-S6-01). |
| `contractService.create(data)` | POST `/api/v1/contracts` | S5 auto-save track; S7 manual entry submit. Sends 4 new optional import-trace fields. |
| `contractService.update(id, data)` | PUT `/api/v1/contracts/:id` | S6 inline edit in review queue (AC-S6-03). |
| `contractService.delete(id)` | DELETE `/api/v1/contracts/:id` | S6 reject in review queue (AC-S6-05). |
| `contractService.updateStatus(id, status)` | PUT `/api/v1/contracts/:id/status` | S6 approve transition draft → active when batch.config.statusMode='active' (AC-S6-04). |

---

## 11. TypeScript types added / extended

### Added (M1c-owned, mirroring BE)

`src/types/entities/import-batch.types.ts`:

- `ImportBatch` — full shape with hydrated `initiatedBy: UserRef`.
- `ImportBatchListItem` — lighter list shape with raw bigint `initiatedBy`.
- `ImportBatchConfig` — `{ contractType?, statusMode, defaultCounterpartyId? }`.
- `ImportBatchStatus` — `'in_progress' | 'paused' | 'completed' | 'cancelled'`.
- `ImportBatchStatusMode` — `'active' | 'draft' | 'auto'`.
- `CreateImportBatchDto`, `UpdateImportBatchDto`, `ImportBatchListQuery`.
- `ExtractContractBulkRequest`, `ExtractContractBulkResponse` (FROZEN per HQ2 — M4 must not change shape).
- `IMPORT_CONFIDENCE_THRESHOLDS = { high: 80, medium: 50, low: 0 }` — single source of truth for routing.

`src/types/mammoth-browser.d.ts` — ambient declaration for mammoth's untyped browser bundle.

### Extended (M1a interfaces additively widened)

`src/types/entities/contract.types.ts`:

- `ContractListItem` extended with `importBatchId: number | null`, `importConfidence: number | null`, `importWarnings: string[] | null`.
- `ContractListQuery` extended with `importBatchId?: number`, `importConfidenceMin?: number`, `importConfidenceMax?: number`.
- `CreateContractDto` extended with `importBatchId?: number`, `importFilename?: string`, `importConfidence?: number`, `importWarnings?: string[]`.
- `Contract` (single) extended with the same 4 import fields (post-Codex H1 fix on BE — round-trip symmetric).

Existing M1a/M1b consumers ignore unknown fields; tsc clean (0 errors) on the full FE codebase.

---

## 12. Runtime dependencies added

3 new runtime deps in `package.json` — all match the versions Lovable already used so behaviour parity is maintained. `npm install` ran successfully (39 packages added; one moderate-severity audit warning in the transitive dep tree present in the existing M0 baseline, unrelated to M1c).

| Package | Version | Purpose |
|---|---|---|
| `@supabase/supabase-js` | ^2.103.3 | HQ1 storage upload — direct to existing 'contracts' bucket. Best-effort; non-blocking when env vars unset. |
| `mammoth` | 1.8.0 | DOCX text extraction in browser (AC-S5-02). |
| `pdfjs-dist` | 4.10.38 | PDF text extraction in browser (AC-S5-02). Worker loaded from CDN at runtime to keep bundle lean. |

---

## 13. Files owned by this module

### Created (20)

```
src/types/entities/import-batch.types.ts
src/types/mammoth-browser.d.ts
src/services/api/import-batch.service.ts
src/services/api/extract-contract-bulk.service.ts
src/features/imports/hooks/useImportBatches.ts
src/features/imports/hooks/useDoubleSubmitLock.ts
src/features/imports/lib/extract-text.ts
src/features/imports/lib/upload-to-storage.ts
src/features/imports/lib/bulk-import-draft.ts
src/features/imports/components/ConfirmDialog.tsx
src/features/imports/components/BulkImportView.tsx
src/features/imports/components/ReviewQueueView.tsx
src/features/imports/components/ManualEntriesView.tsx
src/features/imports/components/AdminImportsListView.tsx
src/features/imports/components/AdminImportBatchDetailView.tsx
src/routes/app/imports.bulk.tsx
src/routes/app/imports.review-queue.tsx
src/routes/app/imports.manual-entries.tsx
src/routes/app/admin.imports.tsx
src/routes/app/admin.imports.$batchId.tsx
```

### Modified (5)

```
src/types/entities/contract.types.ts        (additive M1c extensions on Contract / ContractListItem / ContractListQuery / CreateContractDto)
src/i18n/en.json                            (151 keys added across import.bulk / import.review / import.manual / admin.imports / errors.import)
src/i18n/ar.json                            (151 keys added — Modern Standard Arabic; EN/AR parity verified)
src/routeTree.gen.ts                        (auto-regenerated by @tanstack/router-cli for the 5 new routes)
package.json                                (added @supabase/supabase-js, mammoth, pdfjs-dist)
```

---

## 14. Key UI decisions

1. **Bulk-import flow keeps Lovable's visual idiom — drop zone, file list, pre-flight config panel, processing screen with current file + recently completed list + tally counters, completion summary, pause/resume/cancel controls.** The 1195-line Lovable original was tightly coupled to `supabase.from()` + direct notifications inserts + direct contract inserts; the v2.6 build preserves the visual idiom while routing every backend call through services + React Query.
2. **Review queue "oldest first" is achieved client-side, not via fn signature change.** Per Q3-OI-D, `fn_contract_list` ORDER BY is `created_at DESC` (newest first); a `sortDir` param was deliberately kept out of the M1c fn extension to keep the cross-module change minimal and additive. The BE controller wraps the list response and the FE reverses the data array client-side — documented in `src/features/imports/components/ReviewQueueView.tsx`. Long-term: M2/M3 may add a fn-level `sortDir` param.
3. **Bulk-approve uses `Promise.allSettled` (AC-S6-06).** Bulk-approve in the review queue uses `Promise.allSettled` across the visible page of contracts. Partial failures surface as a "X of Y approved · Z failed" toast pair — matches the AC wording "best-effort, partial failures reported".
4. **Notifications are toast-only (per Q1 deferral, AC-S5-07).** Sonner toasts at start/progress/complete; no DB-side notification rows. A future Notifications module will add server-side rows; the FE will plug in once that ships.

---

## 15. Open issues / known limitations

| ID | Severity | Topic | Details |
|---|---|---|---|
| FE-INFO-1 | informational | Notifications toast-only | Per Q1 deferral. AC-S5-07 satisfied via Sonner toasts only; DB-side `fn_notification_create_bulk` does not exist in M1c. Future Notifications module will add server-side rows. |
| FE-INFO-2 | informational | Supabase storage upload best-effort | Per HQ1 ratification. When `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are unset, `uploadToStorage` returns null; import proceeds with filename-only metadata. Real attachment integration deferred to a future Attachments module per Q2b. |
| FE-INFO-3 | informational | Resume after refresh — files NOT preserved | Browsers cannot persist `File` handles to localStorage. Config + batchId preserved via TTL'd draft (24h); user is shown a toast hint to re-select files to continue. Batch status remains `in_progress` on the BE — can be cancelled or completed via admin drill-down. |
| FE-INFO-4 | informational | Bulk-approve uses Promise.allSettled | AC-S6-06 — best-effort, partial failures reported as "X of Y approved · Z failed". |
| FE-INFO-5 | informational | 3 new runtime deps | @supabase/supabase-js, mammoth, pdfjs-dist — versions match Lovable for parity. |
| CRX-9 | medium | FE Codex round 1 deferred | Quota exhausted 2026-05-03. Run `/codex:adversarial-review` from this repo when quota resets ~2026-05-09. |

---

## 16. How to extend M1c on the frontend

**To add a new field to BulkImportView's pre-flight config panel:**
1. Update `src/types/entities/import-batch.types.ts` `ImportBatchConfig` (interface).
2. Update the BE OpenAPI `ImportBatchConfig` schema if visible via API.
3. Update the FE form labels + i18n keys in `import.bulk.config.*`.
4. Update the bulk-import-draft TTL envelope shape if persisting the new field.

**To add a new column to ReviewQueueView:**
1. Verify the field exists on the BE `ContractListItem` (or extend it via a cross-module additive change).
2. Add a `<th>` + `<td>` cell + i18n key (`import.review.col.<name>`).
3. If sortable client-side, add to the local sort state; keep the fn-level ORDER BY unchanged.

**To run / re-run the FE Codex review (CRX-9):**
1. Ensure Codex quota has reset (~2026-05-09 from M1c ship).
2. `cd` into THIS repo (`musanad-contracts-frontend`).
3. Run `/codex:adversarial-review`.
4. Pair the review with a writer/patch agent — Codex sandbox is read-only (`codex:codex-rescue`).

---

## 17. References

- BE technical handoff: [`musanad-contracts-backend/docs/M1c-technical-handoff.md`](../../musanad-contracts-backend/docs/M1c-technical-handoff.md).
- OpenAPI spec: [`musanad-contracts-backend/docs/api/openapi.yaml`](../../musanad-contracts-backend/docs/api/openapi.yaml).
- Data dictionary: [`musanad-contracts-backend/docs/database/M1c-data-dictionary.md`](../../musanad-contracts-backend/docs/database/M1c-data-dictionary.md).
- Workspace inputs: `.claude/workspace/current-module/` (db-design.md, requirements-analysis.json, api-contracts.json, types.ts, fe-implementation-summary.json, module-M1c-test-report.md, qa-stage4-result.json).
- Lovable source repo: `C:/Users/azureadmin/projects/musanad-contracts-hub` — original `_app/import.bulk.tsx`, `_app/import.review-queue.tsx`, `_app/import.manual-entries.tsx`, `_app/admin.imports.tsx`, `lib/import/extract-text.ts`.

---

*M1c frontend handoff v1.0 — Documentation Generator (Agent 15) v3.0. tsc clean. Ready for git commit.*
