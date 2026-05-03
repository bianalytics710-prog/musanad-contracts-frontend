/**
 * PaymentScheduleTab (S2) — Read-only milestone list inside ContractDetail.
 *
 * AC mapping:
 *   AC-S2-01: GET /contracts/:id/payment-schedules — ordered by dueDate ASC
 *             NULLS LAST then id ASC, no pagination.
 *   AC-S2-02: 404 surfaced via the data-state branches.
 *   AC-S2-03: 404 (NOT 403) when actor cannot see — layered defense.
 *   AC-S2-04: empty state — not an error — when contract has zero milestones.
 *   AC-S2-05: only is_active=true rows returned (server-side).
 *
 * "Edit" affordance opens the PaymentScheduleEditor modal (S3) when the
 * user has contract.edit. Defense-in-depth: BE is the truth.
 *
 * T4: loading / empty / error states all rendered.
 * T12: formatDate / formatDateTime for every date column (no inline new Date()).
 * T3: every string is t()-keyed; status + recurrence labels via the
 *     options namespace.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useContractPaymentSchedule } from "@/features/contracts/hooks/usePaymentSchedule";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import { translateApiError } from "@/lib/translate-api-error";
import { formatDate, formatDateTime } from "@/utils/datetime";
import { cn } from "@/lib/utils";
import { PaymentScheduleEditor } from "./PaymentScheduleEditor";
import type { PaymentSchedule } from "@/types/entities/payment-schedule.types";

interface PaymentScheduleTabProps {
  contractId: number;
  /** When true, contract is editable — show "Edit milestones" button. */
  canEdit: boolean;
}

export function PaymentScheduleTab({ contractId, canEdit }: PaymentScheduleTabProps) {
  const { t } = useTranslation();
  const [editorOpen, setEditorOpen] = useState(false);

  // Defense-in-depth — match canEdit prop with permission check.
  const canEditPermission = useAuthStore(selectHasPermission("contract.edit"));
  const showEdit = canEdit && canEditPermission;

  const { data, isLoading, isError, error, refetch } = useContractPaymentSchedule(contractId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-surface" aria-hidden="true" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-sm font-medium text-destructive">
            {error ? translateApiError(error, t) : t("common.error")}
          </p>
          <Button type="button" size="sm" onClick={() => void refetch()}>
            {t("common.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const rows = data?.data ?? [];

  return (
    <>
      <Card>
        <CardContent className="space-y-3 p-4">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">
                {t("contracts.paymentSchedule.title")}
              </h2>
              <p className="mt-1 text-xs text-ink-muted">
                {t("contracts.paymentSchedule.tabSubtitle", { count: rows.length })}
              </p>
            </div>
            {showEdit && (
              <Button type="button" size="sm" variant="outline" onClick={() => setEditorOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />
                {t("contracts.paymentSchedule.editButton")}
              </Button>
            )}
          </header>

          {rows.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center">
              <h3 className="text-sm font-semibold text-ink">
                {t("contracts.paymentSchedule.emptyTitle")}
              </h3>
              <p className="mt-1 text-xs text-ink-muted">
                {t("contracts.paymentSchedule.emptyDescription")}
              </p>
              {showEdit && (
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  onClick={() => setEditorOpen(true)}
                >
                  {t("contracts.paymentSchedule.addFirst")}
                </Button>
              )}
            </div>
          ) : (
            <ScheduleTable rows={rows} />
          )}
        </CardContent>
      </Card>

      {editorOpen && (
        <PaymentScheduleEditor
          contractId={contractId}
          initialRows={rows}
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </>
  );
}

interface ScheduleTableProps {
  rows: PaymentSchedule[];
}

function ScheduleTable({ rows }: ScheduleTableProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-surface">
          <tr className="text-left">
            <th scope="col" className="px-3 py-2 text-xs font-medium text-ink-muted">
              {t("contracts.paymentSchedule.fields.milestoneLabelEn")}
            </th>
            <th scope="col" className="px-3 py-2 text-xs font-medium text-ink-muted">
              {t("contracts.paymentSchedule.fields.amountAed")}
            </th>
            <th scope="col" className="px-3 py-2 text-xs font-medium text-ink-muted">
              {t("contracts.paymentSchedule.fields.dueDate")}
            </th>
            <th scope="col" className="px-3 py-2 text-xs font-medium text-ink-muted">
              {t("contracts.paymentSchedule.fields.paidAt")}
            </th>
            <th scope="col" className="px-3 py-2 text-xs font-medium text-ink-muted">
              {t("contracts.paymentSchedule.fields.status")}
            </th>
            <th scope="col" className="px-3 py-2 text-xs font-medium text-ink-muted">
              {t("contracts.paymentSchedule.fields.recurrence")}
            </th>
            <th scope="col" className="px-3 py-2 text-xs font-medium text-ink-muted">
              {t("contracts.paymentSchedule.fields.invoiceRef")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const label =
              isAr && row.milestoneLabelAr ? row.milestoneLabelAr : row.milestoneLabelEn;
            return (
              <tr key={row.id} className="border-b border-border/60 hover:bg-surface/40">
                <td className="px-3 py-2">
                  <span className="font-medium text-ink">{label}</span>
                  {(row.milestoneNameEn || row.milestoneNameAr) && (
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      {isAr && row.milestoneNameAr ? row.milestoneNameAr : row.milestoneNameEn}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-ink-muted">
                  {row.amountAed.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-ink-muted">
                  {row.dueDate ? formatDate(row.dueDate) : "—"}
                </td>
                <td className="px-3 py-2 text-ink-muted">
                  {row.paidAt ? formatDateTime(row.paidAt) : "—"}
                </td>
                <td className="px-3 py-2">
                  <StatusPill status={row.status} />
                </td>
                <td className="px-3 py-2 text-ink-muted">
                  {row.recurrence
                    ? t(`contracts.paymentSchedule.recurrenceOptions.${row.recurrence}`, {
                        defaultValue: row.recurrence,
                      })
                    : "—"}
                </td>
                <td className="px-3 py-2 text-ink-muted">{row.invoiceRef ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface StatusPillProps {
  status: PaymentSchedule["status"];
}

function StatusPill({ status }: StatusPillProps) {
  const { t } = useTranslation();
  // Semantic-token color mapping. No raw hex / blue-500.
  const tone: Record<PaymentSchedule["status"], string> = {
    pending: "bg-surface text-ink-muted",
    due: "bg-amber-tint/60 text-amber-ink",
    paid: "bg-success-tint text-success-ink",
    overdue: "bg-terracotta-tint text-terracotta-ink",
    waived: "bg-surface text-ink-subtle",
    cancelled: "bg-surface text-ink-subtle",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone[status],
      )}
    >
      {t(`contracts.paymentSchedule.statusOptions.${status}`, { defaultValue: status })}
    </span>
  );
}

export default PaymentScheduleTab;
