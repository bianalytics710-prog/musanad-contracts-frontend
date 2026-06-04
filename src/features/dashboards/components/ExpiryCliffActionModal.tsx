/**
 * E-rev-3 polish — Expiry cliff drilldown modal.
 *
 * Opens when an executive clicks one of the three expiry-cliff bucket cards
 * on the Executive Insights view (next 30 / 60 / 90 days). Shows a table of
 * contracts in the bucket — Contract # / Title / Counterparty / Drafter — and
 * lets the user check N of M, then fires a renewal alert only to drafters of
 * the selected contracts.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ExpiringContractRow {
  contractId: string;
  contractNumber: string;
  titleEn: string | null;
  titleAr: string | null;
  counterpartyId: string | null;
  counterpartyName: string | null;
  drafterId: string | null;
  drafterName: string | null;
  drafterEmail: string | null;
  endDate: string;
  daysToExpiry: number;
}

interface ExpiringContractsResponse {
  success: boolean;
  data: { windowDays: number; asOf: string; rows: ExpiringContractRow[] };
}

interface Props {
  open: boolean;
  windowDays: 30 | 60 | 90;
  onClose: () => void;
}

export function ExpiryCliffActionModal({ open, windowDays, onClose }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["executive-expiring-contracts", windowDays, open],
    queryFn: async () => {
      const r = await apiClient.get<ExpiringContractsResponse>(
        `/api/v1/dashboards/executive/expiring-contracts`,
        { params: { windowDays } },
      );
      return r.data.data;
    },
    enabled: open,
    staleTime: 30_000,
  });

  // Reset selection whenever the modal opens or window changes
  useEffect(() => {
    setSelected(new Set());
  }, [open, windowDays]);

  const rows = data?.rows ?? [];
  const drafterIds = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      if (selected.has(r.contractId) && r.drafterId) s.add(r.drafterId);
    });
    return s;
  }, [rows, selected]);

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allChecked = rows.length > 0 && selected.size === rows.length;
  const someChecked = selected.size > 0 && !allChecked;
  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.contractId)));
  };

  const onSend = () => {
    if (selected.size === 0) return;
    const distinctDrafters = drafterIds.size;
    toast.success(
      t("dashboards.executive.expiryCliffs.toast.alertsQueued", {
        defaultValue:
          "Renewal alerts queued for {{d}} drafter(s) covering {{n}} contract(s).",
        d: String(distinctDrafters),
        n: String(selected.size),
      }),
    );
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-[920px]">
        <DialogHeader className="border-b border-border/60 bg-card px-6 py-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-terracotta" aria-hidden />
            <DialogTitle>
              {t("dashboards.executive.expiryCliffs.modal.title", {
                defaultValue: "Contracts expiring within {{w}} days",
                w: String(windowDays),
              })}
            </DialogTitle>
          </div>
          <DialogDescription>
            {t("dashboards.executive.expiryCliffs.modal.description", {
              defaultValue:
                "Review the contracts in this expiry window. Select the ones that need a renewal alert and the drafter(s) on those contracts will be notified.",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">
              {t("dashboards.executive.expiryCliffs.modal.loadFailed", {
                defaultValue: "Could not load expiring contracts.",
              })}
            </p>
          ) : rows.length === 0 ? (
            <p className="rounded-md border border-border bg-surface p-6 text-center text-sm text-ink-muted">
              {t("dashboards.executive.expiryCliffs.modal.empty", {
                defaultValue: "No contracts expiring in this window.",
              })}
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-subtle">
                  <th className="w-10 px-2 py-2">
                    <Checkbox
                      checked={allChecked ? true : someChecked ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                      aria-label={t("dashboards.executive.expiryCliffs.modal.selectAll", { defaultValue: "Select all" })}
                    />
                  </th>
                  <th className="px-2 py-2">
                    {t("dashboards.executive.expiryCliffs.modal.col.contract", { defaultValue: "Contract" })}
                  </th>
                  <th className="px-2 py-2">
                    {t("dashboards.executive.expiryCliffs.modal.col.counterparty", { defaultValue: "Counterparty" })}
                  </th>
                  <th className="px-2 py-2">
                    {t("dashboards.executive.expiryCliffs.modal.col.drafter", { defaultValue: "Drafter" })}
                  </th>
                  <th className="px-2 py-2 text-right">
                    {t("dashboards.executive.expiryCliffs.modal.col.endDate", { defaultValue: "Ends" })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isOn = selected.has(r.contractId);
                  return (
                    <tr
                      key={r.contractId}
                      className={cn(
                        "border-b border-border/40 transition-colors",
                        isOn ? "bg-terracotta/5" : "hover:bg-surface",
                      )}
                    >
                      <td className="px-2 py-2 align-top">
                        <Checkbox
                          checked={isOn}
                          onCheckedChange={() => toggleOne(r.contractId)}
                          aria-label={t("dashboards.executive.expiryCliffs.modal.selectRow", {
                            defaultValue: "Select {{n}}",
                            n: r.contractNumber,
                          })}
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div className="font-mono text-[11px] text-ink-muted">{r.contractNumber}</div>
                        <div className="text-sm text-ink">{r.titleEn ?? r.titleAr ?? "—"}</div>
                      </td>
                      <td className="px-2 py-2 align-top text-sm text-ink">
                        {r.counterpartyName ?? "—"}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div className="text-sm text-ink">{r.drafterName ?? "—"}</div>
                        {r.drafterEmail && (
                          <div className="font-mono text-[11px] text-ink-subtle">{r.drafterEmail}</div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right align-top">
                        <div className="font-mono text-xs text-ink">{r.endDate}</div>
                        <div className="font-mono text-[11px] text-ink-subtle">
                          {t("dashboards.executive.expiryCliffs.modal.daysSuffix", {
                            defaultValue: "in {{d}}d",
                            d: String(r.daysToExpiry),
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="border-t border-border/60 bg-card px-6 py-3">
          <div className="mr-auto text-xs text-ink-muted">
            {t("dashboards.executive.expiryCliffs.modal.selectionSummary", {
              defaultValue: "{{n}} of {{m}} selected · {{d}} unique drafter(s)",
              n: String(selected.size),
              m: String(rows.length),
              d: String(drafterIds.size),
            })}
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="button"
            onClick={onSend}
            disabled={selected.size === 0 || drafterIds.size === 0}
          >
            {t("dashboards.executive.expiryCliffs.modal.sendAlerts", {
              defaultValue: "Send alerts to {{d}} drafter(s)",
              d: String(drafterIds.size),
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
