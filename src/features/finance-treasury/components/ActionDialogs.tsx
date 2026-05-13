/**
 * Unit-3 / R-FT — Finance & Treasury persona action dialogs.
 *
 * Three dialogs matching the BRD §7 action set:
 *   - InitiatePriceReviewDialog   — POST /api/v1/finance/contracts/:contractId/price-review
 *   - RecommendPaymentHoldDialog  — POST /api/v1/finance/contracts/:contractId/payment-hold
 *   - InitiateHedgeReviewDialog   — POST /api/v1/finance/contracts/:contractId/hedge-review
 *
 * Dialog pattern: RequestInfoDialog (R-LC4).
 * WCAG: useFocusTrap + aria-modal + aria-labelledby + aria-invalid + Escape-to-close.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translateApiError } from "@/lib/translate-api-error";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { personaActionsService } from "@/services/api/persona-actions.service";

// ─── Shared dialog shell ──────────────────────────────────────────────────────

interface DialogShellProps {
  open: boolean;
  titleId: string;
  title: string;
  onClose: () => void;
  isPending: boolean;
  children: React.ReactNode;
}

function DialogShell({ open, titleId, title, onClose, isPending, children }: DialogShellProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, isPending]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => !isPending && onClose()}
            className="rounded-md p-1 text-ink-muted hover:bg-surface"
            aria-label={t("common.close", { defaultValue: "Close" })}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

// ─── InitiatePriceReviewDialog ────────────────────────────────────────────────

type PriceReviewReason = "index_crossed" | "escalation" | "manual";

interface InitiatePriceReviewDialogProps {
  contractId: string | null;
  correlationId?: string;
  open: boolean;
  onClose: () => void;
}

export function InitiatePriceReviewDialog({
  contractId,
  correlationId,
  open,
  onClose,
}: InitiatePriceReviewDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const titleId = useId();
  const corrId = useId();
  const [reason, setReason] = useState<PriceReviewReason>("index_crossed");
  const [corrInputId, setCorrInputId] = useState(correlationId ?? "");
  const [note, setNote] = useState("");
  const [corrErr, setCorrErr] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("index_crossed");
      setCorrInputId(correlationId ?? "");
      setNote("");
      setCorrErr(false);
    }
  }, [open, correlationId]);

  const m = useMutation({
    mutationFn: async () => {
      if (!contractId) throw new Error("missing contractId");
      if (!corrInputId.trim()) {
        setCorrErr(true);
        throw new Error("corr-required");
      }
      return personaActionsService.initiatePriceReview(contractId, {
        correlationId: corrInputId.trim(),
        reason,
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success(t("finance.actions.priceReview.success"));
      void qc.invalidateQueries({ queryKey: ["dashboards-crg", "finance-treasury"] });
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg !== "corr-required") toast.error(translateApiError(e, t));
    },
  });

  const REASON_OPTIONS: { value: PriceReviewReason; label: string }[] = [
    { value: "index_crossed", label: t("finance.actions.priceReview.reason.index_crossed") },
    { value: "escalation", label: t("finance.actions.priceReview.reason.escalation") },
    { value: "manual", label: t("finance.actions.priceReview.reason.manual") },
  ];

  return (
    <DialogShell
      open={open && contractId !== null}
      titleId={titleId}
      title={t("finance.actions.priceReview.title")}
      onClose={onClose}
      isPending={m.isPending}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        className="space-y-3 px-5 py-4"
      >
        <p className="text-xs text-ink-muted">{t("finance.actions.priceReview.description")}</p>
        <label className="block" htmlFor={corrId}>
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("finance.actions.priceReview.correlationIdLabel")}
            <span className="ms-0.5 text-terracotta">*</span>
          </span>
          <input
            id={corrId}
            type="text"
            value={corrInputId}
            onChange={(e) => {
              setCorrInputId(e.target.value);
              setCorrErr(false);
            }}
            required
            aria-invalid={corrErr}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("finance.actions.priceReview.correlationIdPlaceholder")}
          />
          {corrErr && (
            <p className="mt-0.5 text-xs text-terracotta">
              {t("finance.actions.priceReview.correlationIdRequired")}
            </p>
          )}
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("finance.actions.priceReview.reasonLabel")}
            <span className="ms-0.5 text-terracotta">*</span>
          </span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as PriceReviewReason)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("finance.actions.priceReview.noteLabel")}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("finance.actions.priceReview.notePlaceholder")}
          />
        </label>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={m.isPending}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button type="submit" size="sm" disabled={m.isPending || !corrInputId.trim()}>
            {m.isPending
              ? t("common.saving", { defaultValue: "Saving…" })
              : t("finance.actions.priceReview.confirm")}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

// ─── RecommendPaymentHoldDialog ───────────────────────────────────────────────

interface RecommendPaymentHoldDialogProps {
  contractId: string | null;
  open: boolean;
  onClose: () => void;
}

export function RecommendPaymentHoldDialog({
  contractId,
  open,
  onClose,
}: RecommendPaymentHoldDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const titleId = useId();
  const [invoiceRef, setInvoiceRef] = useState("");
  const [amountAed, setAmountAed] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setInvoiceRef("");
      setAmountAed("");
      setNote("");
    }
  }, [open]);

  const m = useMutation({
    mutationFn: async () => {
      if (!contractId) throw new Error("missing contractId");
      const parsedAmount = amountAed.trim() ? Number(amountAed) : undefined;
      return personaActionsService.recommendPaymentHold(contractId, {
        invoiceRef: invoiceRef.trim() || undefined,
        amountAed: parsedAmount && !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined,
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success(t("finance.actions.paymentHold.success"));
      void qc.invalidateQueries({ queryKey: ["dashboards-crg", "finance-treasury"] });
      onClose();
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  return (
    <DialogShell
      open={open && contractId !== null}
      titleId={titleId}
      title={t("finance.actions.paymentHold.title")}
      onClose={onClose}
      isPending={m.isPending}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        className="space-y-3 px-5 py-4"
      >
        <p className="text-xs text-ink-muted">{t("finance.actions.paymentHold.description")}</p>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("finance.actions.paymentHold.invoiceRefLabel")}
          </span>
          <input
            type="text"
            value={invoiceRef}
            onChange={(e) => setInvoiceRef(e.target.value)}
            maxLength={100}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("finance.actions.paymentHold.invoiceRefPlaceholder")}
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("finance.actions.paymentHold.amountAedLabel")}
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={amountAed}
            onChange={(e) => setAmountAed(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("finance.actions.paymentHold.amountAedPlaceholder")}
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("finance.actions.paymentHold.noteLabel")}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("finance.actions.paymentHold.notePlaceholder")}
          />
        </label>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={m.isPending}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button type="submit" size="sm" disabled={m.isPending}>
            {m.isPending
              ? t("common.saving", { defaultValue: "Saving…" })
              : t("finance.actions.paymentHold.confirm")}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

// ─── InitiateHedgeReviewDialog ────────────────────────────────────────────────

interface InitiateHedgeReviewDialogProps {
  contractId: string | null;
  open: boolean;
  onClose: () => void;
}

export function InitiateHedgeReviewDialog({
  contractId,
  open,
  onClose,
}: InitiateHedgeReviewDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const titleId = useId();
  const [pair, setPair] = useState("USD/AED");
  const [exposureAed, setExposureAed] = useState("");
  const [note, setNote] = useState("");
  const [pairErr, setPairErr] = useState(false);

  useEffect(() => {
    if (open) {
      setPair("USD/AED");
      setExposureAed("");
      setNote("");
      setPairErr(false);
    }
  }, [open]);

  const PAIR_PATTERN = /^[A-Z]{3}\/[A-Z]{3}$/;

  const m = useMutation({
    mutationFn: async () => {
      if (!contractId) throw new Error("missing contractId");
      const trimmedPair = pair.trim();
      if (trimmedPair && !PAIR_PATTERN.test(trimmedPair)) {
        setPairErr(true);
        throw new Error("pair-invalid");
      }
      const parsedExposure = exposureAed.trim() ? Number(exposureAed) : undefined;
      return personaActionsService.initiateHedgeReview(contractId, {
        pair: trimmedPair || undefined,
        exposureAed: parsedExposure && !isNaN(parsedExposure) && parsedExposure > 0 ? parsedExposure : undefined,
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success(t("finance.actions.hedgeReview.success"));
      void qc.invalidateQueries({ queryKey: ["dashboards-crg", "finance-treasury"] });
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg !== "pair-invalid") toast.error(translateApiError(e, t));
    },
  });

  return (
    <DialogShell
      open={open && contractId !== null}
      titleId={titleId}
      title={t("finance.actions.hedgeReview.title")}
      onClose={onClose}
      isPending={m.isPending}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        className="space-y-3 px-5 py-4"
      >
        <p className="text-xs text-ink-muted">{t("finance.actions.hedgeReview.description")}</p>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("finance.actions.hedgeReview.pairLabel")}
          </span>
          <input
            type="text"
            value={pair}
            onChange={(e) => {
              setPair(e.target.value.toUpperCase());
              setPairErr(false);
            }}
            aria-invalid={pairErr}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            placeholder="USD/AED"
          />
          {pairErr && (
            <p className="mt-0.5 text-xs text-terracotta">
              {t("finance.actions.hedgeReview.pairInvalid")}
            </p>
          )}
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("finance.actions.hedgeReview.exposureAedLabel")}
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={exposureAed}
            onChange={(e) => setExposureAed(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("finance.actions.hedgeReview.exposureAedPlaceholder")}
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("finance.actions.hedgeReview.noteLabel")}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("finance.actions.hedgeReview.notePlaceholder")}
          />
        </label>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={m.isPending}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button type="submit" size="sm" disabled={m.isPending}>
            {m.isPending
              ? t("common.saving", { defaultValue: "Saving…" })
              : t("finance.actions.hedgeReview.confirm")}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
