# M15 / CR-G — Executive Evolution + 4 Persona Dashboards + AI Risk Assistant — Frontend

> **Module ID:** M15 | **Change Request:** CR-G
> **Status:** Complete — shipped 2026-05-13 (Unit 2B)
> **BE commit:** 1fdf57a | **FE commit:** b3e82ce

---

## Pages and Routes

| Page / Route | Route File | Auth | Description |
|---|---|---|---|
| Operations Dashboard | `/app/dashboards/operations` | Protected (insights.operations) | SLA breach list, delivery delay tracker, penalty exposure, ops events feed, vendor scorecards |
| Finance & Treasury Dashboard | `/app/dashboards/finance-treasury` | Protected (insights.finance_treasury) | FX volatility tile, price-review trigger queue, payment delay register, currency exposure breakdown |
| Compliance & ESG Dashboard | `/app/dashboards/compliance-esg` | Protected (insights.compliance_esg) | Sanctions exposure (direct + chain), audit rights tracker, sub-contractor chain view, regulatory updates, ESG correlations |
| Procurement Supplier Risk Dashboard | `/app/dashboards/procurement` | Protected (insights.procurement_supplier_risk) | Supplier scorecard, ICV compliance tracker, backup-supplier suggestions, vendor financial health |

**Extended pages (no route change):**

| Page | Extension |
|---|---|
| `/app/dashboards/executive` | +ExecutiveCrgExtension component (3 new sections: WhatChangedToday feed, RecommendedActions list, ClausesTriggered breakdown) |
| AppShell | +RiskAssistantPanel floating drawer (single instance; persona auto-derived from JWT role) |

---

## New Files Created

| File | Description |
|---|---|
| `src/routes/app/dashboards.operations.tsx` | TanStack file-based route for Operations dashboard |
| `src/routes/app/dashboards.finance-treasury.tsx` | TanStack file-based route for Finance & Treasury dashboard |
| `src/routes/app/dashboards.compliance-esg.tsx` | TanStack file-based route for Compliance & ESG dashboard |
| `src/routes/app/dashboards.procurement.tsx` | TanStack file-based route for Procurement dashboard |
| `src/components/dashboards/OperationsDashboard.tsx` | Operations dashboard page component (4 sections) |
| `src/components/dashboards/FinanceTreasuryDashboard.tsx` | Finance & Treasury dashboard page component |
| `src/components/dashboards/ComplianceEsgDashboard.tsx` | Compliance & ESG dashboard page component |
| `src/components/dashboards/ProcurementDashboard.tsx` | Procurement dashboard page component |
| `src/components/ai/RiskAssistantPanel.tsx` | Floating drawer — SSE consumption + citation chips + abort handler + 3 data states (loading/answer/error) |
| `src/components/dashboards/ExecutiveCrgExtension.tsx` | WhatChangedToday + RecommendedActions + ClausesTriggered sections for executive dashboard |
| `src/services/dashboards-crg.service.ts` | Axios service layer for 4 new persona dashboard endpoints |
| `src/services/ai/risk-assistant.service.ts` | SSE streaming client for AI Risk Assistant endpoint |
| `src/types/crg-dashboards.types.ts` | TypeScript interfaces mirroring BE crg-dashboards.types.ts |
| `src/types/risk-assistant.types.ts` | TypeScript interfaces mirroring BE risk-assistant.types.ts |

Total: 15 files created + 5 files modified.

---

## Modified Files

| File | Change |
|---|---|
| `src/components/dashboards/ExecutiveDashboard.tsx` | +ExecutiveCrgExtension component appended after existing sections |
| AppShell layout | +RiskAssistantPanel mounted as floating drawer singleton |
| Sidebar nav config | +4 new dashboard entries gated per insights.* permission |
| `en.json` + `ar.json` | +256 keys each |

---

## Service Layer

### `src/services/dashboards-crg.service.ts`

| Method | Endpoint | Description |
|---|---|---|
| `getOperations(windowDays?)` | GET /api/v1/dashboards/operations | Fetch operations dashboard payload |
| `getFinanceTreasury(windowDays?)` | GET /api/v1/dashboards/finance-treasury | Fetch finance & treasury dashboard payload |
| `getComplianceEsg(windowDays?)` | GET /api/v1/dashboards/compliance-esg | Fetch compliance & ESG dashboard payload |
| `getProcurement(windowDays?)` | GET /api/v1/dashboards/procurement | Fetch procurement dashboard payload |

**CRITICAL-2 fix:** All 4 methods use `unwrapEnvelope(response.data)` to extract `data` from the standard `{ success, data }` response envelope. The original implementation used raw `return data` which returned the envelope object directly — caught by Integration Verifier and patched inline.

### `src/services/ai/risk-assistant.service.ts` (FE)

| Method | Behavior |
|---|---|
| `ask(query, persona?, filters?)` | Opens SSE stream via fetch EventSource pattern. Calls `onToken(chunk)` for each `token` event, `onCitation(citation)` for each `citation` event, `onDone(requestLogId)` on completion, `onError(code, message)` on error event. |
| `askNonStreaming(query, persona?, filters?)` | POST with ?stream=false; returns `{ answer, citations[] }` JSON. |

Abort handler: caller can pass an `AbortController.signal` to cancel an in-flight stream (e.g., when the drawer closes).

---

## React Query Usage

| Query Key | Purpose | Refresh |
|---|---|---|
| `['dashboard', 'operations', windowDays]` | Operations dashboard payload | 60s polling (HITL Q3 lock) |
| `['dashboard', 'finance-treasury', windowDays]` | Finance & Treasury payload | 60s polling |
| `['dashboard', 'compliance-esg', windowDays]` | Compliance & ESG payload | 60s polling |
| `['dashboard', 'procurement', windowDays]` | Procurement payload | 60s polling |

