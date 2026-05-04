/**
 * VerificationGate (S13) — identity verification gate before sign.
 *
 * The signer must enter their full name + email. The FE compares (case-
 * insensitive, trimmed) against the masked email returned by GET
 * /sign/:invitationToken (S3) — comparison is "starts-with the visible
 * prefix" against the local-part of the user's input.
 *
 * AC mapping:
 *   AC-S13-01..06:
 *     - 5-attempt session lock (FE-only state for v1; no BE call).
 *     - On success: gate is closed and parent enables the sign UI.
 *     - On failure: increment attempts; at 5, lock with "contact admin" copy.
 *
 * 13-checklist mapping:
 *   T1   — no service call (per audit-report — FE-only verification).
 *   T3   — every label uses t().
 *   T4   — three states: input / locked / verified.
 *   T6   — proper labels + error live-region.
 *   T7   — full type safety.
 *   T8   — submit gated by completed input.
 *   T13  — emails compared in-memory only; never logged.
 */
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  /** Signer's full name (en) from S3. Used for case-insensitive compare. */
  expectedNameEn: string;
  /**
   * Masked email from S3 (e.g. 'j***@example.com'). We extract:
   *   - the masked prefix before '***' for prefix-match
   *   - the domain after '@' for exact-match
   */
  maskedEmail: string | null;
  /** Optional UAE Pass step-up button (placeholder for v1). */
  onUaePassStepUp?: () => void;
  /** Fired when the gate is satisfied. */
  onVerified: () => void;
}

const MAX_ATTEMPTS = 5;

interface MaskedEmailParts {
  prefix: string;
  domain: string;
}

function parseMasked(masked: string | null): MaskedEmailParts | null {
  if (!masked) return null;
  const at = masked.indexOf("@");
  if (at <= 0) return null;
  const local = masked.slice(0, at);
  const domain = masked.slice(at + 1).toLowerCase().trim();
  // Strip the mask (***) and any trailing '@' artifacts. Take the visible
  // prefix BEFORE the mask.
  const maskIdx = local.indexOf("*");
  const prefix = (maskIdx >= 0 ? local.slice(0, maskIdx) : local)
    .toLowerCase()
    .trim();
  if (!prefix || !domain) return null;
  return { prefix, domain };
}

function emailMatchesMask(input: string, parts: MaskedEmailParts): boolean {
  const at = input.indexOf("@");
  if (at <= 0) return false;
  const local = input.slice(0, at).toLowerCase().trim();
  const domain = input.slice(at + 1).toLowerCase().trim();
  if (domain !== parts.domain) return false;
  // Visible prefix must match. We accept the input local-part starting with
  // the masked prefix.
  return local.startsWith(parts.prefix);
}

function nameMatches(input: string, expected: string): boolean {
  return (
    input.trim().toLowerCase().replace(/\s+/g, " ") ===
    expected.trim().toLowerCase().replace(/\s+/g, " ")
  );
}

export function VerificationGate({
  expectedNameEn,
  maskedEmail,
  onUaePassStepUp,
  onVerified,
}: Props) {
  const { t } = useTranslation();
  const nameId = useId();
  const emailId = useId();
  const errId = useId();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = attempts >= MAX_ATTEMPTS;
  const masked = parseMasked(maskedEmail);

  useEffect(() => {
    if (verified) onVerified();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified]);

  if (verified) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-md border border-sage/40 bg-sage-tint/40 p-3 text-xs text-sage-ink"
      >
        <ShieldCheck className="h-4 w-4" aria-hidden />
        {t("sign.m3.gate.verified")}
      </div>
    );
  }

  if (locked) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
      >
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
          <div>
            <p className="font-medium">{t("sign.m3.gate.locked.title")}</p>
            <p className="mt-1 text-xs">{t("sign.m3.gate.locked.body")}</p>
          </div>
        </div>
      </div>
    );
  }

  const canSubmit = name.trim().length > 0 && email.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const nameOk = nameMatches(name, expectedNameEn);
    const emailOk = masked ? emailMatchesMask(email, masked) : true;

    if (nameOk && emailOk) {
      setVerified(true);
      setError(null);
      return;
    }

    setAttempts((a) => a + 1);
    setError(t("sign.m3.gate.error.mismatch"));
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      <div className="rounded-md border border-amber/40 bg-amber-tint/40 p-3 text-xs text-amber-ink">
        <p className="font-medium">{t("sign.m3.gate.title")}</p>
        <p className="mt-1">{t("sign.m3.gate.description")}</p>
      </div>

      <div>
        <label htmlFor={nameId} className="block text-xs font-medium text-ink-muted">
          {t("sign.m3.gate.nameLabel")}
        </label>
        <input
          id={nameId}
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          required
          className={cn(
            "mt-1 h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
        />
      </div>

      <div>
        <label htmlFor={emailId} className="block text-xs font-medium text-ink-muted">
          {t("sign.m3.gate.emailLabel")}
        </label>
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={255}
          required
          className={cn(
            "mt-1 h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
          aria-describedby={maskedEmail ? `${emailId}-help` : undefined}
        />
        {maskedEmail && (
          <p id={`${emailId}-help`} className="mt-1 text-[11px] text-ink-subtle">
            {t("sign.m3.gate.emailHint", { masked: maskedEmail })}
          </p>
        )}
      </div>

      {error && (
        <p
          id={errId}
          role="alert"
          className="text-[11px] text-destructive"
          aria-live="polite"
        >
          {error}
          {attempts > 0 && attempts < MAX_ATTEMPTS && (
            <>
              {" "}
              {t("sign.m3.gate.attemptsRemaining", {
                n: MAX_ATTEMPTS - attempts,
              })}
            </>
          )}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {onUaePassStepUp && (
          <Button
            type="button"
            variant="outline"
            onClick={onUaePassStepUp}
            disabled={!canSubmit}
          >
            <ShieldCheck className="me-2 h-4 w-4" aria-hidden />
            {t("sign.m3.gate.uaePassStepUp")}
          </Button>
        )}
        <Button type="submit" disabled={!canSubmit}>
          {t("sign.m3.gate.verify")}
        </Button>
      </div>
    </form>
  );
}

export default VerificationGate;
