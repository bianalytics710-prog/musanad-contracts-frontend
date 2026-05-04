# M2 — Approval Workflows — Frontend

> **Project:** Musanad Contracts Hub (`musanad-contracts`)
> **Module:** M2 — Approval Workflows
> **Generated:** 2026-05-04.
> **Pipeline:** Lovable Modernization v3.2 (Mode A — Lovable only).
> **Status:** Complete. tsc clean (errorCount=0; one fix cycle for 6 routeTree / exhaustiveness errors). 8 components shipped (1 hardened, 1 hardened-and-extended, 4 regenerated, 4 new clean). 0 new runtime dependencies. i18n parity 3,579 EN / 3,579 AR keys (+166 keys per locale). 5 Codex FE lessons embedded (F-FE-001, F-FE-002, F-FE-M1, F-FE-M2, FE-R2-001).

This is the practical handoff for the developer extending M2 on the FE side or picking it up across sessions. For the BE handoff see the backend repo's `docs/M2-technical-handoff.md`. For the wire surface see the backend repo's `docs/api/openapi.yaml`. For the database surface see the backend repo's `docs/database/M2-data-dictionary.md`.

---

## 1. Routes Added (3 new TanStack file-based)

| Route file | Path | Auth | Description |
|---|---|---|---|
| `src/routes/app/approvals.tsx` | `/app/approvals` | Protected | Approver inbox — pending steps assigned to the calling user (S1) |
| `src/routes/app/admin.approval-matrix.tsx` | `/app/admin/approval-matrix` | Protected (admin) | Approval matrix admin — list + replace rules (S4 + S5) |
| `src/routes/app/admin.approval-chains.tsx` | `/app/admin/approval-chains` | Protected (admin) | Admin chain monitor — role-aware list (S11) |

All three routes are wrapped in `<ErrorBoundary>` from `@/components/common`. TanStack Router file-based routing applies code-splitting by default. `routeTree.gen.ts` was manually patched in this module — on next `vite dev` the plugin regenerates from `src/routes/*` source files; the additions should survive.

**Out of scope for M2** (deferred):
- Sidebar navigation links to the three new routes — `Sidebar.tsx` is global shell, not in M2 scope. Users navigate via direct URLs or approval emails for now (FI2).
- Embedding `ApprovalChainPreview` in the `ContractDetail` Activity tab — component is shipped but not yet rendered there (FI1, FI-B).

---

## 2. Components Added (8 — fates summarized)

| Story | Component | File | Fate | Cycles |
|---|---|---|---|---|
| S1 | `ApprovalsListView` | `src/features/approvals/components/ApprovalsListView.tsx` | regenerated | — |
| S2 + S3 | `ApprovalDecisionDialog` | `src/features/approvals/components/ApprovalDecisionDialog.tsx` | hardened-and-extended (delegate mode added) | 2 |
| S4 + S5 | `ApprovalMatrixView` + `MatrixRuleEditor` | `src/features/approvals/components/{ApprovalMatrixView,MatrixRuleEditor}.tsx` | regenerated | — |
| S6 + S10 | `ApprovalChainPreview` | `src/features/approvals/components/ApprovalChainPreview.tsx` | new (modes: preview, read-only) | — |
| S7 | `SubmitForApprovalDialog` | `src/features/approvals/components/SubmitForApprovalDialog.tsx` | new (embeds preview) | — |
| S8 | `ApprovalReassignDialog` | `src/features/approvals/components/ApprovalReassignDialog.tsx` | regenerated | — |
| S9 | — | — | skipped (cron-only system event; no UI surface) | — |
| S11 | `AdminApprovalChainsView` | `src/features/approvals/components/AdminApprovalChainsView.tsx` | new (30s React Query refetchInterval) | — |
| S12 | `ContractStatusDialog` (M1a, extended) | `src/features/contracts/components/ContractStatusDialog.tsx` | extended-hardened (narrow-transition map) | 1 |

**Regeneration rationale:** the source Lovable `approvals.tsx` (823 lines) was pervasively coupled to Supabase — direct `supabase.from('approval_*')` calls, `supabase.auth.uid()` references, and inline RPC invocations. Cost of a 13-item harden pass was estimated higher than rebuilding clean against the M2 service layer. Regenerated components retain the original Lovable visual design tokens and layout idioms; the data layer, state, and quality bars are fresh against v2.6 standards.

