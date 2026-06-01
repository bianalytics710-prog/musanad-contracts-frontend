import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Search, Building2, User, Plus, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { partiesService } from "@/services/api/m_parity.service";
import { useDebounce } from "@/hooks/useDebounce";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import { CreatePartyDialog } from "@/features/m_parity/components/CreateEntityDialogs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/parties/")({
  component: () => (
    <ErrorBoundary>
      <PartiesListView />
    </ErrorBoundary>
  ),
});

type PartyTabKey = "all" | "individuals" | "companies";

// L104 — title-case emirate slugs in the filter dropdown
function humanizeEmirate(slug: string): string {
  if (!slug) return slug;
  const map: Record<string, string> = {
    abu_dhabi: "Abu Dhabi",
    "abu dhabi": "Abu Dhabi",
    dubai: "Dubai",
    sharjah: "Sharjah",
    fujairah: "Fujairah",
    ajman: "Ajman",
    ras_al_khaimah: "Ras Al Khaimah",
    "ras al khaimah": "Ras Al Khaimah",
    umm_al_quwain: "Umm Al Quwain",
    "umm al quwain": "Umm Al Quwain",
  };
  const key = slug.toLowerCase();
  if (map[key]) return map[key];
  return slug.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

// L104 — title-case party_type slug for the table chip
function humanizePartyType(slug: string | null | undefined): string {
  if (!slug) return "—";
  const map: Record<string, string> = {
    company: "Company",
    individual: "Individual",
    government: "Government",
    sole_proprietorship: "Sole Proprietorship",
  };
  return map[slug] ?? slug.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function PartiesListView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<PartyTabKey>("all");
  // R-LC5 LC-L3 — additional filters: emirate / free zone / verification / nationality.
  const [emirate, setEmirate] = useState("");
  const [freeZone, setFreeZone] = useState("");
  const [verified, setVerified] = useState<"all" | "yes" | "no">("all");
  const [nationality, setNationality] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const debounced = useDebounce(search, 300);
  const canCreate = useAuthStore(selectHasPermission("contract.edit"));

  // The list endpoint accepts only partyType + q. We over-fetch and
  // apply emirate/freeZone/verified/nationality filters client-side.
  const partyTypeForApi =
    tab === "individuals" ? "individual" : tab === "companies" ? "company" : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["parties", debounced, partyTypeForApi],
    queryFn: () =>
      partiesService.list({
        partyType: partyTypeForApi,
        q: debounced || undefined,
        limit: 500,
      }),
    staleTime: 60_000,
  });

  const all = data?.data ?? [];
  // D39 — default ordering is alphabetical by nameEn so the demo audience
  // doesn't open Parties to "Sanctioned Parent Holdings Ltd" as row #1.
  // Verified counterparties float to the top within the alphabetical
  // order so the seed (mig 423) is visible immediately.
  const filteredItems = useMemo(() => {
    const filtered = all.filter((p) => {
      if (emirate && p.emirate !== emirate) return false;
      if (freeZone && p.freeZone !== freeZone) return false;
      if (verified === "yes" && !p.isVerified) return false;
      if (verified === "no" && p.isVerified) return false;
      if (nationality && p.country !== nationality) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
      return (a.nameEn ?? "").localeCompare(b.nameEn ?? "");
    });
  }, [all, emirate, freeZone, verified, nationality]);

  // D41 — page the 499 parties into 25-row slices so the DOM stays small.
  // Total-row strip below the table communicates the scope.
  const PAGE_SIZE = 25;
  const [currentPage, setCurrentPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  // Reset to page 1 whenever the underlying filter set changes size.
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredItems.length, debounced, tab, emirate, freeZone, verified, nationality]);
  const pagedItems = useMemo(
    () => filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredItems, currentPage],
  );

  const total = data?.pagination.total ?? 0;
  const companies = all.filter((p) => p.partyType === "company").length;
  const individuals = all.filter((p) => p.partyType === "individual").length;

  // Derive emirate/freeZone option lists from current page.
  const emirates = useMemo(
    () =>
      Array.from(new Set(all.map((p) => p.emirate).filter(Boolean))) as string[],
    [all],
  );
  const freeZones = useMemo(
    () =>
      Array.from(new Set(all.map((p) => p.freeZone).filter(Boolean))) as string[],
    [all],
  );
  const nationalities = useMemo(
    () => Array.from(new Set(all.map((p) => p.country).filter(Boolean))) as string[],
    [all],
  );

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

      {/* R-LC5 LC-L2 — 3 tabs (All / Individuals / Companies). */}
      <div role="tablist" aria-label="Party type" className="flex gap-1 border-b border-border">
        {(
          [
            { key: "all", label: t("parties.tab.all", { defaultValue: "All" }) },
            { key: "individuals", label: t("parties.tab.individuals", { defaultValue: "Individuals" }) },
            { key: "companies", label: t("parties.tab.companies", { defaultValue: "Companies" }) },
          ] as const
        ).map((p) => (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={tab === p.key}
            onClick={() => setTab(p.key)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === p.key
                ? "border-gold text-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Filter bar — search + 4 dropdowns (Lovable parity) */}
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
          value={emirate}
          onChange={(e) => setEmirate(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label={t("parties.filter.emirate", { defaultValue: "Emirate" })}
        >
          <option value="">{t("parties.filter.allEmirates", { defaultValue: "All emirates" })}</option>
          {emirates.map((em) => (
            <option key={em} value={em}>
              {humanizeEmirate(em)}
            </option>
          ))}
        </select>
        <select
          value={freeZone}
          onChange={(e) => setFreeZone(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label={t("parties.filter.freeZone", { defaultValue: "Free zone" })}
        >
          <option value="">{t("parties.filter.allFreeZones", { defaultValue: "All free zones" })}</option>
          {freeZones.map((fz) => (
            <option key={fz} value={fz}>
              {fz}
            </option>
          ))}
        </select>
        <select
          value={verified}
          onChange={(e) => setVerified(e.target.value as "all" | "yes" | "no")}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label={t("parties.filter.verified", { defaultValue: "Verification" })}
        >
          <option value="all">{t("parties.filter.allVerification", { defaultValue: "All" })}</option>
          <option value="yes">{t("parties.filter.verifiedYes", { defaultValue: "Verified" })}</option>
          <option value="no">{t("parties.filter.verifiedNo", { defaultValue: "Unverified" })}</option>
        </select>
        <select
          value={nationality}
          onChange={(e) => setNationality(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label={t("parties.filter.nationality", { defaultValue: "Nationality" })}
        >
          <option value="">{t("parties.filter.allNationalities", { defaultValue: "All nationalities" })}</option>
          {nationalities.map((nat) => (
            <option key={nat} value={nat}>
              {nat}
            </option>
          ))}
        </select>
      </div>

      {/* R-LC5 LC-L4 — table layout (decision 4a). */}
      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-ink-muted">
          {t("common.loading", { defaultValue: "Loading…" })}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t("parties.empty", { defaultValue: "No parties match the filter." })}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              <tr>
                <th className="w-9 py-2 ps-3"></th>
                <th className="py-2 text-start">
                  {t("parties.col.name", { defaultValue: "Name" })}
                </th>
                <th className="py-2 text-start" dir="rtl">
                  {t("parties.col.nameAr", { defaultValue: "Name (AR)" })}
                </th>
                <th className="py-2 text-start">
                  {t("parties.col.type", { defaultValue: "Type" })}
                </th>
                <th className="py-2 text-start">
                  {t("parties.col.identifier", { defaultValue: "Identifier" })}
                </th>
                <th className="py-2 text-center">
                  {t("parties.col.verified", { defaultValue: "Verified" })}
                </th>
                <th className="py-2 pe-3 text-end">
                  {t("parties.col.contracts", { defaultValue: "Contracts" })}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* D41 — render only the current page slice (PAGE_SIZE = 25)
                  to keep DOM small. Counter + Prev/Next strip lives below
                  the table. */}
              {pagedItems.map((p) => {
                const initials = p.nameEn
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase();
                const display = isAr && p.nameAr ? p.nameAr : p.nameEn;
                return (
                  <tr key={p.id} className="border-b border-border/50 transition-colors hover:bg-surface/50">
                    <td className="py-2 ps-3">
                      {p.partyType === "company" ? (
                        <Building2 className="h-4 w-4 text-gold" />
                      ) : (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold/10 font-mono text-[10px] font-medium text-gold">
                          {initials}
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <Link
                        to="/app/parties/$id"
                        params={{ id: String(p.id) }}
                        className="font-medium text-ink hover:underline"
                      >
                        {display}
                      </Link>
                    </td>
                    <td className="py-2 text-ink-muted" dir="rtl">
                      {p.nameAr ?? "—"}
                    </td>
                    <td className="py-2">
                      {/* L104 — drop uppercase, use humanized partyType */}
                      <span className="inline-flex items-center rounded-md bg-surface px-2 py-0.5 font-mono text-[10px] tracking-wider text-ink-muted">
                        {humanizePartyType(p.partyType)}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-[11px] text-ink-muted">
                      {p.tradeLicenseNumber ?? "—"}
                    </td>
                    <td className="py-2 text-center">
                      {p.isVerified ? (
                        <BadgeCheck className="mx-auto h-4 w-4 text-sage" />
                      ) : (
                        <span className="text-ink-subtle">—</span>
                      )}
                    </td>
                    {/* L70 — Contracts count from BE */}
                    <td className="py-2 pe-3 text-end font-mono text-xs text-ink-muted">
                      {typeof (p as { contractsCount?: number }).contractsCount === "number"
                        ? (p as { contractsCount: number }).contractsCount
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* D41 — pagination strip. Shows the visible slice + Prev/Next.
              Disabled state on the boundary buttons. */}
          {filteredItems.length > PAGE_SIZE && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs text-ink-muted">
              <span>
                {t("parties.pagination.showing", {
                  defaultValue: "Showing {{from}}-{{to}} of {{n}}",
                  from: (currentPage - 1) * PAGE_SIZE + 1,
                  to: Math.min(currentPage * PAGE_SIZE, filteredItems.length),
                  n: filteredItems.length,
                })}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  {t("common.back", { defaultValue: "Back" })}
                </Button>
                <span className="font-mono text-[10px]">
                  {currentPage} / {pageCount}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                  disabled={currentPage >= pageCount}
                >
                  {t("common.next", { defaultValue: "Next" })}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
