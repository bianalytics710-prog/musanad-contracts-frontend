/**
 * Unit-3 / R-OPS — Operations persona action dialogs.
 *
 * Three dialogs matching the BRD §7 action set:
 *   - AcknowledgeEventDialog  — POST /api/v1/ops/events/:correlationId/acknowledge
 *   - LinkRemedyDialog         — POST /api/v1/ops/events/:correlationId/link-remedy
 *   - EscalateEventDialog      — POST /api/v1/ops/events/:correlationId/escalate
 *
 * Dialog pattern: RequestInfoDialog (R-LC4) — same structure.
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

// ─── AcknowledgeEventDialog ───────────────────────────────────────────────────

interface AcknowledgeEventDialogProps {
  correlationId: string | null;
  open: boolean;
  onClose: () => void;
}

export function AcknowledgeEventDialog({
  correlationId,
  open,
  onClose,
}: AcknowledgeEventDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const titleId = useId();
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  const m = useMutation({
    mutationFn: async () => {
      if (!correlationId) throw new Error("missing correlationId");
      return personaActionsService.acknowledgeEvent(correlationId, {
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success(t("ops.actions.acknowledge.success"));
      void qc.invalidateQueries({ queryKey: ["dashboards-crg", "operations"] });
      onClose();
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  return (
    <DialogShell
      open={open && correlationId !== null}
      titleId={titleId}
      title={t("ops.actions.acknowledge.title")}
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
        <p className="text-xs text-ink-muted">{t("ops.actions.acknowledge.description")}</p>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("ops.actions.acknowledge.noteLabel")}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={500}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("ops.actions.acknowledge.notePlaceholder")}
          />
        </label>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={m.isPending}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button type="submit" size="sm" disabled={m.isPending}>
            {m.isPending
              ? t("common.saving", { defaultValue: "Saving…" })
              : t("ops.actions.acknowledge.confirm")}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

// ─── LinkRemedyDialog ─────────────────────────────────────────────────────────

interface LinkRemedyDialogProps {
  correlationId: string | null;
  open: boolean;
  onClose: () => void;
}

export function LinkRemedyDialog({ correlationId, open, onClose }: LinkRemedyDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const titleId = useId();
  const contractIdId = useId();
  const [contractId, setContractId] = useState("");
  const [clauseId, setClauseId] = useState("");
  const [note, setNote] = useState("");
  const [contractIdErr, setContractIdErr] = useState(false);

  useEffect(() => {
    if (open) {
      setContractId("");
      setClauseId("");
      setNote("");
      setContractIdErr(false);
    }
  }, [open]);

  const m = useMutation({
    mutationFn: async () => {
      if (!correlationId) throw new Error("missing correlationId");
      if (!contractId.trim()) {
        setContractIdErr(true);
        throw new Error("contract-required");
      }
      return personaActionsService.linkRemedy(correlationId, {
        contractId: contractId.trim(),
        clauseId: clauseId.trim() || undefined,
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success(t("ops.actions.linkRemedy.success"));
      void qc.invalidateQueries({ queryKey: ["dashboards-crg", "operations"] });
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg !== "contract-required") {
        toast.error(translateApiError(e, t));
      }
    },
  });

  return (
    <DialogShell
      open={open && correlationId !== null}
      titleId={titleId}
      title={t("ops.actions.linkRemedy.title")}
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
        <p className="text-xs text-ink-muted">{t("ops.actions.linkRemedy.description")}</p>
        <label className="block" htmlFor={contractIdId}>
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("ops.actions.linkRemedy.contractIdLabel")}
            <span className="ms-0.5 text-terracotta">*</span>
          </span>
          <input
            id={contractIdId}
            type="text"
            value={contractId}
            onChange={(e) => {
              setContractId(e.target.value);
              setContractIdErr(false);
            }}
            required
            aria-invalid={contractIdErr}
            aria-describedby={contractIdErr ? `${contractIdId}-err` : undefined}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("ops.actions.linkRemedy.contractIdPlaceholder")}
          />
          {contractIdErr && (
            <p id={`${contractIdId}-err`} className="mt-0.5 text-xs text-terracotta">
              {t("ops.actions.linkRemedy.contractIdRequired")}
            </p>
          )}
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("ops.actions.linkRemedy.clauseIdLabel")}
          </span>
          <input
            type="text"
            value={clauseId}
            onChange={(e) => setClauseId(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("ops.actions.linkRemedy.clauseIdPlaceholder")}
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("ops.actions.linkRemedy.noteLabel")}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("ops.actions.linkRemedy.notePlaceholder")}
          />
        </label>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={m.isPending}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button type="submit" size="sm" disabled={m.isPending || !contractId.trim()}>
            {m.isPending
              ? t("common.saving", { defaultValue: "Saving…" })
              : t("ops.actions.linkRemedy.confirm")}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

// ─── EscalateEventDialog ──────────────────────────────────────────────────────

type EscalateRole = "procurement" | "legal" | "executive";

interface EscalateEventDialogProps {
  correlationId: string | null;
  open: boolean;
  onClose: () => void;
}

export function EscalateEventDialog({ correlationId, open, onClose }: EscalateEventDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const titleId = useId();
  const selectId = useId();
  const [toRole, setToRole] = useState<EscalateRole>("procurement");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setToRole("procurement");
      setNote("");
    }
  }, [open]);

  const m = useMutation({
    mutationFn: async () => {
      if (!correlationId) throw new Error("missing correlationId");
      return personaActionsService.escalateEvent(correlationId, {
        toRole,
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success(t("ops.actions.escalate.success"));
      void qc.invalidateQueries({ queryKey: ["dashboards-crg", "operations"] });
      onClose();
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  const ROLE_OPTIONS: { value: EscalateRole; label: string }[] = [
    { value: "procurement", label: t("ops.actions.escalate.toRoleLabel.procurement") },
    { value: "legal", label: t("ops.actions.escalate.toRoleLabel.legal") },
    { value: "executive", label: t("ops.actions.escalate.toRoleLabel.executive") },
  ];

  return (
    <DialogShell
      open={open && correlationId !== null}
      titleId={titleId}
      title={t("ops.actions.escalate.title")}
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
        <p className="text-xs text-ink-muted">{t("ops.actions.escalate.description")}</p>
        <label className="block" htmlFor={selectId}>
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("ops.actions.escalate.toRoleLabel.label")}
            <span className="ms-0.5 text-terracotta">*</span>
          </span>
          <select
            id={selectId}
            value={toRole}
            onChange={(e) => setToRole(e.target.value as EscalateRole)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("ops.actions.escalate.noteLabel")}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("ops.actions.escalate.notePlaceholder")}
          />
        </label>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={m.isPending}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button type="submit" size="sm" disabled={m.isPending}>
            {m.isPending
              ? t("common.saving", { defaultValue: "Saving…" })
              : t("ops.actions.escalate.confirm")}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
