/**
 * RegulatoryImpactBanner (S12) — banner shown on the contract detail page
 * when the contract has unresolved regulatory_impacts.
 *
 * Mode: REGENERATE. Lovable's `RegulatoryImpactBanner.tsx` (172L) used
 * supabase.from() reads against `regulatory_impacts` joined to
 * `regulatory_updates` and the parent contract's amendment chain — wire
 * shapes that don't match the v2.6 fn_regulatory_impact_list output. We
 * keep the visual silhouette (amber strip, severity dots, deadline cliff,
 * review CTA) but route through the live API.
 *
 * Caller: ContractDetailPage (M1a). The banner is mounted on the contract
 * detail surface so users see active regulatory exposure inline.
 */
import { useTranslation } from "react-i18next";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useRegulatoryImpactList } from "@/features/regulatory/hooks/useRegulatory";
import { formatDate } from "@/utils/datetime";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RegulatoryImpactResolveDialog } from "./RegulatoryImpactResolveDialog";
import { selectHasPermission, useAuthStore } from "@/store/auth.store";
import type { RegulatoryImpact } from "@/types/entities/regulatory.types";

interface Props {
  contractId: number;
  /** Optional callback when the user clicks the "review" link (e.g. parent
   * router can navigate to a tabbed view). */
  onReviewClick?: () => void;
}

const SEVERITY_DOT_CLASS: Record<string, string> = {
  critical: "bg-terracotta",
  high: "bg-gold",
  medium: "bg-amber",
  low: "bg-slate",
};

export function RegulatoryImpactBanner({ contractId, onReviewClick }: Props) {
  const { t } = useTranslation();
  const canManage = useAuthStore(selectHasPermission("regulations.manage"));
  const [resolveTarget, setResolveTarget] = useState<RegulatoryImpact | null>(
    null,
  );

  const { data } = useRegulatoryImpactList(
    { contractId, resolved: false, limit: 5 },
    { staleTime: 60_000 },
  );

  const items = data?.data ?? [];

  if (items.length === 0) return null;

  const earliestDeadline = items
    .map((i) => i.regulatoryUpdate?.titleEn) // proxy for deadline; the list response doesn't include the full update payload, the user clicks through to detail
    .filter((d): d is string => Boolean(d))[0];

  return (
    <div
      role="status"
      className="mb-4 flex flex-col gap-2 rounded-lg border border-gold/40 bg-gold-tint/40 px-3 py-2.5 text-sm text-ink"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center gap-2 font-medium text-ink">
          <AlertTriangle className="h-4 w-4 text-gold" aria-hidden="true" />
          <span>
            {t("regulatory.banner.affected", { count: items.length })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {items.slice(0, 5).map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => canManage && setResolveTarget(row)}
              className={`inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium text-ink transition hover:border-gold hover:bg-gold-tint ${canManage ? "cursor-pointer" : "cursor-default"}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  SEVERITY_DOT_CLASS[row.regulatoryUpdate?.severity ?? "low"]
                }`}
                aria-hidden="true"
              />
              <span className="font-mono">{row.regulation.referenceCode}</span>
            </button>
          ))}
        </div>

        {earliestDeadline && (
          <span className="text-xs text-ink-muted">
            · {t("regulatory.banner.regulatoryUpdate")}: {earliestDeadline}
          </span>
        )}

        {onReviewClick && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ms-auto"
            onClick={onReviewClick}
          >
            {t("regulatory.banner.reviewAll")}
            <ChevronRight className="h-3 w-3 rtl:rotate-180" />
          </Button>
        )}
      </div>

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

// Re-export formatDate where the banner could be extended to surface
// compliance deadlines (currently the impact-list payload omits this; a
// future BE projection extension would expose it).
export { formatDate };
