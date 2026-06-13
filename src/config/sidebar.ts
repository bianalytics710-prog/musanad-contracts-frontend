/**
 * Canonical role → sidebar modules map.
 *
 * Adapted from Lovable's @/config/sidebar to our /app/* route structure.
 * Templates / Clauses / Parties / Obligations are intentionally listed
 * for visual parity with Lovable — they route to a ComingSoon placeholder.
 * Regulations + Queue likewise — render placeholder where Lovable links.
 *
 * CR-W (v1.5 Product Module Toggle):
 *   - MODULES record is the canonical display-metadata registry — unchanged.
 *   - BE_TO_FE_KEY maps BE module keys (snake_case / dotted) to FE ModuleKey where
 *     they differ. Built from the CR-U 25-module catalog seed.
 *   - modulesForEffectiveSet(effectiveModules) replaces the runtime of
 *     modulesForRole: returns the ordered SidebarModule[] for the given
 *     effectiveModules string[] from the BE auth payload.
 *   - modulesForRole is kept as a FALLBACK for offline/test contexts where
 *     effectiveModules has not yet been populated (e.g. during hydration).
 */
import {
  LayoutGrid,
  FileText,
  FileStack,
  Quote,
  Scale,
  PenLine,
  CheckCircle2,
  Shield,
  Users as UsersIcon,
  CalendarClock,
  Radar,
  KeyRound,
  ScrollText,
  Palette,
  Settings as SettingsIcon,
  Activity,
  Globe,
  Mail,
  Building2,
  ShieldCheck,
  Trash2,
  Inbox,
  BookOpen,
  GitMerge,
  ClipboardList,
  SlidersHorizontal,
  // M15 / CR-G dashboard icons
  Wrench,
  TrendingUp,
  ShieldAlert,
  Package,
  // M16 / CR-H advisory + notification icons
  FileEdit,
  Bell,
  BellRing,
  // M17-M18 / CR-I+CR-J demo harness icon
  FlaskConical,
  // M22 / CR-MIG-DRIVE — migration icon
  Database,
  // M19-M20 / CR-K + CR-L Risk Cases + Reports
  ShieldX,
  FileBarChart2,
  // CR-M — Labor-Law Cascade
  ListChecks,
  // M21 / CR-N — Financial Intelligence Budget Burn
  DollarSign,
  // M21 / CR-O — Financial Intelligence Trade Margin
  BarChart2,
  // R-IL — Industry catalogs admin
  Layers,
  Server,
  BellOff,
} from "lucide-react";

export type AppRole =
  | "Super Admin"
  | "platform_admin"
  | "legal_counsel"
  | "contract_drafter"
  | "contract_approver"
  | "contract_approver_2"
  | "contract_recipient"
  | "executive"
  // M15 / CR-G — 3 new persona roles
  | "operations"
  | "finance_treasury"
  | "compliance_esg"
  // CR-M — seeded in migration 292 (closes DEFECT-CRH-DB-01)
  | "procurement_supplier_risk";

export type ModuleKey =
  // M21 — My Work cross-cutting inbox
  | "myWork"
  | "insights"
  | "contracts"
  | "compose"
  | "templates"
  | "clauses"
  | "regulations"
  | "radar"
  | "approvals"
  | "queue"
  | "obligations"
  | "parties"
  | "admin"
  // M15 / CR-G — 4 new persona dashboard modules
  | "dashboards.operations"
  | "dashboards.financeTreasury"
  | "dashboards.complianceEsg"
  | "dashboards.procurement"
  // M16 / CR-H — advisory queue for legal counsel
  | "legal.advisoryQueue"
  // L49 — Advisory templates management for legal counsel
  | "legal.advisoryTemplates"
  // TPA — Third-Party Agreement review for legal counsel
  | "legal.thirdPartyReview"
  // M19 / CR-K — Risk Cases (visible to all 7 dashboard personas)
  | "riskCases"
  // Phase B (mig 643, 2026-06-13) — Executive Risk Triage. Tier-2 borderline
  // alerts the engine wasn't confident enough to auto-route. Same component
  // as /app/admin/risk-review; executive surface only.
  | "riskTriage"
  // M20 / CR-L — Reports (visible to all)
  | "reports"
  // CR-M — Labor-Law Cascade (regulatory.cascade.read)
  | "compliance.regulatoryCascade"
  // M21 / CR-N — Financial Intelligence Budget Burn (finance.budget.read)
  | "financial.budgetBurn"
  // M21 / CR-O — Financial Intelligence Trade Margin (finance.margin.read)
  | "financial.tradeMargin";

