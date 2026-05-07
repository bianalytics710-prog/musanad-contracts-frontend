import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Copy,
  Key,
  MoreVertical,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import {
  adminRolesService,
  adminUsersService,
  type AdminRoleListItem,
  type AdminUserListItem,
} from "@/services/api/admin-users.service";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDateTime } from "@/utils/datetime";
import { useAuthStore, selectUser } from "@/store/auth.store";
import { translateApiError } from "@/lib/translate-api-error";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/users")({
  component: () => (
    <ErrorBoundary>
      <AdminUsersView />
    </ErrorBoundary>
  ),
});

const ROLE_TONE: Record<string, string> = {
  "Super Admin": "bg-gold/15 text-gold",
  platform_admin: "bg-terracotta/15 text-terracotta",
  legal_counsel: "bg-amber/15 text-amber-ink",
  contract_drafter: "bg-sage/15 text-sage",
  contract_approver: "bg-plum-tint text-plum",
  contract_recipient: "bg-surface text-ink-muted",
  executive: "bg-gold/15 text-gold",
};

type ActionDialog =
  | { kind: "invite" }
  | { kind: "change-role"; user: AdminUserListItem }
  | { kind: "reset-password"; user: AdminUserListItem }
  | { kind: "show-password"; user: AdminUserListItem; password: string }
  | null;

