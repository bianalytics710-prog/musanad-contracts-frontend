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
  | "compliance_esg";

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
  | "legal.advisoryQueue";

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
  ],
  // R1 audit: Lovable approver sidebar is narrowly Insights / Approvals /
  // Contracts. Drop Obligations leak (was inherited from drafter mapping).
  // M15 / CR-G — procurement risk dashboard accessible to approver
  contract_approver: ["insights", "approvals", "contracts", "dashboards.procurement"],
  contract_approver_2: ["insights", "approvals", "contracts", "dashboards.procurement"],
  // R-RC0 audit: Lovable recipient sidebar is Insights / Contracts only.
  // Recipients sign contracts; they do not track obligations. Drop the
  // /app/obligations leak.
  contract_recipient: ["insights", "contracts"],
  platform_admin: [
    "admin", "insights", "contracts", "parties", "templates", "clauses",
    // M15 / CR-G — all 4 persona dashboards visible to platform_admin for diagnostics
    "dashboards.operations", "dashboards.financeTreasury", "dashboards.complianceEsg", "dashboards.procurement",
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
  ],
  // R-EX0 audit: Lovable executive sidebar is Insights / Contracts /
  // Impact Watch only. Drop the Parties leak — executive consumes
  // insights, not raw counterparty CRUD.
  executive: ["insights", "contracts", "regulations"],
  // M15 / CR-G — 3 new persona roles with dedicated dashboard modules
  operations: [
    "insights",
    "dashboards.operations",
    "contracts",
  ],
  finance_treasury: [
    "insights",
    "dashboards.financeTreasury",
    "contracts",
  ],
  compliance_esg: [
    "insights",
    "dashboards.complianceEsg",
    "contracts",
    "regulations",
    "radar",
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
