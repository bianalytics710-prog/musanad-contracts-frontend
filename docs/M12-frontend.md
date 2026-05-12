# M12 — Clause Taxonomy + Two-Stage Extractor + pgvector + Auto-Obligations — Frontend

Generated: 2026-05-12T17:00:00Z
Status: Complete

---

## Pages

| Page | Route | Auth | Roles | Description |
|---|---|---|---|---|
| ClauseReviewQueue | /app/clauses/review | Protected | legal_counsel, platform_admin | Paginated worklist of extracted clauses below 70% confidence awaiting legal review |
| ClauseTaxonomyViewer | /app/admin/clause-taxonomy | Protected | All authenticated roles | Read-only admin viewer of the 50-type Annex A taxonomy grouped by family |
| ContractClausesTab (extended) | /app/contracts/$id (Clauses tab) | Protected | All contract-readable roles | Extended contract detail tab — existing library panel + new extracted-clauses panel |

Note: The semantic search surface (/api/v1/clauses/search) is accessible from a search input embedded within the ContractClausesTab extracted-clauses panel, not a dedicated route.

---

## Components and State

### ClauseReviewQueue (/app/clauses/review/page.tsx)

**Purpose**: Lists pending_review extracted clauses with confidence scores, family tags, and source contract links. Allows legal counsel to confirm, correct, or reject each clause via an inline modal.

**API calls**:
| Service method | Endpoint | When called |
|---|---|---|
| clauseService.listReviewQueue(params) | GET /api/v1/clauses/review-queue | On mount + on filter change (debounced 300ms) |
| clauseService.resolve(id, action, corrections) | POST /api/v1/clauses/:id/review | On resolve action confirm in modal |

**React Query**:
| Query key | Purpose | Invalidated by |
|---|---|---|
| ['clauses', 'review-queue', filters] | Pending review clause list | resolve mutation success |

**Key state**:
- Filter state: contractId (integer), clauseType (string), reviewStatus (enum), confidenceBelow (number)
- Modal state: selected clauseId, action (confirm/correct/reject), parametersCorrection JSONB editor value, textExcerptsCorrection per-parameter text inputs
- Loading/error/empty states for list and modal independently

---

### ClauseTaxonomyViewer (/app/admin/clause-taxonomy/page.tsx)

**Purpose**: Displays all 50 Annex A clause types grouped by the 8 families. Read-only in v1 — includes a request-revision dialog for SMEs to flag taxonomy issues for the Legal team.

**API calls**:
| Service method | Endpoint | When called |
|---|---|---|
| clauseTaxonomyService.list(params) | GET /api/v1/admin/clause-taxonomy | On mount |

**React Query**:
| Query key | Purpose | Invalidated by |
|---|---|---|
| ['clause-taxonomy', filters] | Full taxonomy catalogue | Never (reference data changes via admin migration) |

**Key state**:
- Filter: family (8-option select), search (text, 300ms debounce), isActive (boolean)
- Grouped-by-family accordion UI — each family expands to show its clause type cards
- Request-revision modal: selected clauseTypeId, revision notes textarea

---

### ContractClausesTab — Extracted Clauses Panel (extended)

**Purpose**: Dual-pane extension of the existing contract detail Clauses tab. Left pane: existing clause library panel (unchanged). Right pane: extracted clauses for the current contract version — clause type + family tag + confidence pill + parameters preview + jump-to-source offset.

**API calls**:
| Service method | Endpoint | When called |
|---|---|---|
| clauseService.searchClauses(contractId, queryText, limit) | POST /api/v1/clauses/search | On semantic search input submit (300ms debounce) |
| clauseService.triggerExtraction(contractId, forceReprocess) | POST /api/v1/contracts/:id/extract-clauses | On 'Re-extract' button click (Super Admin only) |

**React Query**:
| Query key | Purpose | Invalidated by |
|---|---|---|
| ['clauses', 'search', contractId, queryText] | Semantic search results | New search query |
| ['contracts', contractId, 'extraction-status'] | Extraction status polling | extract mutation + polling interval |

**Key state**:
- Semantic search query text input
- Search results list with similarity scores
- Extraction trigger loading state (202 Accepted — polling via extractionRunId)

---

## Service Layer

### src/services/clause.service.ts

