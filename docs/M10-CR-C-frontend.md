# M10 / CR-C — Audit Hardening + Multi-Tenancy + Admin Cockpit Foundation — Frontend

> **Project:** Musanad Contracts Hub (`musanad-contracts`)
> **Module:** M10 — CR-C
> **Generated:** 2026-05-10
> **Pipeline:** Lovable Modernization v3.2 (Mode: REGENERATE — all CR-C FE surfaces are net-new admin cockpit pages; no Lovable components hardened in this CR).
> **Status:** Complete. tsc clean (0 errors). 161 i18n keys added; 4926/4926 EN/AR parity. 9 new components, 8 new route files, 7 new service files, 7 new type files.

This is the practical handoff for the developer extending CR-C FE surfaces or picking up an adjacent module. For the BE surface see `docs/api/openapi.yaml` (endpoints tagged "M10 — Audit Hardening + Multi-Tenancy + Admin Cockpit") and `docs/database/M10-CR-C-data-dictionary.md`. For the module summary see `docs/modules/M10-CR-C.md`.

---

## 1. Pages Added

| Route file | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `admin.audit.verify.tsx` | `/app/admin/audit/verify` | Protected | `audit.verify` | AuditVerifyPanel — walk + verify hash chain. Optional seq range inputs. Shows first mismatch or success. |
| `admin.demo.purge.tsx` | `/app/admin/demo/purge` | Protected | `demo.purge` (Super Admin only) | DemoPurgePanel + DataClassificationSummaryTable — dry-run preview then double-confirm purge. |
| `admin.tenants.tsx` | `/app/admin/tenants` | Protected | `tenant.read` | TenantList — paginated tenant viewer with search. |
| `admin.branding.tsx` | `/app/admin/branding` | Protected | `branding.manage` | BrandingEditor — logo/favicon multipart upload + color token hex inputs. |
| `admin.email-templates.tsx` | `/app/admin/email-templates` | Protected | `notification.template.manage` | EmailTemplateEditor list view — search, channel filter, sorted by updatedAt. |
| `admin.email-templates.$id.tsx` | `/app/admin/email-templates/:id` | Protected | `notification.template.manage` | EmailTemplateEditor detail — EN/AR side-by-side editor + live render preview. |
| `admin.email-config.tsx` | `/app/admin/email-config` | Protected | `email.config.manage` | SmtpConfigForm — SMTP settings + test-send modal. |
| `admin.roles.edit.$id.tsx` | `/app/admin/roles/:id/edit` | Protected | `role.manage` | RoleEditor — permission grid + rename (built-in roles: rename/delete disabled). |

**Pages extended (additive):**
- `admin.roles.tsx` — Add role button (opens CreateRoleDialog) + per-row Edit and Delete actions.
- `admin.config.tsx` — Expanded from 3-tab to 7-tab layout adding Security, Email, Calendar, Audit Retention.

All routes are TanStack Router file-based with implicit code-splitting. All nest under the `/app` layout which provides the top-level ErrorBoundary and authentication guard.

---

## 2. Components Added

### `AuditVerifyPanel` (`src/components/admin/AuditVerifyPanel.tsx`)

**Purpose:** Trigger and display audit chain verification results.

**API calls:**

| Service method | Endpoint | When called |
|---|---|---|
| `auditChainService.verify(startSeq?, endSeq?)` | `POST /api/v1/admin/audit/verify` | On "Verify" button click |

**React Query:** `useMutation` — no cache to invalidate (read-only verification). `aria-live="polite"` on the result area (D5 compliance).

**Key state:** `startSeq`, `endSeq` optional range inputs. Result renders as green "Chain verified" or red "Tamper detected at row N" with `brokenAtSeq`, `expectedHash`, and `actualHash` values.

---

### `DataClassificationSummaryTable` (`src/components/admin/DataClassificationSummaryTable.tsx`)

**Purpose:** Display per-table demo/pilot/production counts powering the DemoPurgePanel summary card.

**API calls:**

| Service method | Endpoint | When called |
|---|---|---|
| `demoService.getClassificationSummary()` | `GET /api/v1/admin/demo/data-classification-summary` | On mount |

**React Query:** `useQuery(['admin-demo-classification-summary'])`. Invalidated by successful purge mutation.

**Key state:** None — display-only. Uses `scope="col"` on all `<th>` elements (D7 compliance). 5 columns: Table, Demo, Pilot, Production, Total.

---

### `DemoPurgePanel` (`src/components/admin/DemoPurgePanel.tsx`)

**Purpose:** Two-step demo purge — dry-run preview then double-confirm actual purge.

**API calls:**

