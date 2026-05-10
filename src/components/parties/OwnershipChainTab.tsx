/**
 * OwnershipChainTab — tree visualization of ancestors + descendants of a
 * party. Calls GET /api/v1/parties/:id/chain-summary which pre-pivots the
 * traversal output by depth (AC-S8-02) so the FE doesn't need to group.
 *
 * Layout:
 *   Ancestors (above)   — depth N descending toward depth 1 closest to root
 *   Root party          — center card
 *   Descendants (below) — depth 1 closest to root, descending to depth N
 *
 * Truncation banner appears when chainTruncated=true (AC-S8-04 / Q-DA3 lock —
 * silent cap with metadata flag).
 *
 * Empty state when ancestors and descendants are both empty (and self-FK
 * shortcuts haven't surfaced anything either).
 *
 * Add Relationship button is permission-gated (party.graph.manage). On click,
 * opens AddRelationshipDialog. On success, the chain query is invalidated.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { AlertTriangle, Plus, Network, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { partyGraphService } from "@/services/api/party-graph.service";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import { translateApiError } from "@/lib/translate-api-error";
import type {
  PartyChainNode as PartyChainNodeType,
  PartyChainSummary,
  RelationshipTypeCounts,
} from "@/types/entities/party-graph.types";
import { PartyChainNode } from "./PartyChainNode";
import { SanctionsStatusBadge } from "./SanctionsStatusBadge";
import { IcvStatusBadge } from "./IcvStatusBadge";
import { AddRelationshipDialog } from "./AddRelationshipDialog";

export interface OwnershipChainTabProps {
  partyId: number;
  rootNameEn: string;
  rootNameAr: string | null;
  isAr: boolean;
  /** When true, the chain query is enabled (i.e. tab is active). */
  enabled?: boolean;
}

const RELATIONSHIP_LABEL_KEY: Record<keyof RelationshipTypeCounts, string> = {
  parent: "parties.chain.relationshipType.parent",
  ubo: "parties.chain.relationshipType.ubo",
  subsidiary: "parties.chain.relationshipType.subsidiary",
  sub_contractor: "parties.chain.relationshipType.subContractor",
  jv: "parties.chain.relationshipType.jv",
  controlling_shareholder: "parties.chain.relationshipType.controllingShareholder",
};

