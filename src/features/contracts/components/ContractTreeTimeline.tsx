/**
 * ContractTreeTimeline (S7) — parent/child amendment + renewal + extension
 * + SOW timeline. Vertical rail with one node per related contract.
 *
 * Mode: harden — visual idiom adapted from the Lovable ContractTimeline +
 * AmendedBanner components. Data layer fully extracted (T1) — uses
 * useContractTree which calls fn_contract_get_tree.
 *
 * AC mapping:
 *   AC-S7-01..05 — server returns the tree; we render in CTE order.
 *   AC-S7-04     — invisible nodes are pre-omitted by the BE.
 *   AC-S7-05     — `truncated` flag surfaces a banner.
 *   AC-S7-06..07 — error path surfaced via the data-state branches.
 */
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FilePlus2, FileText, RefreshCw, Sparkles } from "lucide-react";
import { useContractTree } from "@/features/contracts/hooks/useContracts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/utils/datetime";
import { cn } from "@/lib/utils";
import { ContractStatusBadge } from "./ContractStatusBadge";
import type { ContractTreeNode, RelationshipType } from "@/types/entities/contract.types";

interface ContractTreeTimelineProps {
  contractId: number;
}

function iconFor(node: ContractTreeNode, isRoot: boolean) {
  if (isRoot) return FileText;
  if (node.relationshipType === "renewal") return RefreshCw;
  return FilePlus2;
}

export function ContractTreeTimeline({ contractId }: ContractTreeTimelineProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useContractTree(contractId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("contracts.tree.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div
            className="h-32 animate-pulse rounded-md bg-surface"
            aria-busy="true"
            aria-label={t("common.loading")}
          />
        ) : isError ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-destructive">{error?.message ?? t("common.error")}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("common.retry")}
            </button>
          </div>
        ) : !data || data.tree.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("contracts.tree.empty")}</p>
        ) : (
          <>
            {data.truncated && (
              <p className="mb-3 rounded-md border border-amber/40 bg-amber-tint/40 px-3 py-2 text-[11px] text-amber-ink">
                {t("contracts.tree.truncatedNote")}
              </p>
            )}
            <ol className="relative space-y-4 ps-6">
              <span aria-hidden="true" className="absolute inset-y-2 start-[10px] w-px bg-border" />
              {data.tree.map((n) => {
                const isCurrent = n.id === data.currentNode;
                const isRoot = n.parentContractId === null;
                const Icon = iconFor(n, isRoot);
                return (
                  <li key={n.id} className="relative">
                    <span
                      className={cn(
                        "absolute -start-6 top-0.5 grid h-5 w-5 place-items-center rounded-full border-2 bg-background",
                        isCurrent ? "border-gold" : "border-border",
                      )}
                    >
                      <Icon
                        className={cn("h-3 w-3", isCurrent ? "text-gold" : "text-ink-subtle")}
                        aria-hidden="true"
                      />
                    </span>
                    <Link
                      to="/app/contracts/$id"
                      params={{ id: String(n.id) }}
                      className={cn(
                        "block rounded-lg border p-3 transition",
                        isCurrent
                          ? "border-gold/50 bg-gold-tint/30"
                          : "border-border bg-card hover:border-gold/40",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-ink-subtle">
                              {n.contractNumber}
                            </span>
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gold-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
                                <Sparkles className="h-3 w-3" aria-hidden="true" />
                                {t("contracts.tree.current")}
                              </span>
                            )}
                            {!isRoot && n.relationshipType && (
                              <RelationshipChip type={n.relationshipType} />
                            )}
                          </div>
                          <p className="mt-1 truncate text-sm font-medium text-ink">{n.titleEn}</p>
                          <p className="mt-0.5 text-xs text-ink-subtle">
                            {formatDate(n.createdAt)}
                          </p>
                        </div>
                        <ContractStatusBadge status={n.status} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface RelationshipChipProps {
  type: RelationshipType;
}

function RelationshipChip({ type }: RelationshipChipProps) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-muted">
      {t(`contracts.relationshipTypeOptions.${type}`, { defaultValue: type })}
    </span>
  );
}

export default ContractTreeTimeline;
