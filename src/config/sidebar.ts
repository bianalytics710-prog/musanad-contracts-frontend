/**
 * Canonical role → sidebar modules map.
 *
 * Adapted from Lovable's @/config/sidebar to our /app/* route structure.
 * Templates / Clauses / Parties / Obligations are intentionally listed
 * for visual parity with Lovable — they route to a ComingSoon placeholder.
 * Regulations + Queue likewise — render placeholder where Lovable links.
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
}

export const MODULES: Record<ModuleKey, SidebarModule> = {
  insights:    { key: "insights",    to: "/app/dashboards/insights", labelKey: "nav.insights",    defaultLabel: "Insights",    icon: LayoutGrid },
  contracts:   { key: "contracts",   to: "/app/contracts",           labelKey: "nav.contracts",   defaultLabel: "Contracts",   icon: FileText },
  compose:     { key: "compose",     to: "/app/contracts/compose",   labelKey: "nav.compose",     defaultLabel: "Compose",     icon: PenLine },
  templates:   { key: "templates",   to: "/app/templates",           labelKey: "nav.templates",   defaultLabel: "Templates",   icon: FileStack },
  clauses:     { key: "clauses",     to: "/app/clauses",             labelKey: "nav.clauses",     defaultLabel: "Clauses",     icon: Quote },
  regulations: { key: "regulations", to: "/app/regulations",         labelKey: "nav.impact",      defaultLabel: "Regulations", icon: Scale },
  radar:       { key: "radar",       to: "/app/regulatory-radar",    labelKey: "nav.impactRadar", defaultLabel: "Reg. Radar",  icon: Radar },
  approvals:   { key: "approvals",   to: "/app/approvals",           labelKey: "nav.approvals",   defaultLabel: "Approvals",   icon: CheckCircle2 },
  queue:       { key: "queue",       to: "/app/queue",               labelKey: "nav.queue",       defaultLabel: "Queue",       icon: CheckCircle2 },
  obligations: { key: "obligations", to: "/app/obligations",         labelKey: "nav.obligations", defaultLabel: "Obligations", icon: CalendarClock },
  parties:     { key: "parties",     to: "/app/parties",             labelKey: "nav.parties",     defaultLabel: "Parties",     icon: UsersIcon },
  admin:       { key: "admin",       to: "/app/admin",               labelKey: "nav.admin",       defaultLabel: "Admin",       icon: Shield },
  // M15 / CR-G — 4 new persona dashboard modules (gated by permission at render time)
  "dashboards.operations":       { key: "dashboards.operations",       to: "/app/dashboards/operations",       labelKey: "nav.dashboardsOperations",       defaultLabel: "Operations",         icon: Wrench },
  "dashboards.financeTreasury":  { key: "dashboards.financeTreasury",  to: "/app/dashboards/finance-treasury", labelKey: "nav.dashboardsFinanceTreasury",  defaultLabel: "Finance & Treasury", icon: TrendingUp },
  "dashboards.complianceEsg":    { key: "dashboards.complianceEsg",    to: "/app/dashboards/compliance-esg",   labelKey: "nav.dashboardsComplianceEsg",    defaultLabel: "Compliance & ESG",   icon: ShieldAlert },
  "dashboards.procurement":      { key: "dashboards.procurement",      to: "/app/dashboards/procurement",      labelKey: "nav.dashboardsProcurement",      defaultLabel: "Procurement Risk",   icon: Package },
  // M16 / CR-H
  "legal.advisoryQueue": { key: "legal.advisoryQueue", to: "/app/legal/advisory-queue", labelKey: "nav.legalAdvisoryQueue", defaultLabel: "Advisory Queue", icon: FileEdit },
  // M19 / CR-K — Risk Cases
  riskCases: { key: "riskCases", to: "/app/risk-cases", labelKey: "nav.riskCases", defaultLabel: "Risk Cases", icon: ShieldX },
  // M20 / CR-L — Reports
  reports:   { key: "reports",   to: "/app/reports",    labelKey: "nav.reports",   defaultLabel: "Reports",    icon: FileBarChart2 },
  // CR-M — Labor-Law Cascade (gated by regulatory.cascade.read at render time)
  "compliance.regulatoryCascade": {
    key: "compliance.regulatoryCascade",
    to: "/app/compliance/regulatory-cascade",
    labelKey: "nav.complianceRegulatoryCASCADE",
    defaultLabel: "Regulatory Cascade",
    icon: ListChecks,
  },
  // M21 / CR-N — Financial Intelligence Budget Burn (gated by finance.budget.read at render time)
  "financial.budgetBurn": {
    key: "financial.budgetBurn",
    to: "/app/financial/budget-burn",
    labelKey: "nav.financialBudgetBurn",
    defaultLabel: "Budget Burn",
    icon: DollarSign,
  },
  // M21 / CR-O — Financial Intelligence Trade Margin (gated by finance.margin.read at render time)
  "financial.tradeMargin": {
    key: "financial.tradeMargin",
    to: "/app/financial/trade-margin",
    labelKey: "nav.financialTradeMargin",
    defaultLabel: "Trade Margin",
    icon: BarChart2,
  },
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
    // M15 / CR-G — procurement risk dashboard accessible to drafter
    "dashboards.procurement",
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
    "insights",
    "dashboards.operations",
    "contracts",
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
];

// M12 — Sub-items shown when the "Clauses" module is active (legal_counsel + platform_admin)
export const CLAUSES_SUB_NAV: AdminSubItem[] = [
  { to: "/app/clauses/review", labelKey: "nav.clausesReview", defaultLabel: "Review queue", icon: ClipboardList },
];

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
