# CR-N FE Implementation Report
**Module:** M21 — Financial Intelligence (Budget Burn — Cost half)
**Date:** 2026-05-28
**Agent:** FE Implementation (Agent 8) — Regenerate Mode
**Status:** COMPLETE — tsc exit 0, EN/AR parity 6346/6346 PASS

---

## Deliverables

### New Files

| File | Lines | Purpose |
|---|---|---|
| `src/types/entities/budget-burn.types.ts` | 180 | Full FE type mirror of CR-N contracts.md Part 1 — 20+ interfaces, COST_CATEGORIES const array, money fields typed as `string` (NUMERIC→::text from BE) |
| `src/services/api/financial-budget-burn.service.ts` | 155 | Bare-domain service wrapping all 9 CR-N endpoints. Controllers return raw fn_ JSONB (no `{success, data}` envelope) matching CR-M pattern |
| `src/routes/app/financial.budget-burn.tsx` | 11 | Parent outlet shim — `createFileRoute('/app/financial/budget-burn')` renders `<Outlet />` |
| `src/routes/app/financial.budget-burn.index.tsx` | 416 | Portfolio list view — summary strip, contracts table with burn bars, offset pagination, permission gate |
| `src/routes/app/financial.budget-burn.$contractId.tsx` | 824 | Contract detail view — 6 sections (KPI strip, variance alert, period×category table, correlated clauses, year-end projection, cumulative burn) + Draft Cure Notice action |
| `src/features/dashboards/components/ExecutiveBudgetBurnSection.tsx` | 190 | Executive dashboard rollup — 3 KPI tiles, top-3 over-budget list, "all on track" banner |

### Modified Files

| File | Change |
|---|---|
| `src/config/sidebar.ts` | Added `DollarSign` icon import; `"financial.budgetBurn"` to `ModuleKey` union + `MODULES` object + `ROLE_MODULES` for finance_treasury, procurement_supplier_risk, operations, executive, legal_counsel, platform_admin, Super Admin |
| `src/features/dashboards/components/ExecutiveDashboard.tsx` | Imported `ExecutiveBudgetBurnSection` + `BudgetBurnSummary`; added `<ExecutiveBudgetBurnSection>` block after `<ExecutiveCrgExtension>` using intersection type cast for the 10th additive fn_dashboard_executive key |
| `src/i18n/en.json` | Added `nav.financialBudgetBurn` + full `financial.budgetBurn` namespace (+92 leaf keys) |
| `src/i18n/ar.json` | Added Arabic equivalents with identical key structure (+92 leaf keys, full EN/AR parity) |
| `src/routeTree.gen.ts` | Registered `AppFinancialBudgetBurnContractIdRoute` in: import, const definition, `FileRoutesByFullPath`, `FileRoutesByTo`, `FileRoutesById`, all 3 `FileRouteTypes` unions, `AppFinancialBudgetBurnRouteChildren` interface + const |

---

## AC Coverage

| AC | Scope | FE Coverage |
|---|---|---|
| AC-N-1 | Budget portfolio list with burn indicators | `financial.budget-burn.index.tsx` — table with burn bars, summary KPI strip, `finance.budget.read` gate |
| AC-N-2 | Period × cost-category breakdown table | `financial.budget-burn.$contractId.tsx` — `PeriodCategoryTable` with `CategoryRow` burn bars per category |
| AC-N-3 | Variance alert banner on day-rate breach | `VarianceAlertBanner` component — thresholdBreached flag + breach details (category, budgetAed, actualAed, variancePct) |
| AC-N-4 | Correlated clause refs (cure period + LD) | `CorrelatedClausesSection` — cure period + LD refs with clause text + contract refs |
| AC-N-5 | Year-end projection with confidence badge | `YearEndProjectionCard` — confidence badge (semantic tokens), projectedTotalAed, contingencyAed |
| AC-N-6 | Cumulative burn table | `CumulativeBurnSection` — period rows with cumAed + cumBudgetAed columns |
| AC-N-7 | Draft cure notice action | `DraftCureNoticeButton` — gated `advisory.draft.review`, `useMutation` → `financialBudgetBurnService.draftCureNotice()`, toast + invalidateQueries |
| AC-N-8 | Executive dashboard rollup | `ExecutiveBudgetBurnSection` — contractsWithBudget, overBudgetCount, projectedOverrunAed + top-3 list |

---

## Standards Compliance

| Check | Result |
|---|---|
| A7 — apiClient never in pages/routes/components | PASS — apiClient only in `financial-budget-burn.service.ts` |
| C12 — i18n every string | PASS — all text via `t('financial.budgetBurn.*')` keys |
| C13 — Semantic tokens only | PASS — `bg-success/10`, `text-warning`, `border-error/30`, `bg-terracotta`, etc. No raw hex |
| C14 — Router Link not `<a>` | PASS — `<Link to="/app/financial/budget-burn/$contractId" params={{ contractId }}>` throughout |
| D6 — label htmlFor + input id match | PASS — no form inputs in these routes (search input omitted per AC scope) |
| D7 — `<th scope>` | PASS — every `<th>` in portfolio table and period×category table has `scope="col"` |
| T3 — i18n parity | PASS — 6346 EN / 6346 AR leaf keys |
| T4 — Three data states | PASS — loading skeletons / empty states / error alert with retry on all query-bearing views |
| T11 — Error boundary | PASS — `<ErrorBoundary>` wraps both index and detail root components |
| T12 — formatDateTime | PASS — `formatDateTime` from `@/utils/datetime` for all timestamp displays |
| Money fields | PASS — all `*Aed` fields parsed with `parseFloat()` before arithmetic/display |
| RTL logical classes | PASS — `me-*`, `ms-*`, `start-*` used throughout |
| WCAG AA | PASS — `role="alert"` on error alerts, `aria-label` on icon-only buttons, semantic HTML |
| Permission gate | PASS — `selectHasPermission('finance.budget.read')` guard on index; `advisory.draft.review` guard on cure-notice action |

---

## Key Design Decisions

1. **Bare-domain service return** — mirrors CR-M regulatory-cascade.service.ts pattern. BE returns raw fn_ JSONB via `res.json(result)` with no `{success, data}` wrapper. FE service returns bare domain types directly.

2. **Money as string** — All `*Aed` fields in types and service are `string` (NUMERIC(18,2) returned as `::text` from PostgreSQL). `formatAedFull` and `formatAedCompact` helpers parse with `parseFloat()` before formatting.

3. **Executive dashboard extension** — Used intersection type cast `(data as unknown as { budgetBurnSummary?: BudgetBurnSummary }).budgetBurnSummary ?? null` to access the 10th additive key on `fn_dashboard_executive` without touching M6's `ExecutiveDashboardSnapshot` type definition (R-EX/CR-G lesson).

4. **Cure notice seam** — `draftCureNotice()` posts to `POST /api/v1/financial/budget-burn/:contractId/cure-notice-draft`. BE feeds correlation_id → fn_advisory_draft_generate → Mustache template `budget_cure_notice_v1`. FE triggers mutation and routes user to advisory queue on success.

5. **Parent/index/detail split** — parent renders `<Outlet />` only (TanStack lesson from CR-H/CR-M — siblings do not auto-mount without explicit parent outlet).

---

## tsc Result

```
npx tsc --noEmit
(exit 0 — no output)
```

## i18n Parity

```
EN leaf keys: 6346
AR leaf keys: 6346
Parity: PASS
```

Baseline before CR-N: 6254/6254. Net addition: +92 keys per locale (1 nav key + 91 financial.budgetBurn namespace keys).