`ApprovalDecisionDialog` was hardened (T1–T13 applied) and then extended in a second pass to support both `decide` and `delegate` flows in a single dialog — the user's primary action surface is identical, with mode determining which mutation fires.

`ContractStatusDialog` (owned by M1a) was extended with `UPDATE_CONTRACT_STATUS_USER_TARGETS` — a static map keyed by source `ContractStatus` that surfaces only valid targets (e.g. `draft → [in_review, cancelled]`, `approved → [active, cancelled]`). `in_approval` source is intentionally absent — when a contract is in_approval, the user MUST use the Approvals page (`fn_approval_decide`). Empty `narrowedTargets` emits a hint (`only via approval workflow`). The M1a duplicate-allowed-list dropdown and the `m1aNote` amber banner were removed.

---

## 3. 13-Item Harden Checklist Application Matrix

Per the harden pattern, each component was scored against T1–T13. New / regenerated components were built from the start meeting all bars; hardened components went through the audit.

| T# | Check | Coverage |
|---|---|---|
| **T1** | Data layer extraction | All components extract data via service modules (`approval.service`, `admin/approval-matrix.service`, `admin/approval-chains.service`). Zero `supabase.from()` calls remain in M2 components. |
| **T2** | React Query wrapping | All reads use `useQuery`; all writes use `useMutation` with `invalidateQueries` on success. No `useEffect`-based fetching. `useApprovals.ts` exposes typed query/mutation hooks. |
| **T3** | i18n keys | Every user-facing string uses `t()`. 166 new keys per locale under `approval.*` and `errors.approval.*`. EN/AR parity 3,579 / 3,579 leaf keys, full MSA Arabic translations. |
| **T4** | Three data states (loading / empty / error) | All list views (`ApprovalsListView`, `AdminApprovalChainsView`, `ApprovalMatrixView`) and the inline preview in `SubmitForApprovalDialog` render: skeleton on `isLoading`, empty hint on `data.length === 0`, retry UI on `isError`. |
| **T5** | Semantic Tailwind tokens only | `border` / `surface` / `muted` / `destructive` / `amber-tint` / `sage` / `gold`. No raw hex; no Tailwind palette colors. |
| **T6** | Accessibility | `useFocusTrap` on all 4 modal dialogs; `aria-busy` on table bodies during refetch; `aria-modal="true"`; `aria-labelledby` with `useId`; semantic `<table>` / `<ol>` / `<li>`; sr-only labels on all inputs; keyboard-accessible reorder buttons (no drag-only). |
| **T7** | Type safety | No `any`. All wire shapes from `approval.types.ts` mirror BE. `ContractStatus` widened 14→16 with `M2ContractStatusExtension`. `ActivityType` widened 9→14. |
| **T8** | Form hygiene | Submit gated on validation + `mutation.isPending` + double-submit lock (F-FE-002). Form reset after successful close. `noValidate` on every `<form>`; client validation matches BE Zod rules. Lock applied to `ApprovalDecisionDialog` Submit, `MatrixRuleEditor` Save, `SubmitForApprovalDialog` Submit, `ApprovalReassignDialog` Confirm. |
| **T9** | Destructive confirmation | Reject / Reassign / Cancel dialogs surface `AlertCircle` warning copy before submission. No `window.confirm`. |
| **T10** | Debounce on search | N/A — no search inputs in M2 surfaces (S1 inbox is sort-only; S11 chain monitor is filter-only). |
| **T11** | Error boundary | All 3 new routes wrapped in `<ErrorBoundary>` from `@/components/common`. |
| **T12** | Date / time handling | `formatDateTime` used for `chain.submittedAt`, decision `decidedAt`, admin chain `submittedAt`. `hoursPending` displayed via i18n unit pluralisation. |
| **T13** | Sensitive field protection | `decisionNote` handled in component-local state only; never `console.log`'d; truncated for inline display in chain history. Pino redaction handles BE side. |

---

## 4. i18n Keys Added (+166 EN/AR)

Namespaced under `approval.*` and `errors.approval.*`. Full MSA Arabic translations provided. EN/AR leaf-key parity preserved at 3,579 / 3,579.

