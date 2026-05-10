/**
 * /app/admin/roles/edit/$id — Role permission editor.
 * Per-cell grant/revoke (not batch save).
 */
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { RoleEditor } from '@/components/admin/RoleEditor';
import {
  adminRolesService,
  type AdminRoleListItem,
} from '@/services/api/admin-users.service';
import {
  adminPermissionsService,
} from '@/services/api/admin-permissions.service';
import { adminRolesMgmtService } from '@/services/api/admin/roles-mgmt.service';
import { BUILT_IN_ROLE_NAMES } from '@/types/admin/roles-mgmt.types';
import { useAuthStore } from '@/store/auth.store';
import { translateApiError } from '@/lib/translate-api-error';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMemo } from 'react';

export const Route = createFileRoute('/app/admin/roles/edit/$id')({
  component: () => (
    <ErrorBoundary>
      <RoleEditView />
    </ErrorBoundary>
  ),
});

function RoleEditView() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const roleId = Number(id);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const hasPermission =
    user?.permissions.includes('role.manage') ?? false;

  const rolesQuery = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => adminRolesService.list(),
    staleTime: 5 * 60_000,
    enabled: hasPermission,
  });

  const permsQuery = useQuery({
    queryKey: ['admin-permissions-all'],
    queryFn: () => adminPermissionsService.listAll(),
    staleTime: 5 * 60_000,
    enabled: hasPermission,
  });

  const rolePermsQuery = useQuery({
    queryKey: ['admin-role-permissions', roleId],
    queryFn: async () => {
      const data = await adminPermissionsService.listForRole(roleId);
      return new Set(data.data.map((p) => p.id));
    },
    staleTime: 30_000,
    enabled: hasPermission && !isNaN(roleId),
  });

  const role = useMemo(
    () => rolesQuery.data?.data.find((r) => r.id === roleId),
    [rolesQuery.data, roleId],
  );

  const isBuiltIn = role
    ? (BUILT_IN_ROLE_NAMES as ReadonlyArray<string>).includes(role.name)
    : false;

  const deleteMutation = useMutation({
    mutationFn: () => adminRolesMgmtService.delete(roleId),
    onSuccess: () => {
      toast.success(
        t('admin.roles.edit.toast.deleted', { defaultValue: 'Role deleted.' }),
      );
      void queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'admin.roles.edit.errors.deleteFailed'));
    },
  });

  if (!hasPermission) {
    return (
      <div className="mx-auto w-full max-w-[1200px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t('common.forbidden', {
              defaultValue: 'You do not have permission to access this page.',
            })}
          </p>
        </div>
      </div>
    );
  }

  const isLoading =
    rolesQuery.isLoading || permsQuery.isLoading || rolePermsQuery.isLoading;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1200px] space-y-4 p-6"
    >
      <div className="flex items-center gap-2">
        <Link
          to="/app/admin/roles"
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('admin.roles.edit.backToRoles', { defaultValue: 'Roles' })}
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-surface" aria-hidden />
          ))}
        </div>
      ) : !role ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-ink-muted">
            {t('admin.roles.edit.notFound', { defaultValue: 'Role not found.' })}
          </p>
        </div>
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">
                {role.name}
              </h1>
              {role.description && (
                <p className="mt-1 text-sm text-ink-muted">{role.description}</p>
              )}
              {isBuiltIn && (
                <span className="mt-1 inline-flex items-center rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gold">
                  {t('admin.roles.edit.systemRole', { defaultValue: 'System role' })}
                </span>
              )}
            </div>
            {!isBuiltIn && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (
                    window.confirm(
                      t('admin.roles.edit.confirmDelete', {
                        defaultValue: 'Delete this role? This cannot be undone.',
                      }),
                    )
                  ) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
                className="text-terracotta hover:bg-terracotta/10"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="me-2 h-4 w-4" />
                )}
                {t('common.delete', { defaultValue: 'Delete' })}
              </Button>
            )}
          </header>

          <RoleEditor
            roleId={roleId}
            roleName={role.name}
            grantedPermIds={rolePermsQuery.data ?? new Set()}
            allPermissions={permsQuery.data?.data ?? []}
            isBuiltIn={isBuiltIn}
          />
        </>
      )}
    </motion.div>
  );
}
