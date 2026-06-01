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
  // M19-M20 / CR-K + CR-L Risk Cases + Reports
  ShieldX,
  FileBarChart2,
  // CR-M — Labor-Law Cascade
  ListChecks,
  // M21 / CR-N — Financial Intelligence Budget Burn
  DollarSign,
  // M21 / CR-O — Financial Intelligence Trade Margin
  BarChart2,
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
  // M19 / CR-K — Risk Cases (visible to all 7 dashboard personas)
  | "riskCases"
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
  // M19 / CR-K — Risk Cases
  riskCases: { key: "riskCases", to: "/app/risk-cases", labelKey: "nav.riskCases", defaultLabel: "Risk Cases", icon: ShieldX,      displayOrder: 360 },
  // M20 / CR-L — Reports
  reports:   { key: "reports",   to: "/app/reports",    labelKey: "nav.reports",   defaultLabel: "Reports",    icon: FileBarChart2, displayOrder: 370 },
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
    defaultLabel: "Budget Burn",
    icon: DollarSign,
    displayOrder: 400,
  },
  // M21 / CR-O — Financial Intelligence Trade Margin (gated by finance.margin.read at render time)
  "financial.tradeMargin": {
    key: "financial.tradeMargin",
    to: "/app/financial/trade-margin",
    labelKey: "nav.financialTradeMargin",
    defaultLabel: "Trade Margin",
    icon: BarChart2,
    displayOrder: 410,
  },

  // ── PLATFORM bundle (display_order 500–560) ───────────────────────────────
  admin: { key: "admin", to: "/app/admin", labelKey: "nav.admin", defaultLabel: "Admin", icon: Shield, displayOrder: 500 },
};

export const ROLE_MODULES: Record<AppRole, ModuleKey[]> = {
  contract_drafter: [
    "insights",
    "contracts",
    "compose",
    "templates",
    "clauses",
    "parties",
    "obligations",
    // D61 — Impact Watch added to the drafter's ROLE_MODULES so the
    // ⌘K command palette (which reads modulesForRole) lists it alongside
    // the sidebar (which reads effectiveModules). Both surfaces stay in
    // sync; the BE perm gate for impact_signals was unlocked in mig 425.
    "regulations",
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
    "regulations",
    "radar",
    "obligations",
    "parties",
    // M16 / CR-H — advisory queue for legal counsel
    "legal.advisoryQueue",
    // L49 — Advisory templates
    "legal.advisoryTemplates",
    // CR-M — Regulatory Cascade (read)
    "compliance.regulatoryCascade",
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
  platform_admin: [
    "admin", "insights", "contracts", "parties", "templates", "clauses",
    // M15 / CR-G — all 4 persona dashboards visible to platform_admin for diagnostics
    "dashboards.operations", "dashboards.financeTreasury", "dashboards.complianceEsg", "dashboards.procurement",
    // CR-M — Regulatory Cascade (read + run)
    "compliance.regulatoryCascade",
    // M21 / CR-N — Financial Intelligence Budget Burn
    "financial.budgetBurn",
    // M21 / CR-O — Financial Intelligence Trade Margin
    "financial.tradeMargin",
    // M19 / M20
    "riskCases", "reports",
  ],
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
    // CR-M — Regulatory Cascade (read + run)
    "compliance.regulatoryCascade",
    // M21 / CR-N — Financial Intelligence Budget Burn
    "financial.budgetBurn",
    // M21 / CR-O — Financial Intelligence Trade Margin
    "financial.tradeMargin",
    // M19 / M20
    "riskCases", "reports",
  ],
  // R-EX0 audit: Lovable executive sidebar is Insights / Contracts /
  // Impact Watch only. Drop the Parties leak — executive consumes
  // insights, not raw counterparty CRUD.
  // M19 / M20 — Risk Cases + Reports for executive oversight.
  // CR-M — Regulatory Cascade (read)
  // M21 / CR-N — Budget Burn (read)
  // M21 / CR-O — Trade Margin (read)
  executive: ["insights", "contracts", "regulations", "compliance.regulatoryCascade", "financial.budgetBurn", "financial.tradeMargin", "riskCases", "reports"],
  // CR-M — procurement_supplier_risk seeded in migration 292
  procurement_supplier_risk: [
    "insights",
    "dashboards.procurement",
    "contracts",
    // CR-M — read access to regulatory cascade
    "compliance.regulatoryCascade",
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
    // CR-M — primary persona for Regulatory Cascade
    "compliance.regulatoryCascade",
    "riskCases",
    "reports",
  ],
};

