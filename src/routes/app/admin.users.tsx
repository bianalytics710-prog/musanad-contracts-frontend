import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Search, Users, UserCheck, UserX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { adminUsersService } from "@/services/api/admin-users.service";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDateTime } from "@/utils/datetime";

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

function AdminUsersView() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", debounced],
    queryFn: () =>
      adminUsersService.list({ search: debounced || undefined, limit: 100 }),
    staleTime: 60_000,
  });

  const items = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const active = items.filter((u) => u.isActive).length;
  const inactive = items.filter((u) => !u.isActive).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("admin.users.title", { defaultValue: "Users" })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("admin.users.subtitle", {
            defaultValue:
              "Workspace user catalog. Click a user to view their profile and role grants.",
          })}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gold" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("admin.users.stats.total", { defaultValue: "Total users" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {total}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-sage" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("admin.users.stats.active", { defaultValue: "Active" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {active}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <UserX className="h-4 w-4 text-ink-subtle" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("admin.users.stats.inactive", { defaultValue: "Inactive" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {inactive}
          </p>
        </div>
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
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-t border-border/60 transition-colors hover:bg-surface/40">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
