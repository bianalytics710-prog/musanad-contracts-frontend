/**
 * SigningCeremony (S3) — public signer-facing landing page.
 *
 * Mode: regenerate — Lovable's SigningCeremony.tsx was a 4-phase post-sign
 * animation tightly coupled to a regenerated signingService. M3's S3 is a
 * different concern: render the contract excerpt + signer details + sign /
 * decline / Q&A actions, all gated behind a verification gate (S13).
 *
 * Behaviour:
 *   - Reads GET /api/v1/sign/:invitationToken (S3) via apiPublicClient.
 *   - Three states (T4):
 *     - Loading skeleton
 *     - Error: 410 invitation_invalid_or_expired surfaces a localised
 *       "expired or unknown" panel (the BE returns a single generic 410
 *       per AC-S3-04 — we don't differentiate unknown / expired / cancelled).
 *     - Success: full ceremony page with contract excerpt + sign UI.
 *   - Locks <html dir> + <html lang> to invitation.language for the duration
 *     of this route.
 *   - VerificationGate (S13) is rendered above the sign UI — the user must
 *     pass it before the SignatureMethodPicker is enabled.
 *   - DeclineDrawer + SignerQADrawer mounted as overlays.
 *
 * AC mapping:
 *   AC-S3-01..07:
 *     - Plaintext token from URL path → API hashes-and-matches.
 *     - signerEmail rendered ALWAYS masked (BE returns masked).
 *     - bodyEnExcerpt / bodyArExcerpt truncated 4000 chars (BE).
 *     - 'viewed' event emitted ONCE per session (BE-side; no FE action).
 *     - signature_data / signature_image_url not present in response.
 *
 * Public route SECURITY:
 *   - apiPublicClient (used by signatureService) does NOT attach Authorization.
 *   - No JWT refresh on this page. No auth store dependency.
 *
 * 13-checklist mapping:
 *   T1/T2 — useSignaturePublicView (apiPublicClient under the hood).
 *   T3    — every label uses t().
 *   T4    — loading / empty / error states.
 *   T5    — semantic Tailwind tokens + T1 brand-tokens elsewhere.
 *   T6    — wcag 2.1 AA: label+input pairs, role=region, focus management.
 *   T11   — caller wraps page in route ErrorBoundary.
 *   T12   — formatDateTime for expiresAt.
 *   T13   — masked email + sensitive fields handled per spec.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  CircleAlert,
  FileText,
  Loader2,
  Mail,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignaturePublicView } from "@/features/signatures/hooks/useSignatures";
import { SignatureMethodPicker } from "@/features/signatures/components/SignatureMethodPicker";
import { VerificationGate } from "@/features/signatures/components/VerificationGate";
import { DeclineDrawer } from "@/features/signatures/components/DeclineDrawer";
import { SignerQADrawer } from "@/features/signatures/components/SignerQADrawer";
import { translateApiError } from "@/lib/translate-api-error";
import { formatDateTime } from "@/utils/datetime";
import type {
  SignaturePublicView,
  SignatureLanguage,
  SignatureInvitationStatus,
} from "@/types/entities/signature.types";

interface Props {
  invitationToken: string;
}

export function SigningCeremony({ invitationToken }: Props) {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, error, refetch } =
    useSignaturePublicView(invitationToken);

  const [verified, setVerified] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [qaOpen, setQaOpen] = useState(false);
  const [completed, setCompleted] = useState(false);

  const view = data?.data ?? null;
  const language: SignatureLanguage = view?.invitation.language ?? "en";

  // Lock <html dir> + <html lang> to invitation.language for the duration
  // of this page. Mirrors M0's app-shell behaviour but applied at the
  // route level so the public page works regardless of authed user prefs.
  useEffect(() => {
    if (!view) return;
    const html = document.documentElement;
    const prevLang = html.lang;
    const prevDir = html.dir;
    html.lang = language;
    html.dir = language === "ar" ? "rtl" : "ltr";
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
    return () => {
      html.lang = prevLang;
      html.dir = prevDir;
    };
  }, [view, language, i18n]);

  const titleEn = view?.contract.titleEn ?? "";
  const displayTitle = useMemo(() => {
    if (!view) return "";
    if (language === "ar" && view.contract.titleAr) return view.contract.titleAr;
    return view.contract.titleEn;
  }, [view, language]);

  const summaryDisplay = useMemo(() => {
    if (!view) return null;
    return language === "ar"
      ? view.contract.aiSummaryAr ?? view.contract.aiSummaryEn
      : view.contract.aiSummaryEn ?? view.contract.aiSummaryAr;
  }, [view, language]);

  const bodyExcerpt = useMemo(() => {
    if (!view) return null;
    return language === "ar"
      ? view.contract.bodyArExcerpt ?? view.contract.bodyEnExcerpt
      : view.contract.bodyEnExcerpt ?? view.contract.bodyArExcerpt;
  }, [view, language]);

  if (isLoading) {
    return (
      <PageShell>
        <div
          className="space-y-4"
          aria-busy="true"
          aria-label={t("common.loading")}
        >
          <div className="h-32 animate-pulse rounded-lg bg-surface" />
          <div className="h-64 animate-pulse rounded-lg bg-surface" />
        </div>
      </PageShell>
    );
  }

  if (isError || !view) {
    const code = error?.code ?? "";
    const isExpired =
      error?.status === 410 ||
      code === "invitation_invalid_or_expired";
    return (
      <PageShell>
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
          <CircleAlert className="mx-auto h-7 w-7 text-destructive" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-ink">
            {isExpired
              ? t("sign.m3.error.expiredTitle")
              : t("sign.m3.error.genericTitle")}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {isExpired
              ? t("sign.m3.error.expiredBody")
              : translateApiError(error, t, "errors.signatures.publicViewFailed")}
          </p>
          {!isExpired && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void refetch()}
            >
              {t("common.retry")}
            </Button>
          )}
        </div>
      </PageShell>
    );
  }

  const status = view.invitation.status;
  const terminal: SignatureInvitationStatus[] = [
    "signed",
    "declined",
    "expired",
    "cancelled",
  ];
  const isTerminal = terminal.includes(status) || completed;

  return (
    <PageShell>
      <header className="mb-4 flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gold/20 text-gold">
            <FileText className="h-4 w-4" aria-hidden />
          </span>
          <p className="text-sm font-medium text-ink">
            {t("sign.m3.heading")}
          </p>
        </div>
        <p className="text-[11px] uppercase tracking-wider text-ink-subtle">
          {view.contract.contractNumber}
        </p>
      </header>

      <main className="space-y-4">
        {isTerminal ? (
          <TerminalState status={status} completed={completed} />
        ) : (
          <>
            <ContractCard
              view={view}
              displayTitle={displayTitle}
              summary={summaryDisplay}
              bodyExcerpt={bodyExcerpt}
            />

            <SignerCard view={view} />

            {/* Q&A action — always available */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setQaOpen(true)}
            >
              <Sparkles className="me-2 h-4 w-4 text-gold" aria-hidden />
              {t("sign.m3.actions.askQuestions")}
            </Button>

            {/* Verification gate (S13) — must pass before sign */}
            {!verified && (
              <VerificationGate
                expectedNameEn={view.signer.nameEn}
                maskedEmail={view.signer.email}
                onVerified={() => setVerified(true)}
              />
            )}

            {verified && (
              <SignatureMethodPicker
                invitationToken={invitationToken}
                availableMethods={view.availableMethods}
                onSigned={() => setCompleted(true)}
              />
            )}

            {/* Decline action */}
            <Button
              type="button"
              variant="ghost"
              className="w-full text-destructive hover:bg-destructive/10"
              onClick={() => setDeclineOpen(true)}
            >
              <X className="me-2 h-4 w-4" aria-hidden />
              {t("sign.m3.actions.decline")}
            </Button>
          </>
        )}
      </main>

      <footer className="mt-8 text-center">
        <p className="text-[10px] text-ink-subtle">
          {t("sign.m3.footer")}
        </p>
      </footer>

      {declineOpen && (
        <DeclineDrawer
          invitationToken={invitationToken}
          open={declineOpen}
          onClose={() => setDeclineOpen(false)}
          onSuccess={() => setCompleted(true)}
        />
      )}

      {qaOpen && (
        <SignerQADrawer
          invitationToken={invitationToken}
          language={language}
          open={qaOpen}
          onClose={() => setQaOpen(false)}
        />
      )}
    </PageShell>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
        {children}
      </div>
    </div>
  );
}