export interface SidebarModule {
  key: ModuleKey;
  to: string;
  labelKey: string;
  defaultLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  /**
   * Display order integer matching the CR-U catalog seed display_order column.
   * CLM: 100–220, ECIP: 300–440, PLATFORM: 500–560.
   * Used by modulesForEffectiveSet to sort sidebar entries consistently.
   */
  displayOrder: number;
}

export const MODULES: Record<ModuleKey, SidebarModule> = {
  // ── M21 — My Work cross-cutting inbox (drafter landing page) ──────────────
  myWork:      { key: "myWork",      to: "/app/work",                labelKey: "nav.myWork",      defaultLabel: "My Work",     icon: Inbox,        displayOrder: 90  },
  // ── CLM bundle (display_order 100–220) ────────────────────────────────────
  insights:    { key: "insights",    to: "/app/dashboards/insights", labelKey: "nav.insights",    defaultLabel: "Insights",    icon: LayoutGrid,   displayOrder: 100 },
  contracts:   { key: "contracts",   to: "/app/contracts",           labelKey: "nav.contracts",   defaultLabel: "Contracts",   icon: FileText,     displayOrder: 110 },
  compose:     { key: "compose",     to: "/app/contracts/compose",   labelKey: "nav.compose",     defaultLabel: "Compose",     icon: PenLine,      displayOrder: 120 },
  templates:   { key: "templates",   to: "/app/templates",           labelKey: "nav.templates",   defaultLabel: "Templates",   icon: FileStack,    displayOrder: 130 },
  clauses:     { key: "clauses",     to: "/app/clauses",             labelKey: "nav.clauses",     defaultLabel: "Clauses",     icon: Quote,        displayOrder: 140 },
  parties:     { key: "parties",     to: "/app/parties",             labelKey: "nav.parties",     defaultLabel: "Parties",     icon: UsersIcon,    displayOrder: 150 },
  obligations: { key: "obligations", to: "/app/obligations",         labelKey: "nav.obligations", defaultLabel: "Obligations", icon: CalendarClock, displayOrder: 160 },
  regulations: { key: "regulations", to: "/app/regulations",         labelKey: "nav.impact",      defaultLabel: "Regulations", icon: Scale,        displayOrder: 170 },
  radar:       { key: "radar",       to: "/app/regulatory-radar",    labelKey: "nav.impactRadar", defaultLabel: "Reg. Radar",  icon: Radar,        displayOrder: 180 },
  approvals:   { key: "approvals",   to: "/app/approvals",           labelKey: "nav.approvals",   defaultLabel: "Approvals",   icon: CheckCircle2, displayOrder: 190 },
  queue:       { key: "queue",       to: "/app/queue",               labelKey: "nav.queue",       defaultLabel: "Queue",       icon: CheckCircle2, displayOrder: 200 },
  // M1c bulk import (mapped from BE key "imports")
  // Note: no dedicated sidebar entry for "imports" in the old ROLE_MODULES — kept at 220 for completeness

  // ── ECIP bundle (display_order 300–440) ───────────────────────────────────
  // M15 / CR-G — 4 new persona dashboard modules (gated by permission at render time)
  "dashboards.operations":       { key: "dashboards.operations",       to: "/app/dashboards/operations",       labelKey: "nav.dashboardsOperations",       defaultLabel: "Operations",         icon: Wrench,       displayOrder: 310 },
  "dashboards.financeTreasury":  { key: "dashboards.financeTreasury",  to: "/app/dashboards/finance-treasury", labelKey: "nav.dashboardsFinanceTreasury",  defaultLabel: "Finance & Treasury", icon: TrendingUp,   displayOrder: 320 },
  "dashboards.complianceEsg":    { key: "dashboards.complianceEsg",    to: "/app/dashboards/compliance-esg",   labelKey: "nav.dashboardsComplianceEsg",    defaultLabel: "Compliance & ESG",   icon: ShieldAlert,  displayOrder: 330 },
  "dashboards.procurement":      { key: "dashboards.procurement",      to: "/app/dashboards/procurement",      labelKey: "nav.dashboardsProcurement",      defaultLabel: "Procurement Risk",   icon: Package,      displayOrder: 340 },
  // M16 / CR-H
  "legal.advisoryQueue": { key: "legal.advisoryQueue", to: "/app/legal/advisory-queue", labelKey: "nav.legalAdvisoryQueue", defaultLabel: "Advisory Queue", icon: FileEdit, displayOrder: 350 },
  // L49 — Advisory templates (gated by advisory.template.manage)
  "legal.advisoryTemplates": { key: "legal.advisoryTemplates", to: "/app/admin/advisory-templates", labelKey: "nav.legalAdvisoryTemplates", defaultLabel: "Advisory Templates", icon: FileStack, displayOrder: 355 },
  // TPA — Third-Party Review (gated by tpa.review.read)
  "legal.thirdPartyReview": { key: "legal.thirdPartyReview", to: "/app/legal/third-party-review", labelKey: "nav.tpaReview", defaultLabel: "Third-Party Review", icon: ScrollText, displayOrder: 358 },
  // M19 / CR-K — Risk Cases
  riskCases: { key: "riskCases", to: "/app/risk-cases", labelKey: "nav.riskCases", defaultLabel: "Risk Cases", icon: ShieldX,      displayOrder: 360 },
  // Phase B (mig 643, 2026-06-13) — Risk Triage sits directly after Risk
  // Cases on the executive sidebar (per Phase B locked decision Q1).
  riskTriage: { key: "riskTriage", to: "/app/exec/risk-triage", labelKey: "nav.riskTriage", defaultLabel: "Risk Triage", icon: ShieldCheck, displayOrder: 365 },
  // M20 / CR-L — Reports
  // Reports bumped to displayOrder 490 (2026-06-04) so it always renders
  // as the last CLM-bundle entry — sits after Budget Burn (400) and Trade
  // Margin (410) on executive, after Risk Cases (360) on legal counsel, etc.
  reports:   { key: "reports",   to: "/app/reports",    labelKey: "nav.reports",   defaultLabel: "Reports",    icon: FileBarChart2, displayOrder: 490 },
  // CR-M — Labor-Law Cascade (gated by regulatory.cascade.read at render time)
  "compliance.regulatoryCascade": {
    key: "compliance.regulatoryCascade",
    to: "/app/compliance/regulatory-cascade",
    labelKey: "nav.complianceRegulatoryCASCADE",
    defaultLabel: "Regulatory Cascade",
    icon: ListChecks,
    displayOrder: 380,
  },
  // M21 / CR-N — Financial Intelligence Budget Burn (gated by finance.budget.read at render time)
  "financial.budgetBurn": {
    key: "financial.budgetBurn",
    to: "/app/financial/budget-burn",
    labelKey: "nav.financialBudgetBurn",
    defaultLabel: "Contract Spend Health",
    icon: DollarSign,
    displayOrder: 400,
  },
  // M21 / CR-O — Financial Intelligence Trade Margin (gated by finance.margin.read at render time)
  "financial.tradeMargin": {
    key: "financial.tradeMargin",
    to: "/app/financial/trade-margin",
    labelKey: "nav.financialTradeMargin",
    defaultLabel: "Index-Linked Contracts",
    icon: BarChart2,
    displayOrder: 410,
  },

  // ── PLATFORM bundle (display_order 500–560) ───────────────────────────────
  admin: { key: "admin", to: "/app/admin", labelKey: "nav.admin", defaultLabel: "Admin", icon: Shield, displayOrder: 500 },
};

