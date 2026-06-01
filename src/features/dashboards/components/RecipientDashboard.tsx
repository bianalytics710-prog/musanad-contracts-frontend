/**
 * RecipientDashboard (S5).
 *
 * Mode: REGENERATE. Lovable's RecipientDashboard.tsx (476L) was tightly
 * supabase-coupled.
 *
 *   GET /api/v1/dashboards/recipient?windowDays=N
 *
 * AC mapping:
 *   AC-S5-01..03 — KPI grid (myContractsCount / pendingMySignatureCount /
 *                  signedByMeWindow). DN-19 / DN-E semantic limitation:
 *                  signedByMeWindow uses signature_event.actor_user_id —
 *                  external-only invitation signers (no user account)
 *                  are NOT counted; internal recipients (UAE-PASS or
 *                  app-authenticated) ARE counted (S2-22-FIX-1).
 *   AC-S5-04 — myObligationsCount placeholder (DASH-OI-A).
 *   AC-S5-05..06 — myContracts5 + pendingSignatures5 lists.
 *   AC-S5-07 — 403 when caller is not recipient / admin / Super Admin.
 *
 * 13-checklist: T1/T2/T3/T4/T5/T6/T7/T11/T12.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight, PenLine, Clock } from "lucide-react";
import { useRecipientDashboard } from "../hooks/useDashboards";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingSkeleton,
  KpiTile,
  TimeRangeSelector,
  asWindowQuery,
  formatNumber,
  rangeFromWindowDays,
} from "./dashboard-primitives";
import type {
  DashboardRangeKey,
  RecipientMyContractsRow,
  RecipientPendingSignatureRow,
} from "@/types/entities/dashboards.types";
import { formatDate, formatDateTime, formatHijriDate } from "@/utils/datetime";
import { useAuthStore, selectUser } from "@/store/auth.store";
import { ContractStatusBadge } from "@/features/contracts/components/ContractStatusBadge";

const DEFAULT_WINDOW_DAYS = 30;

export function RecipientDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [range, setRange] = useState<DashboardRangeKey>(
    rangeFromWindowDays(DEFAULT_WINDOW_DAYS),
  );

  const { data, isLoading, isError, error, refetch } = useRecipientDashboard(
    asWindowQuery(windowDays),
  );

  const topPendingSig = useMemo(
    () => data?.lists.pendingSignatures5?.[0] ?? null,
    [data],
  );

  const nowISO = new Date().toISOString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6 p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {/* R-RC0 — welcome line + Hijri date strip (Lovable parity, mirrors LC + approver). */}
          {/* R42/R44 (Rashid audit 2026-06-01) — AR mode previously used a
              Latin comma and produced mixed-direction text when the actor's
              Latin name landed in the middle of an Arabic banner. The i18n
              template now uses the locale-appropriate comma (Arabic comma
              in ar.json), and the name is rendered inside <bdi> so the RTL
              flow doesn't break around the Latin glyphs. */}
          <p className="text-xs text-ink-subtle">
            {user ? (
              <>
                <span>{t("dashboards.common.welcome", { defaultValue: "Welcome back" })}</span>
                <span>{t("dashboards.recipient.welcomeComma", { defaultValue: ", " })}</span>
                <bdi>{user.firstName} {user.lastName}</bdi>
                <span> · {formatDate(nowISO)} · {formatHijriDate(nowISO)}</span>
              </>
            ) : (
              `${formatDate(nowISO)} · ${formatHijriDate(nowISO)}`
            )}
          </p>
          {/* R-RC0 — H1 wording: "My contracts" (Lovable parity, recipient-tailored). */}
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("dashboards.recipient.title", { defaultValue: "My contracts" })}
          </h1>
        </div>
        {/* R1+R7 (Rashid audit 2026-06-01) — Recipient dashboard is snapshot
            only (myContracts / pending / signedByMe are all lifetime KPIs);
            the date filter scoped nothing visible. BE now signals
            windowApplies=false (mig 435); hide the orphan pill row when so.
            When the BE has not been redeployed yet, default to hiding. */}
        {data?.windowApplies === true && (
          <TimeRangeSelector
            range={range}
            windowDays={windowDays}
            onChange={({ range: r, windowDays: d }) => {
              setRange(r);
              setWindowDays(d);
            }}
          />
        )}
      </header>

      {isLoading && !data ? (
        <DashboardLoadingSkeleton rows={1} />
      ) : isError ? (
        <DashboardErrorState
          error={error}
          onRetry={() => void refetch()}
          fallbackKey="dashboards.recipient.errors.loadFailed"
        />
      ) : !data ? (
        <DashboardEmptyState />
      ) : (
        <>
          {topPendingSig && (
            <Link
              to="/app/contracts/$id"
              params={{ id: String(topPendingSig.contractId) }}
              className="relative block overflow-hidden rounded-xl border border-gold bg-gold/10 p-5 transition-colors hover:bg-gold/20"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="font-mono text-xs uppercase tracking-wider text-gold">
                    {t("dashboards.recipient.hero.kicker", {
                      defaultValue: "Awaiting your signature",
                    })}
                  </div>
                  <div className="mt-1 text-lg font-semibold leading-tight text-ink md:text-xl">
                    {topPendingSig.contractNumber}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-0.5 font-mono">
                      <Clock className="h-3 w-3" />
                      {t("dashboards.recipient.lists.invitationSent")}:{" "}
                      {formatDateTime(topPendingSig.sentAt)}
                    </span>
                    {topPendingSig.expiresAt && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-tint/30 px-2 py-0.5 font-mono text-amber-ink">
                        {t("dashboards.recipient.lists.invitationExpires")}:{" "}
                        {formatDateTime(topPendingSig.expiresAt)}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-card">
                    <PenLine className="h-4 w-4" />
                    {t("dashboards.recipient.hero.signCta", {
                      defaultValue: "Review and sign",
                    })}
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* R-RC3 — KPI rationalisation. Recipients are external counterparty
              signers; "My obligations" was a placeholder tied to a feature
              the recipient role won't ever own (Q1 = drop obligations
              entirely). The "Signed by me" caveat about external invitation
              signers is confusing for a recipient who IS exactly that —
              drop the helper line. Net: 3 tiles, all meaningful for the
              role. */}
          <section
            aria-label={t("dashboards.recipient.kpiGroupLabel")}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <KpiTile
              label={t("dashboards.recipient.kpis.myContractsCount")}
              value={formatNumber(data.kpis.myContractsCount)}
            />
            <KpiTile
              label={t("dashboards.recipient.kpis.pendingMySignatureCount")}
              value={formatNumber(data.kpis.pendingMySignatureCount)}
              variant={
                data.kpis.pendingMySignatureCount > 0 ? "warning" : "default"
              }
            />
            <KpiTile
              /* R3 — renamed to signedByMeCount (no window indicator); the
                 BE now counts fully_signed contracts OR signature_event 'signed'
                 by caller, so the tile reconciles with the visible list. */
              label={t("dashboards.recipient.kpis.signedByMeCount", {
                defaultValue: "Signed by me",
              })}
              value={formatNumber(
                (data.kpis as { signedByMeCount?: number; signedByMeWindow?: number })
                  .signedByMeCount ??
                  (data.kpis as { signedByMeWindow?: number }).signedByMeWindow ??
                  0,
              )}
              variant="success"
            />
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-4">
              {/* R6 — the page H1 already says "My contracts"; rename this
                  section header to differentiate ("Active register"). */}
              <h3 className="mb-2 text-sm font-semibold text-ink">
                {t("dashboards.recipient.lists.myContractsTitle", {
                  defaultValue: "Active register",
                })}
              </h3>
              <p className="mb-3 text-xs text-ink-subtle">
                {t("dashboards.recipient.lists.myContractsDescription")}
              </p>
              <MyContractsList rows={data.lists.myContracts5} />
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold text-ink">
                {t("dashboards.recipient.lists.pendingSignaturesTitle")}
              </h3>
              <p className="mb-3 text-xs text-ink-subtle">
                {t("dashboards.recipient.lists.pendingSignaturesDescription")}
              </p>
              <PendingSignaturesList rows={data.lists.pendingSignatures5} />
            </section>
          </div>
        </>
      )}
    </motion.div>
  );
}

