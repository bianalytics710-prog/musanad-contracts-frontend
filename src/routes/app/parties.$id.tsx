import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, User, Mail, Phone, MapPin } from "lucide-react";
import { partiesService } from "@/services/api/m_parity.service";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { formatDateTime } from "@/utils/datetime";

export const Route = createFileRoute("/app/parties/$id")({
  component: () => (
    <ErrorBoundary>
      <PartyDetailView />
    </ErrorBoundary>
  ),
});

function PartyDetailView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const { id } = Route.useParams();
  const partyId = Number(id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["party", partyId],
    queryFn: () => partiesService.getById(partyId),
    enabled: Number.isInteger(partyId),
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1024px] space-y-4 p-6"
    >
      <Link
        to="/app/parties"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-gold"
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
          </div>
          {data.partyType === "company" ? (
            <Building2 className="h-10 w-10 text-gold" />
          ) : (
            <User className="h-10 w-10 text-gold" />
          )}
        </div>
      </section>

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
                <span className="font-mono text-xs">{data.contactEmail}</span>
              </div>
            )}
            {data.contactPhone && (
              <div className="flex items-center gap-2 text-ink-muted">
                <Phone className="h-4 w-4 text-ink-subtle" />
                <span className="font-mono text-xs">{data.contactPhone}</span>
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
            {t("parties.detail.legal", { defaultValue: "Legal & jurisdiction" })}
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
          <ul className="divide-y divide-border">
            {data.recentContracts5.map((c) => (
              <li key={c.id} className="py-2">
                <Link
                  to="/app/contracts/$id"
                  params={{ id: String(c.id) }}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-surface"
                >
                  <span className="w-28 shrink-0 font-mono text-xs text-ink-subtle">
                    {c.contractNumber}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {c.titleEn}
                  </span>
                  <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                    {c.status}
                  </span>
                  <span className="w-32 shrink-0 text-end font-mono text-xs text-ink-muted">
                    {c.valueAed
                      ? `AED ${c.valueAed.toLocaleString()}`
                      : "—"}
                  </span>
                  <span className="w-32 shrink-0 text-end font-mono text-[10px] text-ink-subtle">
                    {formatDateTime(c.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </motion.div>
  );
}
