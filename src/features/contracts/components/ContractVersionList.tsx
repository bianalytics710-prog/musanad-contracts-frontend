/**
 * ContractVersionList — version history (newest first).
 *
 * v616 refresh:
 *  - "New version" CTA dropped. A new contract_version row is now created
 *    automatically by fn_contract_update whenever a drafter edit changes
 *    body_en or body_ar — so an explicit button is misleading.
 *  - VersionDiffSummaryPanel removed. The Versions tab is a plain
 *    history list; reviewers diff in the Document tab instead.
 *  - Each version gets a "View this version" button that hops to the
 *    Document tab and renders that historical body via onViewVersion.
 *
 * 2026-06-15 — Restore: each non-current version (for editable contracts)
 *  gets a "Restore" action. Restore reuses fn_contract_version_create — it
 *  writes the chosen version's body as a NEW current version ("Restored from
 *  version N"), so the live contract reverts while the full history is kept.
 */
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Eye, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useContractVersions,
  contractsKeys,
} from "@/features/contracts/hooks/useContracts";
import { contractsService } from "@/services/api/contracts.service";
import { formatDateTime } from "@/utils/datetime";
import { translateApiError } from "@/lib/translate-api-error";
import type { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { ContractVersion } from "@/types/entities/contract.types";

interface ContractVersionListProps {
  contractId: number;
  /** Caller-supplied handler — switches the parent to the Document tab
   *  and renders the historical body. */
  onViewVersion?: (version: ContractVersion) => void;
  /** 2026-06-15 — when true, non-current versions show a Restore action.
   *  Gated by the caller to editable contracts (drafter + draft status). */
  canRestore?: boolean;
}

export function ContractVersionList({
  contractId,
  onViewVersion,
  canRestore = false,
}: ContractVersionListProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useContractVersions(contractId, {});
  const [expanded, setExpanded] = useState<number | null>(null);
  // 2026-06-15 — the version pending a restore confirmation.
  const [confirmRestore, setConfirmRestore] = useState<ContractVersion | null>(null);

  const versions = data?.data ?? [];
  const latestVersionNumber = versions[0]?.versionNumber ?? null;

  const restoreMutation = useMutation({
    mutationFn: (v: ContractVersion) =>
      contractsService.createVersion(contractId, {
        bodyEn: v.bodyEn ?? null,
        bodyAr: v.bodyAr ?? null,
        changeNote: t("contracts.versions.restoreNote", {
          defaultValue: "Restored from version {{n}}",
          n: v.versionNumber,
        }),
      }),
    onSuccess: (_res, v) => {
      toast.success(
        t("contracts.versions.restoreToast", {
          defaultValue: "Version {{n}} restored as the current version",
          n: v.versionNumber,
        }),
      );
      setConfirmRestore(null);
      // The live body, version list, and any anchored comments all shift.
      void qc.invalidateQueries({ queryKey: contractsKeys.all });
      void qc.invalidateQueries({ queryKey: contractsKeys.detail(contractId) });
      void qc.invalidateQueries({ queryKey: ["comments", contractId] });
    },
    onError: (err: ApiError) => {
      toast.error(translateApiError(err, t, "contracts.versions.restoreFailed"));
    },
  });

  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="text-base">{t("contracts.versions.title")}</CardTitle>
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
                isLatest={v.versionNumber === latestVersionNumber}
                expanded={expanded === v.id}
                onToggle={() => setExpanded((prev) => (prev === v.id ? null : v.id))}
                onView={onViewVersion ? () => onViewVersion(v) : undefined}
                onRestore={
                  canRestore && v.versionNumber !== latestVersionNumber
                    ? () => setConfirmRestore(v)
                    : undefined
                }
              />
            ))}
          </ul>
        )}
      </CardContent>

      {confirmRestore && (
        <RestoreConfirmDialog
          version={confirmRestore}
          pending={restoreMutation.isPending}
          onCancel={() => !restoreMutation.isPending && setConfirmRestore(null)}
          onConfirm={() => restoreMutation.mutate(confirmRestore)}
        />
      )}
    </Card>
  );
}

interface VersionItemProps {
  version: ContractVersion;
  isLatest: boolean;
  expanded: boolean;
  onToggle: () => void;
  onView?: () => void;
  onRestore?: () => void;
}

function VersionItem({ version, isLatest, expanded, onToggle, onView, onRestore }: VersionItemProps) {
  const { t } = useTranslation();
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const actor = version.changedBy
    ? `${version.changedBy.firstName} ${version.changedBy.lastName}`
    : t("contracts.versions.unknownActor");

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-start gap-3 rounded-md px-1 py-1 text-left transition hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-expanded={expanded}
        >
          <Chevron className="mt-1 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-ink-subtle">
                {t("contracts.versions.versionNumber", { number: version.versionNumber })}
              </span>
              {isLatest && (
                <span className="rounded-full bg-sage/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sage">
                  {t("contracts.versions.currentBadge", { defaultValue: "Current" })}
                </span>
              )}
              <span className="text-xs text-ink-muted">{formatDateTime(version.createdAt)}</span>
            </div>
            {version.changeNote && <p className="mt-1 text-sm text-ink">{version.changeNote}</p>}
            <p className="mt-0.5 text-[11px] text-ink-subtle">
              {t("contracts.versions.byActor", { actor })}
            </p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {onRestore && (
            <Button type="button" variant="ghost" size="sm" onClick={onRestore}>
              <RotateCcw className="h-3.5 w-3.5" />
              {t("contracts.versions.restore", { defaultValue: "Restore" })}
            </Button>
          )}
          {onView && (
            <Button type="button" variant="outline" size="sm" onClick={onView}>
              <Eye className="h-3.5 w-3.5" />
              {t("contracts.versions.viewThisVersion", { defaultValue: "View this version" })}
            </Button>
          )}
        </div>
      </div>

      {expanded && (version.bodyEn || version.bodyAr) && (
        <div className="mt-3 ms-7 grid gap-3 rounded-md border border-border bg-surface/40 p-3 sm:grid-cols-2">
          {version.bodyEn && <BodyPreview label={t("contracts.fields.bodyEn")} body={version.bodyEn} />}
          {version.bodyAr && (
            <BodyPreview label={t("contracts.fields.bodyAr")} body={version.bodyAr} rtl />
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

/** 2026-06-15 — confirm dialog for restoring a historical version. */
function RestoreConfirmDialog({
  version,
  pending,
  onCancel,
  onConfirm,
}: {
  version: ContractVersion;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">
            {t("contracts.versions.restoreTitle", {
              defaultValue: "Restore version {{n}}?",
              n: version.versionNumber,
            })}
          </h2>
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} disabled={pending} aria-label={t("common.close")}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-3 text-sm text-ink-muted">
          {t("contracts.versions.restoreBody", {
            defaultValue:
              "This makes version {{n}}'s content the current contract body, saved as a new version. Nothing is lost — every existing version stays in the history.",
            n: version.versionNumber,
          })}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={pending}>
            {pending
              ? t("common.saving")
              : t("contracts.versions.restoreConfirm", { defaultValue: "Restore version" })}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ContractVersionList;