function AdminUsersView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const me = useAuthStore(selectUser);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<ActionDialog>(null);
  const debounced = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", debounced],
    queryFn: () =>
      adminUsersService.list({ search: debounced || undefined, limit: 100 }),
    staleTime: 60_000,
  });

  const rolesQuery = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => adminRolesService.list(),
    staleTime: 5 * 60_000,
  });

  const items = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const active = items.filter((u) => u.isActive).length;
  const inactive = items.filter((u) => !u.isActive).length;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const suspendMutation = useMutation({
    mutationFn: (id: number) => adminUsersService.suspend(id),
    onSuccess: () => {
      toast.success(t("admin.users.toast.suspended", { defaultValue: "User suspended." }));
      void refresh();
    },
    onError: (err: unknown) =>
      toast.error(translateApiError(err, t, "admin.users.errors.suspendFailed")),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: number) => adminUsersService.update(id, { isActive: true }),
    onSuccess: () => {
      toast.success(
        t("admin.users.toast.reactivated", { defaultValue: "User reactivated." }),
      );
      void refresh();
    },
    onError: (err: unknown) =>
      toast.error(translateApiError(err, t, "admin.users.errors.reactivateFailed")),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("admin.users.title", { defaultValue: "Users" })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("admin.users.subtitle", {
              defaultValue:
                "Workspace user catalog. Click a user to view their profile and role grants.",
            })}
          </p>
        </div>
        <Button onClick={() => setDialog({ kind: "invite" })}>
          <UserPlus className="me-2 h-4 w-4" />
          {t("admin.users.actions.invite", { defaultValue: "Invite user" })}
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Users className="h-4 w-4 text-gold" />}
          label={t("admin.users.stats.total", { defaultValue: "Total users" })}
          value={total}
        />
        <StatCard
          icon={<UserCheck className="h-4 w-4 text-sage" />}
          label={t("admin.users.stats.active", { defaultValue: "Active" })}
          value={active}
        />
        <StatCard
          icon={<UserX className="h-4 w-4 text-ink-subtle" />}
          label={t("admin.users.stats.inactive", { defaultValue: "Inactive" })}
          value={inactive}
        />
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.users.searchPlaceholder", {
              defaultValue: "Search by name or email…",
            })}
            className="ps-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-surface" aria-hidden />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t("admin.users.empty", { defaultValue: "No users match." })}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-ink-subtle">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last login</th>
                <th className="w-12 px-4 py-3" aria-label="Row actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((u) => {
                const isSelf = me?.id === u.id;
                return (
                  <tr
                    key={u.id}
                    className="border-t border-border/60 transition-colors hover:bg-surface/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-gold/15 font-mono text-xs font-semibold text-gold">
                          {u.firstName[0]}
                          {u.lastName[0]}
                        </span>
                        <span className="font-medium text-ink">
                          {u.firstName} {u.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                          ROLE_TONE[u.role.name] ?? "bg-surface text-ink-muted"
                        }`}
                      >
                        {u.role.name.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sage/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-sage">
                          <UserCheck className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                      {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("admin.users.actions.menu", {
                              defaultValue: "Row actions",
                            })}
                            disabled={isSelf}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-48">
                          <DropdownMenuItem
                            onSelect={() =>
                              setDialog({ kind: "change-role", user: u })
                            }
                          >
                            <ShieldCheck className="me-2 h-4 w-4" />
                            {t("admin.users.actions.changeRole", {
                              defaultValue: "Change role",
                            })}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              setDialog({ kind: "reset-password", user: u })
                            }
                          >
                            <Key className="me-2 h-4 w-4" />
                            {t("admin.users.actions.resetPassword", {
                              defaultValue: "Reset password",
                            })}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {u.isActive ? (
                            <DropdownMenuItem
                              onSelect={() => suspendMutation.mutate(u.id)}
                              className="text-terracotta focus:bg-terracotta/10 focus:text-terracotta"
                            >
                              <UserX className="me-2 h-4 w-4" />
                              {t("admin.users.actions.suspend", {
                                defaultValue: "Suspend",
                              })}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() => reactivateMutation.mutate(u.id)}
                            >
                              <UserCheck className="me-2 h-4 w-4" />
                              {t("admin.users.actions.reactivate", {
                                defaultValue: "Reactivate",
                              })}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.kind === "invite" && (
        <InviteUserDialog
          roles={rolesQuery.data?.data ?? []}
          onClose={() => setDialog(null)}
          onCreated={() => {
            setDialog(null);
            void refresh();
          }}
        />
      )}
      {dialog?.kind === "change-role" && (
        <ChangeRoleDialog
          user={dialog.user}
          roles={rolesQuery.data?.data ?? []}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void refresh();
          }}
        />
      )}
      {dialog?.kind === "reset-password" && (
        <ResetPasswordDialog
          user={dialog.user}
          onClose={() => setDialog(null)}
          onReset={(password) =>
            setDialog({ kind: "show-password", user: dialog.user, password })
          }
        />
      )}
      {dialog?.kind === "show-password" && (
        <ShowPasswordDialog
          user={dialog.user}
          password={dialog.password}
          onClose={() => setDialog(null)}
        />
      )}
    </motion.div>
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

// ─── Dialogs ────────────────────────────────────────────────────────────────

function generatePassword(): string {
  // 16 chars, includes upper/lower/digit/symbol so it satisfies the M0
  // strong-password regex.
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digit = "23456789";
  const symbol = "!@#$%^&*?";
  const all = upper + lower + digit + symbol;
  const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pw = rand(upper) + rand(lower) + rand(digit) + rand(symbol);
  for (let i = 0; i < 12; i++) pw += rand(all);
  return pw
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

function InviteUserDialog({
  roles,
  onClose,
  onCreated,
}: {
  roles: AdminRoleListItem[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<number | "">("");
  const [tempPassword, setTempPassword] = useState(generatePassword());

  const createMutation = useMutation({
    mutationFn: () =>
      adminUsersService.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        roleId: Number(roleId),
        password: tempPassword,
      }),
    onSuccess: () => {
      toast.success(
        t("admin.users.toast.invited", {
          defaultValue: "User invited. Share the temporary password.",
        }),
      );
      onCreated();
    },
    onError: (err: unknown) =>
      toast.error(translateApiError(err, t, "admin.users.errors.inviteFailed")),
  });

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    roleId !== "" &&
    !createMutation.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("admin.users.invite.title", { defaultValue: "Invite user" })}
          </DialogTitle>
          <DialogDescription>
            {t("admin.users.invite.description", {
              defaultValue:
                "Creates an active user. Share the auto-generated temporary password — they must change it on first login.",
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              id="invite-first"
              label={t("admin.users.fields.firstName", {
                defaultValue: "First name",
              })}
            >
              <Input
                id="invite-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field
              id="invite-last"
              label={t("admin.users.fields.lastName", {
                defaultValue: "Last name",
              })}
            >
              <Input
                id="invite-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </Field>
          </div>
          <Field
            id="invite-email"
            label={t("admin.users.fields.email", { defaultValue: "Email" })}
          >
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field
            id="invite-role"
            label={t("admin.users.fields.role", { defaultValue: "Role" })}
          >
            <select
              id="invite-role"
              value={roleId}
              onChange={(e) =>
                setRoleId(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-ink"
            >
              <option value="" disabled>
                {t("admin.users.fields.rolePlaceholder", {
                  defaultValue: "Select a role…",
                })}
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="invite-password"
            label={t("admin.users.fields.tempPassword", {
              defaultValue: "Temporary password",
            })}
          >
            <div className="flex gap-2">
              <Input
                id="invite-password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setTempPassword(generatePassword())}
              >
                {t("admin.users.actions.regenerate", {
                  defaultValue: "Regenerate",
                })}
              </Button>
            </div>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => createMutation.mutate()}
          >
            {t("admin.users.actions.create", { defaultValue: "Create" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangeRoleDialog({
  user,
  roles,
  onClose,
  onSaved,
}: {
  user: AdminUserListItem;
  roles: AdminRoleListItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [roleId, setRoleId] = useState<number>(user.role.id);

  const updateMutation = useMutation({
    mutationFn: () => adminUsersService.update(user.id, { roleId }),
    onSuccess: () => {
      toast.success(
        t("admin.users.toast.roleChanged", { defaultValue: "Role updated." }),
      );
      onSaved();
    },
    onError: (err: unknown) =>
      toast.error(translateApiError(err, t, "admin.users.errors.changeRoleFailed")),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("admin.users.changeRole.title", { defaultValue: "Change role" })}
          </DialogTitle>
          <DialogDescription>
            {t("admin.users.changeRole.description", {
              defaultValue: "Pick a new role for {{name}}.",
              name: `${user.firstName} ${user.lastName}`,
            })}
          </DialogDescription>
        </DialogHeader>
        <Field
          id="change-role"
          label={t("admin.users.fields.role", { defaultValue: "Role" })}
        >
          <select
            id="change-role"
            value={roleId}
            onChange={(e) => setRoleId(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-ink"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            disabled={roleId === user.role.id || updateMutation.isPending}
            onClick={() => updateMutation.mutate()}
          >
            {t("common.save", { defaultValue: "Save" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
  onReset,
}: {
  user: AdminUserListItem;
  onClose: () => void;
  onReset: (password: string) => void;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState(generatePassword());

  const resetMutation = useMutation({
    mutationFn: () =>
      adminUsersService.resetPassword(user.id, { password }),
    onSuccess: () => {
      onReset(password);
    },
    onError: (err: unknown) =>
      toast.error(translateApiError(err, t, "admin.users.errors.resetFailed")),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("admin.users.resetPassword.title", {
              defaultValue: "Reset password",
            })}
          </DialogTitle>
          <DialogDescription>
            {t("admin.users.resetPassword.description", {
              defaultValue:
                "Generates a new temporary password for {{name}}. Share it with them — they must change it on first login.",
              name: `${user.firstName} ${user.lastName}`,
            })}
          </DialogDescription>
        </DialogHeader>
        <Field
          id="reset-password"
          label={t("admin.users.fields.newPassword", {
            defaultValue: "New temporary password",
          })}
        >
          <div className="flex gap-2">
            <Input
              id="reset-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setPassword(generatePassword())}
            >
              {t("admin.users.actions.regenerate", {
                defaultValue: "Regenerate",
              })}
            </Button>
          </div>
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            disabled={password.length < 8 || resetMutation.isPending}
            onClick={() => resetMutation.mutate()}
          >
            {t("admin.users.actions.reset", { defaultValue: "Reset" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShowPasswordDialog({
  user,
  password,
  onClose,
}: {
  user: AdminUserListItem;
  password: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const copy = () => {
    void navigator.clipboard.writeText(password);
    toast.success(t("common.copied", { defaultValue: "Copied to clipboard." }));
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("admin.users.passwordReset.title", {
              defaultValue: "Password reset",
            })}
          </DialogTitle>
          <DialogDescription>
            {t("admin.users.passwordReset.description", {
              defaultValue:
                "{{name}} can now sign in with the temporary password below. Copy and share it via a secure channel — it will not be shown again.",
              name: `${user.firstName} ${user.lastName}`,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-surface p-3">
          <code className="block break-all font-mono text-sm text-ink">
            {password}
          </code>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={copy}>
            <Copy className="me-2 h-4 w-4" />
            {t("common.copy", { defaultValue: "Copy" })}
          </Button>
          <Button onClick={onClose}>
            {t("common.done", { defaultValue: "Done" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-xs font-medium uppercase tracking-wider text-ink-subtle"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
