/**
 * Phase A (mig 640, 2026-06-13) — Unified My Work inbox for non-drafter
 * personas (Legal Counsel + Contract Approver, and ready for Compliance /
 * Procurement / Finance when we widen later).
 *
 * Reads from /api/v1/my-work (useMyWorkUnified) which UNIONs five sources:
 *   - work_order  (materialised; today only drafters get these, but the
 *                  branch is included so LC / Approver get parity if they
 *                  ever do)
 *   - approval_step (their pending approval queue)
 *   - risk_case   (anything routed to them by the risk-routing matrix)
 *   - tpa_review  (Legal Counsel only — role-scoped server-side)
 *   - advisory_draft (assigned by template's approver_role)
 *
 * Why this lives next to MyWorkInbox instead of in it: the drafter inbox
 * carries persona-specific concerns (stage dropdown, Compose-draft wizard
 * entry, "Add to my queue" manual flow) that don't apply here. Sharing
 * would mean threading a dozen flags through one component. Same table
 * styling, separate component, simpler call sites.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Search, ArrowRight } from "lucide-react";
import { useMyWorkUnified } from "../hooks/useWorkOrders";
import type { MyWorkRow, MyWorkType } from "@/services/api/my-work.service";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 20;

/** Type filter options — superset of the drafter's three types. */
const TYPE_OPTIONS: Array<{ value: "all" | MyWorkType; labelKey: string; labelDefault: string }> = [
  { value: "all",                     labelKey: "myWork.filters.allTypes",                labelDefault: "All types" },
  { value: "approval_awaiting",       labelKey: "myWork.types.approval_awaiting",         labelDefault: "Approval awaiting" },
  { value: "risk_case_assigned",      labelKey: "myWork.types.risk_case_assigned",        labelDefault: "Risk case" },
  { value: "third_party_review",      labelKey: "myWork.types.third_party_review",        labelDefault: "Third-party review" },
  { value: "advisory_draft",          labelKey: "myWork.types.advisory_draft",            labelDefault: "Advisory draft" },
  { value: "contract_draft_request",  labelKey: "myWork.types.contract_draft_request",    labelDefault: "Draft request" },
  { value: "contract_returned",       labelKey: "myWork.types.contract_returned",         labelDefault: "Returned" },
  { value: "comment_response",        labelKey: "myWork.types.comment_response",          labelDefault: "Comment" },
];

/** Tone classes for the type pill — matches the i18n key conventions. */
const TYPE_TONE: Record<string, string> = {
  approval_awaiting:      "bg-[var(--sage)]/15 text-[var(--sage)]",
  risk_case_assigned:     "bg-[var(--terracotta)]/15 text-[var(--terracotta)]",
  third_party_review:     "bg-[var(--gold)]/15 text-foreground",
  advisory_draft:         "bg-blue-500/10 text-blue-700",
  contract_draft_request: "bg-surface text-ink-muted",
  contract_returned:      "bg-[var(--terracotta)]/10 text-[var(--terracotta)]",
  comment_response:       "bg-surface text-ink-muted",
};

const PRIORITY_TONE: Record<string, string> = {
  urgent: "bg-[var(--terracotta)]/15 text-[var(--terracotta)] border-[var(--terracotta)]/40",
  high:   "bg-[var(--gold)]/15 text-foreground border-[var(--gold)]/40",
  normal: "bg-muted text-muted-foreground border-transparent",
  low:    "bg-muted/60 text-muted-foreground/80 border-transparent",
};

function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleDateString("en-CA");
}

/**
 * Action button label per row type. Synthesized rows navigate to the source
 * page (actionUrl); materialised work_order rows would ordinarily use the
 * drafter's stage-aware logic, but for LC / Approver they're rare and the
 * actionUrl fallback is enough.
 */
function actionLabelKey(workOrderType: MyWorkType): { key: string; def: string } {
  switch (workOrderType) {
    case "approval_awaiting":       return { key: "myWork.actions.decide",         def: "Decide" };
    case "risk_case_assigned":      return { key: "myWork.actions.review",         def: "Review" };
    case "third_party_review":      return { key: "myWork.actions.openTpa",        def: "Open review" };
    case "advisory_draft":          return { key: "myWork.actions.openAdvisory",   def: "Open draft" };
    case "contract_draft_request":  return { key: "myWork.actions.composeDraft",   def: "Compose draft" };
    case "contract_returned":       return { key: "myWork.actions.editDraft",      def: "Edit draft" };
    case "comment_response":        return { key: "myWork.actions.open",           def: "Open" };
    default:                        return { key: "myWork.actions.open",           def: "Open" };
  }
}

