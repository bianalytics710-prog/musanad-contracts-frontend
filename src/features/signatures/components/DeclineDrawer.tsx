/**
 * DeclineDrawer (S5) — public signer-facing decline modal.
 *
 * Mode: regenerate — the Lovable src/components/sign/DeclineDrawer.tsx
 * (and signingService.ts which it imports) is regenerated rather than
 * hardened because:
 *   - Lovable couples directly to a Supabase-backed signingService that is
 *     marked REGENERATE per audit-report.md.
 *   - The M3 wire shape is fundamentally different (verify_jwt=false +
 *     plaintext invitation token in URL path; reason 5..2000 chars; single
 *     generic 410 + 409 already_decided).
 *   - Per memory `feedback_regenerate_when_lovable_too_coupled.md`, regenerate
 *     is the correct escape hatch when the data layer is the bulk of the
 *     coupling.
 *
 * AC mapping:
 *   AC-S5-01..AC-S5-08:
 *   - declineReason required, length 5..2000 (validated client-side; mirrors
 *     DeclineContractDtoSchema in workspace/schemas.ts).
 *   - On 200, surface localised toast + close drawer.
 *   - On 410 invitation_invalid_or_expired → translateApiError surfaces the
 *     localised message.
 *   - On 409 already_decided → same translation path.
 *
 * 13-checklist mapping:
 *   T1/T2 — service via signatureService + React Query mutation.
 *   T3    — every label/text uses t().
 *   T4    — three states: input loading-while-pending, error toast, empty
 *           initial state covered by absence of validation errors.
 *   T6    — useFocusTrap + Esc-close + role="dialog" + aria-labelledby.
 *   T7    — full type safety; declineReason typed via DeclineContractDto.
 *   T8    — submit gated by validation + mutation.isPending +
 *           useDoubleSubmitLock.
 *   T9    — destructive action: warning copy + amber alert.
 *   T11   — caller wraps in route ErrorBoundary.
 *   T13   — declineReason never console.logged.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useDoubleSubmitLock } from "@/features/imports/hooks/useDoubleSubmitLock";
import { useDeclineContract } from "@/features/signatures/hooks/useSignatures";
import { cn } from "@/lib/utils";

interface Props {
  invitationToken: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const MIN_LEN = 5;
const MAX_LEN = 2000;

export function DeclineDrawer({
  invitationToken,
  open,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const reasonId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const [reason, setReason] = useState("");
  const lock = useDoubleSubmitLock();

  const declineMutation = useDeclineContract({
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
    onSettled: () => lock.release(),
  });

  useFocusTrap(dialogRef, open);

  // Reset reason whenever the drawer transitions to open.
  useEffect(() => {
    if (open) {
      setReason("");
    }
  }, [open]);

  // Esc-close (when not pending).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !declineMutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, declineMutation.isPending, onClose]);

  const trimmed = reason.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_LEN;
  const tooLong = trimmed.length > MAX_LEN;
  const empty = trimmed.length === 0;

  const canSubmit = useMemo(
    () =>
      !empty &&
      !tooShort &&
      !tooLong &&
      !declineMutation.isPending &&
      !lock.isLocked(),
    [empty, tooShort, tooLong, declineMutation.isPending, lock],
  );

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!lock.acquire()) return;
    declineMutation.mutate({
      invitationToken,
      data: { declineReason: trimmed },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !declineMutation.isPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {t("sign.m3.decline.title")}
          </h2>
          <Button
            ref={closeRef}
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={declineMutation.isPending}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="mt-2 text-sm text-ink-muted">
          {t("sign.m3.decline.description")}
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3">
          <div>
            <label
              htmlFor={reasonId}
              className="block text-xs font-medium text-ink-muted"
            >
              {t("sign.m3.decline.reasonLabel")}
              <span className="ms-1 text-destructive" aria-hidden>
                *
              </span>
            </label>
            <textarea
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={declineMutation.isPending}
              rows={5}
              minLength={MIN_LEN}
              maxLength={MAX_LEN}
              required
              placeholder={t("sign.m3.decline.reasonPlaceholder")}
              className={cn(
                "mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              aria-describedby={`${reasonId}-help`}
            />
            <div
              id={`${reasonId}-help`}
              className="mt-1 flex items-center justify-between text-[11px]"
            >
              {tooShort ? (
                <p className="text-destructive">
                  {t("sign.m3.decline.tooShort", { min: MIN_LEN })}
                </p>
              ) : tooLong ? (
                <p className="text-destructive">
                  {t("sign.m3.decline.tooLong", { max: MAX_LEN })}
                </p>
              ) : (
                <p className="text-ink-subtle">
                  {t("sign.m3.decline.minChars", { min: MIN_LEN })}
                </p>
              )}
              <p className="text-ink-subtle">
                {trimmed.length}/{MAX_LEN}
              </p>
            </div>
          </div>

          <div className="flex gap-2 rounded-md border border-amber/40 bg-amber-tint/40 p-3 text-[11px] text-amber-ink">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
            <span>{t("sign.m3.decline.warning")}</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={declineMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={!canSubmit}>
              {declineMutation.isPending
                ? t("common.saving")
                : t("sign.m3.decline.confirm")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DeclineDrawer;