export function OwnershipChainTab({
  partyId,
  rootNameEn,
  rootNameAr,
  isAr,
  enabled = true,
}: OwnershipChainTabProps) {
  const { t } = useTranslation();
  const canManage = useAuthStore(selectHasPermission("party.graph.manage"));
  const [addOpen, setAddOpen] = useState(false);

  const queryKey = ["party-chain-summary", partyId] as const;
  const { data, isLoading, isError, error, refetch, isFetching } =
    useQuery<PartyChainSummary>({
      queryKey,
      queryFn: () =>
        partyGraphService.getChainSummary(partyId, { maxDepth: 5 }),
      enabled: enabled && Number.isInteger(partyId) && partyId > 0,
      staleTime: 30_000,
    });

  // Sort depth keys ascending (1, 2, 3, ...) for consistent rendering.
  const ancestorDepthKeys = useMemo(
    () =>
      data
        ? Object.keys(data.ancestorsByDepth).sort(
            (a, b) => Number(a) - Number(b),
          )
        : [],
    [data],
  );
  const descendantDepthKeys = useMemo(
    () =>
      data
        ? Object.keys(data.descendantsByDepth).sort(
            (a, b) => Number(a) - Number(b),
          )
        : [],
    [data],
  );

  const totalEdges = data
    ? Object.values(data.directRelationshipCounts).reduce((a, b) => a + b, 0)
    : 0;

  // ─── Loading state (T4) ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-12 animate-pulse rounded-lg bg-surface" />
        <div className="h-32 animate-pulse rounded-lg bg-surface" />
        <div className="h-24 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  // ─── Error state (T4) ───────────────────────────────────────────────────
  if (isError || !data) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-terracotta" aria-hidden />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-ink">
              {t("parties.chain.error.title")}
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              {translateApiError(error, t)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-3"
            >
              <RefreshCcw className="me-1.5 h-3.5 w-3.5" aria-hidden />
              {t("common.retry", { defaultValue: "Retry" })}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isEmpty =
    ancestorDepthKeys.length === 0 && descendantDepthKeys.length === 0;

  // ─── Empty state (T4) ───────────────────────────────────────────────────
  if (isEmpty) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-lg border border-dashed border-border bg-card p-10 text-center"
        >
          <Network
            className="mx-auto h-10 w-10 text-ink-subtle"
            aria-hidden
          />
          <h3 className="mt-3 text-sm font-semibold text-ink">
            {t("parties.chain.empty.title")}
          </h3>
          <p className="mt-1 max-w-md mx-auto text-xs text-ink-muted">
            {t("parties.chain.empty.description")}
          </p>
          {canManage && (
            <Button
              type="button"
              size="sm"
              onClick={() => setAddOpen(true)}
              className="mt-4"
            >
              <Plus className="me-1.5 h-3.5 w-3.5" aria-hidden />
              {t("parties.chain.addRelationship")}
            </Button>
          )}
          {/* Direct relationship counts strip — always visible (AC-S8-03) */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
            {(
              Object.keys(data.directRelationshipCounts) as Array<
                keyof RelationshipTypeCounts
              >
            ).map((key) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted"
              >
                {t(RELATIONSHIP_LABEL_KEY[key])}:{" "}
                <span className="text-ink">
                  {data.directRelationshipCounts[key]}
                </span>
              </span>
            ))}
          </div>
        </motion.div>
        {addOpen && (
          <AddRelationshipDialog
            open={addOpen}
            onClose={() => setAddOpen(false)}
            anchorPartyId={partyId}
            anchorPartyName={isAr && rootNameAr ? rootNameAr : rootNameEn}
          />
        )}
      </>
    );
  }

  // ─── Loaded state ───────────────────────────────────────────────────────
  // Render ancestors at top (deeper = further up), root in middle, descendants below.
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Truncation banner (AC-S8-04 / Q-DA3 lock) */}
      {data.chainTruncated && (
        <div className="flex items-start gap-2 rounded-md border border-amber/30 bg-amber/10 px-3 py-2">
          <AlertTriangle
            className="h-4 w-4 shrink-0 text-amber-ink"
            aria-hidden
          />
          <p className="text-xs text-amber-ink">
            {t("parties.chain.truncatedBanner")}
          </p>
        </div>
      )}

      {/* Header strip with counts + action */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("parties.chain.directEdges")}:
          </span>
          <span className="font-mono text-xs text-ink">{totalEdges}</span>
          <span className="ms-2 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("parties.chain.depthReached")}:
          </span>
          <span className="font-mono text-xs text-ink">
            {Math.max(
              ancestorDepthKeys.length === 0
                ? 0
                : Number(ancestorDepthKeys[ancestorDepthKeys.length - 1]),
              descendantDepthKeys.length === 0
                ? 0
                : Number(descendantDepthKeys[descendantDepthKeys.length - 1]),
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && (
            <span className="font-mono text-[10px] text-ink-subtle">
              {t("common.refreshing", { defaultValue: "Refreshing…" })}
            </span>
          )}
          {canManage && (
            <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="me-1.5 h-3.5 w-3.5" aria-hidden />
              {t("parties.chain.addRelationship")}
            </Button>
          )}
        </div>
      </div>

      {/* Ancestors (top) — render deepest first so depth=1 sits closest to root */}
      {ancestorDepthKeys.length > 0 && (
        <ChainBand
          title={t("parties.chain.ancestors")}
          depthKeys={[...ancestorDepthKeys].reverse()}
          byDepth={data.ancestorsByDepth}
          isAr={isAr}
        />
      )}

      {/* Root */}
      <div className="flex justify-center">
        <div className="min-w-[260px] rounded-lg border-2 border-gold bg-card p-3 text-center shadow-sm">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("parties.chain.root")}
          </p>
          <h4 className="mt-0.5 text-sm font-semibold text-ink">
            {isAr && data.rootParty.nameAr
              ? data.rootParty.nameAr
              : data.rootParty.nameEn}
          </h4>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            <SanctionsStatusBadge status={data.rootParty.sanctionsStatus} />
            {data.rootParty.icvStatus && (
              <IcvStatusBadge
                status={data.rootParty.icvStatus}
                pct={data.rootParty.icvPct}
              />
            )}
            {typeof data.rootParty.esgScore === "number" && (
              <span className="rounded-full bg-slate/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-ink">
                {t("parties.chain.esg")}: {data.rootParty.esgScore}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Descendants (bottom) */}
      {descendantDepthKeys.length > 0 && (
        <ChainBand
          title={t("parties.chain.descendants")}
          depthKeys={descendantDepthKeys}
          byDepth={data.descendantsByDepth}
          isAr={isAr}
        />
      )}

      {addOpen && (
        <AddRelationshipDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          anchorPartyId={partyId}
          anchorPartyName={isAr && rootNameAr ? rootNameAr : rootNameEn}
        />
      )}
    </motion.div>
  );
}

interface ChainBandProps {
  title: string;
  depthKeys: string[];
  byDepth: Record<string, PartyChainNodeType[]>;
  isAr: boolean;
}

function ChainBand({ title, depthKeys, byDepth, isAr }: ChainBandProps) {
  const { t } = useTranslation();
  return (
    <section>
      <header className="mb-2 flex items-center gap-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
          {title}
        </h3>
      </header>
      <div className="space-y-2">
        {depthKeys.map((dk) => {
          const nodes = byDepth[dk] ?? [];
          return (
            <div
              key={dk}
              className="rounded-md border border-border bg-card p-2"
            >
              <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-ink-subtle">
                {t("parties.chain.depthLabel", { depth: dk })}
                <span className="ms-2">· {nodes.length}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {nodes.map((n) => (
                  <PartyChainNode
                    key={`${n.partyId}-${n.depth}-${n.via}`}
                    node={n}
                    isAr={isAr}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