export function MyWorkUnifiedInbox() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | MyWorkType>("all");
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [typeFilter, search]);

  const listQuery = useMyWorkUnified({
    type: typeFilter === "all" ? undefined : [typeFilter],
    search: search.trim() || undefined,
    limit: PAGE_SIZE,
    page,
  });

  const rows: MyWorkRow[] = listQuery.data?.data ?? [];
  const totalPages = Math.max(1, listQuery.data?.totalPages ?? 1);
  const totalCount = listQuery.data?.totalCount ?? rows.length;
  const pageSize  = listQuery.data?.pageSize ?? PAGE_SIZE;

  const handleAction = (row: MyWorkRow) => {
    // TanStack Router's typed navigate is strict, so route the wildcard via window history.
    // Within the same SPA both behave identically; this avoids a dozen route-type-imports.
    if (row.actionUrl) {
      void navigate({ to: row.actionUrl as never });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("myWork.title", { defaultValue: "My Work" })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("myWork.unifiedSubtitle", {
            defaultValue: "Everything routed to you — approvals, risk cases, third-party reviews and advisory drafts.",
          })}
        </p>
      </div>

      {/* Toolbar */}
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("myWork.searchPlaceholder", {
                defaultValue: "Search counterparty, contract number…",
              })}
              className="ps-7"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "all" | MyWorkType)}
            aria-label={t("myWork.filters.typeLabel", { defaultValue: "Filter by type" })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey, { defaultValue: o.labelDefault })}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : listQuery.isError ? (
            <p className="p-6 text-sm text-[var(--terracotta)]">
              {t("myWork.loadError", { defaultValue: "Couldn't load your queue. Try again." })}
            </p>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-muted-foreground">
                {t("myWork.empty", { defaultValue: "Your queue is empty." })}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface">
                  <tr className="text-left">
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("myWork.columns.request", { defaultValue: "Request" })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("myWork.columns.type", { defaultValue: "Type" })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("myWork.columns.priority", { defaultValue: "Priority" })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("myWork.columns.from", { defaultValue: "From" })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("myWork.columns.created", { defaultValue: "Created" })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle text-center">
                      {t("myWork.columns.action", { defaultValue: "Action" })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((wo) => {
                    const sourceTitle = isAr ? wo.sourceContractTitleAr : wo.sourceContractTitleEn;
                    const counterparty = wo.counterpartyName;
                    const payloadAny = (wo.payload ?? {}) as Record<string, unknown>;
                    const advisoryDraftType = payloadAny.draftType as string | undefined;
                    const riskCaseTitle    = payloadAny.title       as string | undefined;
                    const headline =
                      wo.workOrderType === "risk_case_assigned"
                        ? (riskCaseTitle ?? sourceTitle ?? "—")
                        : wo.workOrderType === "third_party_review"
                        ? (sourceTitle ?? wo.sourceContractNumber ?? "—")
                        : wo.workOrderType === "advisory_draft"
                        ? (advisoryDraftType ?? sourceTitle ?? "—")
                        : (counterparty ?? sourceTitle ?? wo.sourceContractNumber ?? "—");
                    const subtitle =
                      wo.sourceContractNumber && wo.workOrderType !== "third_party_review"
                        ? `${wo.sourceContractNumber}${sourceTitle ? " · " + sourceTitle : ""}`
                        : wo.workOrderType === "third_party_review" && wo.counterpartyName
                        ? wo.counterpartyName
                        : null;
                    const action = actionLabelKey(wo.workOrderType as MyWorkType);
                    const priorityTone = PRIORITY_TONE[wo.priority] ?? PRIORITY_TONE.normal;
                    const typeTone     = TYPE_TONE[wo.workOrderType] ?? "bg-surface text-ink-muted";

                    return (
                      <tr key={wo.id} className="group border-b border-border/60 transition-colors hover:bg-surface/50">
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-ink line-clamp-2">{headline}</div>
                          {subtitle && (
                            <div className="text-xs text-ink-muted line-clamp-1">{subtitle}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-ink-muted">
                          <span className={`rounded-md px-2 py-0.5 font-mono text-[11px] tracking-wider ${typeTone}`}>
                            {t(`myWork.types.${wo.workOrderType}`, { defaultValue: wo.workOrderType })}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${priorityTone}`}>
                            {t(`myWork.priorities.${wo.priority}`, { defaultValue: wo.priority })}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-ink/80">{wo.assignedByName ?? "—"}</td>
                        <td className="px-4 py-3 align-top text-ink-muted whitespace-nowrap font-mono text-xs">
                          {formatDate(wo.createdAt)}
                        </td>
                        <td className="px-4 py-3 align-top text-center">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleAction(wo)}
                            data-testid={`mywork-action-${wo.id}`}
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                            {t(action.key, { defaultValue: action.def })}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("myWork.pagination.range", {
            defaultValue: "{{from}}–{{to}} of {{total}}",
            from: rows.length ? (page - 1) * pageSize + 1 : 0,
            to:   (page - 1) * pageSize + rows.length,
            total: totalCount,
          })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t("common.prev", { defaultValue: "Prev" })}
          </Button>
          <span className="font-mono">{page} / {totalPages}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("common.next", { defaultValue: "Next" })}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default MyWorkUnifiedInbox;
