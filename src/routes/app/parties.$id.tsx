/**
 * /app/parties/$id — Party detail page (M9 / CR-B evolution).
 *
 * Tabs:
 *   - Overview         (existing flat sections — Contact, Legal & Jurisdiction,
 *                       Recent contracts; preserved verbatim)
 *   - Ownership Chain  (NEW — tree visualization of ancestors + descendants)
 *
 * Header additions (CR-B):
 *   - Sanctions status badge with last_checked relative time
 *   - ICV indicator badge (certified / expired / downgraded / pending / none)
 *   - Aliases pill list (display-only)
 *   - "Edit party" button (party.graph.manage gated) — opens
 *     PartyExtendedEditDialog with the editable subset (parent / ubo / aliases /
 *     ESG / ICV / metadata). Sanctions fields are read-only (Q-DA4 lock).
 *
 * Backward compatibility: PartyDetail consumed here is the SUPERSET shape from
 * party-graph.types — every existing M_parity field is preserved verbatim, so
 * the legacy partiesService.getById() return type still satisfies it via
 * structural widening (TO-M9-BE-5).
 */
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { partiesService } from "@/services/api/m_parity.service";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import { formatDateTime } from "@/utils/datetime";
import { formatRelative } from "@/components/sources/relativeTime";
import { SanctionsStatusBadge } from "@/components/parties/SanctionsStatusBadge";
import { IcvStatusBadge } from "@/components/parties/IcvStatusBadge";
import { OwnershipChainTab } from "@/components/parties/OwnershipChainTab";
import { PartyExtendedEditDialog } from "@/components/parties/PartyExtendedEditDialog";
import type { PartyDetail as PartyDetailExtended } from "@/types/entities/party-graph.types";

export const Route = createFileRoute("/app/parties/$id")({
  component: () => (
    <ErrorBoundary>
      <PartyDetailView />
    </ErrorBoundary>
  ),
});

type TabKey = "overview" | "chain";

