/**
 * SignatureMethodPicker (S4) — choose 1 of 4 signing methods + render the
 * method-specific sign form.
 *
 * Mode: regenerate — no Lovable equivalent (the Lovable repo had a
 * UAE-Pass-only ceremony; M3 introduces 4 methods with field-level gating).
 *
 * Methods (per AC-S4-02..04):
 *   - typed     → text input >= 2 chars
 *   - drawn     → in-browser canvas signature; emits a data URL surrogate
 *                 for signatureImageUrl + base64 data for signatureData
 *   - uae_pass  → button → mock redirect → callback (FE-only mock for v1)
 *   - ds_otp    → 6-digit OTP input; metadata.otpReceipt is the OTP value
 *
 * Method gating mirrors workspace/schemas.ts SignContractDtoSchema. Submit
 * dispatches POST /api/v1/sign/:invitationToken/sign via useSignContract.
 *
 * 13-checklist mapping:
 *   T1/T2 — service via signatureService + React Query mutation.
 *   T3    — every label uses t().
 *   T4    — three states: choose method / fill form / pending.
 *   T6    — radiogroup keyboard nav + aria-labels.
 *   T7    — full type safety; SignatureMethod / UaePassVerificationLevel.
 *   T8    — submit gated by per-method validity + lock + mutation.isPending.
 *   T13   — signatureData / signatureImageUrl never console.logged. Canvas
 *           stays in DOM only; data URL written to component state for the
 *           single submit then discarded on close.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, PenLine, ShieldCheck, Type, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDoubleSubmitLock } from "@/features/imports/hooks/useDoubleSubmitLock";
import { useSignContract } from "@/features/signatures/hooks/useSignatures";
import { cn } from "@/lib/utils";
import type {
  SignatureMethod,
  SignatureMethodRef,
  UaePassVerificationLevel,
} from "@/types/entities/signature.types";

interface Props {
  invitationToken: string;
  availableMethods: SignatureMethodRef[];
  /** Optional: pre-selected method (controlled). */
  initialMethod?: SignatureMethod | null;
  onSigned?: () => void;
}

