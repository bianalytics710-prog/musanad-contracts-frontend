/**
 * RequestInfoDialog — R-LC4 LC-F7. Soft "Request info" action that posts a
 * message to the contract comments thread and audits the action without
 * mutating step status (drafter replies via comments).
 *
 * Distinct from request_resubmission (hard bounce). Per LC decision 2(c),
 * both actions are surfaced as separate inline buttons on each pending
 * approval row.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { translateApiError } from "@/lib/translate-api-error";
import { useFocusTrap } from "@/components/common/useFocusTrap";

interface Props {
  stepId: number | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RequestInfoDialog({ stepId, open, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  // R-LC9-4 — WCAG focus trap + Escape-to-close.
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (open) setMessage("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const m = useMutation({
    mutationFn: async () => {
      if (!stepId) throw new Error("missing stepId");
      const trimmed = message.trim();
      if (trimmed.length < 1) throw new Error("message-empty");
      const { data } = await apiClient.post(
        `/api/v1/approvals/${stepId}/request-info`,
        { message: trimmed },
      );
      return data;
    },
    onSuccess: () => {
      toast.success(
        t("approval.requestInfo.success", { defaultValue: "Request sent to drafter" }),
      );
      void qc.invalidateQueries({ queryKey: ["approvals"] });
      onSuccess?.();
      onClose();
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  if (!open || !stepId) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !m.isPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {t("approval.requestInfo.title", { defaultValue: "Request information" })}
          </h2>
          <button
            type="button"
            onClick={() => !m.isPending && onClose()}
            className="rounded-md p-1 text-ink-muted hover:bg-surface"
            aria-label={t("common.close", { defaultValue: "Close" })}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
          className="space-y-3 px-5 py-4"
        >
          <p className="text-xs text-ink-muted">
            {t("approval.requestInfo.helper", {
              defaultValue:
                "Posts a message to the comments thread for the drafter. The contract stays in your queue — you can approve or reject after they respond.",
            })}
          </p>
          <label className="block">
            <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              {t("approval.requestInfo.messageLabel", { defaultValue: "Your question" })}
              <span className="ms-0.5 text-terracotta">*</span>
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              required
              minLength={1}
              maxLength={4000}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder={t("approval.requestInfo.messagePlaceholder", {
                defaultValue: "What do you need clarified?",
              })}
            />
          </label>
          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={m.isPending}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button type="submit" size="sm" disabled={m.isPending || message.trim().length < 1}>
              {m.isPending
                ? t("common.sending", { defaultValue: "Sending…" })
                : t("approval.requestInfo.submit", { defaultValue: "Request info" })}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RequestInfoDialog;