| Service method | Endpoint | When called |
|---|---|---|
| `demoService.purge({ dryRun: true })` | `POST /api/v1/admin/demo/purge` | "Preview" button |
| `demoService.purge({ dryRun: false, confirmToken })` | `POST /api/v1/admin/demo/purge` | "Confirm Purge" in modal |

**React Query:** Two mutations — previewMutation and purgeMutation. purgeMutation `onSuccess` invalidates `['admin-demo-classification-summary']`.

**Key state:** `dryRunResult` (preview counts), `confirmToken` (typed by user). `useFocusTrap` on the confirmation modal (D3 compliance). Submit button disabled via `purgeMutation.isPending`.

**Role gate:** Panel content hidden with `{ user?.role?.name === 'Super Admin' }` check — defense-in-depth alongside BE permission gate.

---

### `TenantList` (`src/components/admin/TenantList.tsx`)

**Purpose:** Paginated searchable list of tenants.

**API calls:**

| Service method | Endpoint | When called |
|---|---|---|
| `tenantsService.list(page, limit, search)` | `GET /api/v1/admin/tenants` | On mount and filter change |

**React Query:** `useQuery(['admin-tenants', page, limit, debouncedSearch])`. `useDebounce(300)` on search input.

**Key state:** `page`, `limit`, `search` filter. Renders `createdAt` via `formatDateTime`. `scope="col"` on all `<th>` (7 columns).

---

### `CreateRoleDialog` (`src/components/admin/CreateRoleDialog.tsx`)

**Purpose:** Modal for creating a new application role.

**API calls:**

| Service method | Endpoint | When called |
|---|---|---|
| `rolesMgmtService.createRole({ name, description })` | `POST /api/v1/admin/roles` | On form submit |

**React Query:** `useMutation`. `onSuccess`: `invalidateQueries(['admin-roles'])` + dialog close + form reset. 409 collision shows toast with `role_name_already_exists` message. `useFocusTrap` active while dialog is open.

---

### `RoleEditor` (`src/components/admin/RoleEditor.tsx`)

**Purpose:** Edit a role's name, description, and permission assignments. Built-in roles show the permission grid but disable rename/delete.

**API calls:**

| Service method | Endpoint | When called |
|---|---|---|
| `rolesMgmtService.getRole(id)` | `GET /api/v1/roles/:id` (existing read path) | On mount |
| `rolesMgmtService.updateRole(id, dto)` | `PATCH /api/v1/admin/roles/:id` | On "Save" |
| `rolesMgmtService.deleteRole(id)` | `DELETE /api/v1/admin/roles/:id` | On "Delete" (built-in = disabled) |
| `rolesMgmtService.grantPermission(roleId, permId)` | `POST /api/v1/admin/roles/:id/permissions/:permId/grant` | On permission toggle on |
| `rolesMgmtService.revokePermission(roleId, permId)` | `DELETE /api/v1/admin/roles/:id/permissions/:permId/revoke` | On permission toggle off |

**React Query:** `useQuery(['admin-role', id])` + `useQuery(['admin-permissions'])`. Grant/revoke mutations each `invalidateQueries(['admin-role', id])`.

**Key UI decisions:**
- `isBuiltIn` flag derived from comparing `role.name` against the hard-coded 8-name constant (mirrors OPEN-DECISION-E). Rename input and delete button hidden for built-in roles.
- Essential grant protection: grant/revoke toggles for Super Admin essential permissions are visually disabled. 422 response from revoke attempt toasts `cannot revoke system grant`.

---

### `BrandingEditor` (`src/components/admin/BrandingEditor.tsx`)

**Purpose:** Upload logo/favicon, edit color tokens, preview brand.

**API calls:**

| Service method | Endpoint | When called |
|---|---|---|
| `brandingService.getSettings()` | `GET /api/v1/admin/settings?category=branding` | On mount |
| `brandingService.upload(kind, file)` | `POST /api/v1/admin/branding/upload` (multipart) | On file select |
| `brandingService.updateColor(key, value)` | `PATCH /api/v1/admin/settings/:key` | On color input blur |

**React Query:** `useQuery(['admin-branding-settings'])`. Upload mutation `onSuccess` invalidates the query.

**Key UI decisions:**
- 4 hex literal `#000000` / `#B8935A` / `#5B8374` values appear in `<input type="color">` elements as fallbacks and placeholders — **not styling tokens**. Allowed by QA C13 skip rule (controls that display/edit hex values).
- `authPassRef` pattern NOT applicable here. Branding color values are non-secret.

---

### `EmailTemplateEditor` (`src/components/admin/EmailTemplateEditor.tsx`)

**Purpose:** List and edit notification templates, with live render preview.

**API calls:**