export interface AdminSubItem {
  to: string;
  labelKey: string;
  defaultLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ADMIN_SUB_NAV: AdminSubItem[] = [
  { to: "/app/admin",                       labelKey: "nav.adminOverview",        defaultLabel: "Overview",              icon: LayoutGrid },
  { to: "/app/admin/users",                 labelKey: "nav.adminUsers",           defaultLabel: "Users",                 icon: UsersIcon },
  { to: "/app/admin/roles",                 labelKey: "nav.adminRoles",           defaultLabel: "Roles & permissions",   icon: KeyRound },
  { to: "/app/admin/audit",                 labelKey: "nav.adminAudit",           defaultLabel: "Audit log",             icon: ScrollText },
  { to: "/app/admin/audit/verify",          labelKey: "nav.adminAuditVerify",     defaultLabel: "Audit verify",          icon: ShieldCheck },
  { to: "/app/admin/config",                labelKey: "nav.adminConfig",          defaultLabel: "Configuration",         icon: SettingsIcon },
  { to: "/app/admin/branding",              labelKey: "nav.adminBranding",        defaultLabel: "Branding",              icon: Palette },
  { to: "/app/admin/email-templates",       labelKey: "nav.adminEmailTemplates",  defaultLabel: "Email templates",       icon: Mail },
  { to: "/app/admin/email-config",          labelKey: "nav.adminEmailConfig",     defaultLabel: "Email server",          icon: Mail },
  { to: "/app/admin/tenants",               labelKey: "nav.adminTenants",         defaultLabel: "Tenants",               icon: Building2 },
  { to: "/app/admin/demo/purge",            labelKey: "nav.adminDemoPurge",       defaultLabel: "Demo purge",            icon: Trash2 },
  { to: "/app/admin/health",                labelKey: "nav.adminHealth",          defaultLabel: "Health",                icon: Activity },
  { to: "/app/admin/sources",               labelKey: "nav.adminSources",         defaultLabel: "Sources",               icon: Globe },
  { to: "/app/admin/source-health",         labelKey: "nav.adminSourceHealth",    defaultLabel: "Source health",         icon: Activity },
  { to: "/app/admin/internal-signal-kinds", labelKey: "nav.adminInternalSignalKinds", defaultLabel: "Internal signal kinds", icon: Radar },
  { to: "/app/admin/approval-matrix",       labelKey: "nav.adminMatrix",          defaultLabel: "Approval matrix",       icon: KeyRound },
  { to: "/app/admin/approval-chains",       labelKey: "nav.adminChains",          defaultLabel: "Approval chains",       icon: KeyRound },
  { to: "/app/admin/regulations",           labelKey: "nav.adminRegs",            defaultLabel: "Regulations",           icon: Scale },
  { to: "/app/admin/impact-categories",     labelKey: "nav.adminImpacts",         defaultLabel: "Impact cats",           icon: Palette },
  { to: "/app/admin/imports",               labelKey: "nav.adminImports",         defaultLabel: "Imports",               icon: ScrollText },
  { to: "/app/admin/ai/cost-report",        labelKey: "nav.adminAiCost",          defaultLabel: "AI cost",               icon: Activity },
  { to: "/app/admin/ai/prompts",            labelKey: "nav.adminAiPrompts",       defaultLabel: "AI prompts",            icon: SettingsIcon },
  { to: "/app/admin/ai/requests",           labelKey: "nav.adminAiReqs",          defaultLabel: "AI requests",           icon: ScrollText },
  // M11 — Document Ingestion Pipeline (CR-D0)
  { to: "/app/admin/ingestion-queue",       labelKey: "nav.admin.ingestionQueue", defaultLabel: "Ingestion queue",       icon: Inbox },
  // M12 — Clause Extraction / Taxonomy (CR-D)
  { to: "/app/admin/clause-taxonomy",       labelKey: "nav.adminClauseTaxonomy",  defaultLabel: "Clause taxonomy",       icon: BookOpen },
  // M13 — Correlation Rules (CR-E)
  { to: "/app/admin/rules",                 labelKey: "nav.adminRules",           defaultLabel: "Correlation rules",     icon: GitMerge },
  // M14 — Scoring Weights (CR-F) — visible to score.weights.manage roles only
  { to: "/app/admin/scoring-weights",       labelKey: "nav.adminScoringWeights",  defaultLabel: "Scoring weights",       icon: SlidersHorizontal },
  // M16 / CR-H — Advisory Templates + Notification Dispatch Log
  { to: "/app/admin/advisory-templates",    labelKey: "nav.adminAdvisoryTemplates", defaultLabel: "Advisory templates",  icon: FileEdit },
  { to: "/app/admin/notifications",         labelKey: "nav.adminNotifications",     defaultLabel: "Notifications",       icon: Bell },
  // M17-M18 / CR-I+CR-J — Demo Control Panel (gated by demo.scenario.trigger in route)
  { to: "/app/admin/demo",                 labelKey: "nav.adminDemo",              defaultLabel: "Demo Control",        icon: FlaskConical },
  // M20 / CR-L — Report Templates (platform_admin only)
  { to: "/app/admin/report-templates",      labelKey: "nav.adminReportTemplates",   defaultLabel: "Report templates",    icon: FileBarChart2 },
  // CR-X (v1.5) — Product Module Toggle admin screens
  { to: "/app/admin/product-modules",       labelKey: "admin.sidebar.productModules",    defaultLabel: "Product modules",     icon: Package },
  { to: "/app/admin/role-modules",          labelKey: "admin.sidebar.roleModuleAccess",  defaultLabel: "Role × module access", icon: LayoutGrid },
];

// M12 — Sub-items shown when the "Clauses" module is active (legal_counsel + platform_admin)
export const CLAUSES_SUB_NAV: AdminSubItem[] = [
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
  "dashboards.finance_treasury":    "dashboards.financeTreasury",
  "dashboards.compliance_esg":      "dashboards.complianceEsg",
  "financial.budget_burn":          "financial.budgetBurn",
  "financial.trade_margin":         "financial.tradeMargin",
  "regulatory_cascade":             "compliance.regulatoryCascade",
  "risk_cases":                     "riskCases",
  "regulatory_radar":               "radar",
  "advisory_queue":                 "legal.advisoryQueue",
  // L49 — Advisory templates BE key → FE ModuleKey
  "legal.advisory_templates":       "legal.advisoryTemplates",
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
export function modulesForEffectiveSet(effectiveModules: string[] | null | undefined): SidebarModule[] {
  if (!effectiveModules || effectiveModules.length === 0) {
    // Fallback: show only insights hub so the user can navigate somewhere.
    return [MODULES.insights];
  }

  const seen = new Set<ModuleKey>();
  const result: SidebarModule[] = [];

  for (const beKey of effectiveModules) {
    // Normalise BE key → FE ModuleKey
    const feKey: ModuleKey | undefined = (BE_TO_FE_KEY[beKey] as ModuleKey | undefined) ?? (beKey as ModuleKey);
    // Skip if the FE key has no display entry or we already added it
    if (!MODULES[feKey] || seen.has(feKey)) continue;
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

  // O10/O42: drop the redundant "Insights" entry when the user has any
  // dedicated persona dashboard. /app/dashboards/insights resolves to the
  // role's home dashboard, so showing both is a duplicate sidebar entry.
  const PERSONA_DASHBOARDS: ModuleKey[] = [
    "dashboards.operations",
    "dashboards.financeTreasury",
    "dashboards.complianceEsg",
    "dashboards.procurement",
  ];
  const hasPersonaDashboard = PERSONA_DASHBOARDS.some((k) => seen.has(k));
  const filtered = hasPersonaDashboard ? result.filter((m) => m.key !== "insights") : result;

  // Sort by displayOrder for a consistent sidebar order.
  filtered.sort((a, b) => a.displayOrder - b.displayOrder);
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
