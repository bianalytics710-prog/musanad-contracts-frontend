/**
 * ContractSignaturesTab (S6) — Signatures tab content for ContractDetail.
 *
 * Mode: regenerate — no Lovable equivalent (the Lovable repo embedded the
 * Signatures view inside its monolithic ContractCenterTabs.tsx; M3
 * introduces a dedicated, API-backed tab with role-aware email masking).
 *
 * Behaviour:
 *   - Three states (T4): loading skeleton, error w/ retry, empty state with
 *     "Configure signers" CTA when permission allows.
 *   - On success: signer roster (sorted by stepOrder ASC, created_at ASC per
 *     AC-S6-07) + per-step progress aggregate.
 *   - Action menu per signer:
 *     - "Resend invitation"  (gated by signature.send) when status pending|viewed.
 *     - "Cancel invitation"  (gated by signature.cancel) when status pending|viewed.
 *
 * AC mapping:
 *   AC-S6-01 — fn_signature_list_for_contract via signatureService.
 *   AC-S6-02 — stepProgress aggregate rendered.
 *   AC-S6-04 — signerEmail rendered as-is from API (BE masks per role).
 *   AC-S6-05 — signature_data / signature_image_url not in payload.
 *   AC-S6-06 — 404 surfaced via translateApiError.
 *   AC-S6-07 — order respected (BE returns sorted; we render in order).
 *
 * 13-checklist mapping:
 *   T1/T2 — useSignatureListForContract.
 *   T3    — every label uses t().
 *   T4    — loading / empty / error.
 *   T5    — semantic Tailwind tokens only.
 *   T6    — keyboard-accessible action menus + aria-labels.
 *   T7    — full type safety; SignatureParty / SignatureStepProgress.
 *   T11   — surfaced inside ContractDetail's route ErrorBoundary.
 *   T12   — formatDateTime for invitationSentAt / signedAt / declinedAt.
 *   T13   — emails arrive masked from BE; never plaintext leaked client-side.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock,
  Mail,
  Plus,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSignatureListForContract } from "@/features/signatures/hooks/useSignatures";
import { ContractSignersConfigDialog } from "@/features/signatures/components/ContractSignersConfigDialog";
import { SendForSignatureConfirmDialog } from "@/features/signatures/components/SendForSignatureConfirmDialog";
import { ResendInvitationConfirm } from "@/features/signatures/components/ResendInvitationConfirm";
import { CancelInvitationConfirm } from "@/features/signatures/components/CancelInvitationConfirm";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import { translateApiError } from "@/lib/translate-api-error";
import { formatDateTime } from "@/utils/datetime";
import { cn } from "@/lib/utils";
import type {
  SignatureParty,
  SignatureStepProgress,
  SignatureInvitationStatus,
} from "@/types/entities/signature.types";

interface Props {
  contractId: number;
  contractNumber?: string;
}

export function ContractSignaturesTab({ contractId, contractNumber }: Props) {
  const { t } = useTranslation();
  const canSend = useAuthStore(selectHasPermission("signature.send"));
  const canCancel = useAuthStore(selectHasPermission("signature.cancel"));

  const { data, isLoading, isError, error, refetch } =
    useSignatureListForContract(contractId);

  const [configOpen, setConfigOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [resendTarget, setResendTarget] = useState<SignatureParty | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{
    invitationId: number;
    party: SignatureParty;
  } | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("signatures.list.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="h-32 animate-pulse rounded-md bg-surface"
            aria-busy="true"
            aria-label={t("common.loading")}
          />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <CircleAlert
            className="mx-auto h-6 w-6 text-destructive"
            aria-hidden="true"
          />
          <p className="mt-2 text-sm text-destructive">
            {translateApiError(error, t, "errors.signatures.listFailed")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void refetch()}
          >
            {t("common.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const list = data?.data;
  const signers = list?.signers ?? [];
  const stepProgress = list?.stepProgress ?? [];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">
            {t("signatures.list.title")}
          </CardTitle>
          {canSend && (
            <div className="flex flex-wrap gap-2">
              {signers.length === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfigOpen(true)}
                >
                  <Plus className="me-1 h-3.5 w-3.5" />
                  {t("signatures.list.configure")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSendOpen(true)}
                >
                  <Send className="me-1 h-3.5 w-3.5" />
                  {t("signatures.list.sendForSignature")}
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {signers.length === 0 ? (
            <EmptyState
              canConfigure={canSend}
              onConfigure={() => setConfigOpen(true)}
            />
          ) : (
            <div className="space-y-4">
              {stepProgress.length > 0 && (
                <StepProgressBar steps={stepProgress} />
              )}
              <SignerRoster
                signers={signers}
                canResend={canSend}
                canCancel={canCancel}
                onResend={(p) => setResendTarget(p)}
                onCancel={(p) => {
                  if (p.currentInvitationId == null) return;
                  setCancelTarget({
                    invitationId: p.currentInvitationId,
                    party: p,
                  });
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {configOpen && (
        <ContractSignersConfigDialog
          contractId={contractId}
          open={configOpen}
          onClose={() => setConfigOpen(false)}
        />
      )}
      {sendOpen && (
        <SendForSignatureConfirmDialog
          contractId={contractId}
          contractNumber={contractNumber}
          open={sendOpen}
          onClose={() => setSendOpen(false)}
        />
      )}
      {resendTarget && (
        <ResendInvitationConfirm
          signaturePartyId={resendTarget.id}
          contractId={contractId}
          signerLabel={`${resendTarget.signerNameEn} · ${t(`signatures.signerSide.${resendTarget.signerSide}`)}`}
          signerEmail={resendTarget.signerEmail}
          open={!!resendTarget}
          onClose={() => setResendTarget(null)}
        />
      )}
      {cancelTarget && (
        <CancelInvitationConfirm
          invitationId={cancelTarget.invitationId}
          signerLabel={`${cancelTarget.party.signerNameEn} · ${t(`signatures.signerSide.${cancelTarget.party.signerSide}`)}`}
          contractId={contractId}
          open={!!cancelTarget}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EmptyState({
  canConfigure,
  onConfigure,
}: {
  canConfigure: boolean;
  onConfigure: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Activity className="h-7 w-7 text-ink-subtle" aria-hidden="true" />
      <p className="text-sm text-ink-muted">{t("signatures.list.empty")}</p>
      {canConfigure && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={onConfigure}
        >
          <Plus className="me-1 h-3.5 w-3.5" />
          {t("signatures.list.configure")}
        </Button>
      )}
    </div>
  );
}

function StepProgressBar({ steps }: { steps: SignatureStepProgress[] }) {
  const { t } = useTranslation();
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {steps.map((step) => {
        const completion =
          step.totalRequired === 0
            ? 0
            : Math.round(
                ((step.signedCount + step.declinedCount) / step.totalRequired) *
                  100,
              );
        return (
          <li
            key={step.stepOrder}
            className="rounded-md border border-border bg-surface p-3"
          >
            <div className="flex items-center justify-between text-xs">
              <p className="font-medium text-ink">
                {t("signatures.progress.step", { n: step.stepOrder })}
              </p>
              <p className="text-ink-subtle">
                {step.signedCount}/{step.totalRequired}
              </p>
            </div>
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background"
              role="progressbar"
              aria-valuenow={completion}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span
                className="block h-full bg-sage-ink"
                style={{ width: `${completion}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-ink-subtle">
              {step.pendingCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden />
                  {t("signatures.progress.pending", { n: step.pendingCount })}
                </span>
              )}
              {step.signedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-sage-ink">
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                  {t("signatures.progress.signed", { n: step.signedCount })}
                </span>
              )}
              {step.declinedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <X className="h-3 w-3" aria-hidden />
                  {t("signatures.progress.declined", { n: step.declinedCount })}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

interface SignerRosterProps {
  signers: SignatureParty[];
  canResend: boolean;
  canCancel: boolean;
  onResend: (party: SignatureParty) => void;
  onCancel: (party: SignatureParty) => void;
}

function SignerRoster({
  signers,
  canResend,
  canCancel,
  onResend,
  onCancel,
}: SignerRosterProps) {
  const { t } = useTranslation();
  // Group by stepOrder for a stable visual hierarchy.
  const grouped = useMemo(() => {
    const m = new Map<number, SignatureParty[]>();
    for (const s of signers) {
      const arr = m.get(s.stepOrder) ?? [];
      arr.push(s);
      m.set(s.stepOrder, arr);
    }
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
  }, [signers]);

  return (
    <ol className="space-y-3">
      {grouped.map(([stepOrder, partyList]) => (
        <li key={stepOrder}>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
            {t("signatures.progress.step", { n: stepOrder })}
          </p>
          <ul className="space-y-2">
            {partyList.map((party) => (
              <SignerRow
                key={party.id}
                party={party}
                canResend={canResend}
                canCancel={canCancel}
                onResend={() => onResend(party)}
                onCancel={() => onCancel(party)}
              />
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

interface SignerRowProps {
  party: SignatureParty;
  canResend: boolean;
  canCancel: boolean;
  onResend: () => void;
  onCancel: () => void;
}

function SignerRow({
  party,
  canResend,
  canCancel,
  onResend,
  onCancel,
}: SignerRowProps) {
  const { t } = useTranslation();
  const status = party.currentInvitationStatus;
  const canActOnInvitation =
    status === "pending" || status === "viewed";
  // Cancel additionally requires a real invitation id to target the
  // POST /signature-invitations/:id/cancel endpoint (migration 038).
  const canShowCancel = canActOnInvitation && party.currentInvitationId != null;

  return (
    <li className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            {party.signerNameEn}
            {party.isRequired && (
              <span
                className="ms-2 rounded-full bg-amber-tint px-1.5 py-0.5 text-[10px] font-medium text-amber-ink"
                aria-label={t("signatures.list.required")}
              >
                {t("signatures.list.required")}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {t(`signatures.signerSide.${party.signerSide}`)}
          </p>
          {party.signerEmail && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-ink-subtle">
              <Mail className="h-3 w-3" aria-hidden />
              <span className="font-mono">{party.signerEmail}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <SignerStatusBadge status={status} />
          {party.invitationSentAt && (
            <p className="text-[10px] text-ink-subtle">
              {t("signatures.list.sentAt", {
                when: formatDateTime(party.invitationSentAt),
              })}
            </p>
          )}
          {party.signedAt && (
            <p className="text-[10px] text-sage-ink">
              {t("signatures.list.signedAt", {
                when: formatDateTime(party.signedAt),
              })}
            </p>
          )}
          {party.declinedAt && (
            <p className="text-[10px] text-destructive">
              {t("signatures.list.declinedAt", {
                when: formatDateTime(party.declinedAt),
              })}
            </p>
          )}
        </div>
      </div>

      {((canResend && canActOnInvitation) ||
        (canCancel && canShowCancel)) && (
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          {canResend && canActOnInvitation && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResend}
              aria-label={t("signatures.list.resendForSigner", {
                signer: party.signerNameEn,
              })}
            >
              <RefreshCw className="me-1 h-3 w-3" aria-hidden />
              {t("signatures.list.resend")}
            </Button>
          )}
          {canCancel && canShowCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              aria-label={t("signatures.list.cancelForSigner", {
                signer: party.signerNameEn,
              })}
            >
              <X className="me-1 h-3 w-3 text-destructive" aria-hidden />
              {t("signatures.list.cancel")}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

const STATUS_TONE: Record<SignatureInvitationStatus, string> = {
  pending: "bg-slate-tint text-slate-ink",
  viewed: "bg-amber-tint text-amber-ink",
  signed: "bg-sage-tint text-sage-ink",
  declined: "bg-terracotta-tint text-terracotta-ink",
  expired: "bg-terracotta-tint text-terracotta-ink",
  cancelled: "bg-slate-tint text-slate-ink",
};

function SignerStatusBadge({
  status,
}: {
  status: SignatureInvitationStatus | null;
}) {
  const { t } = useTranslation();
  if (!status) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-tint px-2 py-0.5 text-[10px] font-medium text-slate-ink">
        {t("signatures.status.notIssued")}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        STATUS_TONE[status],
      )}
    >
      {t(`signatures.status.${status}`)}
    </span>
  );
}

export default ContractSignaturesTab;
