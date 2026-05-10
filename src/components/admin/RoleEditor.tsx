/**
 * RoleEditor — grouped permission grid widget.
 * Each cell is an individual grant/revoke API call (per-cell saves, not batch).
 * Used by /app/admin/roles/edit/$id.
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, X } from 'lucide-react';
import { adminRolesMgmtService } from '@/services/api/admin/roles-mgmt.service';
import { translateApiError } from '@/lib/translate-api-error';
import { toast } from 'sonner';
import type { PermissionRow } from '@/services/api/admin-permissions.service';

interface Props {
  roleId: number;
  roleName: string;
  grantedPermIds: Set<number>;
  allPermissions: PermissionRow[];
  isBuiltIn: boolean;
}

export function RoleEditor({
  roleId,
  roleName,
  grantedPermIds,
  allPermissions,
  isBuiltIn,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // Track which permId is currently saving
  const [savingPermId, setSavingPermId] = useState<number | null>(null);

  const grantMutation = useMutation({
    mutationFn: ({ permId }: { permId: number }) =>
      adminRolesMgmtService.grantPermission(roleId, permId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-role-permissions', roleId] });
      setSavingPermId(null);
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'admin.roles.edit.errors.grantFailed'));
      setSavingPermId(null);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: ({ permId }: { permId: number }) =>
      adminRolesMgmtService.revokePermission(roleId, permId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-role-permissions', roleId] });
      setSavingPermId(null);
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'admin.roles.edit.errors.revokeFailed'));
      setSavingPermId(null);
    },
  });

  const handleToggle = (perm: PermissionRow, granted: boolean) => {
    if (isBuiltIn) return;
    setSavingPermId(perm.id);
    if (granted) {
      revokeMutation.mutate({ permId: perm.id });
    } else {
      grantMutation.mutate({ permId: perm.id });
    }
  };

  // Group permissions by module
  const groupedPerms = useMemo(() => {
    const groups = new Map<string, PermissionRow[]>();
    for (const p of allPermissions) {
      if (!groups.has(p.module)) groups.set(p.module, []);
      groups.get(p.module)!.push(p);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.code.localeCompare(b.code));
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [allPermissions]);

  return (
    <div className="space-y-4">
      {isBuiltIn && (
        <div className="rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold">
          {t('common.builtInRole.editBlocked', {
            defaultValue:
              'This is a system role. Individual permissions can be viewed but not modified.',
          })}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-ink-subtle">
              <th scope="col" className="px-4 py-3 font-medium">
                {t('admin.roles.edit.permCol', { defaultValue: 'Permission' })}
              </th>
              <th scope="col" className="px-4 py-3 text-center font-medium">
                {t('admin.roles.edit.grantedCol', { defaultValue: 'Granted' })}
              </th>
            </tr>
          </thead>
          <tbody>
            {groupedPerms.map(([module, perms]) => (
              <>
                <tr key={`group-${module}`}>
                  <td
                    colSpan={2}
                    className="bg-surface/40 px-4 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-subtle"
                  >
                    {module}
                  </td>
                </tr>
                {perms.map((perm) => {
                  const granted = grantedPermIds.has(perm.id);
                  const isSaving = savingPermId === perm.id;

                  return (
                    <tr
                      key={perm.id}
                      className="border-t border-border/60 transition-colors hover:bg-surface/40"
                    >
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs text-ink">{perm.code}</span>
                        {perm.description && (
                          <p className="mt-0.5 text-xs text-ink-subtle">{perm.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {isSaving ? (
                          <Loader2 className="mx-auto h-4 w-4 animate-spin text-ink-muted" />
                        ) : (
                          <button
                            onClick={() => handleToggle(perm, granted)}
                            disabled={isBuiltIn || isSaving}
                            aria-label={
                              granted
                                ? t('admin.roles.edit.revokePermLabel', {
                                    defaultValue: 'Revoke {{code}}',
                                    code: perm.code,
                                  })
                                : t('admin.roles.edit.grantPermLabel', {
                                    defaultValue: 'Grant {{code}}',
                                    code: perm.code,
                                  })
                            }
                            aria-pressed={granted}
                            className="mx-auto flex h-5 w-5 items-center justify-center rounded disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {granted ? (
                              <Check className="h-4 w-4 text-sage" />
                            ) : (
                              <X className="h-3 w-3 text-ink-subtle/40" />
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
