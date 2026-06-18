/**
 * ContractRedlineTab — Scenario 2: upload the counterparty's returned contract
 * file, review the clause-section diff vs our current version, accept/reject
 * each change, and apply accepted changes as a new version.
 */
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Upload,
  FileDiff,
  Check,
  X,
  Plus,
  Minus,
  Pencil,
  Loader2,
  GitCommitHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/datetime";
import {
  contractRedlineService,
  type RedlineImport,
  type RedlineChange,
  type RedlineDecision,
} from "@/services/api/contract-redline.service";

export function ContractRedlineTab({ contractId }: { contractId: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeImportId, setActiveImportId] = useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ["redline-imports", contractId],
    queryFn: () => contractRedlineService.list(contractId),
    staleTime: 30_000,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => contractRedlineService.upload(contractId, file),
    onSuccess: (imp) => {
      toast.success(
        t("contracts.redline.uploaded", {
          defaultValue: "Analysed {{name}} — {{n}} change(s) found.",
          name: imp.filename,
          n: imp.counts.total,
        }),
      );
      setActiveImportId(imp.id);
      void qc.invalidateQueries({ queryKey: ["redline-imports", contractId] });
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(
        e.response?.data?.error?.message ??
          t("contracts.redline.uploadFailed", { defaultValue: "Could not analyse that file." }),
      );
    },
  });

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) uploadMutation.mutate(f);
    e.target.value = "";
  };

  return (
    <div role="tabpanel" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <FileDiff className="h-4 w-4 text-gold" aria-hidden />
            {t("contracts.redline.title", { defaultValue: "Counterparty redline" })}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">
            {t("contracts.redline.subtitle", {
              defaultValue:
                "Upload the counterparty's returned contract (.docx / .pdf / .txt). We diff it against the current version clause-by-clause; accept or reject each change, then apply the accepted ones as a new version.",
            })}
          </p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".docx,.pdf,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            onChange={onPick}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploadMutation.isPending}>
            {uploadMutation.isPending ? (
              <Loader2 className="me-1 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="me-1 h-4 w-4" />
            )}
            {uploadMutation.isPending
              ? t("contracts.redline.analysing", { defaultValue: "Analysing…" })
              : t("contracts.redline.upload", { defaultValue: "Upload counterparty redline" })}
          </Button>
        </div>
      </div>

      {/* Past imports */}
      {(listQuery.data?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
            {t("contracts.redline.history", { defaultValue: "Uploads" })}
          </div>
          <ul className="divide-y divide-border">
            {listQuery.data!.map((imp) => (
              <li key={imp.id}>
                <button
                  type="button"
                  onClick={() => setActiveImportId(imp.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface",
                    activeImportId === imp.id && "bg-surface",
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink">{imp.filename}</div>
                    <div className="text-[11px] text-ink-subtle">
                      {formatDateTime(imp.createdAt)} ·{" "}
                      {t("contracts.redline.vsBase", { defaultValue: "vs v{{n}}", n: imp.baseVersionNumber })}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] text-ink-muted">
                      {t("contracts.redline.changeCount", { defaultValue: "{{n}} changes", n: imp.counts.total })}
                    </span>
                    {imp.status === "applied" ? (
                      <span className="rounded-full bg-sage/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sage">
                        {t("contracts.redline.applied", { defaultValue: "Applied v{{n}}", n: imp.appliedVersionNumber })}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-ink">
                        {t("contracts.redline.inReview", { defaultValue: "In review" })}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeImportId != null ? (
        <RedlineReview contractId={contractId} importId={activeImportId} />
      ) : (
        (listQuery.data?.length ?? 0) === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-surface/40 p-10 text-center">
            <FileDiff className="mx-auto mb-2 h-8 w-8 text-ink-subtle" aria-hidden />
            <p className="text-sm font-medium text-ink">
              {t("contracts.redline.emptyTitle", { defaultValue: "No counterparty redline yet" })}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {t("contracts.redline.emptyBody", {
                defaultValue: "Upload their returned file to see a clause-by-clause diff.",
              })}
            </p>
          </div>
        )
      )}
    </div>
  );
}

function RedlineReview({ contractId, importId }: { contractId: number; importId: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: imp, isLoading } = useQuery({
    queryKey: ["redline-import", contractId, importId],
    queryFn: () => contractRedlineService.get(contractId, importId),
    staleTime: 10_000,
  });

  const decideMutation = useMutation({
    mutationFn: ({ changeId, decision }: { changeId: number; decision: RedlineDecision }) =>
      contractRedlineService.decide(contractId, importId, changeId, decision),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["redline-import", contractId, importId] }),
  });

  const applyMutation = useMutation({
    mutationFn: () => contractRedlineService.apply(contractId, importId),
    onSuccess: (res) => {
      toast.success(
        t("contracts.redline.appliedToast", {
          defaultValue: "Applied {{n}} change(s) → version v{{v}}.",
          n: res.appliedChanges,
          v: res.versionNumber,
        }),
      );
      void qc.invalidateQueries({ queryKey: ["redline-import", contractId, importId] });
      void qc.invalidateQueries({ queryKey: ["redline-imports", contractId] });
      void qc.invalidateQueries({ queryKey: ["contract-versions", contractId] });
      void qc.invalidateQueries({ queryKey: ["contract", contractId] });
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(
        e.response?.data?.error?.message ??
          t("contracts.redline.applyFailed", { defaultValue: "Could not apply changes." }),
      );
    },
  });

  if (isLoading || !imp) {
    return <div className="h-40 animate-pulse rounded-lg bg-surface" aria-hidden />;
  }

  const acceptedCount = imp.changes.filter((c) => c.decision === "accepted").length;
  const applied = imp.status === "applied";

  return (
    <div className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <FileDiff className="h-4 w-4 text-gold" aria-hidden />
          <div>
            <div className="text-sm font-semibold text-ink">{imp.filename}</div>
            <div className="text-[11px] text-ink-subtle">
              {t("contracts.redline.diffAgainst", {
                defaultValue: "Diffed against v{{n}} · {{a}} added · {{r}} removed · {{m}} modified",
                n: imp.baseVersionNumber,
                a: imp.counts.added,
                r: imp.counts.removed,
                m: imp.counts.modified,
              })}
            </div>
          </div>
        </div>
        {applied ? (
          <span className="rounded-full bg-sage/15 px-2.5 py-1 text-xs font-semibold text-sage">
            {t("contracts.redline.appliedBadge", { defaultValue: "Applied → v{{n}}", n: imp.appliedVersionNumber })}
          </span>
        ) : (
          <Button
            onClick={() => applyMutation.mutate()}
            disabled={acceptedCount === 0 || applyMutation.isPending}
          >
            {applyMutation.isPending ? (
              <Loader2 className="me-1 h-4 w-4 animate-spin" />
            ) : (
              <GitCommitHorizontal className="me-1 h-4 w-4" />
            )}
            {t("contracts.redline.applyN", {
              defaultValue: "Apply {{n}} accepted → new version",
              n: acceptedCount,
            })}
          </Button>
        )}
      </header>

      {imp.changes.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-muted">
          {t("contracts.redline.noChanges", {
            defaultValue: "No clause-level differences detected against the current version.",
          })}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {imp.changes.map((ch) => (
            <ChangeRow
              key={ch.id}
              change={ch}
              disabled={applied || decideMutation.isPending}
              onDecide={(decision) => decideMutation.mutate({ changeId: ch.id, decision })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ChangeRow({
  change,
  disabled,
  onDecide,
}: {
  change: RedlineChange;
  disabled: boolean;
  onDecide: (d: RedlineDecision) => void;
}) {
  const { t } = useTranslation();
  const typeMeta = {
    added: { Icon: Plus, label: t("contracts.redline.type.added", { defaultValue: "Added" }), cls: "bg-sage/15 text-sage" },
    removed: { Icon: Minus, label: t("contracts.redline.type.removed", { defaultValue: "Removed" }), cls: "bg-terracotta/15 text-terracotta" },
    modified: { Icon: Pencil, label: t("contracts.redline.type.modified", { defaultValue: "Modified" }), cls: "bg-amber/15 text-amber-ink" },
  }[change.changeType];
  const TypeIcon = typeMeta.Icon;

  return (
    <li
      className={cn(
        "px-4 py-3",
        change.decision === "accepted" && "bg-sage/[0.04]",
        change.decision === "rejected" && "bg-terracotta/[0.04]",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", typeMeta.cls)}>
            <TypeIcon className="h-3 w-3" aria-hidden />
            {typeMeta.label}
          </span>
          <span className="text-sm font-medium text-ink">
            {change.clauseHeading || t("contracts.redline.untitledClause", { defaultValue: "(untitled clause)" })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={change.decision === "accepted" ? "default" : "outline"}
            size="sm"
            disabled={disabled}
            onClick={() => onDecide(change.decision === "accepted" ? "pending" : "accepted")}
          >
            <Check className="me-1 h-3.5 w-3.5" />
            {t("contracts.redline.accept", { defaultValue: "Accept" })}
          </Button>
          <Button
            variant={change.decision === "rejected" ? "default" : "outline"}
            size="sm"
            disabled={disabled}
            onClick={() => onDecide(change.decision === "rejected" ? "pending" : "rejected")}
          >
            <X className="me-1 h-3.5 w-3.5" />
            {t("contracts.redline.reject", { defaultValue: "Reject" })}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {change.changeType !== "added" && (
          <div className="rounded-md border border-terracotta/30 bg-terracotta/[0.04] p-2">
            <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-terracotta">
              {t("contracts.redline.ours", { defaultValue: "Current (ours)" })}
            </div>
            <p className="whitespace-pre-wrap text-xs text-ink-muted">{change.ourText}</p>
          </div>
        )}
        {change.changeType !== "removed" && (
          <div className="rounded-md border border-sage/30 bg-sage/[0.04] p-2">
            <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-sage">
              {t("contracts.redline.theirs", { defaultValue: "Counterparty proposed" })}
            </div>
            <p className="whitespace-pre-wrap text-xs text-ink">{change.theirText}</p>
          </div>
        )}
      </div>
    </li>
  );
}
