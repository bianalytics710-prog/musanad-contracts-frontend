/**
 * ContractVersionList (S9) — version history (newest first).
 *
 * Mode: harden — list-only slice of the Lovable VersionCompareDialog. The
 * full diff comparison + AI summary is M4 territory.
 *
 * AC mapping:
 *   AC-S9-01..03 — fn_contract_version_list with default limit=20.
 *   AC-S9-04     — bodyEn/bodyAr appear in payload but we render only a
 *                  collapsed preview; the full body is gated behind an
 *                  expand toggle (and never logged).
 *   AC-S9-05..06 — error path surfaced via data-state branches.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContractVersions } from "@/features/contracts/hooks/useContracts";
import { formatDateTime } from "@/utils/datetime";
import { cn } from "@/lib/utils";
import { ContractVersionCreateDialog } from "./ContractVersionCreateDialog";
import type { ContractVersion } from "@/types/entities/contract.types";

interface ContractVersionListProps {
  contractId: number;
  /** When true, surfaces the "New version" CTA wired to ContractVersionCreateDialog (S10). */
  canCreate?: boolean;
}

export function ContractVersionList({ contractId, canCreate = false }: ContractVersionListProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useContractVersions(contractId, {});
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const versions = data?.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{t("contracts.versions.title")}</CardTitle>
        {canCreate && (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <FilePlus2 className="h-3.5 w-3.5" />
            {t("contracts.versions.create")}
          </Button>
        )}
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
        ) : versions.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("contracts.versions.empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {versions.map((v) => (
              <VersionItem
                key={v.id}
                version={v}
                expanded={expanded === v.id}
                onToggle={() => setExpanded((prev) => (prev === v.id ? null : v.id))}
              />
            ))}
          </ul>
        )}
      </CardContent>

      {createOpen && (
        <ContractVersionCreateDialog
          contractId={contractId}
          open={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </Card>
  );
}

interface VersionItemProps {
  version: ContractVersion;
  expanded: boolean;
  onToggle: () => void;
}

function VersionItem({ version, expanded, onToggle }: VersionItemProps) {
  const { t } = useTranslation();
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const actor = version.changedBy
    ? `${version.changedBy.firstName} ${version.changedBy.lastName}`
    : t("contracts.versions.unknownActor");

  return (
    <li className="py-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-2 rounded-md px-1 py-1 text-left transition hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3">
          <Chevron className="mt-1 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-ink-subtle">
                {t("contracts.versions.versionNumber", {
                  number: version.versionNumber,
                })}
              </span>
              <span className="text-xs text-ink-muted">{formatDateTime(version.createdAt)}</span>
            </div>
            {version.changeNote && <p className="mt-1 text-sm text-ink">{version.changeNote}</p>}
            <p className="mt-0.5 text-[11px] text-ink-subtle">
              {t("contracts.versions.byActor", { actor })}
            </p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 ms-7 space-y-2 rounded-md border border-border bg-surface/40 p-3">
          {version.diffSummary && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                {t("contracts.versions.diffSummary")}
              </p>
              <p className="mt-1 text-sm text-ink-muted">{version.diffSummary}</p>
            </div>
          )}
          {(version.bodyEn || version.bodyAr) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {version.bodyEn && (
                <BodyPreview label={t("contracts.fields.bodyEn")} body={version.bodyEn} />
              )}
              {version.bodyAr && (
                <BodyPreview label={t("contracts.fields.bodyAr")} body={version.bodyAr} rtl />
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

interface BodyPreviewProps {
  label: string;
  body: string;
  rtl?: boolean;
}

function BodyPreview({ label, body, rtl }: BodyPreviewProps) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">{label}</p>
      <pre
        className={cn(
          "mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-card p-2 text-xs text-ink",
        )}
        dir={rtl ? "rtl" : "ltr"}
      >
        {body}
      </pre>
    </div>
  );
}

export default ContractVersionList;
