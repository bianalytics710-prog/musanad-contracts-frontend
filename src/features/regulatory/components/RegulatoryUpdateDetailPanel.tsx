/**
 * RegulatoryUpdateDetailPanel (S7) — side panel shown when a regulatory_update
 * is selected on the radar (S6).
 *
 * Mode: regenerate. Lovable's `regulations.radar.tsx` (539L) embedded the
 * detail rendering inline; v2.6 surfaces it as a dedicated component that
 * consumes fn_regulatory_update_get_by_id (Section 3.4) including the
 * impactSummary aggregate (totalImpacts / resolvedCount / pendingCount /
 * avgImpactScore — AC-S7-02..04, RLS-aware AC-S7-05).
 *
 * Hosts:
 *   - "AI explain" / "AI amendment" actions → RegulatoryImpactPanel (M4)
 *     with sampleContracts populated from the impact list (closes
 *     M4-FE-OI-3 — REG-OI-C).
 *   - "Bulk amend" action → opens BulkAmendmentSheet (S11) for the impacted
 *     contracts.
 *   - Edit / delete actions for legal_counsel + platform_admin.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Edit3, Trash2, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translateApiError } from "@/lib/translate-api-error";
import { formatDate } from "@/utils/datetime";
import { selectHasPermission, useAuthStore } from "@/store/auth.store";
import {
  useRegulatoryImpactList,
  useRegulatoryUpdateById,
} from "@/features/regulatory/hooks/useRegulatory";
import type {
  RegulatoryImpact,
  RegulatorySeverity,
} from "@/types/entities/regulatory.types";
import { RegulatoryUpdateEditForm } from "./RegulatoryUpdateEditForm";
import { RegulatoryUpdateDeleteConfirmDialog } from "./RegulatoryUpdateDeleteConfirmDialog";
import { BulkAmendmentSheet } from "./BulkAmendmentSheet";

interface Props {
  regulatoryUpdateId: number;
  onClose: () => void;
}

const SEVERITY_CLASS: Record<RegulatorySeverity, string> = {
  critical: "bg-terracotta-tint/40 text-terracotta-ink border-terracotta/30",
  high: "bg-amber-tint/40 text-amber-ink border-amber/30",
  medium: "bg-amber-tint/30 text-ink border-border",
  low: "bg-muted/40 text-ink-muted border-border",
};

export function RegulatoryUpdateDetailPanel({
  regulatoryUpdateId,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const canManage = useAuthStore(selectHasPermission("regulations.manage"));
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const { data, isLoading, isError, error } = useRegulatoryUpdateById(
    regulatoryUpdateId,
  );

  // Pull associated impacts (FE handles RLS server-side)
  const { data: impactsData } = useRegulatoryImpactList({
    regulatoryUpdateId,
    limit: 50,
  });
  const impacts = useMemo<RegulatoryImpact[]>(
    () => impactsData?.data ?? [],
    [impactsData],
  );

  return (
    <aside
      role="complementary"
      aria-label={t("regulatory.regulatoryUpdate.detail.ariaLabel")}
      className="flex h-full w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-ink">
            {data?.titleEn ??
              t("regulatory.regulatoryUpdate.detail.loading")}
          </h2>
          {data?.severity && (
            <span
              className={`mt-1 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${SEVERITY_CLASS[data.severity]}`}
            >
              {t(`regulatory.regulatoryUpdate.severity.${data.severity}`)}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-sm">
        {isError ? (
          <div
            role="alert"
            className="rounded-md border border-terracotta/30 bg-terracotta-tint/30 p-3 text-terracotta-ink"
          >
            {translateApiError(error, t)}
          </div>
        ) : isLoading || !data ? (
          <div role="status" aria-busy="true" className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 w-full animate-pulse rounded-md bg-muted/30"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {data.titleAr && (
              <p
                dir="rtl"
                lang="ar"
                className="text-base font-medium text-ink"
              >
                {data.titleAr}
              </p>
            )}

            <DetailRow
              label={t("regulatory.regulatoryUpdate.fields.regulator")}
              value={`${data.regulator.code} — ${data.regulator.nameEn}`}
            />
            <DetailRow
              label={t("regulatory.regulatoryUpdate.fields.publishedDate")}
              value={formatDate(data.publishedDate)}
            />
            <DetailRow
              label={t("regulatory.regulatoryUpdate.fields.effectiveDate")}
              value={formatDate(data.effectiveDate)}
            />
            <DetailRow
              label={t("regulatory.regulatoryUpdate.fields.complianceDeadline")}
              value={formatDate(data.complianceDeadline)}
            />
            {data.referenceNumber && (
              <DetailRow
                label={t("regulatory.regulatoryUpdate.fields.referenceNumber")}
                value={data.referenceNumber}
                mono
              />
            )}
            {data.category && (
              <DetailRow
                label={t("regulatory.regulatoryUpdate.fields.category")}
                value={data.category.nameEn}
              />
            )}

            {(data.summaryEn || data.summaryAr) && (
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {t("regulatory.regulatoryUpdate.fields.summary")}
                </h3>
                {data.summaryEn && (
                  <p className="whitespace-pre-wrap text-ink">
                    {data.summaryEn}
                  </p>
                )}
                {data.summaryAr && (
                  <p
                    dir="rtl"
                    lang="ar"
                    className="mt-2 whitespace-pre-wrap text-ink"
                  >
                    {data.summaryAr}
                  </p>
                )}
              </section>
            )}

            {data.affectedClauseCategories.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {t(
                    "regulatory.regulatoryUpdate.fields.affectedClauseCategories",
                  )}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {data.affectedClauseCategories.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-ink-muted"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {data.sourceUrl && (
              <a
                href={data.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-gold hover:underline"
              >
                {t("regulatory.regulatoryUpdate.openSource")}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            {/* Impact summary aggregate — AC-S7-02..04 */}
            <section className="rounded-lg border border-border bg-muted/20 p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t("regulatory.regulatoryUpdate.detail.impactSummary")}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Stat
                  label={t(
                    "regulatory.regulatoryUpdate.detail.totalImpacts",
                  )}
                  value={data.impactSummary.totalImpacts.toString()}
                />
                <Stat
                  label={t("regulatory.regulatoryUpdate.detail.pendingCount")}
                  value={data.impactSummary.pendingCount.toString()}
                />
                <Stat
                  label={t("regulatory.regulatoryUpdate.detail.resolvedCount")}
                  value={data.impactSummary.resolvedCount.toString()}
                />
                <Stat
                  label={t("regulatory.regulatoryUpdate.detail.avgImpactScore")}
                  value={
                    data.impactSummary.avgImpactScore !== null
                      ? data.impactSummary.avgImpactScore.toFixed(1)
                      : "—"
                  }
                />
              </div>
            </section>
          </div>
        )}
      </div>

      {data && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border p-3">
          {canManage && impacts.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setBulkOpen(true)}
            >
              <Wand2 className="h-4 w-4" />
              {t("regulatory.regulatoryUpdate.detail.bulkAmend")}
            </Button>
          )}
          {canManage && (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditOpen(true)}
              >
                <Edit3 className="h-4 w-4" />
                {t("common.edit")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                {t("common.delete")}
              </Button>
            </>
          )}
        </div>
      )}

      {data && editOpen && (
        <RegulatoryUpdateEditForm
          regulatoryUpdateId={data.id}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
      {data && deleteOpen && (
        <RegulatoryUpdateDeleteConfirmDialog
          regulatoryUpdate={data}
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
        />
      )}
      {data && bulkOpen && impacts.length > 0 && (
        <BulkAmendmentSheet
          regulatoryUpdate={data}
          impacts={impacts}
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
        />
      )}
    </aside>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-start gap-2">
      <dt className="text-xs uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className={`text-ink ${mono ? "font-mono text-xs" : ""}`}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-ink-muted">{label}</p>
      <p className="font-mono text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
