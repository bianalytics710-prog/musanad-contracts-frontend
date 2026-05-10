/**
 * /app/admin/roles — roles + permission grid with edit/create/delete actions.
 *
 * Matrix layout: capability rows (one per permission code, grouped by
 * module) × role columns. Cell = checkmark when the role grants that
 * permission. Edit button opens /admin/roles/edit/$id per-role editor.
 * Add button opens CreateRoleDialog modal.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Check, Plus, Pencil, ShieldCheck, X } from "lucide-react";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { CreateRoleDialog } from "@/components/admin/CreateRoleDialog";
import { useAuthStore } from "@/store/auth.store";
import {
  adminRolesService,
  type AdminRoleListItem,
} from "@/services/api/admin-users.service";
import {
  adminPermissionsService,
  type PermissionListResponse,
  type PermissionRow,
} from "@/services/api/admin-permissions.service";

export const Route = createFileRoute("/app/admin/roles")({
  component: () => (
    <ErrorBoundary>
      <AdminRolesView />
    </ErrorBoundary>
  ),
});

function AdminRolesView() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const canManageRoles = user?.permissions.includes('role.manage') ?? false;

  const rolesQuery = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => adminRolesService.list(),
    staleTime: 5 * 60_000,
  });

  // Master permission catalog (no roleId filter)
  const permsQuery = useQuery<PermissionListResponse>({
    queryKey: ["admin-permissions-all"],
    queryFn: () => adminPermissionsService.listAll(),
    staleTime: 5 * 60_000,
  });

  const roles: AdminRoleListItem[] = rolesQuery.data?.data ?? [];

  // For each role, fetch its permission codes
  const rolePermsQueries = useQueries({
    queries: roles.map((r) => ({
      queryKey: ["admin-role-permissions", r.id],
      queryFn: async (): Promise<{ roleId: number; codes: Set<string> }> => {
        const data = await adminPermissionsService.listForRole(r.id);
        return {
          roleId: r.id,
          codes: new Set(data.data.map((p) => p.code)),
        };
      },
      staleTime: 5 * 60_000,
      enabled: roles.length > 0,
    })),
  });

  const roleCodeMap = useMemo(() => {
    const m = new Map<number, Set<string>>();
    for (const q of rolePermsQueries) {
      if (q.data) m.set(q.data.roleId, q.data.codes);
    }
    return m;
  }, [rolePermsQueries]);

  // Group permissions by module
  const groupedPerms = useMemo(() => {
    const all = permsQuery.data?.data ?? [];
    const groups = new Map<string, PermissionRow[]>();
    for (const p of all) {
      if (!groups.has(p.module)) groups.set(p.module, []);
      groups.get(p.module)!.push(p);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.code.localeCompare(b.code));
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permsQuery.data]);

  const isLoading =
    rolesQuery.isLoading ||
    permsQuery.isLoading ||
    rolePermsQueries.some((q) => q.isLoading);

  const totalPerms = permsQuery.data?.data.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] space-y-4 p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("admin.roles.title", { defaultValue: "Roles & permissions" })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("admin.roles.subtitle", {
              defaultValue:
                "Permission matrix for all roles. Use Edit to manage per-role grants.",
            })}
          </p>
        </div>
        {canManageRoles && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t("admin.roles.addRole", { defaultValue: "Add role" })}
          </Button>
        )}
      </header>

      {showCreateDialog && (
        <CreateRoleDialog onClose={() => setShowCreateDialog(false)} />
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<ShieldCheck className="h-4 w-4 text-gold" />}
          label={t("admin.roles.stats.roles", { defaultValue: "Roles" })}
          value={roles.length}
        />
        <StatCard
          icon={<ShieldCheck className="h-4 w-4 text-sage" />}
          label={t("admin.roles.stats.permissions", {
            defaultValue: "Permissions",
          })}
          value={totalPerms}
        />
        <StatCard
          icon={<ShieldCheck className="h-4 w-4 text-ink-subtle" />}
          label={t("admin.roles.stats.modules", {
            defaultValue: "Modules",
          })}
          value={groupedPerms.length}
        />
      </section>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded bg-surface"
              aria-hidden
            />
          ))}
        </div>
      ) : roles.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t("admin.roles.empty", { defaultValue: "No roles defined." })}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-ink-subtle">
                <th scope="col" className="sticky left-0 bg-surface px-4 py-3 font-medium">
                  {t("admin.roles.headers.permission", {
                    defaultValue: "Permission",
                  })}
                </th>
                {roles.map((r) => (
                  <th
                    key={r.id}
                    scope="col"
                    className="px-3 py-3 text-center font-mono text-[10px] font-medium uppercase tracking-wider"
                    title={r.description ?? r.name}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span>{r.name.replace(/_/g, " ")}</span>
                      {canManageRoles && (
                        <Link
                          to="/app/admin/roles/edit/$id"
                          params={{ id: String(r.id) }}
                          className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[9px] text-gold hover:bg-gold/10"
                          aria-label={t("admin.roles.editRole", { defaultValue: "Edit {{name}}", name: r.name })}
                        >
                          <Pencil className="h-2.5 w-2.5" />
                          {t("common.edit", { defaultValue: "Edit" })}
                        </Link>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedPerms.map(([module, perms]) => (
                <ModuleGroup
                  key={module}
                  module={module}
                  perms={perms}
                  roles={roles}
                  roleCodeMap={roleCodeMap}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

function ModuleGroup({
  module,
  perms,
  roles,
  roleCodeMap,
}: {
  module: string;
  perms: PermissionRow[];
  roles: AdminRoleListItem[];
  roleCodeMap: Map<number, Set<string>>;
}) {
  const colCount = roles.length + 1;
  return (
    <>
      <tr>
        <td
          colSpan={colCount}
          className="bg-surface/40 px-4 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-subtle"
        >
          {module}
        </td>
      </tr>
      {perms.map((p) => (
        <tr
          key={p.id}
          className="border-t border-border/60 transition-colors hover:bg-surface/40"
        >
          <td
            className="sticky left-0 bg-card px-4 py-2 align-top"
            title={p.description ?? p.code}
          >
            <span className="font-mono text-xs text-ink">{p.code}</span>
            {p.description && (
              <p className="mt-0.5 max-w-md text-xs text-ink-subtle">
                {p.description}
              </p>
            )}
          </td>
          {roles.map((r) => {
            const granted = roleCodeMap.get(r.id)?.has(p.code) ?? false;
            return (
              <td key={r.id} className="px-3 py-2 text-center">
                {granted ? (
                  <Check
                    className="mx-auto h-4 w-4 text-sage"
                    aria-label="granted"
                  />
                ) : (
                  <X
                    className="mx-auto h-3 w-3 text-ink-subtle/40"
                    aria-label="not granted"
                  />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
          {label}
        </p>
      </div>
      <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
