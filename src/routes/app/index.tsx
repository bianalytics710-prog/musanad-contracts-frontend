/**
 * Authenticated landing — role-aware home with module navigation.
 *
 * Renders module tile groups based on the active user's role + permission
 * set. Replaces the original M0 placeholder with a real cross-module index.
 *
 * Role coverage: Super Admin, platform_admin, legal_counsel, contract_drafter,
 * contract_approver(_2), contract_recipient, executive. Falls back to a
 * minimal Account tile when the role is unknown.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { selectUser, useAuthStore } from "@/store/auth.store";
import { formatDateTime } from "@/utils/datetime";
import { humanizeLabel } from "@/features/dashboards/components/dashboard-primitives";

// R29 (Rashid audit 2026-06-01) — humanize the raw role slug for display in
// the launcher subtitle. Maps a snake_case role name to a presentation label.
// Falls back through humanizeLabel for unknown roles (e.g. "operations" →
// "Operations").
const ROLE_DISPLAY_OVERRIDES: Record<string, string> = {
  "Super Admin": "Super Admin",
  platform_admin: "Platform Admin",
  legal_counsel: "Legal Counsel",
  contract_drafter: "Contract Drafter",
  contract_approver: "Contract Approver",
  contract_approver_2: "Contract Approver (Stage 2)",
  contract_recipient: "Contract Recipient",
  executive: "Executive",
  operations: "Operations",
  finance_treasury: "Finance & Treasury",
  compliance_esg: "Compliance & ESG",
  procurement_supplier_risk: "Procurement & Supplier Risk",
};
const humanizeRole = (raw: string): string =>
  ROLE_DISPLAY_OVERRIDES[raw] ?? humanizeLabel(raw);

export const Route = createFileRoute("/app/")({
  component: AppDashboard,
});

type ModuleTile = {
  key: string;
  to: string;
  title: string;
  description: string;
  badge?: string;
};

type ModuleGroup = {
  key: string;
  title: string;
  tiles: ModuleTile[];
};

function buildGroups(roleName: string, permissions: string[]): ModuleGroup[] {
  const has = (code: string) => permissions.includes(code);
  const isAdmin = roleName === "Super Admin" || roleName === "platform_admin" || roleName === "Admin";
  const isLegal = roleName === "legal_counsel";
  const isDrafter = roleName === "contract_drafter";
  const isApprover = roleName === "contract_approver" || roleName === "contract_approver_2";
  const isRecipient = roleName === "contract_recipient";
  const isExecutive = roleName === "executive";

  const groups: ModuleGroup[] = [];

  // Insights — every role has a dashboard.
  // R30 (Rashid audit 2026-06-01) — drop the generic "My dashboard" tile
  // when a role-specific tile already exists; both routes resolve to the
  // same page and the duplicate confused readers.
  const hasRoleSpecificDashboard =
    isAdmin || isExecutive || isDrafter || isApprover || isLegal || isRecipient;
  groups.push({
    key: "insights",
    title: "Insights",
    tiles: [
      ...(hasRoleSpecificDashboard
        ? []
        : [
            {
              key: "router",
              to: "/app/dashboards/insights",
              title: "My dashboard",
              description: "Auto-routes to the dashboard for your role.",
            },
          ]),
      ...(isAdmin
        ? [
            { key: "admin", to: "/app/dashboards/admin", title: "Admin dashboard", description: "System-wide KPIs, AI cost, ingestion." },
          ]
        : []),
      ...(isExecutive || isAdmin
        ? [
            { key: "executive", to: "/app/dashboards/executive", title: "Executive dashboard", description: "Enterprise value, expiry cliffs, AI anomalies." },
            { key: "anomalies", to: "/app/dashboards/executive/anomalies", title: "AI anomalies history", description: "Past detected anomalies with refresh." },
          ]
        : []),
      ...(isDrafter ? [{ key: "drafter", to: "/app/dashboards/drafter", title: "Drafter dashboard", description: "My drafts, awaiting action, ready to send." }] : []),
      ...(isApprover ? [{ key: "approver", to: "/app/dashboards/approver", title: "Approver dashboard", description: "Pending queue, decision velocity." }] : []),
      ...(isLegal ? [{ key: "legal", to: "/app/dashboards/legal-counsel", title: "Legal counsel dashboard", description: "Regulatory updates, open impacts, audit." }] : []),
      ...(isRecipient ? [{ key: "recipient", to: "/app/dashboards/recipient", title: "My contracts", description: "Contracts where you are a signatory and pending signing tasks." }] : []),
    ],
  });

  // Contracts — anyone with contract.read access (most roles have it)
  if (isAdmin || isDrafter || isApprover || isLegal || isRecipient || has("contract.read.all") || has("contract.read.own") || has("contract.read.assigned")) {
    groups.push({
      key: "contracts",
      title: "Contracts",
      tiles: [
        { key: "list", to: "/app/contracts", title: "All contracts", description: "Browse contracts; filter by status, party, tag." },
        ...(isDrafter || isAdmin
          ? [
              { key: "compose", to: "/app/contracts/compose", title: "Compose new", description: "Step-through compose wizard." },
              { key: "imports-bulk", to: "/app/imports/bulk", title: "Bulk import", description: "AI-extracted bulk contract intake." },
              { key: "imports-manual", to: "/app/imports/manual-entries", title: "Manual entry", description: "Single-contract manual entry." },
              { key: "imports-review", to: "/app/imports/review-queue", title: "Review queue", description: "Drafts pending finalization." },
            ]
          : []),
      ],
    });
  }

  // Approvals — drafters submit, approvers act, admins/legal review
  if (isAdmin || isDrafter || isApprover || isLegal || has("approval.act") || has("approval.submit_for_review")) {
    groups.push({
      key: "approvals",
      title: "Approvals",
      tiles: [
        { key: "queue", to: "/app/approvals", title: "Approvals queue", description: "Submit, act, delegate, reassign." },
        ...(isAdmin
          ? [
              { key: "matrix", to: "/app/admin/approval-matrix", title: "Approval matrix", description: "Configure auto-routing rules." },
              { key: "chains", to: "/app/admin/approval-chains", title: "Chains", description: "Inspect / repair active chains." },
            ]
          : []),
      ],
    });
  }

  // Regulatory — legal & admin
  if (isAdmin || isLegal || has("regulations.read") || has("regulations.manage")) {
    groups.push({
      key: "regulatory",
      title: "Regulatory",
      tiles: [
        { key: "radar", to: "/app/regulatory-radar", title: "Regulatory radar", description: "Incoming updates by severity & deadline." },
        ...(isAdmin || isLegal || has("regulations.manage")
          ? [
              { key: "regulations", to: "/app/admin/regulations", title: "Regulations library", description: "Manage regulations + supersession." },
              { key: "categories", to: "/app/admin/impact-categories", title: "Impact categories", description: "Taxonomy admin." },
            ]
          : []),
      ],
    });
  }

  // Admin observability
  if (isAdmin || has("ai.observability.read") || has("audit.read")) {
    const tiles: ModuleTile[] = [];
    if (isAdmin) tiles.push({ key: "admin-home", to: "/app/admin", title: "Admin home", description: "Quick-link tiles + counts." });
    if (isAdmin || has("audit.read")) tiles.push({ key: "imports", to: "/app/admin/imports", title: "Import batches", description: "Audit ingest runs." });
    if (isAdmin || has("ai.observability.read")) {
      tiles.push({ key: "ai-cost", to: "/app/admin/ai/cost-report", title: "AI cost report", description: "Cost by prompt and user." });
      tiles.push({ key: "ai-requests", to: "/app/admin/ai/requests", title: "AI requests log", description: "Append-only telemetry." });
      tiles.push({ key: "ai-prompts", to: "/app/admin/ai/prompts", title: "AI prompts", description: "Registered prompts + defaults." });
    }
    if (isAdmin) tiles.push({ key: "health", to: "/app/admin/health", title: "System health", description: "DB, cron heartbeats, migrations." });
    if (tiles.length > 0) {
      groups.push({ key: "admin", title: "Admin", tiles });
    }
  }

  // R31 (Rashid audit 2026-06-01) — surface every reachable nav target on
  // the launcher (Reports for any role with report.read; Profile for any
  // authed user; both were silently missing).
  if (has("report.read") || isAdmin || isExecutive || isDrafter || isApprover || isLegal || isRecipient) {
    groups.push({
      key: "reports",
      title: "Reports",
      tiles: [
        { key: "reports", to: "/app/reports", title: "Reports library", description: "Generate role-specific operational and briefing reports." },
      ],
    });
  }
  groups.push({
    key: "profile",
    title: "Profile",
    tiles: [
      {
        key: "notification-prefs",
        to: "/app/profile/notification-preferences",
        title: "Notification preferences",
        description: "Choose channels and priority thresholds for each notification type.",
      },
    ],
  });

  return groups.filter((g) => g.tiles.length > 0);
}

function AppDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);

  if (!user) {
    return (
      <div role="status" className="p-6 text-sm text-ink-muted">
        {t("common.loading", { defaultValue: "Loading…" })}
      </div>
    );
  }

  const groups = buildGroups(user.role.name, user.permissions);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-7xl space-y-8 p-6"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("home.welcome", { defaultValue: "Welcome back, {{name}}", name: user.firstName })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {/* R29 (Rashid audit 2026-06-01) — humanize the role slug
                ("contract_recipient" → "Contract Recipient") and drop the
                developer-debug "N permissions active" string. */}
            {t("home.subtitleHumanRole", {
              defaultValue: "Signed in as {{role}}",
              role: humanizeRole(user.role.name),
            })}
          </p>
        </div>
        <div className="text-xs text-ink-muted">
          {t("home.now", { defaultValue: "Now" })}: {formatDateTime(new Date().toISOString())}
        </div>
      </header>

      {groups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("home.noModules", { defaultValue: "No modules available" })}</CardTitle>
            <CardDescription>
              {t("home.noModulesBody", {
                defaultValue:
                  "Your role has no modules wired to this home page yet. Contact an administrator if you believe this is wrong.",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Email</dt>
                <dd className="font-medium text-ink">{user.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Role</dt>
                <dd className="font-medium text-ink">{user.role.name}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`group-${group.key}`} className="space-y-3">
              <h2
                id={`group-${group.key}`}
                className="text-sm font-semibold uppercase tracking-wide text-ink-muted"
              >
                {group.title}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.tiles.map((tile) => (
                  <ModuleCard key={tile.key} tile={tile} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ModuleCard({ tile }: { tile: ModuleTile }) {
  return (
    <Link
      to={tile.to}
      className="block rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-gold/60"
    >
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-base">{tile.title}</CardTitle>
          <CardDescription>{tile.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs font-medium text-gold">
            Open <span aria-hidden>→</span>
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