export const ROLE_MODULES: Record<AppRole, ModuleKey[]> = {
  contract_drafter: [
    // M21 — My Work first; landing surface for assigned tasks.
    "myWork",
    "insights",
    "contracts",
    "compose",
    "templates",
    "clauses",
    "parties",
    // Demo prep 2026-06-09 — Obligations + Impact Watch hidden from
    // drafter sidebar. They remain accessible via direct URL + ⌘K for
    // power users; the routes + permissions stay live so deep links
    // don't break.
    // (removed) "obligations",
    // (removed) "regulations",
    // D48 — "dashboards.procurement" (M15 / CR-G) removed from the
    // drafter's sidebar. Procurement supplier-risk is Pari's persona
    // surface; surfacing the same dashboard to the contract drafter
    // added noise and didn't intersect her workflow. If a drafter needs
    // counterparty risk context, deep-linking from the contract detail
    // page is the canonical path. Pari + Eman + Omar retain their own
    // entries unchanged.
    // M19 / M20 — Risk Cases + Reports
    "riskCases",
    "reports",
  ],
  legal_counsel: [
    "insights",
    "contracts",
    "approvals",
    "templates",
    "clauses",
    // Demo prep 2026-06-09 — Obligations + Impact Watch hidden from
    // legal counsel sidebar (Impact Radar kept — it's the regulatory-
    // cascade telemetry Layla actively works in).
    // (removed) "regulations",
    "radar",
    // (removed) "obligations",
    "parties",
    // M16 / CR-H — advisory queue for legal counsel
    "legal.advisoryQueue",
    // L49 — Advisory templates
    "legal.advisoryTemplates",
    // TPA — Third-Party Review
    "legal.thirdPartyReview",
    // E-rev-E — Regulatory Cascade hidden from all sidebars to keep the
    // demo focused. Route + tables remain in the codebase; just no link.
    // M21 / CR-N — Budget Burn (read — legal counsel drafts cure notices)
    "financial.budgetBurn",
    // M19 / M20
    "riskCases",
    "reports",
  ],
  // R1 audit: Lovable approver sidebar is narrowly Insights / Approvals /
  // Contracts. Drop Obligations leak (was inherited from drafter mapping).
  // M15 / CR-G — procurement risk dashboard accessible to approver
  // M19 — Risk Cases visible (approvers can see + transition cases)
  // M20 — Reports library visible
  contract_approver: ["insights", "approvals", "contracts", "dashboards.procurement", "riskCases", "reports"],
  contract_approver_2: ["insights", "approvals", "contracts", "dashboards.procurement", "riskCases", "reports"],
  // R-RC0 audit: Lovable recipient sidebar is Insights / Contracts only.
  // Recipients sign contracts; they do not track obligations. Drop the
  // /app/obligations leak.
  // M20 — Reports library visible for downloadable shared briefings.
  contract_recipient: ["insights", "contracts", "reports"],
  // Platform admin is a tech-ops role. Their workbench is the admin sub-nav
  // (35 items, grouped). They land on /app/admin overview and navigate
  // everything from there — they don't need contracts, persona dashboards,
  // reports, etc. cluttering the top-level sidebar.
  platform_admin: ["admin"],
  "Super Admin": [
    "admin",
    "insights",
    "contracts",
    "compose",
    "approvals",
    "templates",
    "clauses",
    "parties",
    "obligations",
    "regulations",
    "radar",
    // M15 / CR-G — all 4 persona dashboards for Super Admin
    "dashboards.operations", "dashboards.financeTreasury", "dashboards.complianceEsg", "dashboards.procurement",
    // E-rev-E — Regulatory Cascade hidden from sidebars (demo focus).
    // M21 / CR-N — Financial Intelligence Budget Burn
    "financial.budgetBurn",
    // M21 / CR-O — Financial Intelligence Trade Margin
    "financial.tradeMargin",
    // M19 / M20
    "riskCases", "reports",
    // TPA — Third-Party Review
    "legal.thirdPartyReview",
  ],
  // R-EX0 audit: Lovable executive sidebar is Insights / Contracts /
  // Impact Watch only. Drop the Parties leak — executive consumes
  // insights, not raw counterparty CRUD.
  // M19 / M20 — Risk Cases + Reports for executive oversight.
  // CR-M — Regulatory Cascade (read)
  // M21 / CR-N — Budget Burn (read)
  // M21 / CR-O — Trade Margin (read)
  // M21 mig 638 — exec gets "Assigned Work" (label override at render time)
  // as the FIRST entry. The route still resolves to /app/work; the page
  // dispatches to AssignedByMeView when the role is "executive".
  executive: ["myWork", "insights", "contracts", "regulations", "financial.budgetBurn", "financial.tradeMargin", "riskCases", "riskTriage", "reports"],
  // CR-M — procurement_supplier_risk seeded in migration 292
  procurement_supplier_risk: [
    "insights",
    "dashboards.procurement",
    "contracts",
    // E-rev-E — Regulatory Cascade hidden from sidebars (demo focus).
    // M21 / CR-N — Budget Burn read access
    "financial.budgetBurn",
    "riskCases",
    "reports",
  ],
  // M15 / CR-G — 3 new persona roles with dedicated dashboard modules
  operations: [
    // O10/O42 — "insights" removed; operations role lands on /dashboards/operations
    // directly and "insights" was a duplicate sidebar entry pointing to the same page.
    "dashboards.operations",
    "contracts",
    // O31 — Impact Watch is operationally relevant (Brent / Hormuz / commodity
    // signals) and Omar already has read access; expose via sidebar so he can
    // find it without typing the URL.
    "regulations",
    // M21 / CR-N — Budget Burn read access
    "financial.budgetBurn",
    "riskCases",
    "reports",
  ],
  finance_treasury: [
    "insights",
    "dashboards.financeTreasury",
    "contracts",
    // M21 / CR-N — Budget Burn (primary persona)
    "financial.budgetBurn",
    // M21 / CR-O — Trade Margin (primary persona)
    "financial.tradeMargin",
    "riskCases",
    "reports",
  ],
  compliance_esg: [
    "insights",
    "dashboards.complianceEsg",
    "contracts",
    "regulations",
    "radar",
    // E-rev-E — Regulatory Cascade hidden from sidebars (demo focus).
    "riskCases",
    "reports",
  ],
};

