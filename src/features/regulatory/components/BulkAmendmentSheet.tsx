/**
 * BulkAmendmentSheet (S11) — bulk-detect regulatory_impact rows across a
 * candidate set of contracts.
 *
 * Mode: REGENERATE. Lovable's `BulkAmendmentSheet.tsx` (912L) was a 5-step
 * wizard chained through supabase.functions.invoke + approvalEngine +
 * direct supabase.from() writes — none of that exists in v2.6 (DB Objects
 * First; thin BE; M2 owns approval routing). We compress to a focused
 * bulk-detect form aligned with POST /api/v1/regulatory-impacts/bulk-detect:
 *
 *   1. Pick affected contracts from the impacts list passed by the parent.
 *   2. Compose per-contract impact payload (impactScore + notes/summaries).
 *      Defaults populated from the impactScore/note/summary already on the
 *      impact row (re-detection scenario).
 *   3. Submit → fn_regulatory_impact_create_bulk (idempotent re-runs via
 *      ON CONFLICT DO NOTHING; AC-S11-02).
 *
 * The full "draft amendment + approval routing + execute" flow Lovable
 * shipped is M2/M3/M4 territory, not S11 — that workflow is downstream of
 * this detection step. Hardening a Lovable component that proxies multiple
 * other modules' jobs would create coupling we explicitly want to break.
 *
 * SENSITIVE: impactPayload (per-contract noteEn/Ar / summaryEn/Ar /
 * impactScore) is AI-generated content. Flows through useMutation body
 * only; never console.log.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useBulkDetectRegulatoryImpacts } from "@/features/regulatory/hooks/useRegulatory";
import type {
  BulkDetectRegulatoryImpactDto,
  ImpactPayloadEntry,
  RegulatoryImpact,
  RegulatoryUpdate,
} from "@/types/entities/regulatory.types";

interface Props {
  regulatoryUpdate: RegulatoryUpdate;
  impacts: RegulatoryImpact[];
  open: boolean;
  onClose: () => void;
}

interface RowDraft {
  contractId: number;
  contractNumber: string;
  contractTitle: string;
  selected: boolean;
  payload: ImpactPayloadEntry;
}

export function BulkAmendmentSheet({
  regulatoryUpdate,
  impacts,
  open,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [drafts, setDrafts] = useState<RowDraft[]>([]);
  useEffect(() => {
    if (!open) return;
    setDrafts(
      impacts.map((imp) => ({
        contractId: imp.contract.id,
        contractNumber: imp.contract.contractNumber,
        contractTitle: imp.contract.titleEn,
        selected: !imp.resolved,
        payload: {
          impactScore: imp.impactScore,
          noteEn: imp.impactNoteEn,
          noteAr: imp.impactNoteAr,
          summaryEn: imp.impactSummaryEn,
          summaryAr: imp.impactSummaryAr,
        },
      })),
    );
  }, [open, impacts]);

  const mutation = useBulkDetectRegulatoryImpacts({
    onSuccess: () => onClose(),
  });

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !mutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, mutation.isPending]);

  const selectedDrafts = useMemo(
    () => drafts.filter((d) => d.selected),
    [drafts],
  );

  const canSubmit = selectedDrafts.length > 0 && !mutation.isPending;

  if (!open) return null;

  const onSubmit = () => {
    if (!canSubmit) return;
    const payload: BulkDetectRegulatoryImpactDto = {
      regulatoryUpdateId: regulatoryUpdate.id,
      regulationId: 0, // see note below
      contractIds: selectedDrafts.map((d) => d.contractId),
      impactPayload: Object.fromEntries(
        selectedDrafts.map((d) => [String(d.contractId), d.payload]),
      ),
    };
    // The bulk-detect endpoint requires a regulationId (the "umbrella"
    // regulation). We resolve from the first impact's regulation ref —
    // every impact in this list shares the same regulation since impacts
    // here are filtered by regulatoryUpdateId. If the list is empty (e.g.
    // re-running after first detection wiped the impacts list), the user
    // is asked to specify by closing+reopening from a regulation context.
    const firstReg = impacts[0]?.regulation.id;
    if (!firstReg) return; // canSubmit gates this implicitly via selection
    payload.regulationId = firstReg;
    mutation.mutate(payload);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !mutation.isPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2
              id={titleId}
              className="flex items-center gap-2 text-lg font-semibold text-ink"
            >
              <Sparkles className="h-5 w-5 text-gold" />
              {t("regulatory.bulkAmend.title")}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              {regulatoryUpdate.titleEn}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={mutation.isPending}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {drafts.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-muted">
              {t("regulatory.bulkAmend.empty")}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="py-2 pe-3 text-start">
                    <span className="sr-only">
                      {t("regulatory.bulkAmend.selectColumn")}
                    </span>
                  </th>
                  <th className="py-2 pe-3 text-start">
                    {t("regulatory.bulkAmend.fields.contract")}
                  </th>
                  <th className="py-2 pe-3 text-start">
                    {t("regulatory.bulkAmend.fields.impactScore")}
                  </th>
                  <th className="py-2 pe-3 text-start">
                    {t("regulatory.bulkAmend.fields.noteEn")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {drafts.map((row, idx) => (
                  <tr key={row.contractId}>
                    <td className="py-2 pe-3">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) =>
                          setDrafts((curr) =>
                            curr.map((d, i) =>
                              i === idx
                                ? { ...d, selected: e.target.checked }
                                : d,
                            ),
                          )
                        }
                        aria-label={t("regulatory.bulkAmend.selectRow", {
                          number: row.contractNumber,
                        })}
                        disabled={mutation.isPending}
                      />
                    </td>
                    <td className="py-2 pe-3">
                      <div className="font-mono text-xs text-ink-muted">
                        {row.contractNumber}
                      </div>
                      <div className="text-ink">{row.contractTitle}</div>
                    </td>
                    <td className="py-2 pe-3">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={
                          row.payload.impactScore === null ||
                          row.payload.impactScore === undefined
                            ? ""
                            : row.payload.impactScore
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          setDrafts((curr) =>
                            curr.map((d, i) =>
                              i === idx
                                ? {
                                    ...d,
                                    payload: {
                                      ...d.payload,
                                      impactScore:
                                        v === "" ? null : Number(v),
                                    },
                                  }
                                : d,
                            ),
                          );
                        }}
                        disabled={mutation.isPending || !row.selected}
                        className="w-24"
                        aria-label={t(
                          "regulatory.bulkAmend.fields.impactScore",
                        )}
                      />
                    </td>
                    <td className="py-2 pe-3">
                      <Input
                        type="text"
                        value={row.payload.noteEn ?? ""}
                        onChange={(e) =>
                          setDrafts((curr) =>
                            curr.map((d, i) =>
                              i === idx
                                ? {
                                    ...d,
                                    payload: {
                                      ...d.payload,
                                      noteEn: e.target.value || null,
                                    },
                                  }
                                : d,
                            ),
                          )
                        }
                        disabled={mutation.isPending || !row.selected}
                        aria-label={t("regulatory.bulkAmend.fields.noteEn")}
                        placeholder={t(
                          "regulatory.bulkAmend.placeholders.noteEn",
                        )}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border p-4 text-sm">
          <p className="text-ink-muted">
            {t("regulatory.bulkAmend.selectionCount", {
              selected: selectedDrafts.length,
              total: drafts.length,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
            >
              {mutation.isPending
                ? t("common.processing")
                : t("regulatory.bulkAmend.submit", {
                    count: selectedDrafts.length,
                  })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
