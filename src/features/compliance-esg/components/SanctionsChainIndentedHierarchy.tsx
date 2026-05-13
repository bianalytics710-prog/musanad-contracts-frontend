/**
 * Unit-3 / R-CES C4 — Sanctions chain indented hierarchy.
 *
 * Replaces the flat table view. Uses semantic <ul><li> nesting.
 * Depth is approximated by `depthReached`: root node depth=0,
 * children visually indented per depth unit.
 *
 * Decision AD-6: indented hierarchy (not SVG).
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { DashboardEmptyState } from "@/features/dashboards/components/dashboard-primitives";
import { RaiseFlagDialog } from "./ActionDialogs";
import type { SubContractorChainRow } from "@/types/entities/crg-dashboards.types";

interface SanctionsChainIndentedHierarchyProps {
  rows: SubContractorChainRow[];
}

export function SanctionsChainIndentedHierarchy({
  rows,
}: SanctionsChainIndentedHierarchyProps) {
  const { t } = useTranslation();
  const [flagContractId, setFlagContractId] = useState<string | null>(null);
  const [flagOpen, setFlagOpen] = useState(false);

  if (rows.length === 0) {
    return (
      <DashboardEmptyState
        description={t("dashboards.complianceEsg.empty.noChains")}
      />
    );
  }

  return (
    <>
      <ul
        className="space-y-1"
        aria-label={t("compliance.sanctionsChain.listAriaLabel")}
      >
        {rows.map((row) => {
          const indentPx = row.depthReached * 20;
          const isSanctioned = row.sanctionedNodesCount > 0;

          return (
            <li
              key={row.chainRootCounterpartyId}
              style={{ paddingInlineStart: `${indentPx}px` }}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-surface px-3 py-2"
            >
              {/* Depth bullet */}
              <span
                className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                  isSanctioned ? "bg-terracotta" : "bg-sage"
                }`}
                aria-hidden
              />

              {/* Name */}
              <Link
                to="/app/parties/$id"
                params={{ id: row.chainRootCounterpartyId }}
                className="min-w-0 flex-1 truncate text-sm text-ink hover:text-gold hover:underline"
              >
                {row.chainRootName}
              </Link>

              {/* Sanctioned badge */}
              {isSanctioned && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-terracotta/30 bg-terracotta/15 px-2 py-0.5 font-mono text-[10px] uppercase text-terracotta"
                  aria-label={t("compliance.sanctionsChain.sanctionedBadge")}
                >
                  <AlertTriangle className="h-3 w-3" aria-hidden />
                  {t("compliance.sanctionsChain.sanctionedBadge")}
                </span>
              )}

              {/* Depth label */}
              {row.depthReached > 0 && (
                <span className="font-mono text-[10px] text-ink-subtle">
                  {t("compliance.sanctionsChain.depthLabel", {
                    depth: row.depthReached,
                    defaultValue: `depth ${row.depthReached}`,
                  })}
                </span>
              )}

              {/* Affected contracts count */}
              <span className="font-mono text-[11px] text-ink-muted">
                {row.affectedContractsCount}{" "}
                {t("dashboards.complianceEsg.affectedContracts")}
              </span>

              {/* Chain truncated marker */}
              {row.chainTruncated && (
                <span
                  className="ms-1 font-mono text-[10px] text-ink-subtle"
                  title={t("dashboards.complianceEsg.chainTruncated")}
                >
                  *
                </span>
              )}

              {/* Raise flag action (H4) */}
              {isSanctioned && (
                <button
                  type="button"
                  onClick={() => {
                    // Use chainRootCounterpartyId as a synthetic contractId handle for the flag.
                    // In practice the BE flag needs a contractId — the first affected contract.
                    // We use chainRootCounterpartyId as placeholder; user confirms in dialog.
                    setFlagContractId(row.chainRootCounterpartyId);
                    setFlagOpen(true);
                  }}
                  className="ms-1 shrink-0 rounded-md border border-terracotta/40 px-2 py-0.5 text-[10px] font-medium text-terracotta hover:bg-terracotta/10"
                  aria-label={t("compliance.sanctionsChain.raiseFlagAriaLabel", {
                    name: row.chainRootName,
                  })}
                >
                  {t("compliance.sanctionsChain.raiseFlagButton")}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <RaiseFlagDialog
        contractId={flagContractId}
        open={flagOpen}
        onClose={() => {
          setFlagOpen(false);
          setFlagContractId(null);
        }}
      />
    </>
  );
}
