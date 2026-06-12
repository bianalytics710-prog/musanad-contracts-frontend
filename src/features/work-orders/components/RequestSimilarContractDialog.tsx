/**
 * M21 — "Request similar contract" exec modal.
 *
 * V2 (post-pivot): only a work_order row is created here. The drafter
 * composes the contract via the wizard. The exec picks:
 *   - a drafter from the workload-aware dropdown
 *   - a counterparty: existing party (autocomplete) OR free-text new prospect
 *   - optional value + instruction note
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, AlertCircle, Wand2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  useAssignableDrafters,
  useCreateDraftRequest,
} from "../hooks/useWorkOrders";
import { workOrdersService } from "@/services/api/work-orders.service";
import { toast } from "sonner";

const NEW_PROSPECT_SENTINEL = "__new_prospect__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceContract: {
    id: number;
    contractNumber: string;
    titleEn: string | null;
    titleAr: string | null;
    counterpartyName: string | null;
  };
}

export function RequestSimilarContractDialog({ open, onOpenChange, sourceContract }: Props) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const navigate = useNavigate();

  const [drafterId, setDrafterId] = useState<number | "">("");
  // "" = unselected. number = existing party id. NEW_PROSPECT_SENTINEL = free-text prospect mode.
  const [partySelection, setPartySelection] = useState<string>("");
  const [prospectName, setProspectName] = useState("");
  const [instruction, setInstruction] = useState("");

  const draftersQuery = useAssignableDrafters(open);
  const mutation = useCreateDraftRequest();

  // Eager-load all counterparty options via the work-order-specific endpoint
  // (skips the party.read permission gate that some roles like executive lack).
  const partiesQuery = useQuery({
    queryKey: ["work-orders", "counterparty-options"],
    queryFn: () => workOrdersService.counterpartyOptions(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!open) {
      setDrafterId("");
      setPartySelection("");
      setProspectName("");
      setInstruction("");
      mutation.reset();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const sourceTitle = isAr
    ? sourceContract.titleAr ?? sourceContract.titleEn
    : sourceContract.titleEn ?? sourceContract.titleAr;

  const isProspectMode = partySelection === NEW_PROSPECT_SENTINEL;
  const selectedPartyId = !isProspectMode && partySelection !== ""
    ? Number(partySelection)
    : null;

  const canSubmit = useMemo(() => {
    if (typeof drafterId !== "number") return false;
    if (mutation.isPending) return false;
    if (isProspectMode) return prospectName.trim().length >= 2;
    return selectedPartyId != null;
  }, [drafterId, mutation.isPending, isProspectMode, selectedPartyId, prospectName]);

  const submit = async () => {
    if (typeof drafterId !== "number") return;
    try {
      const result = await mutation.mutateAsync({
        sourceContractId: sourceContract.id,
        assignedDrafterId: drafterId,
        counterpartyId: selectedPartyId,
        counterpartyProspectName: isProspectMode ? prospectName.trim() : null,
        instructionNote: instruction.trim() || null,
      });
      toast.success(
        t("requestSimilar.successToast", {
          name: result.assignedDrafter.name,
        }),
      );
      onOpenChange(false);
      void navigate({ to: "/app/work" });
    } catch {
      // ApiError already toasted by global handler; keep dialog open.
    }
  };

  const drafters = draftersQuery.data ?? [];
  const parties = useMemo(() => partiesQuery.data ?? [], [partiesQuery.data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-[var(--gold)]" />
            {t("requestSimilar.title")}
          </DialogTitle>
          <DialogDescription>
            {t("requestSimilar.subtitle", { number: sourceContract.contractNumber })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="font-medium">{sourceTitle ?? sourceContract.contractNumber}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{sourceContract.contractNumber}</span>
              {sourceContract.counterpartyName && <span>· {sourceContract.counterpartyName}</span>}
            </div>
          </div>

          {/* Drafter */}
          <div>
            <Label htmlFor="drafter">{t("requestSimilar.assignTo")}</Label>
            {draftersQuery.isLoading ? (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("requestSimilar.loadingDrafters")}
              </div>
            ) : drafters.length === 0 ? (
              <div className="mt-2 flex items-center gap-2 text-sm text-[var(--terracotta)]">
                <AlertCircle className="h-4 w-4" />
                {t("requestSimilar.noDrafters")}
              </div>
            ) : (
              <select
                id="drafter"
                value={drafterId}
                onChange={(e) =>
                  setDrafterId(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="request-similar-drafter-select"
              >
                <option value="">{t("requestSimilar.pickDrafter")}</option>
                {drafters.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName} {d.openWorkOrders > 0
                      ? `· ${t("requestSimilar.openCount", { count: d.openWorkOrders })}`
                      : `· ${t("requestSimilar.freeNow")}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Counterparty selector — single dropdown of existing parties + "Add prospect" path */}
          <div>
            <Label htmlFor="counterparty">{t("requestSimilar.counterparty")}</Label>
            <select
              id="counterparty"
              value={partySelection}
              onChange={(e) => setPartySelection(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              data-testid="counterparty-select"
              disabled={partiesQuery.isLoading}
            >
              <option value="">{t("requestSimilar.pickCounterparty")}</option>
              <option value={NEW_PROSPECT_SENTINEL}>
                + {t("requestSimilar.addProspect")}
              </option>
              {parties.length > 0 && (
                <optgroup label={t("requestSimilar.existingCustomers")}>
                  {parties.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.nameEn}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            {isProspectMode && (
              <input
                type="text"
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                placeholder={t("requestSimilar.prospectPlaceholder")}
                maxLength={200}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="prospect-name-input"
                autoFocus
              />
            )}
          </div>

          {/* Instruction */}
          <div>
            <Label htmlFor="instruction">{t("requestSimilar.instructionLabel")}</Label>
            <textarea
              id="instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={t("requestSimilar.instructionPlaceholder")}
              rows={3}
              maxLength={2000}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="request-similar-instruction"
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">
              {instruction.length}/2000
            </div>
          </div>

          <div className="rounded-md bg-[var(--gold)]/5 border border-[var(--gold)]/30 p-3 text-xs text-foreground/80">
            {t("requestSimilar.aiHint")}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            data-testid="request-similar-submit"
          >
            {mutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("requestSimilar.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