/**
 * Admin sub-nav grouping (2026-06-03). 35 items split into 8 logical
 * sections so platform_admin's sidebar reads as a workbench rather than
 * a flat dump. Section keys are stable; ordering inside each section is
 * deliberate (most-used items first).
 */
export type AdminGroupKey =
  | "system"
  | "identity"
  | "workflow"
  | "templates"
  | "dataSources"
  | "ai"
  | "audit"
  | "diagnostics";

export interface AdminSubItem {
  to: string;
  labelKey: string;
  defaultLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Stable group key — drives the section header in the sidebar. */
  group: AdminGroupKey;
}

/**
 * Ordered list of admin section headers. The sidebar renders them in this
 * order; items are bucketed by their `group` field.
 */
export const ADMIN_GROUPS: ReadonlyArray<{
  key: AdminGroupKey;
  labelKey: string;
  defaultLabel: string;
}> = [
  { key: "system",       labelKey: "admin.group.system",       defaultLabel: "System configuration" },
  { key: "identity",     labelKey: "admin.group.identity",     defaultLabel: "Identity & access" },
  { key: "workflow",     labelKey: "admin.group.workflow",     defaultLabel: "Workflow & rules" },
  { key: "templates",    labelKey: "admin.group.templates",    defaultLabel: "Templates" },
  { key: "dataSources",  labelKey: "admin.group.dataSources",  defaultLabel: "Data sources" },
  { key: "ai",           labelKey: "admin.group.ai",           defaultLabel: "AI governance" },
  { key: "audit",        labelKey: "admin.group.audit",        defaultLabel: "Audit & compliance" },
  { key: "diagnostics",  labelKey: "admin.group.diagnostics",  defaultLabel: "Diagnostics" },
];

