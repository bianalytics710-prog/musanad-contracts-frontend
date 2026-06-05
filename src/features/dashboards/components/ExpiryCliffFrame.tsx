/**
 * Inline collapsible Expiry-Cliff frame (mig 554..557).
 *
 * Renders below the tile strip when an executive opens a 30/60/90-day cliff.
 * Features:
 *
 *   • Sortable Value + Ends headers (asc/desc/off cycle)
 *   • Three dropdown filters — Escalation / Drafter / Counterparty
 *   • Columns: checkbox · contract · counterparty · VALUE · drafter · ends · status
 *   • Already-escalated rows get a darker amber tint + "Escalated" badge.
 *     They remain selectable (clicking Send escalates again) — the badge is
 *     informational only.
 *   • Confirm modal with optional note; on success, query is invalidated.
 *
 * Single-frame-at-a-time: opening another tile closes this one (parent state).
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  CalendarClock,
  X,
  Search,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/datetime";
import {
  expiryCliffService,
  type ExpiringContractRow,
} from "@/services/api/expiry-cliff.service";
import { formatAedCompact } from "./dashboard-primitives";

type WindowDays = 30 | 60 | 90;
type EscalationFilter = "all" | "open" | "escalated";
type SortKey = "value" | "endDate";
type SortDir = "asc" | "desc";

interface Props {
  windowDays: WindowDays;
  onClose: () => void;
}

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function ExpiryCliffFrame({ windowDays, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["executive-expiring-contracts", windowDays],
    queryFn: () => expiryCliffService.list(windowDays),
    staleTime: 30_000,
  });
  const rows = data?.rows ?? [];

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [escalationFilter, setEscalationFilter] = useState<EscalationFilter>("all");
  const [drafterFilter, setDrafterFilter] = useState<string>("all");
  const [counterpartyFilter, setCounterpartyFilter] = useState<string>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [note, setNote] = useState("");

  // Reset state when switching cliffs
  useEffect(() => {
    setSelected(new Set());
    setSearch("");
    setEscalationFilter("all");
    setDrafterFilter("all");
    setCounterpartyFilter("all");
    setSort(null);
    setNote("");
  }, [windowDays]);

  // Distinct dropdown options derived from the loaded rows
  const drafterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach((r) => {
      if (r.drafterName) seen.set(r.drafterName, r.drafterName);
    });
    return Array.from(seen.keys()).sort();
  }, [rows]);

  const counterpartyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach((r) => {
      if (r.counterpartyName) seen.set(r.counterpartyName, r.counterpartyName);
    });
    return Array.from(seen.keys()).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (escalationFilter === "open" && r.escalatedAt) return false;
      if (escalationFilter === "escalated" && !r.escalatedAt) return false;
      if (drafterFilter !== "all" && r.drafterName !== drafterFilter) return false;
      if (
        counterpartyFilter !== "all" &&
        r.counterpartyName !== counterpartyFilter
      )
        return false;
      if (!q) return true;
      const hay = [
        r.contractNumber,
        r.titleEn ?? "",
        r.titleAr ?? "",
        r.counterpartyName ?? "",
        r.drafterName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    if (!sort) return filtered;
    const sorted = [...filtered].sort((a, b) => {
      let av: number, bv: number;
      if (sort.key === "value") {
        av = Number(a.valueAed ?? 0);
        bv = Number(b.valueAed ?? 0);
      } else {
        av = new Date(a.endDate).getTime();
        bv = new Date(b.endDate).getTime();
      }
      return sort.dir === "asc" ? av - bv : bv - av;
    });
    return sorted;
  }, [
    rows,
    debouncedSearch,
    escalationFilter,
    drafterFilter,
    counterpartyFilter,
    sort,
  ]);

  // A row is non-selectable only when there's no drafter to notify.
  // Already-escalated rows are still selectable — sending again is allowed.
  const isRowDisabled = (r: ExpiringContractRow): boolean => !r.drafterId;

  const selectableRows = filteredRows.filter((r) => !isRowDisabled(r));
  const allChecked =
    selectableRows.length > 0 &&
    selectableRows.every((r) => selected.has(r.contractId));
  const someChecked =
    selectableRows.some((r) => selected.has(r.contractId)) && !allChecked;

  const distinctDrafterIds = useMemo(() => {
    const s = new Set<string>();
    filteredRows.forEach((r) => {
      if (selected.has(r.contractId) && r.drafterId) s.add(r.drafterId);
    });
    return s;
  }, [filteredRows, selected]);

  const toggleOne = (r: ExpiringContractRow) => {
    if (isRowDisabled(r)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(r.contractId)) next.delete(r.contractId);
      else next.add(r.contractId);
      return next;
    });
  };

  const toggleAll = () => {
    if (allChecked) {
      setSelected((prev) => {
        const next = new Set(prev);
        selectableRows.forEach((r) => next.delete(r.contractId));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        selectableRows.forEach((r) => next.add(r.contractId));
        return next;
      });
    }
  };

  // Cycle: off → asc → desc → off
  const cycleSort = (key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (!sort || sort.key !== k)
      return <ChevronsUpDown className="h-3 w-3 opacity-50" aria-hidden />;
    return sort.dir === "asc" ? (
      <ChevronUp className="h-3 w-3" aria-hidden />
    ) : (
      <ChevronDown className="h-3 w-3" aria-hidden />
    );
  };

  const escalateMutation = useMutation({
    mutationFn: (params: { contractIds: number[]; note?: string }) =>
      expiryCliffService.escalate({
        contractIds: params.contractIds,
        windowDays,
        note: params.note,
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({
        queryKey: ["executive-expiring-contracts", windowDays],
      });
      setSelected(new Set());
      setConfirmOpen(false);
      setNote("");
      const msgKey =
        result.skipped > 0
          ? "dashboards.executive.expiryCliffs.frame.toast.sentWithSkipped"
          : "dashboards.executive.expiryCliffs.frame.toast.sent";
      toast.success(
        t(msgKey, {
          defaultValue:
            result.skipped > 0
              ? "Sent {{sent}} renewal alert(s) · skipped {{skipped}}."
              : "Sent {{sent}} renewal alert(s) to drafters.",
          sent: String(result.sent),
          skipped: String(result.skipped),
        }),
      );
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Failed to send renewal alerts.";
      toast.error(msg);
    },
  });

  const onSendClick = () => {
    if (selected.size === 0 || distinctDrafterIds.size === 0) return;
    setConfirmOpen(true);
  };

  const onConfirmSend = () => {
    const ids = Array.from(selected).map((s) => Number(s));
    escalateMutation.mutate({
      contractIds: ids,
      note: note.trim() || undefined,
    });
  };

  return (
    <AnimatePresence initial={false}>
      <motion.section
        key={windowDays}
        aria-label={t("dashboards.executive.expiryCliffs.frame.regionLabel", {
          defaultValue: "Expiring contracts — {{w}} days",
          w: String(windowDays),
        })}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="overflow-hidden rounded-lg border border-border bg-card"
      >
        <header className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-terracotta" aria-hidden />
            <h3 className="text-sm font-semibold text-ink">
              {t("dashboards.executive.expiryCliffs.frame.title", {
                defaultValue: "Contracts expiring within {{w}} days",
                w: String(windowDays),
              })}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("dashboards.executive.expiryCliffs.frame.closeAria", {
              defaultValue: "Close expiry frame",
            })}
            className="rounded p-1 text-ink-subtle hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        {/* Search + 3 dropdown filters */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 bg-surface/40 px-4 py-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(
                "dashboards.executive.expiryCliffs.frame.searchPlaceholder",
                {
                  defaultValue: "Search contract, counterparty, drafter…",
                },
              )}
              className="w-full rounded-md border border-border bg-card pl-8 pr-2 py-1.5 text-sm focus:border-gold focus:outline-none"
            />
          </div>

          <FilterDropdown
            label={t(
              "dashboards.executive.expiryCliffs.frame.filterLabel.escalation",
              { defaultValue: "Escalation" },
            )}
            value={escalationFilter}
            onChange={(v) => setEscalationFilter(v as EscalationFilter)}
            options={[
              {
                value: "all",
                label: t("dashboards.executive.expiryCliffs.frame.filter.all", {
                  defaultValue: "All",
                }),
              },
              {
                value: "open",
                label: t("dashboards.executive.expiryCliffs.frame.filter.open", {
                  defaultValue: "Not escalated",
                }),
              },
              {
                value: "escalated",
                label: t(
                  "dashboards.executive.expiryCliffs.frame.filter.escalated",
                  { defaultValue: "Escalated" },
                ),
              },
            ]}
          />

          <FilterDropdown
            label={t(
              "dashboards.executive.expiryCliffs.frame.filterLabel.drafter",
              { defaultValue: "Drafter" },
            )}
            value={drafterFilter}
            onChange={setDrafterFilter}
            options={[
              {
                value: "all",
                label: t("dashboards.executive.expiryCliffs.frame.filter.all", {
                  defaultValue: "All",
                }),
              },
              ...drafterOptions.map((d) => ({ value: d, label: d })),
            ]}
          />

          <FilterDropdown
            label={t(
              "dashboards.executive.expiryCliffs.frame.filterLabel.counterparty",
              { defaultValue: "Counterparty" },
            )}
            value={counterpartyFilter}
            onChange={setCounterpartyFilter}
            options={[
              {
                value: "all",
                label: t("dashboards.executive.expiryCliffs.frame.filter.all", {
                  defaultValue: "All",
                }),
              },
              ...counterpartyOptions.map((c) => ({ value: c, label: c })),
            ]}
          />
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-4 py-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">
              {(error as Error)?.message ??
                t(
                  "dashboards.executive.expiryCliffs.frame.loadFailed",
                  { defaultValue: "Could not load expiring contracts." },
                )}
            </p>
          ) : filteredRows.length === 0 ? (
            <p className="rounded-md border border-border bg-surface p-6 text-center text-sm text-ink-muted">
              {rows.length === 0
                ? t("dashboards.executive.expiryCliffs.frame.empty", {
                    defaultValue: "No contracts expiring in this window.",
                  })
                : t("dashboards.executive.expiryCliffs.frame.emptyFiltered", {
                    defaultValue: "No contracts match your filter.",
                  })}
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-subtle">
                  <th scope="col" className="w-10 px-2 py-2">
                    <Checkbox
                      checked={allChecked ? true : someChecked ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                      disabled={selectableRows.length === 0}
                      aria-label={t(
                        "dashboards.executive.expiryCliffs.frame.selectAll",
                        { defaultValue: "Select all rows" },
                      )}
                    />
                  </th>
                  <th scope="col" className="px-2 py-2">
                    {t("dashboards.executive.expiryCliffs.frame.col.contract", {
                      defaultValue: "Contract",
                    })}
                  </th>
                  <th scope="col" className="px-2 py-2">
                    {t(
                      "dashboards.executive.expiryCliffs.frame.col.counterparty",
                      { defaultValue: "Counterparty" },
                    )}
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => cycleSort("value")}
                      className="inline-flex items-center gap-1 uppercase tracking-wider text-ink-subtle hover:text-ink"
                    >
                      {t("dashboards.executive.expiryCliffs.frame.col.value", {
                        defaultValue: "Value",
                      })}
                      <SortIcon k="value" />
                    </button>
                  </th>
                  <th scope="col" className="px-2 py-2">
                    {t("dashboards.executive.expiryCliffs.frame.col.drafter", {
                      defaultValue: "Drafter",
                    })}
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => cycleSort("endDate")}
                      className="inline-flex items-center gap-1 uppercase tracking-wider text-ink-subtle hover:text-ink"
                    >
                      {t("dashboards.executive.expiryCliffs.frame.col.endDate", {
                        defaultValue: "Ends",
                      })}
                      <SortIcon k="endDate" />
                    </button>
                  </th>
                  <th scope="col" className="px-2 py-2">
                    {t("dashboards.executive.expiryCliffs.frame.col.status", {
                      defaultValue: "Status",
                    })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const disabled = isRowDisabled(r);
                  const isEscalated = !!r.escalatedAt;
                  const isOn = selected.has(r.contractId);
                  const escalatedTooltip = isEscalated
                    ? t(
                        "dashboards.executive.expiryCliffs.frame.tip.alreadyEscalated",
                        {
                          defaultValue: "Last escalated {{when}} by {{who}}.",
                          when: r.escalatedAt
                            ? formatDateTime(r.escalatedAt)
                            : "—",
                          who: r.escalatedByName ?? "—",
                        },
                      )
                    : undefined;
                  return (
                    <tr
                      key={r.contractId}
                      className={cn(
                        "border-b border-border/40 transition-colors",
                        isOn
                          ? "bg-terracotta/5"
                          : isEscalated
                            ? "bg-amber/15"
                            : "hover:bg-surface",
                        disabled && "opacity-60",
                      )}
                    >
                      <td className="px-2 py-2 align-top">
                        <Checkbox
                          checked={isOn}
                          onCheckedChange={() => toggleOne(r)}
                          disabled={disabled}
                          aria-label={t(
                            "dashboards.executive.expiryCliffs.frame.selectRow",
                            {
                              defaultValue: "Select {{n}}",
                              n: r.contractNumber,
                            },
                          )}
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div className="font-mono text-[11px] text-ink-muted">
                          {r.contractNumber}
                        </div>
                        <div className="text-sm text-ink">
                          {r.titleEn ?? r.titleAr ?? "—"}
                        </div>
                      </td>
                      <td className="px-2 py-2 align-top text-sm text-ink">
                        {r.counterpartyName ?? "—"}
                      </td>
                      <td className="px-2 py-2 align-top text-right">
                        {r.valueAed != null && Number(r.valueAed) > 0 ? (
                          <span className="font-mono text-sm text-ink">
                            {formatAedCompact(Number(r.valueAed))}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-subtle">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top">
                        {r.drafterName ? (
                          <>
                            <div className="text-sm text-ink">{r.drafterName}</div>
                            {r.drafterEmail && (
                              <div className="font-mono text-[11px] text-ink-subtle">
                                {r.drafterEmail}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-sm italic text-ink-subtle">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top text-right">
                        <div className="font-mono text-xs text-ink">
                          {r.endDate}
                        </div>
                        <div className="font-mono text-[11px] text-ink-subtle">
                          {t(
                            "dashboards.executive.expiryCliffs.frame.daysSuffix",
                            {
                              defaultValue: "in {{d}}d",
                              d: String(r.daysToExpiry),
                            },
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 align-top">
                        {isEscalated ? (
                          <span
                            title={escalatedTooltip}
                            className="inline-flex items-center gap-1 rounded-full bg-amber/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber"
                          >
                            <CheckCircle2 className="h-3 w-3" aria-hidden />
                            {t(
                              "dashboards.executive.expiryCliffs.frame.badge.escalated",
                              { defaultValue: "Escalated" },
                            )}
                          </span>
                        ) : (
                          <span className="text-[11px] text-ink-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t border-border/60 bg-card px-4 py-3">
          <div className="mr-auto text-xs text-ink-muted">
            {t("dashboards.executive.expiryCliffs.frame.selectionSummary", {
              defaultValue: "{{n}} of {{m}} selected · {{d}} unique drafter(s)",
              n: String(selected.size),
              m: String(filteredRows.length),
              d: String(distinctDrafterIds.size),
            })}
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.close", { defaultValue: "Close" })}
          </Button>
          <Button
            type="button"
            onClick={onSendClick}
            disabled={
              selected.size === 0 ||
              distinctDrafterIds.size === 0 ||
              escalateMutation.isPending
            }
          >
            {t("dashboards.executive.expiryCliffs.frame.sendAlerts", {
              defaultValue: "Send renewal alerts ({{d}})",
              d: String(distinctDrafterIds.size),
            })}
          </Button>
        </footer>

        <Dialog
          open={confirmOpen}
          onOpenChange={(o) => !o && setConfirmOpen(false)}
        >
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>
                {t("dashboards.executive.expiryCliffs.frame.confirm.title", {
                  defaultValue: "Send renewal alerts",
                })}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "dashboards.executive.expiryCliffs.frame.confirm.description",
                  {
                    defaultValue:
                      "{{n}} contract(s) will trigger in-app alerts to {{d}} drafter(s). You can add an optional note.",
                    n: String(selected.size),
                    d: String(distinctDrafterIds.size),
                  },
                )}
              </DialogDescription>
            </DialogHeader>
            <label className="block text-xs font-medium text-ink-muted">
              {t(
                "dashboards.executive.expiryCliffs.frame.confirm.noteLabel",
                { defaultValue: "Note (optional)" },
              )}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                rows={3}
                maxLength={500}
                placeholder={t(
                  "dashboards.executive.expiryCliffs.frame.confirm.notePlaceholder",
                  { defaultValue: "e.g. Please prepare renewal terms by Friday." },
                )}
                className="mt-1 w-full rounded-md border border-border bg-card p-2 text-sm focus:border-gold focus:outline-none"
              />
              <span className="text-[10px] text-ink-subtle">{note.length}/500</span>
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </Button>
              <Button
                type="button"
                onClick={onConfirmSend}
                disabled={escalateMutation.isPending}
              >
                {escalateMutation.isPending
                  ? t("common.sending", { defaultValue: "Sending…" })
                  : t("dashboards.executive.expiryCliffs.frame.confirm.send", {
                      defaultValue: "Send alerts",
                    })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.section>
    </AnimatePresence>
  );
}

// ─── FilterDropdown — small native-select wrapper ──────────────────────
function FilterDropdown({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-card px-2 py-1 text-xs font-normal normal-case text-ink focus:border-gold focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
