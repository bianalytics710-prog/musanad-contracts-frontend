/**
 * TokenOnceCopyPanel — shared copy-link UX for the @once-only invitation
 * tokens returned by S2 (send-for-signature) and S7 (resend-invitation).
 *
 * SECURITY:
 *   - Plaintext token is held only in the parent's local state for the
 *     duration the dialog is open. Closing the dialog discards the token —
 *     it is NEVER persisted to localStorage / sessionStorage / cookies / any
 *     other long-lived store.
 *   - We surface the token as the constructed signing URL (origin + /sign/
 *     + token) so the copy action puts the link the signer needs into the
 *     drafter's clipboard.
 *   - Pressing Copy uses navigator.clipboard.writeText. We never log the
 *     token nor the URL.
 *
 * UX:
 *   - "This link can only be retrieved once" warning copy.
 *   - One-time visibility toggle (eye / eye-off) — defaults to obscured
 *     to discourage shoulder-surfing.
 *   - Copy button surfaces a transient "Copied" affordance.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Eye, EyeOff, Mail, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  /** Plaintext invitation token returned ONCE by the backend. */
  invitationTokenPlaintext: string;
  /** Optional: signer email (full plaintext) so the drafter can confirm
   *  the recipient. Displayed alongside the link; never persisted. */
  signerEmail?: string | null;
  /** Optional: signer label (name, role) shown above the link. */
  signerLabel?: string;
  /**
   * Build the signing URL. Defaults to:
   *   `${window.location.origin}/sign/${token}`
   * Provided for tests + non-browser environments.
   */
  buildSignUrl?: (token: string) => string;
}

export function TokenOnceCopyPanel({
  invitationTokenPlaintext,
  signerEmail,
  signerLabel,
  buildSignUrl,
}: Props) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  const signUrl = useMemo(() => {
    if (buildSignUrl) return buildSignUrl(invitationTokenPlaintext);
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}/sign/${invitationTokenPlaintext}`;
    }
    return `/sign/${invitationTokenPlaintext}`;
  }, [invitationTokenPlaintext, buildSignUrl]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(signUrl);
      } else {
        // Fallback — create a transient input for execCommand('copy').
        const ta = document.createElement("textarea");
        ta.value = signUrl;
        ta.setAttribute("readonly", "true");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } finally {
          document.body.removeChild(ta);
        }
      }
      setCopied(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard rejected (permissions / focus). Caller can react via the
      // visible Copy button — we deliberately don't surface an error toast
      // because the URL is also displayed and can be selected manually.
      setCopied(false);
    }
  };

  // Display value — masked unless revealed.
  const displayValue = revealed
    ? signUrl
    : `${signUrl.replace(invitationTokenPlaintext, "•".repeat(Math.min(invitationTokenPlaintext.length, 32)))}`;

  return (
    <div className="space-y-3 rounded-md border border-amber/40 bg-amber-tint/40 p-4">
      <div className="flex items-start gap-2 text-[12px] text-amber-ink">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
        <p>{t("signatures.tokenOnce.warning")}</p>
      </div>

      {signerLabel && (
        <p className="text-xs font-medium text-ink">{signerLabel}</p>
      )}

      {signerEmail && (
        <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <Mail className="h-3 w-3" aria-hidden />
          <span className="font-mono">{signerEmail}</span>
        </div>
      )}

      <div>
        <label
          htmlFor="token-once-link"
          className="block text-[11px] font-medium uppercase tracking-wider text-ink-subtle"
        >
          {t("signatures.tokenOnce.linkLabel")}
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id="token-once-link"
            type="text"
            readOnly
            value={displayValue}
            className={cn(
              "h-9 flex-1 rounded-md border border-input bg-card px-3 py-1 text-xs font-mono shadow-sm",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setRevealed((r) => !r)}
            aria-label={
              revealed
                ? t("signatures.tokenOnce.hide")
                : t("signatures.tokenOnce.reveal")
            }
            title={
              revealed
                ? t("signatures.tokenOnce.hide")
                : t("signatures.tokenOnce.reveal")
            }
          >
            {revealed ? (
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Eye className="h-3.5 w-3.5" aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleCopy}
            aria-label={t("signatures.tokenOnce.copy")}
          >
            {copied ? (
              <>
                <Check className="me-1 h-3.5 w-3.5 text-sage-ink" aria-hidden />
                {t("signatures.tokenOnce.copied")}
              </>
            ) : (
              <>
                <Copy className="me-1 h-3.5 w-3.5" aria-hidden />
                {t("signatures.tokenOnce.copy")}
              </>
            )}
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-ink-subtle">
        {t("signatures.tokenOnce.hint")}
      </p>
    </div>
  );
}

export default TokenOnceCopyPanel;