export const ADMIN_SUB_NAV: AdminSubItem[] = [
  // ── System configuration ────────────────────────────────────────────────
  { to: "/app/admin",                       labelKey: "nav.adminOverview",        defaultLabel: "Overview",              icon: LayoutGrid,        group: "system" },
  { to: "/app/admin/config",                labelKey: "nav.adminConfig",          defaultLabel: "Configuration",         icon: SettingsIcon,      group: "system" },
  { to: "/app/admin/branding",              labelKey: "nav.adminBranding",        defaultLabel: "Branding",              icon: Palette,           group: "system" },
  { to: "/app/admin/email-config",          labelKey: "nav.adminEmailConfig",     defaultLabel: "Email server",          icon: Mail,              group: "system" },
  { to: "/app/admin/migration",             labelKey: "nav.adminMigration",       defaultLabel: "Migration",             icon: Database,          group: "system" },

  // ── Identity & access ──────────────────────────────────────────────────
  { to: "/app/admin/users",                 labelKey: "nav.adminUsers",           defaultLabel: "Users",                 icon: UsersIcon,         group: "identity" },
  { to: "/app/admin/roles",                 labelKey: "nav.adminRoles",           defaultLabel: "Roles & permissions",   icon: KeyRound,          group: "identity" },
  { to: "/app/admin/tenants",               labelKey: "nav.adminTenants",         defaultLabel: "Tenants",               icon: Building2,         group: "identity" },
  { to: "/app/admin/product-modules",       labelKey: "admin.sidebar.productModules",   defaultLabel: "Product modules",       icon: Package,     group: "identity" },
  { to: "/app/admin/role-modules",          labelKey: "admin.sidebar.roleModuleAccess", defaultLabel: "Role × module access",  icon: LayoutGrid,  group: "identity" },

  // ── Workflow & rules ───────────────────────────────────────────────────
  { to: "/app/admin/approval-matrix",       labelKey: "nav.adminMatrix",          defaultLabel: "Approval matrix",       icon: KeyRound,          group: "workflow" },
  { to: "/app/admin/approval-chains",       labelKey: "nav.adminChains",          defaultLabel: "Approval chains",       icon: KeyRound,          group: "workflow" },
  { to: "/app/admin/rules",                 labelKey: "nav.adminRules",           defaultLabel: "Correlation rules",     icon: GitMerge,          group: "workflow" },
  { to: "/app/admin/scoring-weights",       labelKey: "nav.adminScoringWeights",  defaultLabel: "Scoring weights",       icon: SlidersHorizontal, group: "workflow" },
  { to: "/app/admin/risk-scoring",          labelKey: "nav.adminRiskScoring",     defaultLabel: "Risk scoring formula",  icon: SlidersHorizontal, group: "workflow" },
  { to: "/app/admin/clause-taxonomy",       labelKey: "nav.adminClauseTaxonomy",  defaultLabel: "Clause taxonomy",       icon: BookOpen,          group: "workflow" },
  { to: "/app/admin/notification-rules",    labelKey: "nav.adminNotificationRules", defaultLabel: "Notification rules",   icon: BellOff,           group: "workflow" },
  // AI Chat Actions (mig 633/634/635) — catalog of prompt-driven actions
  // the floating chatbot can fire. Platform admin toggles per tenant.
  { to: "/app/admin/ai-actions",            labelKey: "nav.adminAiActions",       defaultLabel: "AI chat actions",       icon: SlidersHorizontal, group: "ai" },

  // ── Templates ──────────────────────────────────────────────────────────
  { to: "/app/admin/email-templates",       labelKey: "nav.adminEmailTemplates",  defaultLabel: "Message templates",     icon: Mail,              group: "templates" },
  { to: "/app/admin/advisory-templates",    labelKey: "nav.adminAdvisoryTemplates", defaultLabel: "Advisory templates",  icon: FileEdit,          group: "templates" },
  { to: "/app/admin/report-templates",      labelKey: "nav.adminReportTemplates", defaultLabel: "Report templates",      icon: FileBarChart2,     group: "templates" },
  { to: "/app/admin/notifications",         labelKey: "nav.adminNotifications",   defaultLabel: "Notifications",         icon: Bell,              group: "templates" },

  // ── Data sources ───────────────────────────────────────────────────────
  { to: "/app/admin/sources",               labelKey: "nav.adminSources",         defaultLabel: "External sources",      icon: Globe,             group: "dataSources" },
  { to: "/app/admin/internal-systems",      labelKey: "nav.adminInternalSystems", defaultLabel: "Internal systems",      icon: Server,            group: "dataSources" },
  { to: "/app/admin/source-health",         labelKey: "nav.adminSourceHealth",    defaultLabel: "Source health",         icon: Activity,          group: "dataSources" },
  { to: "/app/admin/internal-signal-kinds", labelKey: "nav.adminInternalSignalKinds", defaultLabel: "Internal signal kinds", icon: Radar,         group: "dataSources" },
  { to: "/app/admin/regulations",           labelKey: "nav.adminRegs",            defaultLabel: "Regulations",           icon: Scale,             group: "dataSources" },
  { to: "/app/admin/impact-categories",     labelKey: "nav.adminImpacts",         defaultLabel: "Impact categories",     icon: Palette,           group: "dataSources" },
  { to: "/app/admin/imports",               labelKey: "nav.adminImports",         defaultLabel: "Imports",               icon: ScrollText,        group: "dataSources" },
  { to: "/app/admin/ingestion-queue",       labelKey: "nav.admin.ingestionQueue", defaultLabel: "Ingestion queue",       icon: Inbox,             group: "dataSources" },

  // ── AI governance ──────────────────────────────────────────────────────
  { to: "/app/admin/ai/cost-report",        labelKey: "nav.adminAiCost",          defaultLabel: "AI cost",               icon: Activity,          group: "ai" },
  { to: "/app/admin/ai/prompts",            labelKey: "nav.adminAiPrompts",       defaultLabel: "AI prompts",            icon: SettingsIcon,      group: "ai" },
  { to: "/app/admin/ai/requests",           labelKey: "nav.adminAiReqs",          defaultLabel: "AI requests",           icon: ScrollText,        group: "ai" },

  // ── Audit & compliance ─────────────────────────────────────────────────
  { to: "/app/admin/audit",                 labelKey: "nav.adminAudit",           defaultLabel: "Audit log",             icon: ScrollText,        group: "audit" },
  { to: "/app/admin/audit/verify",          labelKey: "nav.adminAuditVerify",     defaultLabel: "Audit verify",          icon: ShieldCheck,       group: "audit" },

  // ── Diagnostics ────────────────────────────────────────────────────────
  { to: "/app/admin/health",                labelKey: "nav.adminHealth",          defaultLabel: "Health",                icon: Activity,          group: "diagnostics" },
  { to: "/app/admin/demo",                  labelKey: "nav.adminDemo",            defaultLabel: "Demo Control",          icon: FlaskConical,      group: "diagnostics" },
  { to: "/app/admin/demo/purge",            labelKey: "nav.adminDemoPurge",       defaultLabel: "Demo purge",            icon: Trash2,            group: "diagnostics" },
  // Mig 538 — toggle persona visibility on the dev one-click login panel.
  { to: "/app/admin/dev-login-personas",    labelKey: "nav.adminDevPersonas",     defaultLabel: "Login personas",        icon: ShieldCheck,       group: "diagnostics" },
  // Mig 539 — reorder sidebar modules per role.
  { to: "/app/admin/sidebar-order",         labelKey: "nav.adminSidebarOrder",    defaultLabel: "Sidebar order",         icon: SlidersHorizontal, group: "identity" },
  // Mig 549/550 — Risk routing matrix + Risk review (manual triage for
  // low-confidence alerts). Both sit under Workflow & rules with the
  // approval matrix + correlation rules since they're the same family
  // of "how should the platform handle this incoming event" policy.
  { to: "/app/admin/risk-routing",          labelKey: "nav.adminRiskRouting",     defaultLabel: "Risk routing",          icon: SlidersHorizontal, group: "workflow" },
  { to: "/app/admin/risk-review",           labelKey: "nav.adminRiskReview",      defaultLabel: "Risk review",           icon: ShieldCheck,       group: "workflow" },
  // R-IL — Industry catalogs (Index-Linked Contracts repositioning).
  // Platform Admin manages pricing benchmarks + cost components per
  // industry (and per-tenant overrides). Lives under Workflow & rules
  // alongside Risk routing since both are policy/config that drive
  // platform behaviour rather than identity or tenancy.
  { to: "/app/admin/industry-catalogs",     labelKey: "nav.adminIndustryCatalogs", defaultLabel: "Industry catalogs",    icon: Layers,            group: "workflow" },
];

