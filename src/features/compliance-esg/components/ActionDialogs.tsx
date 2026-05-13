/**
 * Unit-3 / R-CES — Compliance & ESG persona action dialogs.
 *
 * Four dialogs matching the BRD §7 action set:
 *   - RaiseFlagDialog              — POST /api/v1/compliance/contracts/:contractId/raise-flag
 *   - InitiateSupplierAuditDialog  — POST /api/v1/compliance/contracts/:contractId/supplier-audit
 *   - RecommendHoldDialog          — POST /api/v1/compliance/contracts/:contractId/recommend-hold
 *   - RecommendTerminationDialog   — POST /api/v1/compliance/contracts/:contractId/recommend-termination
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

// ─── RaiseFlagDialog ──────────────────────────────────────────────────────────

type FlagKind = "sanctions" | "esg" | "audit_rights" | "other";
type FlagSeverity = "low" | "medium" | "high" | "critical";

interface RaiseFlagDialogProps {
  contractId: string | null;
  open: boolean;
  onClose: () => void;
}

export function RaiseFlagDialog({ contractId, open, onClose }: RaiseFlagDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const titleId = useId();
  const [flagKind, setFlagKind] = useState<FlagKind>("sanctions");
  const [severity, setSeverity] = useState<FlagSeverity>("high");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setFlagKind("sanctions");
      setSeverity("high");
      setNote("");
    }
  }, [open]);

  const m = useMutation({
    mutationFn: async () => {
      if (!contractId) throw new Error("missing contractId");
      return personaActionsService.raiseFlag(contractId, {
        flagKind,
        severity,
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success(t("compliance.actions.raiseFlag.success"));
      void qc.invalidateQueries({ queryKey: ["dashboards-crg", "compliance-esg"] });
      onClose();
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  const FLAG_KINDS: { value: FlagKind; label: string }[] = [
    { value: "sanctions", label: t("compliance.actions.raiseFlag.flagKind.sanctions") },
    { value: "esg", label: t("compliance.actions.raiseFlag.flagKind.esg") },
    { value: "audit_rights", label: t("compliance.actions.raiseFlag.flagKind.audit_rights") },
    { value: "other", label: t("compliance.actions.raiseFlag.flagKind.other") },
  ];

  const SEVERITIES: { value: FlagSeverity; label: string }[] = [
    { value: "low", label: t("dashboards.common.severity.low") },
    { value: "medium", label: t("dashboards.common.severity.medium") },
    { value: "high", label: t("dashboards.common.severity.high") },
    { value: "critical", label: t("dashboards.common.severity.critical") },
  ];

  return (
    <DialogShell
      open={open && contractId !== null}
      titleId={titleId}
      title={t("compliance.actions.raiseFlag.title")}
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
        <p className="text-xs text-ink-muted">{t("compliance.actions.raiseFlag.description")}</p>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("compliance.actions.raiseFlag.flagKindLabel")}
            <span className="ms-0.5 text-terracotta">*</span>
          </span>
          <select
            value={flagKind}
            onChange={(e) => setFlagKind(e.target.value as FlagKind)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {FLAG_KINDS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("compliance.actions.raiseFlag.severityLabel")}
            <span className="ms-0.5 text-terracotta">*</span>
          </span>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as FlagSeverity)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {SEVERITIES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("compliance.actions.raiseFlag.noteLabel")}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={1000}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("compliance.actions.raiseFlag.notePlaceholder")}
          />
        </label>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={m.isPending}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button type="submit" size="sm" disabled={m.isPending} className="bg-terracotta hover:bg-terracotta/90 text-white">
            {m.isPending
              ? t("common.saving", { defaultValue: "Saving…" })
              : t("compliance.actions.raiseFlag.confirm")}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

// ─── InitiateSupplierAuditDialog ──────────────────────────────────────────────

type AuditScope = "financial" | "operational" | "esg" | "sanctions" | "full";

interface InitiateSupplierAuditDialogProps {
  contractId: string | null;
  open: boolean;
  onClose: () => void;
}

export function InitiateSupplierAuditDialog({
  contractId,
  open,
  onClose,
}: InitiateSupplierAuditDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const titleId = useId();
  const [scope, setScope] = useState<AuditScope>("full");
  const [targetDate, setTargetDate] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setScope("full");
      setTargetDate("");
      setNote("");
    }
  }, [open]);

  const m = useMutation({
    mutationFn: async () => {
      if (!contractId) throw new Error("missing contractId");
      return personaActionsService.initiateSupplierAudit(contractId, {
        scope,
        targetDate: targetDate || undefined,
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success(t("compliance.actions.supplierAudit.success"));
      void qc.invalidateQueries({ queryKey: ["dashboards-crg", "compliance-esg"] });
      onClose();
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  const SCOPES: { value: AuditScope; label: string }[] = [
    { value: "financial", label: t("compliance.actions.supplierAudit.scope.financial") },
    { value: "operational", label: t("compliance.actions.supplierAudit.scope.operational") },
    { value: "esg", label: t("compliance.actions.supplierAudit.scope.esg") },
    { value: "sanctions", label: t("compliance.actions.supplierAudit.scope.sanctions") },
    { value: "full", label: t("compliance.actions.supplierAudit.scope.full") },
  ];

  return (
    <DialogShell
      open={open && contractId !== null}
      titleId={titleId}
      title={t("compliance.actions.supplierAudit.title")}
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
        <p className="text-xs text-ink-muted">{t("compliance.actions.supplierAudit.description")}</p>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("compliance.actions.supplierAudit.scopeLabel")}
            <span className="ms-0.5 text-terracotta">*</span>
          </span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as AuditScope)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {SCOPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("compliance.actions.supplierAudit.targetDateLabel")}
          </span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("compliance.actions.supplierAudit.noteLabel")}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("compliance.actions.supplierAudit.notePlaceholder")}
          />
        </label>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={m.isPending}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button type="submit" size="sm" disabled={m.isPending}>
            {m.isPending
              ? t("common.saving", { defaultValue: "Saving…" })
              : t("compliance.actions.supplierAudit.confirm")}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

// ─── RecommendHoldDialog ──────────────────────────────────────────────────────

interface RecommendHoldDialogProps {
  contractId: string | null;
  open: boolean;
  onClose: () => void;
}

export function RecommendHoldDialog({ contractId, open, onClose }: RecommendHoldDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const titleId = useId();
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [proposedHoldUntil, setProposedHoldUntil] = useState("");
  const [reasonErr, setReasonErr] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setProposedHoldUntil("");
      setReasonErr(false);
    }
  }, [open]);

  const m = useMutation({
    mutationFn: async () => {
      if (!contractId) throw new Error("missing contractId");
      if (!reason.trim()) {
        setReasonErr(true);
        throw new Error("reason-required");
      }
      return personaActionsService.recommendHold(contractId, {
        reason: reason.trim(),
        proposedHoldUntil: proposedHoldUntil || undefined,
      });
    },
    onSuccess: () => {
      toast.success(t("compliance.actions.recommendHold.success"));
      void qc.invalidateQueries({ queryKey: ["dashboards-crg", "compliance-esg"] });
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg !== "reason-required") toast.error(translateApiError(e, t));
    },
  });

  return (
    <DialogShell
      open={open && contractId !== null}
      titleId={titleId}
      title={t("compliance.actions.recommendHold.title")}
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
        <p className="text-xs text-ink-muted">{t("compliance.actions.recommendHold.description")}</p>
        <label className="block" htmlFor={reasonId}>
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("compliance.actions.recommendHold.reasonLabel")}
            <span className="ms-0.5 text-terracotta">*</span>
          </span>
          <textarea
            id={reasonId}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonErr(false);
            }}
            required
            rows={4}
            maxLength={1000}
            aria-invalid={reasonErr}
            aria-describedby={reasonErr ? `${reasonId}-err` : undefined}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("compliance.actions.recommendHold.reasonPlaceholder")}
          />
          {reasonErr && (
            <p id={`${reasonId}-err`} className="mt-0.5 text-xs text-terracotta">
              {t("compliance.actions.recommendHold.reasonRequired")}
            </p>
          )}
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("compliance.actions.recommendHold.holdUntilLabel")}
          </span>
          <input
            type="date"
            value={proposedHoldUntil}
            onChange={(e) => setProposedHoldUntil(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={m.isPending}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button type="submit" size="sm" disabled={m.isPending || !reason.trim()}>
            {m.isPending
              ? t("common.saving", { defaultValue: "Saving…" })
              : t("compliance.actions.recommendHold.confirm")}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

// ─── RecommendTerminationDialog ───────────────────────────────────────────────

type TerminationGrounds =
  | "sanctions"
  | "material_breach"
  | "esg_violation"
  | "non_performance"
  | "regulatory_compliance"
  | "other";

interface RecommendTerminationDialogProps {
  contractId: string | null;
  open: boolean;
  onClose: () => void;
}

export function RecommendTerminationDialog({
  contractId,
  open,
  onClose,
}: RecommendTerminationDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const titleId = useId();
  const reasonId = useId();
  const [grounds, setGrounds] = useState<TerminationGrounds>("sanctions");
  const [reason, setReason] = useState("");
  const [reasonErr, setReasonErr] = useState(false);

  useEffect(() => {
    if (open) {
      setGrounds("sanctions");
      setReason("");
      setReasonErr(false);
    }
  }, [open]);

  const m = useMutation({
    mutationFn: async () => {
      if (!contractId) throw new Error("missing contractId");
      if (!reason.trim()) {
        setReasonErr(true);
        throw new Error("reason-required");
      }
      return personaActionsService.recommendTermination(contractId, {
        reason: reason.trim(),
        grounds,
      });
    },
    onSuccess: () => {
      toast.success(t("compliance.actions.recommendTermination.success"));
      void qc.invalidateQueries({ queryKey: ["dashboards-crg", "compliance-esg"] });
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg !== "reason-required") toast.error(translateApiError(e, t));
    },
  });

  const GROUNDS: { value: TerminationGrounds; label: string }[] = [
    { value: "sanctions", label: t("compliance.actions.recommendTermination.grounds.sanctions") },
    { value: "material_breach", label: t("compliance.actions.recommendTermination.grounds.material_breach") },
    { value: "esg_violation", label: t("compliance.actions.recommendTermination.grounds.esg_violation") },
    { value: "non_performance", label: t("compliance.actions.recommendTermination.grounds.non_performance") },
    { value: "regulatory_compliance", label: t("compliance.actions.recommendTermination.grounds.regulatory_compliance") },
    { value: "other", label: t("compliance.actions.recommendTermination.grounds.other") },
  ];

  return (
    <DialogShell
      open={open && contractId !== null}
      titleId={titleId}
      title={t("compliance.actions.recommendTermination.title")}
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
        <p className="text-xs text-ink-muted text-terracotta/80">
          {t("compliance.actions.recommendTermination.description")}
        </p>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("compliance.actions.recommendTermination.groundsLabel")}
            <span className="ms-0.5 text-terracotta">*</span>
          </span>
          <select
            value={grounds}
            onChange={(e) => setGrounds(e.target.value as TerminationGrounds)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {GROUNDS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block" htmlFor={reasonId}>
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("compliance.actions.recommendTermination.reasonLabel")}
            <span className="ms-0.5 text-terracotta">*</span>
          </span>
          <textarea
            id={reasonId}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonErr(false);
            }}
            required
            rows={4}
            maxLength={2000}
            aria-invalid={reasonErr}
            aria-describedby={reasonErr ? `${reasonId}-err` : undefined}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("compliance.actions.recommendTermination.reasonPlaceholder")}
          />
          {reasonErr && (
            <p id={`${reasonId}-err`} className="mt-0.5 text-xs text-terracotta">
              {t("compliance.actions.recommendTermination.reasonRequired")}
            </p>
          )}
        </label>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={m.isPending}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={m.isPending || !reason.trim()}
            className="bg-terracotta hover:bg-terracotta/90 text-white"
          >
            {m.isPending
              ? t("common.saving", { defaultValue: "Saving…" })
              : t("compliance.actions.recommendTermination.confirm")}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