| Service method | Endpoint | When called |
|---|---|---|
| `notificationTemplatesService.list(page, limit, channel, search)` | `GET /api/v1/admin/notification-templates` | List view mount |
| `notificationTemplatesService.getById(id)` | `GET /api/v1/admin/notification-templates/:id` | Detail view mount |
| `notificationTemplatesService.update(id, dto)` | `PATCH /api/v1/admin/notification-templates/:id` | On "Save" |
| `notificationTemplatesService.render({ templateId, channel, locale, parameters })` | `POST /api/v1/admin/notification-templates/render` | On "Preview" button |

**React Query:** `useQuery(['admin-notification-templates', filters])` (list), `useQuery(['admin-notification-template', id])` (detail). Update mutation `onSuccess` invalidates both.

**Key UI decisions:** `templateId` and `channel` fields are display-only (immutable after create — matches AC-S12-05). Preview renders the EN body by default; locale toggle switches to AR rendering. `missingParameters[]` shown as warning chips below the preview.

---

### `SmtpConfigForm` (`src/components/admin/SmtpConfigForm.tsx`)

**Purpose:** SMTP server configuration form + test-send modal.

**API calls:**

| Service method | Endpoint | When called |
|---|---|---|
| `emailConfigService.get()` | `GET /api/v1/admin/email-config` | On mount |
| `emailConfigService.update(dto)` | `PATCH /api/v1/admin/email-config` | On "Save" |
| `emailConfigService.testSend(recipient?)` | `POST /api/v1/admin/email-config/test-send` | On "Send test email" in modal |

**React Query:** `useQuery(['admin-email-config'])`. Update mutation + testSend mutation both use `onSuccess`/`onError` toast pattern.

**Key UI decisions:**
- `authPassRef` is WRITE-ONLY: GET response never includes the secret value — only `authPassRefSet: boolean` is shown ("Password configured ✓" or "Not configured"). The password field in the form is a new-value-only input; leaving it blank on PATCH preserves the stored value.
- Test-send modal: optional recipient override field. Default is the calling admin's email (shown as placeholder).

---

## 3. Service Layer

All 7 service files live under `src/services/api/admin/`:

| File | Methods | Endpoint group |
|---|---|---|
| `audit-chain.service.ts` | `verify(startSeq?, endSeq?)` | POST /admin/audit/verify |
| `demo.service.ts` | `purge(opts)`, `getClassificationSummary()` | POST /admin/demo/purge, GET /admin/demo/data-classification-summary |
| `tenants.service.ts` | `list(page, limit, search)`, `getById(id)` | GET /admin/tenants, GET /admin/tenants/:id |
| `roles-mgmt.service.ts` | `createRole(dto)`, `updateRole(id, dto)`, `deleteRole(id)`, `grantPermission(roleId, permId)`, `revokePermission(roleId, permId)` | /admin/roles/* |
| `notification-templates.service.ts` | `list(params)`, `getById(id)`, `update(id, dto)`, `render(dto)` | /admin/notification-templates/* |
| `email-config.service.ts` | `get()`, `update(dto)`, `testSend(recipient?)` | /admin/email-config/* |
| `branding.service.ts` | `getSettings()`, `upload(kind, file)`, `updateColor(key, value)` | GET /admin/settings?category=branding, POST /admin/branding/upload, PATCH /admin/settings/:key |

All services use `apiClient` (axios instance from `src/lib/api-client.ts`). No component imports apiClient directly (QA A6/A7 PASS). Response envelope unwrap: all services extract `response.data.data` from the `ApiResponse<T>` wrapper.

---

## 4. TypeScript Types

Types live under `src/types/admin/`:

| File | Key types |
|---|---|
| `audit-chain.types.ts` | `AuditChainVerifyRequest`, `AuditChainVerifyResult` |
| `demo.types.ts` | `DemoPurgeRequest`, `DemoPurgeResult`, `DataClassificationSummary`, `DataClassificationRow` |
| `tenants.types.ts` | `TenantSummary`, `TenantDetail`, `ListTenantsResponse` |
| `roles-mgmt.types.ts` | `CreateRoleDto`, `UpdateRoleDto`, `RoleCreateResult`, `RoleUpdateResult`, `RoleDeleteResult`, `RolePermissionGrantResult`, `RolePermissionRevokeResult` |
| `notification-templates.types.ts` | `NotificationTemplate`, `NotificationTemplateSummary`, `NotificationTemplateUpdateDto`, `NotificationTemplateRenderRequest`, `NotificationTemplateRenderResult` |
| `email-config.types.ts` | `SmtpConfig`, `EmailConfigPatchDto`, `EmailTestSendRequest`, `EmailTestSendResult` |
| `branding.types.ts` | `BrandingUploadRequest`, `BrandingUploadResult` |

---

## 5. i18n Keys Added (161 keys, EN + AR parity)

**Namespace breakdown (illustrative — exact keys in en.json / ar.json):**

| Namespace prefix | Keys added | Coverage |
|---|---|---|
| `admin.audit.*` | ~18 | AuditVerifyPanel labels, result messages, seq range inputs |
| `admin.demo.*` | ~22 | DemoPurgePanel labels, dry-run summary, confirm token instructions, toast messages |
| `admin.tenants.*` | ~15 | TenantList table headers, search placeholder, empty states |
| `admin.branding.*` | ~20 | BrandingEditor labels, upload instructions, color token names |
| `admin.emailTemplates.*` | ~35 | EmailTemplateEditor list/detail labels, preview UI, parameter schema display |
| `admin.emailConfig.*` | ~25 | SmtpConfigForm field labels, validation messages, test-send modal |
| `admin.roles.*` (additions) | ~12 | CreateRoleDialog, RoleEditor permission grid headings, built-in protection messages |
| `admin.config.*` (additions) | ~14 | 4 new tab labels + system setting descriptions for new categories |

Total across both locales: **4926 EN keys / 4926 AR keys** (i18n parity verified independently post-implementation; 0 missing keys in either direction).

---

## 6. Key UI Decisions

1. **authPassRef write-only pattern:** The SMTP password is never surfaced in a read/display context. The GET endpoint returns `authPassRefSet: boolean` only. The form renders a new-value-only input with placeholder "Leave blank to retain current password." This pattern should be reused for any future secret-key management (API keys, OAuth client secrets).

2. **DemoPurgePanel two-step UX:** The dry-run preview step (Step 1) is mandatory before the confirm modal (Step 2) can open. This prevents accidental purges by ensuring the operator has seen exactly what will be deleted. The `confirmToken` is computed by the FE from `new Date()` and shown in the modal's instruction text — the operator must type it manually, not copy-paste. This adds friction by design.

3. **Built-in role protection via client-side constant:** `RoleEditor` derives `isBuiltIn` from a hard-coded 8-name array mirroring OPEN-DECISION-E. This is defense-in-depth only — the BE also blocks the operations. If new built-in roles are added server-side, the FE constant must be updated in the same PR.

---

## 7. Files Owned by This Module

**FE Components (new):**
- `src/components/admin/AuditVerifyPanel.tsx`
- `src/components/admin/DataClassificationSummaryTable.tsx`
- `src/components/admin/DemoPurgePanel.tsx`
- `src/components/admin/TenantList.tsx`
- `src/components/admin/CreateRoleDialog.tsx`
- `src/components/admin/RoleEditor.tsx`
- `src/components/admin/BrandingEditor.tsx`
- `src/components/admin/EmailTemplateEditor.tsx`
- `src/components/admin/SmtpConfigForm.tsx`

**FE Routes (new):**
- `src/routes/app/admin.audit.verify.tsx`
- `src/routes/app/admin.demo.purge.tsx`
- `src/routes/app/admin.tenants.tsx`
- `src/routes/app/admin.branding.tsx`
- `src/routes/app/admin.email-templates.tsx`
- `src/routes/app/admin.email-templates.$id.tsx`
- `src/routes/app/admin.email-config.tsx`
- `src/routes/app/admin.roles.edit.$id.tsx`

**FE Routes (extended):**
- `src/routes/app/admin.roles.tsx`
- `src/routes/app/admin.config.tsx`
- `src/config/sidebar.ts`

**FE Types:**
- `src/types/admin/audit-chain.types.ts`
- `src/types/admin/demo.types.ts`
- `src/types/admin/tenants.types.ts`
- `src/types/admin/roles-mgmt.types.ts`
- `src/types/admin/notification-templates.types.ts`
- `src/types/admin/email-config.types.ts`
- `src/types/admin/branding.types.ts`

**FE Services:**
- `src/services/api/admin/audit-chain.service.ts`
- `src/services/api/admin/demo.service.ts`
- `src/services/api/admin/tenants.service.ts`
- `src/services/api/admin/roles-mgmt.service.ts`
- `src/services/api/admin/notification-templates.service.ts`
- `src/services/api/admin/email-config.service.ts`
- `src/services/api/admin/branding.service.ts`

**E2E Tests:**
- `tests/e2e/CR-C-admin-audit-verify.spec.ts`
- `tests/e2e/CR-C-admin-branding.spec.ts`
- `tests/e2e/CR-C-admin-config-7tabs.spec.ts`
- `tests/e2e/CR-C-admin-email-config.spec.ts`
- `tests/e2e/CR-C-admin-roles.spec.ts`
- `tests/e2e/CR-C-demo-moment-S16.spec.ts`

---

*Generated: 2026-05-10 | Agent 15 — Documentation Generator | Source: workspace/current-module/ (api-contracts.json, fe-implementation-summary.json, module-M10-test-report.md, qa-stage4-report.md)*