| Namespace | Count | Purpose |
|---|---|---|
| `approval.list.*` | 21 | Approver inbox (S1) — table headers, sort options, empty / loading / error states, hoursPending unit pluralization |
| `approval.decide.*` | 21 | Decision dialog (S2) — title, action labels, decisionNote field, validation errors, confirmation copy |
| `approval.delegate.*` | 9 | Delegate dialog mode (S3) |
| `approval.submit.*` | 5 | Submit-for-approval dialog (S7) |
| `approval.reassign.*` | 9 | Admin reassign dialog (S8) |
| `approval.matrix.*` | 24 | Matrix admin view + rule editor (S4 + S5) |
| `approval.chains.*` | 16 | Admin chain monitor (S11) |
| `approval.chain.*` | 25 | Chain preview / read-only chain detail (S6 + S10) |
| `approval.toasts.*` | 7 | Mutation success toasts |
| `errors.approval.*` | 9 | Mutation error fallback keys (consumed by `translateApiError`) |

The estimated total is ~146 in the FE summary; the embedded fact sheet sets the canonical figure at 166 per locale.

---

## 5. State Management

### 5.1 React Query

- **Reads:** `useQuery` everywhere. Polling via `refetchInterval: 30_000` on:
  - `GET /approvals/my-pending` (`useApprovals.useMyPending`)
  - `GET /admin/approval-chains` (`AdminApprovalChainsView`)
- **Writes:** `useMutation` everywhere. `onSuccess` calls `queryClient.invalidateQueries` on the relevant approval / contract keys. `onError` funnels through `translateApiError(err, t, 'errors.approval.<action>Failed')` with namespaced fallback keys, then raises `toast.error`.
- **Mutations covered:** decide, delegate, submit-for-approval, matrix replace, reassign, status patch.

### 5.2 Zustand