interface ContractCardProps {
  view: SignaturePublicView;
  displayTitle: string;
  summary: string | null;
  bodyExcerpt: string | null;
}

function ContractCard({ view, displayTitle, summary, bodyExcerpt }: ContractCardProps) {
  const { t, i18n } = useTranslation();
  const [showFullBody, setShowFullBody] = useState(false);
  return (
    <section
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
      aria-label={t("sign.m3.contract.regionLabel")}
    >
      <p className="text-[11px] uppercase tracking-wider text-ink-subtle">
        {t(`sign.m3.contract.type.${view.contract.contractType}`, {
          defaultValue: view.contract.contractType,
        })}
      </p>
      <h1 className="mt-1 text-lg font-semibold tracking-tight text-ink">
        {displayTitle}
      </h1>

      <dl className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        {view.contract.ourPartyName && (
          <Field label={t("sign.m3.contract.ourParty")} value={view.contract.ourPartyName} />
        )}
        {view.contract.counterpartyName && (
          <Field
            label={t("sign.m3.contract.counterparty")}
            value={view.contract.counterpartyName}
          />
        )}
        {view.contract.valueAed !== null && (
          <Field
            label={t("sign.m3.contract.value")}
            value={new Intl.NumberFormat(
              i18n.language?.startsWith("ar") ? "ar-AE" : "en-AE",
              { style: "currency", currency: "AED", maximumFractionDigits: 2 },
            ).format(view.contract.valueAed)}
          />
        )}
        {view.contract.startDate && (
          <Field
            label={t("sign.m3.contract.startDate")}
            value={formatDateTime(view.contract.startDate, { showTime: false })}
          />
        )}
        {view.contract.endDate && (
          <Field
            label={t("sign.m3.contract.endDate")}
            value={formatDateTime(view.contract.endDate, { showTime: false })}
          />
        )}
      </dl>

      {summary && (
        <div className="mt-4 rounded-md border border-border bg-surface p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
            {t("sign.m3.contract.summary")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink">{summary}</p>
        </div>
      )}

      {bodyExcerpt && (
        <div className="mt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowFullBody((s) => !s)}
            aria-expanded={showFullBody}
          >
            {showFullBody
              ? t("sign.m3.contract.hideBody")
              : t("sign.m3.contract.showBody")}
          </Button>
          {showFullBody && (
            <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-xs leading-relaxed text-ink-muted">
              {bodyExcerpt}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}

function SignerCard({ view }: { view: SignaturePublicView }) {
  const { t } = useTranslation();
  return (
    <section
      className="rounded-xl border border-border bg-card p-4 shadow-sm"
      aria-label={t("sign.m3.signer.regionLabel")}
    >
      <p className="text-[11px] uppercase tracking-wider text-ink-subtle">
        {t("sign.m3.signer.heading")}
      </p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{view.signer.nameEn}</p>
          <p className="text-xs text-ink-muted">
            {t(`signatures.signerSide.${view.signer.side}`)}
          </p>
          {view.signer.email && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-ink-subtle">
              <Mail className="h-3 w-3" aria-hidden />
              <span className="font-mono">{view.signer.email}</span>
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="inline-flex items-center gap-1 text-[11px] text-ink-subtle">
            <Calendar className="h-3 w-3" aria-hidden />
            {t("sign.m3.signer.expiresAt", {
              when: formatDateTime(view.invitation.expiresAt),
            })}
          </p>
          <p className="mt-0.5 text-[10px] text-ink-subtle">
            {t("sign.m3.signer.viewCount", { n: view.invitation.viewCount })}
          </p>
        </div>
      </div>
    </section>
  );
}

function TerminalState({
  status,
  completed,
}: {
  status: SignatureInvitationStatus;
  completed: boolean;
}) {
  const { t } = useTranslation();
  const effectiveStatus = completed ? "signed" : status;
  let icon: React.ReactNode;
  let key: string;
  if (effectiveStatus === "signed") {
    icon = <Sparkles className="h-7 w-7 text-sage-ink" aria-hidden />;
    key = "signed";
  } else if (effectiveStatus === "declined") {
    icon = <X className="h-7 w-7 text-destructive" aria-hidden />;
    key = "declined";
  } else if (effectiveStatus === "expired") {
    icon = <ShieldAlert className="h-7 w-7 text-amber-ink" aria-hidden />;
    key = "expired";
  } else {
    icon = <CircleAlert className="h-7 w-7 text-amber-ink" aria-hidden />;
    key = "cancelled";
  }
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto inline-flex">{icon}</div>
      <h2 className="mt-3 text-lg font-semibold text-ink">
        {t(`sign.m3.terminal.${key}.title`)}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        {t(`sign.m3.terminal.${key}.body`)}
      </p>
    </div>
  );
}

export default SigningCeremony;
