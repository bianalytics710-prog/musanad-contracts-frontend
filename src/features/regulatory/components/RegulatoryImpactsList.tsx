/**
 * RegulatoryImpactsList (S12) — list of regulatory_impact rows for a given
 * scope (contract / regulation / regulatoryUpdate).
 *
 * Mode: new. Lovable's `RegulatoryImpactBanner.tsx` (172L) was a small
 * supabase-backed contract-detail banner — RegulatoryImpactBanner is its
 * own component (below) wrapping a tighter banner UI. This component is
 * the larger paginated list shown on the regulation/regulatory-update
 * detail surfaces.
 *
 * AC mapping:
 *   AC-S12-01..03 — at-least-one-of (contractId|regulationId|
 *                   regulatoryUpdateId) required (the hook guards this).
 *   AC-S12-04 / AC-S12-05 — RLS narrowing applied server-side.
 *   AC-S12-06 — empty state when no impacts.
 *   AC-S12-07 — pagination metadata.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { translateApiError } from "@/lib/translate-api-error";
import { formatDate } from "@/utils/datetime";
import { selectHasPermission, useAuthStore } from "@/store/auth.store";
import { useRegulatoryImpactList } from "@/features/regulatory/hooks/useRegulatory";
import type {
  RegulatoryImpact,
  RegulatoryImpactListQuery,
} from "@/types/entities/regulatory.types";
import { RegulatoryImpactResolveDialog } from "./RegulatoryImpactResolveDialog";

interface Props {
  /** At least one of contractId / regulationId / regulatoryUpdateId required. */
  scope: Pick<
    RegulatoryImpactListQuery,
    "contractId" | "regulationId" | "regulatoryUpdateId" | "resolved"
  >;
  pageSize?: number;
  /** When true, hides the resolve action even for callers with permission. */
  readOnly?: boolean;
}

const SEVERITY_CLASS: Record<string, string> = {
  critical: "bg-terracotta-tint/40 text-terracotta-ink",
  high: "bg-amber-tint/40 text-amber-ink",
  medium: "bg-amber-tint/30 text-ink",
  low: "bg-muted/40 text-ink-muted",
};

export function RegulatoryImpactsList({
  scope,
  pageSize = 20,
  readOnly = false,
}: Props) {
  const { t } = useTranslation();
  const canManage = useAuthStore(selectHasPermission("regulations.manage"));
  const showResolveAction = canManage && !readOnly;

  const [page, setPage] = useState(1);
  const [resolveTarget, setResolveTarget] = useState<RegulatoryImpact | null>(
    null,
  );

  const query: RegulatoryImpactListQuery = useMemo(
    () => ({
      ...scope,
      page,
      limit: pageSize,
    }),
    [scope, page, pageSize],
  );

  const { data, isLoading, isError, error, isFetching } =
    useRegulatoryImpactList(query);

  const items = data?.data ?? [];

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-md border border-terracotta/30 bg-terracotta-tint/30 p-3 text-sm text-terracotta-ink"
      >
        {translateApiError(error, t)}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div role="status" aria-busy="true" className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-12 w-full animate-pulse rounded-md bg-muted/30"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-border bg-muted/10 p-4 text-center text-sm text-ink-muted">
        {t("regulatory.impact.list.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul
        className="space-y-2"
        aria-busy={isFetching ? "true" : "false"}
      >
        {items.map((row) => (
          <li
            key={row.id}
            className="rounded-md border border-border bg-card p-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-ink-muted">
                    {row.contract.contractNumber}
                  </span>
                  <span className="text-ink">{row.contract.titleEn}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <span className="font-mono">
                    {row.regulation.referenceCode}
                  </span>
                  {row.regulatoryUpdate ? (
                    <span
                      className={`inline-flex items-center rounded-md px-1.5 py-0.5 ${SEVERITY_CLASS[row.regulatoryUpdate.severity] ?? ""}`}
                    >
                      {t(
                        `regulatory.regulatoryUpdate.severity.${row.regulatoryUpdate.severity}`,
                      )}
                    </span>
                  ) : (
                    <span className="rounded-md bg-muted/40 px-1.5 py-0.5">
                      {t("regulatory.impact.structuralBadge")}
                    </span>
                  )}
                  <span>·</span>
                  <span>
                    {t("regulatory.impact.detectedAt")}:{" "}
                    {formatDate(row.detectedAt)}
                  </span>
                  {row.impactScore !== null && (
                    <>
                      <span>·</span>
                      <span>
                        {t("regulatory.impact.score")}:{" "}
                        <span className="font-mono">
                          {row.impactScore.toFixed(1)}
                        </span>
                      </span>
                    </>
                  )}
                </div>
                {row.impactNoteEn && (
                  <p className="mt-1 text-xs text-ink">{row.impactNoteEn}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ResolutionPill
                  resolved={row.resolved}
                  resolutionAction={row.resolutionAction}
                />
                {showResolveAction && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setResolveTarget(row)}
                  >
                    {row.resolved
                      ? t("regulatory.impact.actions.update")
                      : t("regulatory.impact.actions.resolve")}
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <p className="text-ink-muted">
            {t("common.pagination.showing", {
              current: data.pagination.page,
              total: data.pagination.totalPages,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.pagination.page <= 1 || isFetching}
              onClick={() => setPage(Math.max(1, page - 1))}
            >
              {t("common.pagination.previous")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                data.pagination.page >= data.pagination.totalPages || isFetching
              }
              onClick={() =>
                setPage(Math.min(data.pagination.totalPages, page + 1))
              }
            >
              {t("common.pagination.next")}
            </Button>
          </div>
        </div>
      )}

      {resolveTarget && (
        <RegulatoryImpactResolveDialog
          impact={resolveTarget}
          open={resolveTarget !== null}
          onClose={() => setResolveTarget(null)}
        />
      )}
    </div>
  );
}

function ResolutionPill({
  resolved,
  resolutionAction,
}: {
  resolved: boolean;
  resolutionAction: string | null;
}) {
  const { t } = useTranslation();
  if (!resolved) {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-tint/40 px-2 py-0.5 text-xs font-medium text-amber-ink">
        {t("regulatory.impact.status.pending")}
      </span>
    );
  }
  const label = resolutionAction
    ? t(`regulatory.impact.resolutionAction.${resolutionAction}`)
    : t("regulatory.impact.status.resolved");
  return (
    <span className="inline-flex items-center rounded-md bg-sage-tint/40 px-2 py-0.5 text-xs font-medium text-sage-ink">
      {label}
    </span>
  );
}
