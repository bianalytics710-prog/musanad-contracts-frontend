/**
 * ApprovalMatrixView (S4 + S5) — admin list of approval matrix rules grouped
 * by (contract_type, valueMin, valueMax). Hosts the MatrixRuleEditor dialog.
 *
 * GET /api/v1/admin/approval-matrix — paginated, ordered by contract_type ASC,
 * step_order ASC, parallel_group NULLS FIRST. Permission gate
 * approval.matrix.read.
 *
 * AC mapping:
 *   AC-S4-01..04 — pagination + ordering + row shape.
 *   AC-S4-05 — caller without approval.matrix.read sees 403; the route gate
 *              normally redirects, but our error branch surfaces a friendly
 *              message via translateApiError.
 *
 * 13-checklist mapping:
 *   T1/T2 — service through approvalMatrixService + React Query.
 *   T3    — every label uses t().
 *   T4    — explicit loading / error / empty branches.
 *   T6    — semantic <table>; aria-busy on body during refetch.
 *   T11   — wrapped in route ErrorBoundary.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Plus, Edit3, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { translateApiError } from "@/lib/translate-api-error";
import { useApprovalMatrixList } from "@/features/approvals/hooks/useApprovals";
import { MatrixRuleEditor } from "@/features/approvals/components/MatrixRuleEditor";
import type { ApprovalMatrix } from "@/types/entities/approval.types";

/** M1a 8-value contract_type enum mirrored on approval_matrix CHECK. */
const CONTRACT_TYPES: readonly string[] = [
  "employment",
  "vendor",
  "service",
  "nda",
  "consultancy",
  "msa",
  "sow",
  "license",
];

/** Approver roles available in seed data — keep aligned with role table. */
const APPROVER_ROLES: readonly string[] = [
  "platform_admin",
  "legal_counsel",
  "contract_approver",
  "contract_approver_2",
  "executive",
];

interface RuleGroup {
  contractType: string;
  valueMin: number;
  valueMax: number | null;
  rules: ApprovalMatrix[];
}

function groupRules(rows: readonly ApprovalMatrix[]): RuleGroup[] {
  const map = new Map<string, RuleGroup>();
  for (const r of rows) {
    const key = `${r.contractType}__${r.valueMin}__${r.valueMax ?? "inf"}`;
    if (!map.has(key)) {
      map.set(key, {
        contractType: r.contractType,
        valueMin: r.valueMin,
        valueMax: r.valueMax,
        rules: [],
      });
    }
    map.get(key)!.rules.push(r);
  }
  for (const g of map.values()) {
    g.rules.sort((a, b) => a.stepOrder - b.stepOrder);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.contractType !== b.contractType)
      return a.contractType.localeCompare(b.contractType);
    return a.valueMin - b.valueMin;
  });
}

export function ApprovalMatrixView() {
  const { t } = useTranslation();
  const [contractTypeFilter, setContractTypeFilter] = useState<string>("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RuleGroup | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useApprovalMatrixList({
      page: 1,
      limit: 100,
      contractType: contractTypeFilter || undefined,
    });

  const groups = useMemo(() => groupRules(data?.data ?? []), [data]);

  const openCreate = () => {
    setEditingGroup(null);
    setEditorOpen(true);
  };
  const openEdit = (group: RuleGroup) => {
    setEditingGroup(group);
    setEditorOpen(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("approval.matrix.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("approval.matrix.intro")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label={t("common.retry")}
          >
            <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {t("common.retry")}
          </Button>
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="me-1.5 h-3.5 w-3.5" />
            {t("approval.matrix.addRule")}
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <label htmlFor="matrix-ct-filter" className="text-xs text-ink-muted">
            {t("approval.matrix.filterContractType")}
          </label>
          <select
            id="matrix-ct-filter"
            value={contractTypeFilter}
            onChange={(e) => setContractTypeFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">{t("approval.matrix.filterAll")}</option>
            {CONTRACT_TYPES.map((ct) => (
              <option key={ct} value={ct}>
                {t(`contractTypes.${ct}`, { defaultValue: ct })}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-md bg-surface"
                aria-hidden="true"
              />
            ))}
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="h-5 w-5 text-destructive" aria-hidden />
            <p className="text-sm font-medium text-destructive">
              {translateApiError(error, t, "errors.approval.matrixListFailed")}
            </p>
            <Button type="button" size="sm" onClick={() => void refetch()}>
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
            <h2 className="text-base font-semibold text-ink">
              {t("approval.matrix.emptyTitle")}
            </h2>
            <p className="max-w-md text-sm text-ink-muted">
              {t("approval.matrix.emptyDescription")}
            </p>
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="me-1.5 h-3.5 w-3.5" />
              {t("approval.matrix.addRule")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <RuleGroupCard
              key={`${group.contractType}-${group.valueMin}-${group.valueMax ?? "inf"}`}
              group={group}
              onEdit={() => openEdit(group)}
            />
          ))}
        </div>
      )}

      <MatrixRuleEditor
        open={editorOpen}
        existingRule={editingGroup}
        contractTypes={CONTRACT_TYPES}
        approverRoles={APPROVER_ROLES}
        onClose={() => setEditorOpen(false)}
        onSuccess={() => {
          setEditorOpen(false);
          void refetch();
        }}
      />
    </motion.div>
  );
}

interface RuleGroupCardProps {
  group: RuleGroup;
  onEdit: () => void;
}

function RuleGroupCard({ group, onEdit }: RuleGroupCardProps) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <span className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink">
            {t(`contractTypes.${group.contractType}`, {
              defaultValue: group.contractType,
            })}
          </span>
          <span className="rounded-full border border-border bg-background px-2.5 py-0.5 font-mono text-xs text-ink-muted">
            {formatRange(group.valueMin, group.valueMax, t)}
          </span>
          <span className="text-ink-subtle">·</span>
          <ol className="flex flex-wrap items-center gap-1.5">
            {group.rules.map((r) => (
              <li
                key={r.id}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-ink"
              >
                <span className="font-mono text-ink-muted">{r.stepOrder}</span>
                <span>
                  {t(`roles.${r.approverRole}`, { defaultValue: r.approverRole })}
                </span>
                {r.parallelGroup !== null && (
                  <span className="rounded-full bg-gold/10 px-1.5 text-[10px] text-ink">
                    {t("approval.chain.parallelBadge")}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={onEdit}>
            <Edit3 className="me-1.5 h-3.5 w-3.5" />
            {t("common.edit")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatRange(
  min: number,
  max: number | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (min === 0 && max === null) return t("approval.matrix.range.any");
  if (min === 0 && max !== null)
    return t("approval.matrix.range.under", { max: formatAed(max) });
  if (max === null)
    return t("approval.matrix.range.over", { min: formatAed(min) });
  return t("approval.matrix.range.between", {
    min: formatAed(min),
    max: formatAed(max),
  });
}

function formatAed(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default ApprovalMatrixView;