function MyContractsList({ rows }: { rows: RecipientMyContractsRow[] }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  if (rows.length === 0) {
    return <DashboardEmptyState description={t("dashboards.common.emptyList")} />;
  }
  return (
    <ul role="list" className="divide-y divide-border">
      {rows.map((row) => {
        // R41 — locale-aware title (use titleAr in AR mode when present).
        const displayTitle = isAr && row.titleAr ? row.titleAr : row.titleEn;
        // R4 — show the real counterparty name instead of the
        // "Counterparty details: pending" placeholder. BE mig 435 now ships
        // the field for recipient scope. Falls back gracefully when null.
        const counterpartyName =
          (isAr ? row.counterpartyNameAr : row.counterpartyNameEn) ??
          row.counterpartyNameEn ??
          null;
        return (
          <li key={row.id} role="listitem" className="py-2">
            <Link
              to="/app/contracts/$id"
              params={{ id: String(row.id) }}
              className="block rounded-md px-2 py-1 transition hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label={t("dashboards.common.openContractAria", {
                number: row.contractNumber,
                title: displayTitle,
              })}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs text-ink-subtle">
                  {row.contractNumber}
                </span>
                {/* R5 — replace ad-hoc uppercase font-mono label with the
                    shared title-case status badge ("Fully signed" not
                    "FULLY SIGNED"). */}
                <ContractStatusBadge status={row.status as never} />
              </div>
              <p className="mt-1 text-sm text-ink">{displayTitle}</p>
              {counterpartyName ? (
                <p className="text-[11px] text-ink-muted">
                  {t("dashboards.recipient.lists.counterpartyLabel", {
                    defaultValue: "Counterparty",
                  })}
                  : {counterpartyName}
                </p>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function PendingSignaturesList({
  rows,
}: {
  rows: RecipientPendingSignatureRow[];
}) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    // R9 — single empty-state line; previous "Nothing here yet — Nothing to
    // show yet." rendered the same message twice. The signer-facing copy
    // explains the next step in one short line.
    return (
      <DashboardEmptyState
        description={t("dashboards.recipient.lists.pendingSignaturesEmpty", {
          defaultValue:
            "No active signing invitations. New invitations from counterparties will appear here.",
        })}
      />
    );
  }
  return (
    <ul role="list" className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.invitationId} role="listitem" className="py-2">
          <Link
            to="/app/contracts/$id"
            params={{ id: String(row.contractId) }}
            className="block rounded-md px-2 py-1 transition hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={t("dashboards.common.openContractAria", {
              number: row.contractNumber,
              title: row.contractNumber,
            })}
          >
            <span className="font-mono text-xs text-ink-subtle">
              {row.contractNumber}
            </span>
            <p className="mt-1 text-sm text-ink">
              {t("dashboards.recipient.lists.invitationSent")}:{" "}
              {formatDateTime(row.sentAt)}
            </p>
            {row.expiresAt && (
              <p className="text-[11px] text-amber-ink">
                {t("dashboards.recipient.lists.invitationExpires")}:{" "}
                {formatDateTime(row.expiresAt)}
              </p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default RecipientDashboard;
