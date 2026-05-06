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
} from "lucide-react";

export type AppRole =
  | "Super Admin"
  | "platform_admin"
  | "legal_counsel"
  | "contract_drafter"
  | "contract_approver"
  | "contract_approver_2"
  | "contract_recipient"
  | "executive";

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
  | "admin";

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
  ],
  contract_approver: ["insights", "approvals", "contracts", "obligations"],
  contract_approver_2: ["insights", "approvals", "contracts", "obligations"],
  contract_recipient: ["insights", "contracts", "obligations"],
  platform_admin: ["admin", "insights", "contracts", "parties", "templates", "clauses"],
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
  ],
  executive: ["insights", "contracts", "regulations", "parties"],
};

export interface AdminSubItem {
  to: string;
  labelKey: string;
  defaultLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ADMIN_SUB_NAV: AdminSubItem[] = [
  { to: "/app/admin",                      labelKey: "nav.adminOverview", defaultLabel: "Overview",        icon: LayoutGrid },
  { to: "/app/admin/users",                labelKey: "nav.adminUsers",    defaultLabel: "Users",           icon: UsersIcon },
  { to: "/app/admin/audit",                labelKey: "nav.adminAudit",    defaultLabel: "Audit log",       icon: ScrollText },
  { to: "/app/admin/health",               labelKey: "nav.adminHealth",   defaultLabel: "Health",          icon: Activity },
  { to: "/app/admin/approval-matrix",      labelKey: "nav.adminMatrix",   defaultLabel: "Approval matrix", icon: KeyRound },
  { to: "/app/admin/approval-chains",      labelKey: "nav.adminChains",   defaultLabel: "Approval chains", icon: KeyRound },
  { to: "/app/admin/regulations",          labelKey: "nav.adminRegs",     defaultLabel: "Regulations",     icon: Scale },
  { to: "/app/admin/impact-categories",    labelKey: "nav.adminImpacts",  defaultLabel: "Impact cats",     icon: Palette },
  { to: "/app/admin/imports",              labelKey: "nav.adminImports",  defaultLabel: "Imports",         icon: ScrollText },
  { to: "/app/admin/ai/cost-report",       labelKey: "nav.adminAiCost",   defaultLabel: "AI cost",         icon: Activity },
  { to: "/app/admin/ai/prompts",           labelKey: "nav.adminAiPrompts", defaultLabel: "AI prompts",     icon: SettingsIcon },
  { to: "/app/admin/ai/requests",          labelKey: "nav.adminAiReqs",   defaultLabel: "AI requests",     icon: ScrollText },
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
