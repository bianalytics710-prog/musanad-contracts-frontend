/**
 * ContractSignersConfigDialog (S1) — drafter-side modal that configures
 * the signature_party roster BEFORE send-for-signature.
 *
 * Mode: regenerate — no Lovable equivalent (the Lovable flow used a
 * Supabase-coupled signingService that auto-derived signers from contract
 * parties; M3 introduces an explicit configure-before-send step).
 *
 * Behaviour:
 *   - Form with dynamic signer rows (1..20, AC-S1-04).
 *   - Per row: signerSide (employer/counterparty/witness), nameEn (required),
 *     nameAr (optional), email (optional), stepOrder (1..N), isRequired.
 *   - At least ONE row must be signerSide='employer' AND isRequired=true
 *     (AC-S1-04). UI surfaces a banner when this constraint is violated.
 *   - Submit calls fn_signature_party_create_bulk via signatureService.
 *   - On success, closes; the Signatures tab will refetch via invalidateQueries.
 *
 * AC mapping:
 *   AC-S1-01..AC-S1-09:
 *     - Empty signerNameEn → field-level "Required" message.
 *     - Invalid email format → field-level message.
 *     - At least one employer required → banner-level message.
 *     - signers length 1..20.
 *
 * 13-checklist mapping:
 *   T1/T2 — service via signatureService + React Query mutation.
 *   T3    — every label uses t().
 *   T4    — three states: validation errors / mutation pending / submit ok.
 *   T6    — useFocusTrap + Esc-close + role="dialog" + aria-labelledby.
 *   T7    — full type safety; uses SignaturePartyInput.
 *   T8    — submit gated on canSubmit + useDoubleSubmitLock.
 *   T13   — emails not console.logged.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useDoubleSubmitLock } from "@/features/imports/hooks/useDoubleSubmitLock";
import { useCreateSignatureParties } from "@/features/signatures/hooks/useSignatures";
import type {
  SignaturePartyInput,
  SignerSide,
} from "@/types/entities/signature.types";
import { SIGNER_SIDE_VALUES } from "@/types/entities/signature.types";
import { cn } from "@/lib/utils";

interface Props {
  contractId: number;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface SignerRow {
  signerSide: SignerSide;
  signerNameEn: string;
  signerNameAr: string;
  signerEmail: string;
  stepOrder: number;
  isRequired: boolean;
}

const MIN_SIGNERS = 1;
const MAX_SIGNERS = 20;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function makeBlankRow(stepOrder: number): SignerRow {
  return {
    signerSide: "employer",
    signerNameEn: "",
    signerNameAr: "",
    signerEmail: "",
    stepOrder,
    isRequired: true,
  };
}

export function ContractSignersConfigDialog({
  contractId,
  open,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const [rows, setRows] = useState<SignerRow[]>([makeBlankRow(1)]);
  const lock = useDoubleSubmitLock();
  const createMutation = useCreateSignatureParties({
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
    onSettled: () => lock.release(),
  });

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (open) {
      setRows([makeBlankRow(1)]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !createMutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, createMutation.isPending, onClose]);

  if (!open) return null;

  const updateRow = (idx: number, patch: Partial<SignerRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    if (rows.length >= MAX_SIGNERS) return;
    const nextStep = Math.max(...rows.map((r) => r.stepOrder)) + 1;
    setRows((prev) => [
      ...prev,
      { ...makeBlankRow(nextStep), signerSide: "counterparty" },
    ]);
  };

  const removeRow = (idx: number) => {
    if (rows.length <= MIN_SIGNERS) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  // Validation
  const rowErrors = rows.map((r) => {
    const errs: { signerNameEn?: string; signerEmail?: string; stepOrder?: string } = {};
    if (r.signerNameEn.trim().length === 0) errs.signerNameEn = "required";
    if (r.signerEmail.trim().length > 0 && !EMAIL_RE.test(r.signerEmail.trim())) {
      errs.signerEmail = "invalid";
    }
    if (!Number.isInteger(r.stepOrder) || r.stepOrder < 1) errs.stepOrder = "invalid";
    return errs;
  });
  const hasFieldErrors = rowErrors.some((e) => Object.keys(e).length > 0);
  const hasEmployerRequired = rows.some(
    (r) => r.signerSide === "employer" && r.isRequired,
  );
  const tooFew = rows.length < MIN_SIGNERS;
  const tooMany = rows.length > MAX_SIGNERS;

  const canSubmit =
    !hasFieldErrors &&
    hasEmployerRequired &&
    !tooFew &&
    !tooMany &&
    !createMutation.isPending &&
    !lock.isLocked();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!lock.acquire()) return;

    const signers: SignaturePartyInput[] = rows.map((r) => ({
      signerSide: r.signerSide,
      signerNameEn: r.signerNameEn.trim(),
      signerNameAr: r.signerNameAr.trim() === "" ? null : r.signerNameAr.trim(),
      signerEmail: r.signerEmail.trim() === "" ? null : r.signerEmail.trim(),
      stepOrder: r.stepOrder,
      isRequired: r.isRequired,
    }));

    createMutation.mutate({ contractId, data: { signers } });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !createMutation.isPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-6">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {t("signatures.config.title")}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {t("signatures.config.description")}
            </p>
          </div>
          <Button
            ref={closeRef}
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={createMutation.isPending}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
            {!hasEmployerRequired && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {t("signatures.config.errors.employerRequired")}
              </div>
            )}
            {tooMany && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {t("signatures.config.errors.tooMany", { max: MAX_SIGNERS })}
              </div>
            )}

            <ul className="space-y-3">
              {rows.map((row, idx) => {
                const errs = rowErrors[idx];
                return (
                  <li
                    key={idx}
                    className="rounded-md border border-border bg-surface p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                        {t("signatures.config.signerN", { n: idx + 1 })}
                      </p>
                      {rows.length > MIN_SIGNERS && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRow(idx)}
                          disabled={createMutation.isPending}
                          aria-label={t("signatures.config.removeSigner")}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Field
                        label={t("signatures.config.fields.signerSide")}
                        required
                      >
                        <select
                          value={row.signerSide}
                          onChange={(e) =>
                            updateRow(idx, {
                              signerSide: e.target.value as SignerSide,
                            })
                          }
                          disabled={createMutation.isPending}
                          className={inputCls}
                        >
                          {SIGNER_SIDE_VALUES.map((v) => (
                            <option key={v} value={v}>
                              {t(`signatures.signerSide.${v}`)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label={t("signatures.config.fields.stepOrder")}
                        required
                        error={
                          errs.stepOrder
                            ? t("signatures.config.errors.stepOrder")
                            : null
                        }
                      >
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={MAX_SIGNERS}
                          value={row.stepOrder}
                          onChange={(e) =>
                            updateRow(idx, { stepOrder: Number(e.target.value) || 0 })
                          }
                          disabled={createMutation.isPending}
                          className={inputCls}
                        />
                      </Field>
                      <Field
                        label={t("signatures.config.fields.signerNameEn")}
                        required
                        error={
                          errs.signerNameEn
                            ? t("signatures.config.errors.required")
                            : null
                        }
                      >
                        <input
                          type="text"
                          value={row.signerNameEn}
                          onChange={(e) =>
                            updateRow(idx, { signerNameEn: e.target.value })
                          }
                          disabled={createMutation.isPending}
                          maxLength={200}
                          className={inputCls}
                        />
                      </Field>
                      <Field
                        label={t("signatures.config.fields.signerNameAr")}
                      >
                        <input
                          type="text"
                          value={row.signerNameAr}
                          onChange={(e) =>
                            updateRow(idx, { signerNameAr: e.target.value })
                          }
                          disabled={createMutation.isPending}
                          maxLength={200}
                          dir="auto"
                          className={inputCls}
                        />
                      </Field>
                      <Field
                        label={t("signatures.config.fields.signerEmail")}
                        error={
                          errs.signerEmail
                            ? t("signatures.config.errors.invalidEmail")
                            : null
                        }
                      >
                        <input
                          type="email"
                          value={row.signerEmail}
                          onChange={(e) =>
                            updateRow(idx, { signerEmail: e.target.value })
                          }
                          disabled={createMutation.isPending}
                          maxLength={255}
                          autoComplete="off"
                          className={inputCls}
                        />
                      </Field>
                      <label className="mt-6 inline-flex items-center gap-2 text-xs text-ink">
                        <input
                          type="checkbox"
                          checked={row.isRequired}
                          onChange={(e) =>
                            updateRow(idx, { isRequired: e.target.checked })
                          }
                          disabled={createMutation.isPending}
                        />
                        {t("signatures.config.fields.isRequired")}
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              disabled={createMutation.isPending || rows.length >= MAX_SIGNERS}
            >
              <Plus className="me-1 h-3.5 w-3.5" />
              {t("signatures.config.addSigner")}
            </Button>
          </div>

          <div className="flex justify-end gap-2 border-t border-border bg-background px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={createMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {createMutation.isPending
                ? t("common.saving")
                : t("signatures.config.confirm")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls = cn(
  "mt-1 h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string | null;
  children: React.ReactNode;
}

function Field({ label, required, error, children }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-muted">
        {label}
        {required && (
          <span className="ms-1 text-destructive" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-[11px] text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default ContractSignersConfigDialog;
