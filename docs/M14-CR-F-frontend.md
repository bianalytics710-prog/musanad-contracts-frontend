# M14 / CR-F — 5-Dim Risk Scoring + MaR + AVaR — Frontend

> **Module ID:** M14 | **Change Request:** CR-F
> **Status:** Complete — shipped 2026-05-13
> **BE commit:** b2bd8bc | **FE commit:** 9155788

---

## Pages and Routes

| Page / Route | Route File | Auth | Description |
|---|---|---|---|
| Contract Risk Tab | Injected into `/app/contracts/$id` | Protected (score.read) | Tabbed panel showing Health Score gauge, 5-dim breakdown bars, MaR-per-correlation list, score history chart, and what-if panel |
| AVaR Dashboard Section | Injected into `/app/dashboards/executive` | Protected (score.read) | Aggregate Value at Risk top-tile + breakdown by 4 groupBy tabs (business_unit / counterparty_id / geography / risk_kind) |
| Scoring Weights Admin | `/app/admin/scoring-weights` | Protected (score.weights.manage) | 5 accessible sliders (ARIA-labelled) + sum meter + normalize button + version history table + recompute-all CTA with destructive-confirm dialog |

---

## New Files Created

| File | Description |
|---|---|
| `src/routes/app/admin.scoring-weights.tsx` | TanStack file-based route for /app/admin/scoring-weights |
| `src/components/contracts/ContractRiskTab.tsx` | Risk tab panel — SVG health-score gauge + 5-dim bars + MaR list + Recharts LineChart + what-if counterfactual panel |
| `src/hooks/useRiskScore.ts` | React Query hooks wrapping risk-score BE endpoints (3 queries: explain, history, avar) |
| `src/components/dashboards/AvarDashboardSection.tsx` | AVaR section mounted on ExecutiveDashboard before R-EX KPI strip |
| `src/services/risk-score.service.ts` | Axios service layer for all 6 risk score BE endpoints |
| `src/services/admin-scoring-weights.service.ts` | Axios service layer for admin scoring-weights endpoints |
| `src/types/risk-score.types.ts` | TypeScript interfaces mirroring BE risk-score.types.ts |

---

## Modified Files

| File | Change |
|---|---|
| `/app/contracts/$id` contract detail | +Risk tab (gated by score.read permission; hidden for contract_recipient) |
| `/app/dashboards/executive` ExecutiveDashboard | +AvarDashboardSection component inserted before R-EX KPI strip |
| Sidebar nav config | +Scoring Weights admin entry (platform_admin + Super Admin only) |

---

## Service Layer

### `src/services/risk-score.service.ts`

| Method | Endpoint | Description |
|---|---|---|
| `getExplain(contractId)` | GET /api/v1/contracts/:id/risk-score | Fetch latest risk score + full explanation |
| `getHistory(contractId, windowDays)` | GET /api/v1/contracts/:id/risk-score/history | Fetch score history snapshots |
| `getAvar(filters)` | GET /api/v1/risk/avar | Fetch AVaR aggregate with breakdown |

### `src/services/admin-scoring-weights.service.ts`

| Method | Endpoint | Description |
|---|---|---|
| `getWeights()` | GET /api/v1/admin/scoring-weights | Fetch current weights + history |
| `patchWeights(body)` | PATCH /api/v1/admin/scoring-weights | Update 5-dim weights |
| `recomputeAll()` | POST /api/v1/admin/scoring-weights/recompute-all | Trigger bulk recompute (destructive-confirm required in FE) |

---

## React Query Usage

| Query Key | Purpose | Invalidated By |
|---|---|---|
| `['risk-score', 'explain', contractId]` | Contract risk score explain | Stale after recompute-all |
| `['risk-score', 'history', contractId, windowDays]` | Score history snapshots | Stale after recompute-all |
| `['risk-score', 'avar', filters]` | Portfolio AVaR aggregate | Stale after recompute-all |
| `['scoring-weights', 'current']` | Admin scoring weights config | Invalidated by patchWeights mutation |

---

## TypeScript Types

From `src/types/risk-score.types.ts` (mirrors BE):

| Type | Description |
|---|---|
| `RiskScoreExplainResponse` | Full explain response from GET /risk-score |
| `RiskScoreHistoryResponse` | History snapshots response |
| `AvarAggregateResponse` | AVaR aggregate with breakdown |
| `ScoringWeightsGetResponse` | Admin weights + version history |
| `ScoringWeightsUpdateRequest` | PATCH /admin/scoring-weights body |
| `ScoringWeightsSetResponse` | PATCH response with newVersion |
| `RecomputeAllResponse` | Bulk recompute result with failedContractIds |
| `HydratedContributingCorrelation` | Hydrated correlation with signal + clause details |
| `RiskScoreDimensionBreakdown` | Per-dimension score + probability + impact + reasons |

---

## i18n Keys Added

**+96 keys added** in both `en.json` and `ar.json` (strict parity — AR uses `[NEEDS TRANSLATION]` placeholders).

Namespaces:

| Namespace | Key Count | Examples |
|---|---|---|
| `risk.score.*` | ~30 | risk.score.healthScore, risk.score.lastCalculated, risk.score.dimensions.legal, risk.score.triggeredBy.signal |
| `risk.mar.*` | ~15 | risk.mar.value, risk.mar.noValue, risk.mar.currency, risk.mar.breakdown |
| `risk.avar.*` | ~25 | risk.avar.totalAvar, risk.avar.groupBy.businessUnit, risk.avar.delta, risk.avar.noValueContracts |
| `admin.scoring.*` | ~26 | admin.scoring.weights.title, admin.scoring.weights.legalDim, admin.scoring.normalize, admin.scoring.recomputeAll, admin.scoring.versionHistory |

Total parity: 5250/5250 (was 5154 pre-CR-F).

---

## Key UI Decisions

1. **SVG Health Score Gauge with color bands:** The circular gauge uses inline SVG with three color bands (green 0-40, amber 41-70, red 71-100). Avoids a Recharts RadialBarChart which produced accessibility issues (missing ARIA roles). Color values are currently hex literals (`#8b5cf6`, `#06b6d4`) — follow-up CR will add purple + cyan to semantic-token palette (QA W5).

2. **Client-side what-if counterfactual panel:** The what-if weight adjustment sliders read the current `ScoringWeightsGetResponse` and compute an estimated adjusted Health Score entirely in the FE (no BE round-trip). This is a display-only approximation — it does NOT persist or call PATCH /scoring-weights. Labeled clearly as "Estimated" to avoid confusion with the persisted score.

3. **Destructive-confirm for recompute-all:** The Recompute All button requires a two-step confirmation (dialog with "CONFIRM" text input) before calling POST /admin/scoring-weights/recompute-all. This matches the M10 demo-purge UX pattern (T9 transformation).

---

## Harden Mode Transformations Applied

All FE components hardened per 13-item checklist:

| Component | Transformations |
|---|---|
| ContractRiskTab.tsx | T1, T2, T3, T4, T5, T6, T7, T11, T12, T13 |
| AvarDashboardSection.tsx | T1, T2, T3, T4, T5, T6, T7, T11 |
| admin.scoring-weights.tsx | T1, T2, T3, T4, T5, T6, T7, T8, T9, T11 |

Sensitive fields (`marValue`, `contributingCorrelations`, `explanation`) are masked when displayed in non-privileged contexts (T13).
