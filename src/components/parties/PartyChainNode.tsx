/**
 * PartyChainNode — single-node renderer for the OwnershipChainTab tree.
 *
 * Visual: rounded card with name (locale-aware), sanctions badge, ownership
 * pct (if present), and the relationship-type label that took the traversal
 * from depth N-1 to this node. Sanctioned nodes get a terracotta left border
 * for chain-path emphasis.
 *
 * Props:
 *   - node: PartyChainNode (depth, partyId, names, status, etc.)
 *   - isAr: locale flag for nameAr fallback
 */
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Building2 } from "lucide-react";
import type { PartyChainNode as PartyChainNodeType } from "@/types/entities/party-graph.types";
import { SanctionsStatusBadge } from "./SanctionsStatusBadge";

const RELATIONSHIP_KEY: Record<string, string> = {
  parent: "parties.chain.relationshipType.parent",
  ubo: "parties.chain.relationshipType.ubo",
  subsidiary: "parties.chain.relationshipType.subsidiary",
  sub_contractor: "parties.chain.relationshipType.subContractor",
  jv: "parties.chain.relationshipType.jv",
  controlling_shareholder: "parties.chain.relationshipType.controllingShareholder",
};

export interface PartyChainNodeProps {
  node: PartyChainNodeType;
  isAr: boolean;
}

export function PartyChainNode({ node, isAr }: PartyChainNodeProps) {
  const { t } = useTranslation();
  const displayName = isAr && node.nameAr ? node.nameAr : node.nameEn;
  const isSanctioned =
    node.sanctionsStatus === "sanctioned" || node.sanctionsStatus === "flagged";

  const borderClass = isSanctioned
    ? "border-l-terracotta"
    : node.via === "edge"
      ? "border-l-gold"
      : "border-l-slate";

  return (
    <Link
      to="/app/parties/$id"
      params={{ id: String(node.partyId) }}
      className={`group flex min-w-[220px] items-start gap-2 rounded-md border border-border border-l-4 bg-card p-2.5 text-start transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${borderClass}`}
    >
      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-ink">
            {displayName}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <SanctionsStatusBadge status={node.sanctionsStatus} />
          <span className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
            {t(RELATIONSHIP_KEY[node.relationshipType] ?? node.relationshipType)}
          </span>
          {typeof node.ownershipPct === "number" && (
            <span className="font-mono text-[10px] text-ink-muted">
              {node.ownershipPct}%
            </span>
          )}
        </div>
        <p className="mt-0.5 font-mono text-[10px] text-ink-subtle">
          {t("parties.chain.depth", { depth: node.depth })}
          {node.via !== "edge" && (
            <span className="ms-1 text-slate">
              · {t("parties.chain.viaSelfFk")}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}
