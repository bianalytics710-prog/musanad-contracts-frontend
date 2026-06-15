/**
 * AddManualWorkOrderDialog v3 (2026-06-12) — drafter self-adds a work order
 * that originated outside the system.
 *
 * Field order:
 *   1. Request Type      (dropdown) — Draft request / Returned / Comment
 *   2. Request Details   (textarea) — what the request is
 *   3. Similar contract  (text, opt.) — ONLY when Request Type = Draft request.
 *      Drafter types a contract number → debounced lookup → confirmation
 *      card. On confirm → sourceContractId stored. When set, "Compose draft"
 *      uses the AI extract flow; when blank, falls back to /app/contracts/compose.
 *   4. Requestor         (dropdown) — active tenant users
 *   5. Stage             (dropdown) — Not started (default) / In progress / Completed
 *
 * Self-assigned (drafter = assigned_to_user_id). Requestor is the assigned_by
 * (stored in DB so the table's "From" column reflects who asked). Stage maps
 * to work_order.status server-side; for completed entries the BE also
 * stamps completed_at + completed_by.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  workOrdersService,
  workOrderKeys,
  type ContractLookupResponse,
  type CreateManualWorkOrderPayload,
  type ManualInitialStage,
  type WorkOrderType,
} from "@/services/api/work-orders.service";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";

interface AddManualWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REQUEST_TYPES: WorkOrderType[] = [
  "contract_draft_request",
  "contract_returned",
  "comment_response",
];

const STAGE_OPTIONS: ManualInitialStage[] = ["not_started", "in_progress", "completed"];

export function AddManualWorkOrderDialog({
  open,
  onOpenChange,
}: AddManualWorkOrderDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  // 2026-06-15 — "Similar contract" is a drafter affordance (replicate an
  // existing contract for a new draft). Not relevant to Legal Counsel's
  // ad-hoc tasks, so hide it for legal_counsel.
  const isLegalCounsel =
    useAuthStore((s) => s.user?.role?.name ?? null) === "legal_counsel";

  // Form state.
  const [requestType, setRequestType] = useState<WorkOrderType>("contract_draft_request");
  const [instructionNote, setInstructionNote] = useState("");
  const [requestorId, setRequestorId] = useState<string>("");
  const [initialStage, setInitialStage] = useState<ManualInitialStage>("not_started");

  // M21 mig 631 — Similar contract (only when type = draft_request).
  // Three discrete states:
  //   - typing       : user is editing the input; no lookup result yet
  //   - found        : lookup matched → showing confirmation card
  //   - confirmed    : drafter said Yes → input locked, sourceContractId stored
  //   - notFound     : lookup returned no match → muted hint
  const [similarNumber, setSimilarNumber] = useState("");
  const [lookup, setLookup] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "found"; result: ContractLookupResponse }
    | { kind: "confirmed"; contractId: number; titleEn: string | null; contractNumber: string }
    | { kind: "notFound" }
    | { kind: "error" }
  >({ kind: "idle" });
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Requestor dropdown source — active tenant users.
  const requestorsQuery = useQuery({
    queryKey: ["workOrders", "requestors"] as const,
    queryFn: () => workOrdersService.requestorOptions(),
    staleTime: 5 * 60_000,
    enabled: open,
  });
  const requestors = requestorsQuery.data?.items ?? [];

  // M21 mig 631 — Debounced lookup. Fires 500ms after the user stops typing
  // a contract number that's ≥4 chars. Triggers only while requestType =
  // contract_draft_request.
  //
  // 2026-06-12 fix — Only depend on (similarNumber, requestType). Putting
  // lookup.kind in deps was causing an infinite loop: typing → set loading →
  // effect re-fires due to kind change → cancels + reschedules → set notFound
  // → re-fires again → screen flickering. The "confirmed" guard isn't needed
  // because the input is disabled in that state, so similarNumber can't change.
  useEffect(() => {
    if (lookupTimer.current) {
      clearTimeout(lookupTimer.current);
      lookupTimer.current = null;
    }
    if (requestType !== "contract_draft_request") return;
    const trimmed = similarNumber.trim();
    if (trimmed.length < 4) {
      setLookup((prev) => (prev.kind === "idle" ? prev : { kind: "idle" }));
      return;
    }
    lookupTimer.current = setTimeout(() => {
      setLookup({ kind: "loading" });
      workOrdersService
        .lookupContract(trimmed)
        .then((res) => {
          if (res.found && res.id != null) {
            setLookup({ kind: "found", result: res });
          } else {
            setLookup({ kind: "notFound" });
          }
        })
        .catch(() => {
          setLookup({ kind: "error" });
        });
    }, 500);
    return () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    };
  }, [similarNumber, requestType]);

  // If the drafter switches Request Type away from draft_request, drop any
  // similar-contract state so the field doesn't quietly persist on submit.
  useEffect(() => {
    if (requestType !== "contract_draft_request") {
      setSimilarNumber("");
      setLookup({ kind: "idle" });
    }
  }, [requestType]);

  const formValid =
    instructionNote.trim().length > 0 && requestorId.length > 0;

  const mutation = useMutation({
    mutationFn: (payload: CreateManualWorkOrderPayload) =>
      workOrdersService.createManual(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workOrderKeys.all });
      toast.success(
        t("myWork.addManual.success", {
          defaultValue: "Added to your queue.",
        }),
      );
      reset();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(
        err.message ||
          t("myWork.addManual.error", {
            defaultValue: "Couldn't add to your queue. Try again.",
          }),
      );
    },
  });

  const reset = () => {
    setRequestType("contract_draft_request");
    setInstructionNote("");
    setRequestorId("");
    setInitialStage("not_started");
    setSimilarNumber("");
    setLookup({ kind: "idle" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid) return;
    // Only carry sourceContractId when the drafter has actually confirmed a
    // match. A typed-but-unconfirmed number is treated as "no similar contract"
    // — the drafter will start from scratch in Compose.
    const sourceContractId =
      lookup.kind === "confirmed" ? lookup.contractId : null;
    mutation.mutate({
      requestType,
      instructionNote: instructionNote.trim(),
      requestorUserId: Number(requestorId),
      initialStage,
      sourceContractId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("myWork.addManual.title", { defaultValue: "Add to my queue" })}
          </DialogTitle>
          <DialogDescription>
            {t("myWork.addManual.subtitle", {
              defaultValue:
                "Track a request that arrived outside the system (email, chat, in person).",
            })}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* 1. Request Type */}
          <div>
            <label htmlFor="addmanual-type" className="block text-xs font-medium text-ink-muted">
              {t("myWork.addManual.requestType", { defaultValue: "Request type" })}
              <span className="ms-1 text-destructive" aria-hidden="true">*</span>
            </label>
            <select
              id="addmanual-type"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as WorkOrderType)}
              className={cn(
                "mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            >
              {REQUEST_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {t(`myWork.types.${rt}`, { defaultValue: rt })}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Request Details */}
          <div>
            <label htmlFor="addmanual-note" className="block text-xs font-medium text-ink-muted">
              {t("myWork.addManual.requestDetails", { defaultValue: "Request details" })}
              <span className="ms-1 text-destructive" aria-hidden="true">*</span>
            </label>
            <textarea
              id="addmanual-note"
              value={instructionNote}
              onChange={(e) => setInstructionNote(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={t("myWork.addManual.notePlaceholder", {
                defaultValue:
                  "e.g. Need MSA for ABB Power & Automation UAE, 24-month term, AED 50M.",
              })}
              className={cn(
                "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
              aria-invalid={instructionNote.trim().length === 0}
            />
          </div>

          {/* 3. Similar contract (optional, only for Draft request) — M21 mig 631.
              2026-06-15 — hidden for legal_counsel (drafter-only affordance). */}
          {requestType === "contract_draft_request" && !isLegalCounsel && (
            <div>
              <label
                htmlFor="addmanual-similar"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("myWork.addManual.similarContract", {
                  defaultValue: "Similar contract (optional)",
                })}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="addmanual-similar"
                  type="text"
                  value={similarNumber}
                  onChange={(e) => setSimilarNumber(e.target.value)}
                  disabled={lookup.kind === "confirmed"}
                  placeholder={t("myWork.addManual.similarPlaceholder", {
                    defaultValue: "e.g. CT-2026-000033",
                  })}
                  className={cn(
                    "h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    "disabled:bg-muted disabled:text-muted-foreground",
                  )}
                  data-testid="addmanual-similar-input"
                />
                {lookup.kind === "loading" && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {lookup.kind === "confirmed" && (
                  <button
                    type="button"
                    onClick={() => {
                      setSimilarNumber("");
                      setLookup({ kind: "idle" });
                    }}
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    {t("common.change", { defaultValue: "Change" })}
                  </button>
                )}
              </div>

              {/* Confirmation card — drafter says Yes/No */}
              {lookup.kind === "found" && lookup.result.id != null && (
                <div
                  className="mt-2 rounded-md border border-[var(--gold)]/40 bg-[var(--gold)]/10 p-3 text-sm"
                  data-testid="addmanual-similar-confirm"
                >
                  <div className="font-medium text-foreground">
                    {lookup.result.titleEn ||
                      lookup.result.contractNumber ||
                      t("myWork.addManual.similarUntitled", { defaultValue: "Untitled contract" })}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    <span className="font-mono">{lookup.result.contractNumber}</span>
                    {lookup.result.counterpartyName && (
                      <>
                        <span className="mx-1">·</span>
                        {lookup.result.counterpartyName}
                      </>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-foreground/80">
                    {t("myWork.addManual.similarConfirmPrompt", {
                      defaultValue: "Is this the contract you want to replicate?",
                    })}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setLookup({
                          kind: "confirmed",
                          contractId: lookup.result.id!,
                          titleEn: lookup.result.titleEn ?? null,
                          contractNumber: lookup.result.contractNumber ?? similarNumber.trim(),
                        });
                      }}
                      data-testid="addmanual-similar-yes"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {t("common.yes", { defaultValue: "Yes" })}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSimilarNumber("");
                        setLookup({ kind: "idle" });
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                      {t("common.no", { defaultValue: "No" })}
                    </Button>
                  </div>
                </div>
              )}

              {lookup.kind === "notFound" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("myWork.addManual.similarNotFound", {
                    defaultValue: "No contract found with that number.",
                  })}
                </p>
              )}
              {lookup.kind === "confirmed" && (
                <p className="mt-1 text-xs text-[var(--sage)]">
                  {t("myWork.addManual.similarConfirmed", {
                    defaultValue: "Locked in. The wizard will start from this contract.",
                  })}
                </p>
              )}
              {lookup.kind === "error" && (
                <p className="mt-1 text-xs text-[var(--terracotta)]">
                  {t("myWork.addManual.similarError", {
                    defaultValue: "Couldn't look up the contract. Try again.",
                  })}
                </p>
              )}
            </div>
          )}

          {/* 4. Requestor */}
          <div>
            <label htmlFor="addmanual-requestor" className="block text-xs font-medium text-ink-muted">
              {t("myWork.addManual.requestor", { defaultValue: "Requestor" })}
              <span className="ms-1 text-destructive" aria-hidden="true">*</span>
            </label>
            <select
              id="addmanual-requestor"
              value={requestorId}
              onChange={(e) => setRequestorId(e.target.value)}
              disabled={requestorsQuery.isLoading}
              className={cn(
                "mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
              aria-invalid={requestorId.length === 0}
            >
              <option value="">
                {requestorsQuery.isLoading
                  ? t("common.loading", { defaultValue: "Loading…" })
                  : t("myWork.addManual.chooseRequestor", { defaultValue: "Choose…" })}
              </option>
              {requestors.map((u) => {
                const fullName = `${u.firstName} ${u.lastName}`.trim() || u.email;
                const roleHumanised = u.roleName.replace(/_/g, " ");
                return (
                  <option key={u.id} value={String(u.id)}>
                    {fullName} — {roleHumanised}
                  </option>
                );
              })}
            </select>
          </div>

          {/* 5. Stage */}
          <div>
            <label htmlFor="addmanual-stage" className="block text-xs font-medium text-ink-muted">
              {t("myWork.addManual.stage", { defaultValue: "Stage" })}
            </label>
            <select
              id="addmanual-stage"
              value={initialStage}
              onChange={(e) => setInitialStage(e.target.value as ManualInitialStage)}
              className={cn(
                "mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            >
              {STAGE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`myWork.stages.${s}`, { defaultValue: s })}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              <X className="h-3.5 w-3.5" />
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!formValid || mutation.isPending}
              data-testid="addmanual-submit"
            >
              {mutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {t("myWork.addManual.submit", { defaultValue: "Add to queue" })}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddManualWorkOrderDialog;