export function SignatureMethodPicker({
  invitationToken,
  availableMethods,
  initialMethod,
  onSigned,
}: Props) {
  const { t } = useTranslation();
  const [method, setMethod] = useState<SignatureMethod | null>(
    initialMethod ?? null,
  );

  // Reset transient form state when method changes.
  const [typedValue, setTypedValue] = useState("");
  const [drawnDataUrl, setDrawnDataUrl] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [uaePassLevel, setUaePassLevel] =
    useState<UaePassVerificationLevel>("verified");
  const [uaePassReady, setUaePassReady] = useState(false);

  const lock = useDoubleSubmitLock();
  const signMutation = useSignContract({
    onSuccess: () => {
      onSigned?.();
    },
    onSettled: () => lock.release(),
  });

  // Filter to enabled methods sorted by verificationStrength DESC; the BE
  // already does this but defense in depth.
  const enabledMethods = useMemo(
    () =>
      availableMethods
        .filter((m) => m.isEnabled)
        .sort((a, b) => b.verificationStrength - a.verificationStrength),
    [availableMethods],
  );

  // Reset form-specific state when method changes — discard prior data so
  // we never accidentally submit it.
  useEffect(() => {
    setTypedValue("");
    setDrawnDataUrl(null);
    setOtp("");
    setUaePassReady(false);
  }, [method]);

  const valid = useMemo(() => {
    if (!method) return false;
    if (method === "typed") return typedValue.trim().length >= 2;
    if (method === "drawn") return !!drawnDataUrl && drawnDataUrl.length > 64;
    if (method === "ds_otp") return otp.trim().length >= 4;
    if (method === "uae_pass") return uaePassReady;
    return false;
  }, [method, typedValue, drawnDataUrl, otp, uaePassReady]);

  const canSubmit =
    !!method && valid && !signMutation.isPending && !lock.isLocked();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !method) return;
    if (!lock.acquire()) return;

    if (method === "typed") {
      signMutation.mutate({
        invitationToken,
        data: { signatureMethod: "typed", signatureData: typedValue.trim() },
      });
    } else if (method === "drawn" && drawnDataUrl) {
      signMutation.mutate({
        invitationToken,
        data: {
          signatureMethod: "drawn",
          signatureData: drawnDataUrl,
          signatureImageUrl: drawnDataUrl,
        },
      });
    } else if (method === "uae_pass") {
      signMutation.mutate({
        invitationToken,
        data: {
          signatureMethod: "uae_pass",
          uaePassVerificationLevel: uaePassLevel,
          metadata: { uaePassMock: true },
        },
      });
    } else if (method === "ds_otp") {
      signMutation.mutate({
        invitationToken,
        data: {
          signatureMethod: "ds_otp",
          metadata: { otpReceipt: otp.trim() },
        },
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">
          {t("sign.m3.method.legend")}
        </legend>
        <div
          role="radiogroup"
          aria-label={t("sign.m3.method.legend")}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {enabledMethods.map((m) => {
            const Icon = METHOD_ICON[m.code];
            return (
              <label
                key={m.code}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-md border bg-card p-3 text-start",
                  method === m.code
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-primary/50",
                  signMutation.isPending && "cursor-not-allowed opacity-60",
                )}
              >
                <input
                  type="radio"
                  name="signature-method"
                  value={m.code}
                  className="sr-only"
                  checked={method === m.code}
                  onChange={() => setMethod(m.code)}
                  disabled={signMutation.isPending}
                  aria-label={t(`sign.m3.method.${m.code}.label`)}
                />
                <Icon className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {t(`sign.m3.method.${m.code}.label`)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {t(`sign.m3.method.${m.code}.help`)}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      {method === "typed" && (
        <TypedForm
          value={typedValue}
          onChange={setTypedValue}
          disabled={signMutation.isPending}
        />
      )}
      {method === "drawn" && (
        <DrawnForm
          dataUrl={drawnDataUrl}
          onChange={setDrawnDataUrl}
          disabled={signMutation.isPending}
        />
      )}
      {method === "uae_pass" && (
        <UaePassForm
          level={uaePassLevel}
          onLevelChange={setUaePassLevel}
          ready={uaePassReady}
          onReady={setUaePassReady}
          disabled={signMutation.isPending}
        />
      )}
      {method === "ds_otp" && (
        <OtpForm
          value={otp}
          onChange={setOtp}
          disabled={signMutation.isPending}
        />
      )}

      <Button type="submit" disabled={!canSubmit} className="w-full">
        {signMutation.isPending ? (
          <>
            <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
            {t("sign.m3.method.submitting")}
          </>
        ) : (
          t("sign.m3.method.submit")
        )}
      </Button>
    </form>
  );
}

const METHOD_ICON: Record<
  SignatureMethod,
  React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  uae_pass: ShieldCheck,
  ds_otp: Wand2,
  drawn: PenLine,
  typed: Type,
};

// ─── Method forms ────────────────────────────────────────────────────────────

function TypedForm({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-ink-muted">
        {t("sign.m3.method.typed.inputLabel")}
        <span className="ms-1 text-destructive" aria-hidden>
          *
        </span>
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={200}
        placeholder={t("sign.m3.method.typed.placeholder") as string}
        className={cn(
          "mt-1 h-12 w-full rounded-md border border-input bg-card px-3 py-2 font-ceremonial text-2xl shadow-sm",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
      <p className="mt-1 text-[11px] text-ink-subtle">
        {t("sign.m3.method.typed.help")}
      </p>
    </div>
  );
}

interface DrawnFormProps {
  dataUrl: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled: boolean;
}

function DrawnForm({ dataUrl, onChange, disabled }: DrawnFormProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  // Initialise canvas on mount + on resize.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio ?? 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0A1628";
  }, []);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawing(true);
    lastRef.current = getPoint(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing || disabled) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lastRef.current) return;
    const next = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    lastRef.current = next;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDrawing(false);
    lastRef.current = null;
    // Snapshot the canvas to a data URL on stroke end.
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    onChange(url);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div>
      <p className="text-xs font-medium text-ink-muted">
        {t("sign.m3.method.drawn.label")}
        <span className="ms-1 text-destructive" aria-hidden>
          *
        </span>
      </p>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={t("sign.m3.method.drawn.canvasLabel")}
        className={cn(
          "mt-1 h-40 w-full touch-none rounded-md border border-input bg-card shadow-sm",
          disabled && "cursor-not-allowed opacity-50",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className="mt-1 flex items-center justify-between text-[11px]">
        <p className="text-ink-subtle">{t("sign.m3.method.drawn.help")}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={disabled || !dataUrl}
        >
          {t("sign.m3.method.drawn.clear")}
        </Button>
      </div>
    </div>
  );
}

interface UaePassFormProps {
  level: UaePassVerificationLevel;
  onLevelChange: (level: UaePassVerificationLevel) => void;
  ready: boolean;
  onReady: (ready: boolean) => void;
  disabled: boolean;
}

const UAE_PASS_LEVELS: readonly UaePassVerificationLevel[] = [
  "basic",
  "verified",
  "premium",
];

function UaePassForm({
  level,
  onLevelChange,
  ready,
  onReady,
  disabled,
}: UaePassFormProps) {
  const { t } = useTranslation();
  const [verifying, setVerifying] = useState(false);

  // Mock UAE Pass verification — emits a "ready" state after a short delay
  // to mirror the federation round-trip. Real integration is deferred.
  const handleVerify = async () => {
    if (disabled || ready) return;
    setVerifying(true);
    await new Promise((r) => setTimeout(r, 1200));
    setVerifying(false);
    onReady(true);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-ink-muted">
          {t("sign.m3.method.uae_pass.levelLabel")}
        </label>
        <div className="mt-1 flex gap-1">
          {UAE_PASS_LEVELS.map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => onLevelChange(lv)}
              disabled={disabled}
              className={cn(
                "flex-1 rounded-md border px-3 py-1.5 text-xs font-medium",
                level === lv
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-ink-muted hover:bg-surface",
                disabled && "cursor-not-allowed opacity-50",
              )}
              aria-pressed={level === lv}
            >
              {t(`sign.m3.method.uae_pass.level.${lv}`)}
            </button>
          ))}
        </div>
      </div>
      {!ready && (
        <Button
          type="button"
          onClick={handleVerify}
          disabled={disabled || verifying}
          className="w-full"
        >
          {verifying ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
              {t("sign.m3.method.uae_pass.verifying")}
            </>
          ) : (
            <>
              <ShieldCheck className="me-2 h-4 w-4" aria-hidden />
              {t("sign.m3.method.uae_pass.verify")}
            </>
          )}
        </Button>
      )}
      {ready && (
        <p
          role="status"
          className="rounded-md border border-sage/40 bg-sage-tint/40 px-3 py-2 text-xs text-sage-ink"
        >
          {t("sign.m3.method.uae_pass.verified")}
        </p>
      )}
    </div>
  );
}

function OtpForm({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-ink-muted">
        {t("sign.m3.method.ds_otp.label")}
        <span className="ms-1 text-destructive" aria-hidden>
          *
        </span>
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{4,8}"
        maxLength={8}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        disabled={disabled}
        placeholder="123456"
        className={cn(
          "mt-1 h-12 w-full rounded-md border border-input bg-card px-3 py-2 text-center font-mono text-xl tracking-[0.5em] shadow-sm",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
      <p className="mt-1 text-[11px] text-ink-subtle">
        {t("sign.m3.method.ds_otp.help")}
      </p>
    </div>
  );
}

export default SignatureMethodPicker;