Used for transient UI state inside dialogs (selected step, draft decision text, mode toggle on `ApprovalDecisionDialog`). No persisted Zustand stores in M2 — `localStorage` is intentionally avoided (FE-R2-001 lesson, even though it's N/A here).

### 5.3 Service layer

| File | Methods |
|---|---|
| `src/services/api/approval.service.ts` | `myPending(query)`, `decide(stepId, dto)`, `delegate(stepId, dto)`, `chainGetByContractId(contractId)`, `routeInitPreview(contractId, body)`, `submitForApproval(contractId)` |
| `src/services/api/admin/approval-matrix.service.ts` | `list(query)`, `set(dto)` |
| `src/services/api/admin/approval-chains.service.ts` | `list(query)`, `reassign(stepId, dto)` |

All services route through `@/lib/api-client` (axios; M0 401-refresh interceptor; X-Request-ID propagation). Zero raw `fetch()` calls (F-FE-001).

---

## 6. Codex FE Lessons Embedded

Codex FE adversarial review SKIPPED per same developer decision as BE (memory `feedback_skip_codex_review_dexian_decision.md`). Compensating control: cumulative scan of historical Codex FE lessons applied during implementation.

| Lesson | Status in M2 | Evidence |
|---|---|---|
| **F-FE-001** — all axios calls go through `@/lib/api-client` (preserves 401 refresh + X-Request-ID); no raw `fetch()` | Confirmed | Integration Verifier `rawFetchAntipattern=ok`. Zero `fetch(` in `src/services/api/` and `src/features/approvals/`. |
| **F-FE-002** — `useDoubleSubmitLock` on every mutation submit handler | Applied | All 4 dialogs (Decide, Submit, MatrixSave, Reassign) import and apply the lock. Integration Verifier `doubleSubmitLockDetail` confirms. |
| **F-FE-M1** — no localStorage drafts | N/A | M2 has no localStorage drafts. |
| **F-FE-M2** — error handlers funnel through `translateApiError` with namespaced fallback keys | Applied | `useApprovals.ts` 6 onError handlers all call `translateApiError(err, t, 'errors.approval.*')`. |
| **FE-R2-001** — no localStorage state | N/A | M2 has no localStorage state. |

---

## 7. TypeScript Types Introduced

From `src/types/entities/approval.types.ts`:

| Type | Description |
|---|---|
| `M2ContractStatusExtension` | `'in_approval' \| 'cancelled'` |
| `ContractStatus` | Widened to `M1aContractStatus \| M2ContractStatusExtension` (16 values) |
| `M2ActivityTypeExtension` | 5 namespace-prefixed approval activity types |
| `ActivityType` | Widened to `M1aActivityType \| M2ActivityTypeExtension` (14 values) |
| `ApprovalChainStatus` | `'in_progress' \| 'approved' \| 'rejected' \| 'resubmission_requested' \| 'cancelled'` |
| `ApprovalStepStatus` | 8-value union (delegated / reassigned reserved, unwritten by M2) |
| `ApprovalDecisionType` | `'approve' \| 'reject' \| 'request_resubmission' \| 'delegate' \| 'reassign' \| 'escalate'` |
| `ApprovalPendingSort` | `'oldest' \| 'newest' \| 'highest_value'` |
| `ApprovalMatrix`, `ApprovalMatrixRuleInput`, `UpdateApprovalMatrixDto`, `CreateApprovalMatrixDto`, `ApprovalMatrixListQuery`, `ApprovalMatrixListResponse`, `ApprovalMatrixSetResponse`, `ApprovalMatrixSnapshotEntry` | Matrix admin |
| `ApprovalChain`, `ApprovalChainStepDecisionItem`, `ApprovalChainStepDetail`, `ApprovalChainGetResponseChain`, `ApprovalChainDetail`, `ApprovalChainGetResponse`, `ApprovalChainListItem`, `ApprovalChainListQuery`, `ApprovalChainListResponse` | Chain detail / list |
| `RouteInitPreviewStep`, `RouteInitPreviewRequest`, `RouteInitPreviewResponse` | S6 preview |
| `SubmitForApprovalRequest` (`Record<string, never>`), `SubmitForApprovalResponse` | S7 |
| `ApprovalStep`, `ApprovalDecision` | Entity-level |
| `MyPendingApprovalListItem`, `MyPendingApprovalListQuery`, `MyPendingApprovalListResponse` | S1 |
| `DecideApprovalDto`, `DecideApprovalResponse` | S2 |
| `DelegateApprovalDto`, `DelegateApprovalResponse` | S3 |
| `ReassignApprovalDto`, `ReassignApprovalResponse` | S8 |
| `UpdateContractStatusUserDto`, `UpdateContractStatusUserResponse` | S12 (M2 / AE-2 — supersedes M1a `UpdateContractStatusDto` on the wire; same field shape, narrower transition matrix) |
| `M2_NEW_PERMISSIONS`, `M2PermissionCode` | 6-tuple constant + derived union |
| `M2_SENSITIVE_FIELD_EXTENSIONS`, `M2SensitiveFieldName` | `decision_note`, `matrix_snapshot` |

`ApprovalChain` (entity-level, includes `matrixSnapshot`) is intentionally distinct from `ApprovalChainGetResponseChain` (lighter wire projection without `matrixSnapshot` — M2 forensic-only redaction). Q3-OI-A documents the asymmetry.

---

## 8. Key UI Decisions

1. **No drag-and-drop reorder in `MatrixRuleEditor`.** Rule order is managed via keyboard-accessible up/down buttons (T6 a11y). Drag handles add complexity without a screen-reader story; M2 admin volume is low.
2. **`ApprovalChainPreview` two modes from one component.** `mode='preview'` calls `POST /contracts/:id/approval-chain/preview`; `mode='read-only'` calls `GET /contracts/:id/approval-chain`. Visual rendering is identical (step list + parallel-group brackets); only the data source differs. Avoids two near-identical components.
3. **`SubmitForApprovalDialog` embeds the preview.** Drafter sees the routed approvers BEFORE clicking Submit, surfacing `hasNoMatchingRule=true` with a "configure matrix first" hint per AC-S6-05.
4. **`ApprovalsListView` polls every 30 s rather than subscribing.** Aligns with HQ1 (no notification table, no realtime) and the FE service stack — TanStack Start + React Query refetchInterval is the simplest path to "near-live" behaviour.
5. **`ContractStatusDialog` `UPDATE_CONTRACT_STATUS_USER_TARGETS` as a static map.** Keyed by source `ContractStatus`. Surfaces only valid targets so the user never sees impossible options (e.g. `draft → approved` is gone — would 409 anyway). Empty `narrowedTargets` emits an explicit hint message.

---

## 9. Deferred Follow-Ups (from FE Implementation)

| ID | Topic | Notes |
|---|---|---|
| FI1 | Embed `ApprovalChainPreview` in ContractDetail Activity tab | Component shipped; integration into existing `src/features/contracts/components/ContractDetail.tsx` (which uses `ContractCenterTabs` from Lovable) deferred to next module. |
| FI2 | Sidebar links for `/app/approvals` + admin sub-routes | `Sidebar.tsx` is global shell; not in M2 scope. Users navigate via direct URLs or approval emails. |
| FI3 | Live role list endpoint for `MatrixRuleEditor` | `MatrixRuleEditor` receives `APPROVER_ROLES` via prop; `ApprovalMatrixView` passes a hardcoded seed list. M3+ should add `GET /admin/roles`. |
| FI4 | `currentStepId` in `fn_approval_chain_list` response | `AdminApprovalChainsView` passes `currentStepOrder` as a placeholder when invoking `ApprovalReassignDialog`. BE shape tightening recommended for M2.x. |

Operational notes:
- **TanStack Router `routeTree.gen.ts` was manually patched.** The three new file-based routes were added by hand. The Vite plugin will rewrite the file based on `src/routes/*` contents on next `vite dev`; the additions should survive (since the source files exist). If drift occurs, re-run `vite dev` once and verify all three routes are present.
- **No new runtime dependencies.** No additions to `package.json`. `@tanstack/react-router`, `react-i18next`, `framer-motion`, `axios`, `zustand`, `@tanstack/react-query` already installed.

---

## 10. Files Owned by This Module

### New (14)

**Types:**
- `src/types/entities/approval.types.ts`

**Services:**
- `src/services/api/approval.service.ts`
- `src/services/api/admin/approval-matrix.service.ts`
- `src/services/api/admin/approval-chains.service.ts`

**Hooks:**
- `src/features/approvals/hooks/useApprovals.ts`

**Components:**
- `src/features/approvals/components/ApprovalsListView.tsx`
- `src/features/approvals/components/ApprovalDecisionDialog.tsx`
- `src/features/approvals/components/ApprovalChainPreview.tsx`
- `src/features/approvals/components/SubmitForApprovalDialog.tsx`
- `src/features/approvals/components/ApprovalReassignDialog.tsx`
- `src/features/approvals/components/AdminApprovalChainsView.tsx`
- `src/features/approvals/components/ApprovalMatrixView.tsx`
- `src/features/approvals/components/MatrixRuleEditor.tsx`

**Routes:**
- `src/routes/app/approvals.tsx`
- `src/routes/app/admin.approval-matrix.tsx`
- `src/routes/app/admin.approval-chains.tsx`

### Modified (7)

- `src/types/entities/contract.types.ts` — `ContractStatus` widened 14→16 (`M2ContractStatusExtension`); `UPDATE_CONTRACT_STATUS_USER_TARGETS` map; `UpdateContractStatusUserDto`.
- `src/services/api/contracts.service.ts` — `updateStatus` shape narrowed.
- `src/features/contracts/components/ContractStatusDialog.tsx` — narrow-transition map; M1a duplicate-allowed-list dropdown removed; M1a `m1aNote` amber banner removed.
- `src/features/contracts/components/ContractStatusBadge.tsx` — `in_approval` + `cancelled` styling.
- `src/features/contracts/components/ContractActivityLog.tsx` — `M2ActivityTypeExtension` exhaustiveness; new icons / labels for the 5 namespace-prefixed approval activity types.
- `src/i18n/en.json`, `src/i18n/ar.json` — +166 keys per locale.
- `src/routeTree.gen.ts` — manually patched with the 3 new routes (Vite plugin will regenerate from source on next dev run).

---

*Generated by Documentation Generator (Agent 15) post-QA Stage 4. Sources: requirements-analysis.json, fe-implementation-summary.json, types.ts, api-contracts.json, module-M2-file-manifest.json, qa-stage4-result.json. v1.0 — M2 ship.*
