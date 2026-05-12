# M13 — Correlation Rule Engine + DSL — Frontend

Generated: 2026-05-12T17:00:00Z
Status: Complete

---

## Pages

| Page | Route | Auth | Roles | Description |
|---|---|---|---|---|
| AdminRulesList | /app/admin/rules | Protected | platform_admin, legal_counsel | Paginated list of all correlation rules with enabled status, scenario tag, and version hash |
| AdminRuleDetail | /app/admin/rules/$id | Protected | platform_admin, legal_counsel | Full rule detail with YAML editor, fixture list, and test-against-fixture panel |
| CorrelationsList | /app/correlations | Protected | platform_admin, legal_counsel | Paginated list of active/dismissed/expired correlations with dismiss flow |

---

## Components and State

### AdminRulesList (/app/admin/rules/page.tsx)

**Purpose**: Shows all correlation rules for the tenant with filtering by enabled state, scenario tag, and name search. Platform admins can create, enable/disable, and soft-delete rules from this view. Legal counsel has read-only access.

**API calls**:
| Service method | Endpoint | When called |
|---|---|---|
| ruleService.list(params) | GET /api/v1/admin/rules | On mount + on filter/page change (debounced 300ms) |
| ruleService.create(data) | POST /api/v1/admin/rules | On create modal form submit |
| ruleService.delete(id) | DELETE /api/v1/admin/rules/:id | On delete confirm (destructive confirmation D9) |
| ruleService.update(id, { enabled }) | PATCH /api/v1/admin/rules/:id | On enabled toggle switch |

**React Query**:
| Query key | Purpose | Invalidated by |
|---|---|---|
| ['rules', 'list', filters] | Rules list | create, update, delete mutations |

**Key state**:
- Filter state: enabled (boolean), scenario (string), search (text, 300ms debounce)
- Create rule modal open/closed; form state for ruleId, name, nameAr, scenario, matchYaml, produceYaml, meta

---

### AdminRuleDetail (/app/admin/rules/$id/page.tsx)

**Purpose**: Full rule view with: (1) rule metadata and friendly form editor for known predicates + Advanced YAML tab as escape hatch; (2) fixture list showing expected_match for each fixture; (3) test-against-fixture panel that runs a simulation and returns pass/fail with evidence.

**API calls**:
| Service method | Endpoint | When called |
|---|---|---|
| ruleService.getById(id) | GET /api/v1/admin/rules/:id | On mount |
| ruleService.update(id, data) | PATCH /api/v1/admin/rules/:id | On save in edit form |
| ruleService.testAgainstFixture(id, body) | POST /api/v1/admin/rules/:id/test | On 'Run Test' button |

**React Query**:
| Query key | Purpose | Invalidated by |
|---|---|---|
| ['rules', id] | Single rule detail | update mutation |
| ['rules', id, 'test-result'] | Fixture test result | testAgainstFixture mutation |

**Key state**:
- Edit form state with YAML editors (CodeMirror or textarea) for matchYaml and produceYaml
- Selected fixture (for single-fixture test run)
- Test result display state: pass/fail, matchEvidence, matchReason, diffNotes, durationMs
- Tab state: friendly form vs Advanced YAML tab

---

### CorrelationsList (/app/correlations/page.tsx)

**Purpose**: Shows all correlation rows for the tenant (active, dismissed, expired) with filtering by contract, status, rule, and date range. Platform admins and legal counsel can dismiss active correlations with a mandatory business reason.

**API calls**:
| Service method | Endpoint | When called |
|---|---|---|
| correlationService.list(params) | GET /api/v1/correlations | On mount + on filter/page change (debounced 300ms) |
| correlationService.dismiss(id, reason) | POST /api/v1/correlations/:id/dismiss | On dismiss confirm in dismiss modal |

**React Query**:
| Query key | Purpose | Invalidated by |
|---|---|---|
| ['correlations', 'list', filters] | Correlations list | dismiss mutation |

**Key state**:
- Filter state: contractId, status (active/dismissed/expired), ruleId, fromDate, toDate
- Dismiss modal: selected correlationId, reason text (min 10 chars, max 2000 chars)
- Loading/error/empty states for list and modal independently

---

## Service Layer

### src/services/rule.service.ts

| Method | Endpoint | Description |
|---|---|---|
| list(params) | GET /api/v1/admin/rules | Paginated rule list with filters |
| getById(id) | GET /api/v1/admin/rules/:id | Full rule detail with fixtures |
| create(data) | POST /api/v1/admin/rules | Create new rule with DSL YAML bodies |
| update(id, data) | PATCH /api/v1/admin/rules/:id | Partial update — name, scenario, enabled, YAML, meta |
| delete(id) | DELETE /api/v1/admin/rules/:id | Soft-delete (is_active = false) |
| testAgainstFixture(id, body) | POST /api/v1/admin/rules/:id/test | Run rule against fixture in simulation mode |