| Method | Endpoint | Description |
|---|---|---|
| listReviewQueue(params) | GET /api/v1/clauses/review-queue | Fetches paginated pending_review clauses with optional filters |
| resolve(id, data) | POST /api/v1/clauses/:id/review | Submits confirm/correct/reject for a pending_review clause |
| triggerExtraction(contractId, body) | POST /api/v1/contracts/:id/extract-clauses | Queues extraction for latest contract version |
| triggerExtractionForVersion(contractId, vId, body) | POST /api/v1/contracts/:id/versions/:vId/extract-clauses | Queues extraction for specific version |
| searchClauses(body) | POST /api/v1/clauses/search | Semantic search — server embeds the query and returns top-N similar clauses |

### src/services/clause-taxonomy.service.ts

| Method | Endpoint | Description |
|---|---|---|
| list(params) | GET /api/v1/admin/clause-taxonomy | Fetches full taxonomy catalogue with optional family/search/isActive filters |

---

## TypeScript Types

From `src/types/clause.types.ts`:

| Type | Description |
|---|---|
| ClauseTaxonomyEntry | Full taxonomy row: clauseTypeId, family, displayNameEn/Ar, definitionEn/Ar, identificationCuesEn/Ar, parameterSchema, version, isDeprecated |
| ClauseTaxonomyParameterDef | One parameter definition: type (duration_days/date/money/enum/...), required, enum_values? |
| ClauseReviewQueueItem | Row in the review queue: id, contractId, contractTitleEn/Ar, clauseTypeV2, family, displayNameEn/Ar, parametersPreview, confidence, pageNo, reviewStatus, createdAt |
| ClauseExtractionRequestResult | Trigger-extraction response: queued, extractionRunId, reason |
| ClauseReviewResolveResult | Resolve response: clauseId, newReviewStatus, obligationsRecomputed |
| ClauseSemanticSearchResponse | Search results: data[] (clauseId, contractId, clauseTypeV2, family, similarity, summaryEn/Ar, pageNo), count, queryEmbeddingLogId |

---

## i18n Keys Added

Approximately 80 net-new keys in the M12 surface (portion of the +159 total M12+M13 addition):

| Namespace | Coverage |
|---|---|
| clauses.taxonomy.* | 50 clause type display names + 8 family names + definitions + identification cues (EN + AR pairs) |
| clauses.review.* | Filter chip labels, confidence band labels ('Low confidence', 'Medium confidence'), action buttons ('Confirm', 'Edit', 'Reject'), modal headings, empty state messages |
| clauses.search.* | Semantic search input placeholder, result card labels (similarity score label, clause type label), no-results message |
| contracts.clausesTab.* | Extracted clauses panel heading, confidence pill labels, family color legend, jump-to-source link text, re-extract button |

---

## Key UI Decisions

1. **Dual-pane Clauses tab without route change**: The existing contract detail Clauses tab route (/app/contracts/$id with tab=clauses) was preserved. The extracted-clauses panel was added as a second pane within the existing tab, controlled by a toggle or splitter. This avoids breaking the existing tab URL bookmark pattern and preserves the clause library pane that drafters use.

2. **Review modal with per-parameter text inputs**: The correct action in the review modal renders one text textarea per extracted parameter (matching the text_excerpts structure). This enforces the Annex A.1.2 discipline at the UI layer — legal counsel must provide source text for every corrected parameter before submitting. An incomplete set of excerpts triggers an inline validation error before the API call.

3. **Semantic search via POST, not GET**: The /api/v1/clauses/search endpoint uses POST rather than GET because the query text and filters are complex objects (including the limit and similarity threshold). This also avoids logging query text in server access logs via URL (pinoRedactPaths covers the request body). React Query uses the request body as part of the query key for caching.

4. **Confidence color coding paired with text labels**: Confidence pills use a semantic color scheme (red for low < 0.50, amber for medium 0.50-0.70, green for high >= 0.70) but each pill also renders the numeric value and a text label ('Low', 'Medium', 'High'). This satisfies the WCAG 2.1 AA color-only prohibition.

---

## Files Owned by This Module

- `src/routes/app/clauses/review/page.tsx`
- `src/routes/app/admin/clause-taxonomy/page.tsx`
- `src/features/clauses/ClauseReviewQueue.tsx`
- `src/features/clauses/ClauseReviewModal.tsx`
- `src/features/clauses/ClauseTaxonomyViewer.tsx`
- `src/features/clauses/ClauseSemanticSearch.tsx`
- `src/features/contracts/tabs/ClausesTab.tsx` (extended — existing file)
- `src/services/clause.service.ts`
- `src/services/clause-taxonomy.service.ts`
- `src/types/clause.types.ts`