/**
 * M12 — Sub-items shown when the "Clauses" module is active
 * (legal_counsel + platform_admin). Reuses AdminSubItem shape minus the
 * grouping (only one entry here, no sectioning needed).
 */
export interface ClausesSubItem {
  to: string;
  labelKey: string;
  defaultLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const CLAUSES_SUB_NAV: ClausesSubItem[] = [
  { to: "/app/clauses/review", labelKey: "nav.clausesReview", defaultLabel: "Review queue", icon: ClipboardList },
];

// ─── CR-W: BE-key → FE-key normalisation ─────────────────────────────────────
//
// The BE (CR-U catalog seed) uses snake_case / dotted keys such as
// "dashboards.finance_treasury" while the FE `ModuleKey` union uses camelCase
// variants ("dashboards.financeTreasury"). This map normalises incoming
// `effectiveModules` strings from the auth payload into the FE key space.
//
// Only mappings where BE key ≠ FE key are listed. All others pass through.

export const BE_TO_FE_KEY: Readonly<Record<string, ModuleKey>> = {
  // BE key                         FE ModuleKey
  // M21 — Work Order Queue
  "my_work":                        "myWork",
  "dashboards.finance_treasury":    "dashboards.financeTreasury",
  "dashboards.compliance_esg":      "dashboards.complianceEsg",
  "financial.budget_burn":          "financial.budgetBurn",
  "financial.trade_margin":         "financial.tradeMargin",
  "regulatory_cascade":             "compliance.regulatoryCascade",
  "risk_cases":                     "riskCases",
  // Phase B (mig 644) — Executive Risk Triage maps to the riskTriage FE key.
  "risk_triage":                    "riskTriage",
  "regulatory_radar":               "radar",
  "advisory_queue":                 "legal.advisoryQueue",
  // L49 — Advisory templates BE key → FE ModuleKey
  "legal.advisory_templates":       "legal.advisoryTemplates",
  // TPA — Third-Party Review
  "tpa_review":                     "legal.thirdPartyReview",
  "insights_hub":                   "insights",
  // O31: BE-returned "impact_signals" module key maps to the FE "regulations"
  // sidebar entry (Impact Watch).
  "impact_signals":                 "regulations",
  // "contracts.browse" → "contracts" (FE has one unified contracts key)
  "contracts.browse":               "contracts",
  // "contracts.compose" → "compose"
  "contracts.compose":              "compose",
  // "demo_harness" has no sidebar entry in MODULES (admin-only CRIP sub-nav)
  // so it is intentionally omitted here — the sidebar won't render it.
};

/**
 * CR-W runtime replacement for modulesForRole.
 *
 * Returns the ordered SidebarModule[] for the given `effectiveModules` array
 * (from the BE auth payload). BE keys are normalised to FE keys via
 * BE_TO_FE_KEY before lookup. Unknown or PLATFORM-only keys that have no
 * MODULES entry are silently skipped (e.g. "demo_harness", "admin.*",
 * "users_roles", "audit", "settings", "branding", "profile").
 *
 * Result is sorted by displayOrder so sidebar order is always consistent
 * regardless of the order the BE returns the array.
 */
export function modulesForEffectiveSet(
  effectiveModules: string[] | null | undefined,
  orderOverride?: string[] | null,
  roleName?: string | null,
): SidebarModule[] {
  if (!effectiveModules || effectiveModules.length === 0) {
    // Fallback: show only insights hub so the user can navigate somewhere.
    return [MODULES.insights];
  }

  const seen = new Set<ModuleKey>();
  const result: SidebarModule[] = [];

  // E-rev-E — Regulatory Cascade module dropped from the demo. Suppress
  // its sidebar entry regardless of what the BE sends in effectiveModules.
  // Route + tables remain available; only the navigation link is hidden.
  const SUPPRESSED_MODULES: ReadonlySet<ModuleKey> = new Set<ModuleKey>([
    "compliance.regulatoryCascade",
  ]);

  // Demo prep 2026-06-09 — per-role suppression. Sidebar is driven by the
  // BE's effectiveModules, so trimming ROLE_MODULES alone has no effect
  // at runtime. Hide Obligations + Impact Watch from the drafter + legal
  // counsel sidebars while leaving the routes + permissions live (deep
  // links still work; only the nav entries disappear).
  const PER_ROLE_SUPPRESSED: Record<string, ReadonlySet<ModuleKey>> = {
    contract_drafter: new Set<ModuleKey>(["obligations", "regulations"]),
    legal_counsel:    new Set<ModuleKey>(["obligations", "regulations"]),
  };
  const roleSuppressed: ReadonlySet<ModuleKey> | undefined =
    roleName ? PER_ROLE_SUPPRESSED[roleName] : undefined;

  for (const beKey of effectiveModules) {
    // Normalise BE key → FE ModuleKey
    const feKey: ModuleKey | undefined = (BE_TO_FE_KEY[beKey] as ModuleKey | undefined) ?? (beKey as ModuleKey);
    // Skip if the FE key has no display entry, is suppressed, or already added
    if (!MODULES[feKey] || SUPPRESSED_MODULES.has(feKey) || seen.has(feKey)) continue;
    if (roleSuppressed && roleSuppressed.has(feKey)) continue;
    seen.add(feKey);
    result.push(MODULES[feKey]);
  }

  // Ensure the single "Admin" nav pin is rendered when the user actually has
  // the "admin" module in their effective set. Previously this fired for ANY
  // PLATFORM-bundle key (including "profile", which every role has) and so
  // showed an Admin link to non-admin personas like compliance_esg.
  if (effectiveModules.includes("admin") && !seen.has("admin")) {
    result.push(MODULES.admin);
  }

  // O10/O42: drop the redundant "Insights" entry only when the user is on
  // a persona role whose Insights link literally resolves to their already-
  // visible persona dashboard. For approvers / drafters / legal / executive
  // etc., "Insights" routes to /app/dashboards/<role> which is a distinct
  // page from "Procurement Risk" or any other ancillary dashboard they have
  // access to — so we keep Insights for them.
  //
  // The persona dashboards filter was over-aggressive: contract_approver has
  // `dashboards.procurement` for side-feature access, but their home is the
  // approver dashboard reached via Insights. Suppressing Insights stranded
  // them on a sidebar that no longer linked to their primary view.
  const filtered = result;

  // Mig 539 — if a per-role override is supplied, sort by the override
  // index first; modules not in the override fall to the end in their
  // built-in displayOrder. If no override, plain displayOrder sort.
  if (orderOverride && orderOverride.length > 0) {
    const index = new Map<string, number>();
    orderOverride.forEach((k, i) => index.set(k, i));
    filtered.sort((a, b) => {
      const ai = index.has(a.key) ? (index.get(a.key) as number) : Number.MAX_SAFE_INTEGER;
      const bi = index.has(b.key) ? (index.get(b.key) as number) : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.displayOrder - b.displayOrder;
    });
  } else {
    filtered.sort((a, b) => a.displayOrder - b.displayOrder);
  }
  return filtered;
}

export function modulesForRole(roleName: string | null | undefined): SidebarModule[] {
  if (!roleName) return [];
  const role = roleName as AppRole;
  const keys = ROLE_MODULES[role];
  if (!keys) {
    return [MODULES.insights, MODULES.contracts];
  }
  return keys.map((k) => MODULES[k]);
}

export function canSee(roleName: string | null | undefined, moduleKey: ModuleKey): boolean {
  if (!roleName) return false;
  const role = roleName as AppRole;
  return ROLE_MODULES[role]?.includes(moduleKey) ?? false;
}