function PartyDetailView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar") ?? false;
  const { id } = Route.useParams();
  const partyId = Number(id);
  const canManage = useAuthStore(selectHasPermission("party.graph.manage"));

  const [tab, setTab] = useState<TabKey>("overview");
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["party", partyId],
    queryFn: () =>
      partiesService.getById(partyId) as Promise<PartyDetailExtended>,
    enabled: Number.isInteger(partyId) && partyId > 0,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1024px] space-y-4 p-6">
        <div className="h-8 animate-pulse rounded-md bg-surface" />
        <div className="h-32 animate-pulse rounded-lg bg-surface" />
        <div className="h-48 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-md p-12 text-center">
        <h1 className="text-base font-semibold text-ink">
          {t("parties.notFound", { defaultValue: "Party not found" })}
        </h1>
        <Link
          to="/app/parties"
          className="mt-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t("parties.backToList", { defaultValue: "Back to parties" })}
        </Link>
      </div>
    );
  }

  // Defensive view-projection — older API responses lacking M9 columns will
  // surface as undefined; coerce to safe defaults so the new UI doesn't crash.
  const sanctionsStatus = data.sanctionsStatus ?? "clean";
  const aliases: string[] = Array.isArray(data.aliases) ? data.aliases : [];
  const hasIcv =
    data.icvStatus !== null &&
    data.icvStatus !== undefined &&
    data.icvStatus !== "none";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1024px] space-y-4 p-6"
    >
      <Link
        to="/app/parties"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
        {t("parties.backToList", { defaultValue: "Back to parties" })}
      </Link>

      {/* Header card */}
      <section className="rounded-lg border border-border border-l-4 border-l-gold bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="font-mono text-xs uppercase tracking-wider text-ink-subtle">
              {data.partyType === "company"
                ? t("parties.company", { defaultValue: "Company" })
                : t("parties.individual", { defaultValue: "Individual" })}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">
              {isAr && data.nameAr ? data.nameAr : data.nameEn}
            </h1>
            {data.nameAr && !isAr && (
              <p className="mt-0.5 text-sm text-ink-subtle" dir="rtl">
                {data.nameAr}
              </p>
            )}

            {/* M9 status row — sanctions + ICV + last checked */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SanctionsStatusBadge status={sanctionsStatus} />
              {data.sanctionsLastChecked && (
                <span className="font-mono text-[11px] text-ink-muted">
                  {t("parties.sanctions.lastChecked", {
                    defaultValue: "Last checked",
                  })}
                  : {formatRelative(data.sanctionsLastChecked)}
                </span>
              )}
              {hasIcv && data.icvStatus && (
                <IcvStatusBadge status={data.icvStatus} pct={data.icvPct} />
              )}
              {typeof data.esgScore === "number" && (
                <span className="rounded-full bg-slate/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-ink">
                  {t("parties.esgScore", { defaultValue: "ESG" })}:{" "}
                  {data.esgScore}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            {canManage && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="me-1.5 h-3.5 w-3.5" aria-hidden />
                {t("parties.editParty", { defaultValue: "Edit party" })}
              </Button>
            )}
            {data.partyType === "company" ? (
              <Building2 className="h-10 w-10 text-gold" />
            ) : (
              <User className="h-10 w-10 text-gold" />
            )}
          </div>
        </div>

        {/* Aliases pill list */}
        {aliases.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t("parties.aliases.title")}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {aliases.map((alias, idx) => (
                <span
                  key={`${alias}-${idx}`}
                  className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-xs text-ink"
                >
                  {alias}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="overview">
            {t("parties.tabs.overview", { defaultValue: "Overview" })}
          </TabsTrigger>
          <TabsTrigger value="chain">
            {t("parties.tabs.ownershipChain", {
              defaultValue: "Ownership chain",
            })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Detail grid */}
          <section className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold text-ink">
                {t("parties.detail.contact", { defaultValue: "Contact" })}
              </h2>
              <dl className="space-y-2 text-sm">
                {data.contactEmail && (
                  <div className="flex items-center gap-2 text-ink-muted">
                    <Mail className="h-4 w-4 text-ink-subtle" />
                    <span className="font-mono text-xs">
                      {data.contactEmail}
                    </span>
                  </div>
                )}
                {data.contactPhone && (
                  <div className="flex items-center gap-2 text-ink-muted">
                    <Phone className="h-4 w-4 text-ink-subtle" />
                    <span className="font-mono text-xs">
                      {data.contactPhone}
                    </span>
                  </div>
                )}
                {data.registeredAddress && (
                  <div className="flex items-start gap-2 text-ink-muted">
                    <MapPin className="mt-0.5 h-4 w-4 text-ink-subtle" />
                    <span className="text-xs">{data.registeredAddress}</span>
                  </div>
                )}
              </dl>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold text-ink">
                {t("parties.detail.legal", {
                  defaultValue: "Legal & jurisdiction",
                })}
              </h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-ink-subtle">
                    {t("parties.detail.tradeLicense", {
                      defaultValue: "Trade license",
                    })}
                  </dt>
                  <dd className="font-mono text-xs text-ink">
                    {data.tradeLicenseNumber ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-ink-subtle">
                    {t("parties.detail.issuer", { defaultValue: "Issuer" })}
                  </dt>
                  <dd className="text-xs text-ink">
                    {data.tradeLicenseIssuer ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-ink-subtle">
                    {t("parties.detail.emirate", { defaultValue: "Emirate" })}
                  </dt>
                  <dd className="text-xs capitalize text-ink">
                    {data.emirate?.replace(/_/g, " ") ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-ink-subtle">
                    {t("parties.detail.freeZone", { defaultValue: "Free zone" })}
                  </dt>
                  <dd className="text-xs text-ink">{data.freeZone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-ink-subtle">
                    {t("parties.detail.country", { defaultValue: "Country" })}
                  </dt>
                  <dd className="text-xs text-ink">{data.country}</dd>
                </div>
              </dl>
            </div>
          </section>

          {/* Recent contracts */}
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">
              {t("parties.detail.recentContracts", {
                defaultValue: "Recent contracts (5)",
              })}
            </h2>
            {data.recentContracts5.length === 0 ? (
              <p className="py-4 text-center text-xs text-ink-subtle">
                {t("parties.detail.noContracts", {
                  defaultValue: "No contracts wired to this party yet.",
                })}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-ink-subtle">
                  <tr>
                    <th scope="col" className="py-1.5 text-start">
                      {t("parties.detail.colContract", {
                        defaultValue: "Contract",
                      })}
                    </th>
                    <th scope="col" className="py-1.5 text-start">
                      {t("parties.detail.colTitle", {
                        defaultValue: "Title",
                      })}
                    </th>
                    <th scope="col" className="py-1.5 text-start">
                      {t("parties.detail.colStatus", {
                        defaultValue: "Status",
                      })}
                    </th>
                    <th scope="col" className="py-1.5 text-end">
                      {t("parties.detail.colValue", {
                        defaultValue: "Value",
                      })}
                    </th>
                    <th scope="col" className="py-1.5 text-end">
                      {t("parties.detail.colUpdated", {
                        defaultValue: "Updated",
                      })}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.recentContracts5.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2">
                        <Link
                          to="/app/contracts/$id"
                          params={{ id: String(c.id) }}
                          className="font-mono text-xs text-ink-subtle hover:text-gold focus-visible:outline-none focus-visible:underline"
                        >
                          {c.contractNumber}
                        </Link>
                      </td>
                      <td className="py-2 text-ink">{c.titleEn}</td>
                      <td className="py-2">
                        <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2 text-end font-mono text-xs text-ink-muted">
                        {c.valueAed
                          ? `AED ${c.valueAed.toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="py-2 text-end font-mono text-[10px] text-ink-subtle">
                        {formatDateTime(c.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </TabsContent>

        <TabsContent value="chain">
          <OwnershipChainTab
            partyId={partyId}
            rootNameEn={data.nameEn}
            rootNameAr={data.nameAr}
            isAr={isAr}
            enabled={tab === "chain"}
          />
        </TabsContent>
      </Tabs>

      {editOpen && (
        <PartyExtendedEditDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          party={data}
        />
      )}
    </motion.div>
  );
}
