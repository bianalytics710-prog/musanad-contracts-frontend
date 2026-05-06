import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Search, Building2, User, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { partiesService } from "@/services/api/m_parity.service";
import { useDebounce } from "@/hooks/useDebounce";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import { CreatePartyDialog } from "@/features/m_parity/components/CreateEntityDialogs";

export const Route = createFileRoute("/app/parties/")({
  component: () => (
    <ErrorBoundary>
      <PartiesListView />
    </ErrorBoundary>
  ),
});

function PartiesListView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const [search, setSearch] = useState("");
  const [partyType, setPartyType] = useState<"" | "individual" | "company">("");
  const [createOpen, setCreateOpen] = useState(false);
  const debounced = useDebounce(search, 300);
  const canCreate = useAuthStore(selectHasPermission("contract.edit"));

  const { data, isLoading } = useQuery({
    queryKey: ["parties", debounced, partyType],
    queryFn: () =>
      partiesService.list({
        partyType: partyType || undefined,
        q: debounced || undefined,
        limit: 200,
      }),
    staleTime: 60_000,
  });

  const items = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const companies = items.filter((p) => p.partyType === "company").length;
  const individuals = items.filter((p) => p.partyType === "individual").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("parties.title", { defaultValue: "Counterparties & Parties" })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("parties.subtitle", {
              defaultValue:
                "Catalog of organizations and individuals you transact with.",
            })}
          </p>
        </div>
        {canCreate && (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("parties.create.cta", { defaultValue: "New party" })}
          </Button>
        )}
      </header>
      <CreatePartyDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Stat strip */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
            {t("parties.stats.total", { defaultValue: "Total parties" })}
          </p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {total}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gold" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("parties.stats.companies", { defaultValue: "Companies" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {companies}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-ink-subtle" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("parties.stats.individuals", { defaultValue: "Individuals" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {individuals}
          </p>
        </div>
      </section>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("parties.searchPlaceholder", {
              defaultValue: "Search by name…",
            })}
            className="ps-9"
          />
        </div>
        <select
          value={partyType}
          onChange={(e) =>
            setPartyType(e.target.value as "" | "individual" | "company")
          }
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">
            {t("parties.allTypes", { defaultValue: "All types" })}
          </option>
          <option value="company">
            {t("parties.company", { defaultValue: "Company" })}
          </option>
          <option value="individual">
            {t("parties.individual", { defaultValue: "Individual" })}
          </option>
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg bg-surface"
              aria-hidden
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t("parties.empty", { defaultValue: "No parties match the filter." })}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                to="/app/parties/$id"
                params={{ id: String(p.id) }}
                className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-gold"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      {isAr && p.nameAr ? p.nameAr : p.nameEn}
                    </p>
                    {p.nameAr && !isAr && (
                      <p className="mt-0.5 text-xs text-ink-subtle" dir="rtl">
                        {p.nameAr}
                      </p>
                    )}
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                    {p.partyType === "company" ? (
                      <Building2 className="h-3 w-3" />
                    ) : (
                      <User className="h-3 w-3" />
                    )}
                    {p.partyType}
                  </span>
                </div>
                {p.tradeLicenseNumber && (
                  <p className="mt-2 font-mono text-[11px] text-ink-subtle">
                    {p.tradeLicenseNumber} · {p.tradeLicenseIssuer ?? ""}
                  </p>
                )}
                {p.emirate && (
                  <p className="mt-1 text-[11px] text-ink-muted capitalize">
                    {p.emirate.replace(/_/g, " ")}
                    {p.freeZone ? ` · ${p.freeZone}` : ""}
                  </p>
                )}
                {p.contactEmail && (
                  <p className="mt-1 truncate font-mono text-[11px] text-ink-subtle">
                    {p.contactEmail}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