### src/services/correlation.service.ts

| Method | Endpoint | Description |
|---|---|---|
| list(params) | GET /api/v1/correlations | Paginated correlation list with filters |
| dismiss(id, data) | POST /api/v1/correlations/:id/dismiss | Dismiss active correlation with mandatory reason |

---

## TypeScript Types

From `src/types/rule.types.ts` and `src/types/correlation.types.ts`:

| Type | Description |
|---|---|
| CorrelationRule | Full rule row: id, tenantId, ruleId, name, nameAr, scenario, enabled, meta, matchYaml, produceYaml, versionHash, lastReviewedBy/Name/At, dataClassification, audit columns, fixtures |
| CorrelationRuleListItem | List-view projection: id, ruleId, name, nameAr, scenario, enabled, lastReviewedAt, versionHashShort, versionHash, updatedAt |
| CreateCorrelationRuleDto | Input for rule creation: ruleId, name, nameAr, scenario, enabled, matchYaml, produceYaml, meta |
| UpdateCorrelationRuleDto | Partial update input: all fields optional, at least one required |
| CorrelationRuleFixture | Fixture row: id, fixtureId, description, expectedMatch |
| RuleTestAgainstFixtureResult | Test result: ruleId, fixtureId, expectedMatch, actualMatch, matchEvidence, matchReason, diffNotes, passed, durationMs |
| Correlation | Full correlation row: id, tenantId, signalId, contractId, contractTitleEn/Ar, ruleId, ruleName, ruleScenario, ruleVersionHash, confidence, matchReason, matchEvidence, matchGeographies, matchEntities, status, dismissedBy/At/Reason, expiresAt, dataClassification, audit columns |
| CorrelationDismissResult | Dismiss response: correlationId, newStatus |
| CorrelationStatus | Union type: 'active' | 'dismissed' | 'expired' |

---

## i18n Keys Added

Approximately 79 net-new keys in the M13 surface (portion of the +159 total M12+M13 addition):

| Namespace | Coverage |
|---|---|
| admin.rules.* | List page headings and labels, create/edit form field labels (rule ID, name, name AR, scenario, enabled toggle), YAML editor labels, Advanced tab label, scenario tag chips, version hash display ('Version', 'Short'), last-reviewed badge, test panel ('Run Test', 'All Fixtures', fixture result labels: passed/failed/evidence/reason/duration) |
| correlations.* | List page headings, filter labels (status, contract, rule, date range), status badges ('Active', 'Dismissed', 'Expired'), confidence display, matchReason label, dismiss button label, dismiss modal heading and mandatory-reason field label + character-count hint |

---

## Key UI Decisions

1. **Friendly form + Advanced YAML as co-equal tabs**: The rule create/edit form offers two modes — a structured friendly form that renders known Annex C predicates as labelled inputs, and an Advanced YAML textarea that exposes the raw match_yaml and produce_yaml bodies. Both tabs write to the same underlying state. When the user switches tabs, the current form values are serialized to YAML (friendly → advanced) or parsed from YAML (advanced → friendly, with parse error display if YAML is invalid). This satisfies HITL Q5 — SMEs use the friendly form; advanced users use YAML.

2. **versionHash display as truncated hex with copy button**: The rule detail page shows the 64-char version_hash as versionHashShort (first 8 chars) with a copy-full-hash button. This matches the git short-sha UX pattern that developers are familiar with and keeps the UI readable. The full hash is stored and available for comparison.

3. **Dismiss modal enforces minimum reason length client-side**: The dismiss modal disables the submit button until the reason field reaches 10 characters, matching the server-side constraint in fn_correlation_dismiss. An inline character-count hint shows the current / minimum / maximum. The reason is logged in the audit trail and displayed in the dismissedReason field on the correlation list — this serves as accountability for dismissal decisions.

4. **Test panel shows diff notes prominently on failure**: When a fixture test fails (actualMatch != expectedMatch), the RuleTestPanel renders diffNotes in a highlighted section above the match evidence. This surfaces the specific predicate that failed (e.g. 'signal.kind did not match: expected sanctions_list_update, got commodity_price') so the rule author can fix the match block directly.

---

## Files Owned by This Module

- `src/routes/app/admin/rules/page.tsx`
- `src/routes/app/admin/rules/$id/page.tsx`
- `src/routes/app/correlations/page.tsx`
- `src/features/rules/AdminRulesList.tsx`
- `src/features/rules/AdminRuleForm.tsx`
- `src/features/rules/RuleTestPanel.tsx`
- `src/features/correlations/CorrelationsList.tsx`
- `src/features/correlations/CorrelationDismissModal.tsx`
- `src/services/rule.service.ts`
- `src/services/correlation.service.ts`
- `src/types/rule.types.ts`
- `src/types/correlation.types.ts`