All 4 dashboard queries use `refetchInterval: 60_000` per HITL Q3 decision (60s polling v1; event-driven WebSocket deferred to pilot).

---

## TypeScript Types

From `src/types/crg-dashboards.types.ts`:

| Type | Description |
|---|---|
| `OperationsDashboardResponse` | Full operations dashboard payload |
| `FinanceTreasuryDashboardResponse` | Full finance & treasury dashboard payload |
| `ComplianceEsgDashboardResponse` | Full compliance & ESG dashboard payload |
| `ProcurementSupplierRiskDashboardResponse` | Full procurement dashboard payload |
| `ExecutiveDashboardCrgAdditions` | 3 new top-level keys on executive dashboard |
| `WhatChangedTodayRow` | Single entry in whatChangedToday array |
| `RecommendedActionRow` | Single entry in recommendedActions array (assignedRoles is PLURAL ARRAY per M13-projection) |
| `ClausesTriggeredRow` | Single entry in clausesTriggered.last7d / .last30d |
| `SupplierScorecardRow` | Supplier scorecard row (dim_* fields in camelCase per QA W1) |

From `src/types/risk-assistant.types.ts`:

| Type | Description |
|---|---|
| `RiskAssistantAskRequest` | POST body for /ai/risk-assistant/ask |
| `RiskAssistantSSEEvent` | Single SSE event (token / citation / done / error) |
| `RiskAssistantCitation` | Inline citation chip (type / id / label / href / excerpt) |
| `RiskAssistantNonStreamingResponse` | Non-streaming JSON response shape |

---

## i18n Keys Added

**+256 keys added** in both `en.json` and `ar.json` (strict parity).
AR keys use `[NEEDS TRANSLATION]` placeholders — translation sprint deferred post-ship.

Namespaces:

| Namespace | Key Count | Examples |
|---|---|---|
| `dashboards.operations.*` | ~55 | dashboards.operations.title, dashboards.operations.slaBreaches.title, dashboards.operations.penaltyExposure.total |
| `dashboards.fintech.*` | ~50 | dashboards.fintech.fxVolatility.title, dashboards.fintech.priceReview.trigger |
| `dashboards.compliance.*` | ~55 | dashboards.compliance.sanctions.direct, dashboards.compliance.auditRights.expiring |
| `dashboards.procurement.*` | ~45 | dashboards.procurement.supplierScorecard.title, dashboards.procurement.icv.status |
| `ai.riskAssistant.*` | ~30 | ai.riskAssistant.title, ai.riskAssistant.placeholder, ai.riskAssistant.streaming, ai.riskAssistant.citation |
| `dashboards.executive.*` (extension) | ~21 | dashboards.executive.whatChanged.title, dashboards.executive.recommendedActions.slaHours, dashboards.executive.clausesTriggered |

Total parity: 5506/5506 (was 5250 pre-CR-G; +256 from 5250).

---

## Key UI Decisions

1. **RiskAssistantPanel as floating drawer singleton:** The AI Risk Assistant is mounted once at AppShell level (not per-route) so the conversation persists when users navigate between routes. Persona is auto-derived from the JWT role claim on mount — no manual selection required. The drawer can be opened/closed via a floating action button in the bottom-right corner.

2. **Per-persona dashboard auto-refresh at 60s:** All 4 new persona dashboards use React Query `refetchInterval: 60_000`. The refetch runs silently in the background; stale data is shown without a loading spinner during refresh to avoid flash-of-blank. This was HITL Q3 decision — event-driven WebSocket deferred to pilot.

3. **SSE stream abort on drawer close:** The RiskAssistantPanel passes an `AbortController` to the streaming service. When the drawer closes (user action or ESC key), the abort signal cancels the in-flight fetch and cleans up the EventSource. This prevents orphaned streams accumulating if a user opens the panel repeatedly.

4. **Backup-supplier category pivot on party.party_type:** The ProcurementDashboard backup-supplier suggestions display the `category` field which maps to `party.party_type` (Agent 3 decision A4b). The FE chip label maps the raw type value to a display label via `i18n('party.type.' + category)` — no hardcoded strings.

---

## Harden Mode Transformations Applied

| Component | Transformations Applied |
|---|---|
| OperationsDashboard.tsx | T1, T2, T3, T4, T5, T6, T7, T11, T12 |
| FinanceTreasuryDashboard.tsx | T1, T2, T3, T4, T5, T6, T7, T11, T12 |
| ComplianceEsgDashboard.tsx | T1, T2, T3, T4, T5, T6, T7, T11, T12 |
| ProcurementDashboard.tsx | T1, T2, T3, T4, T5, T6, T7, T11 |
| RiskAssistantPanel.tsx | T1, T3, T4, T5, T6, T7, T11, T13 |
| ExecutiveCrgExtension.tsx | T1, T2, T3, T4, T5, T6, T7, T11, T12 |

T13 (Sensitive field protection) applied to RiskAssistantPanel — query + filter fields are never logged or included in error reports; citation excerpts are marked sensitive.

---

## Known Open Items

| Item | Description |
|---|---|
| DEFECT-CR-G-7 | AI Risk Assistant LLM stream silent. Panel shows spinner then graceful error state. Infrastructure verified working. |
| AR translations | 256 keys with [NEEDS TRANSLATION] placeholders in ar.json — translation sprint needed |
| Agent 12 E2E | Playwright per-persona dashboard render tests deferred — post-ship sprint |
| R-OPS / R-FT / R-CES / R-PROC | Persona parity rounds in Unit 3 (deeper functional coverage per persona) |
