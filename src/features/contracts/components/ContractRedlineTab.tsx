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
  UserPlus,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth.store";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/datetime";
import {
  contractRedlineService,
  type RedlineImport,
  type RedlineChange,
  type RedlineDecision,
  type RedlineApprover,
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
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <FileDiff className="h-4 w-4 text-gold" aria-hidden />
          {t("contracts.redline.title", { defaultValue: "Counterparty redline" })}
        </h2>
        <input
          ref={fileRef}
          type="file"
          accept=".docx,.pdf,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="hidden"
          onChange={onPick}
        />
        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploadMutation.isPending}>
          {uploadMutation.isPending ? (
            <Loader2 className="me-1 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="me-1 h-4 w-4" />
          )}
          {uploadMutation.isPending
            ? t("contracts.redline.analysing", { defaultValue: "Analysing…" })
            : t("contracts.redline.upload", { defaultValue: "Upload redline" })}
        </Button>
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

const DRAFTER_ROLES = new Set(["contract_drafter", "platform_admin", "Super Admin"]);

function RedlineReview({ contractId, importId }: { contractId: number; importId: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const role = useAuthStore((s) => s.user?.role?.name ?? "");
  const isDrafter = DRAFTER_ROLES.has(role);

  const { data: imp, isLoading } = useQuery({
    queryKey: ["redline-import", contractId, importId],
    queryFn: () => contractRedlineService.get(contractId, importId),
    staleTime: 10_000,
  });

  const { data: approvers = [] } = useQuery({
    queryKey: ["redline-approvers", contractId],
    queryFn: () => contractRedlineService.approvers(contractId),
    staleTime: 5 * 60_000,
  });

  const decideMutation = useMutation({
    mutationFn: ({ changeId, decision, comment }: { changeId: number; decision: RedlineDecision; comment?: string }) =>
      contractRedlineService.decide(contractId, importId, changeId, decision, comment),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["redline-import", contractId, importId] }),
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e.response?.data?.error?.message ?? t("contracts.redline.decideFailed", { defaultValue: "Could not record that decision." })),
  });

  const assignMutation = useMutation({
    mutationFn: ({ changeId, assigneeId }: { changeId: number; assigneeId: number | null }) =>
      contractRedlineService.assign(contractId, importId, changeId, assigneeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["redline-import", contractId, importId] }),
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e.response?.data?.error?.message ?? t("contracts.redline.assignFailed", { defaultValue: "Could not tag that approver." })),
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
        ) : isDrafter ? (
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
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1 text-[11px] text-ink-muted">
            <Lock className="h-3 w-3" aria-hidden />
            {t("contracts.redline.drafterOnly", {
              defaultValue: "{{n}} accepted · only a drafter can merge into a version",
              n: acceptedCount,
            })}
          </span>
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
              applied={applied}
              currentUserId={userId}
              approvers={approvers}
              busy={decideMutation.isPending || assignMutation.isPending}
              onDecide={(decision, comment) => decideMutation.mutate({ changeId: ch.id, decision, comment })}
              onAssign={(assigneeId) => assignMutation.mutate({ changeId: ch.id, assigneeId })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ChangeRow({
  change,
  applied,
  currentUserId,
  approvers,
  busy,
  onDecide,
  onAssign,
}: {
  change: RedlineChange;
  applied: boolean;
  currentUserId: number | null;
  approvers: RedlineApprover[];
  busy: boolean;
  onDecide: (d: RedlineDecision, comment?: string) => void;
  onAssign: (assigneeId: number | null) => void;
}) {
  const { t } = useTranslation();
  const [comment, setComment] = useState(change.reviewerComment ?? "");
  const typeMeta = {
    added: { Icon: Plus, label: t("contracts.redline.type.added", { defaultValue: "Added" }), cls: "bg-sage/15 text-sage" },
    removed: { Icon: Minus, label: t("contracts.redline.type.removed", { defaultValue: "Removed" }), cls: "bg-terracotta/15 text-terracotta" },
    modified: { Icon: Pencil, label: t("contracts.redline.type.modified", { defaultValue: "Modified" }), cls: "bg-amber/15 text-amber-ink" },
  }[change.changeType];
  const TypeIcon = typeMeta.Icon;

  const lockedToOther =
    change.assignedTo != null && change.assignedTo !== currentUserId;
  const canDecide = !applied && !lockedToOther;

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
        {lockedToOther ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink-muted">
            <Lock className="h-3 w-3" aria-hidden />
            {t("contracts.redline.awaiting", {
              defaultValue: "Awaiting {{name}}",
              name: change.assigneeName ?? t("contracts.redline.approver", { defaultValue: "approver" }),
            })}
          </span>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant={change.decision === "accepted" ? "default" : "outline"}
              size="sm"
              disabled={!canDecide || busy}
              onClick={() => onDecide(change.decision === "accepted" ? "pending" : "accepted", comment)}
            >
              <Check className="me-1 h-3.5 w-3.5" />
              {t("contracts.redline.accept", { defaultValue: "Accept" })}
            </Button>
            <Button
              variant={change.decision === "rejected" ? "default" : "outline"}
              size="sm"
              disabled={!canDecide || busy}
              onClick={() => onDecide(change.decision === "rejected" ? "pending" : "rejected", comment)}
            >
              <X className="me-1 h-3.5 w-3.5" />
              {t("contracts.redline.reject", { defaultValue: "Reject" })}
            </Button>
          </div>
        )}
      </div>

      {/* Tag-an-approver + reviewer comment (hidden once applied) */}
      {!applied && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-subtle">
            <UserPlus className="h-3 w-3" aria-hidden />
            {t("contracts.redline.tagApprover", { defaultValue: "Approver:" })}
          </span>
          <select
            value={change.assignedTo ?? ""}
            disabled={busy}
            onChange={(e) => onAssign(e.target.value ? Number(e.target.value) : null)}
            className="h-7 rounded-md border border-border bg-card px-2 text-xs text-ink"
          >
            <option value="">{t("contracts.redline.noApprover", { defaultValue: "— LC reviews —" })}</option>
            {approvers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.role.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          {canDecide && (
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("contracts.redline.commentPh", { defaultValue: "Add a review note (optional)…" })}
              className="h-7 min-w-[200px] flex-1 rounded-md border border-border bg-card px-2 text-xs text-ink"
            />
          )}
        </div>
      )}

      {change.reviewerComment && (
        <p className="mb-2 rounded-md bg-surface/60 px-2 py-1 text-[11px] text-ink-muted">
          “{change.reviewerComment}”
        </p>
      )}

      <RowDiff change={change} />
    </li>
  );
}

// ── Inline word-level diff (LCS) — highlights exactly what they changed ──────

type DiffSeg = { t: "same" | "add" | "del"; v: string };

function diffWords(oldText: string, newText: string): DiffSeg[] {
  const a = oldText.split(/(\s+)/);
  const b = newText.split(/(\s+)/);
  const n = a.length;
  const m = b.length;
  // LCS length table.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: DiffSeg[] = [];
  let i = 0;
  let j = 0;
  const pushSeg = (t: DiffSeg["t"], v: string) => {
    const last = out[out.length - 1];
    if (last && last.t === t) last.v += v;
    else out.push({ t, v });
  };
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pushSeg("same", a[i]!);
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      pushSeg("del", a[i]!);
      i += 1;
    } else {
      pushSeg("add", b[j]!);
      j += 1;
    }
  }
  while (i < n) pushSeg("del", a[i++]!);
  while (j < m) pushSeg("add", b[j++]!);
  return out;
}

function InlineDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const segs = diffWords(oldText, newText);
  return (
    <>
      {segs.map((s, i) =>
        s.t === "same" ? (
          <span key={i}>{s.v}</span>
        ) : s.t === "del" ? (
          <span key={i} className="rounded bg-terracotta/15 text-terracotta line-through">
            {s.v}
          </span>
        ) : (
          <span key={i} className="rounded bg-sage/20 text-sage">
            {s.v}
          </span>
        ),
      )}
    </>
  );
}

function RowDiff({ change }: { change: RedlineChange }) {
  const { t } = useTranslation();
  return (
    <div className="mt-2">
      <div className="rounded-md border border-border bg-surface/40 p-2.5">
        <div className="mb-1 flex items-center gap-3 font-mono text-[9px] uppercase tracking-wider text-ink-subtle">
          <span>
            {change.changeType === "modified"
              ? t("contracts.redline.theirEdits", { defaultValue: "Their edits highlighted" })
              : change.changeType === "added"
                ? t("contracts.redline.theirs", { defaultValue: "Counterparty proposed" })
                : t("contracts.redline.ours", { defaultValue: "Current clause (they removed)" })}
          </span>
          {change.changeType === "modified" && (
            <span className="flex items-center gap-2 normal-case tracking-normal text-ink-subtle">
              <span className="rounded bg-terracotta/15 px-1 text-terracotta line-through">{t("contracts.redline.removedWord", { defaultValue: "removed" })}</span>
              <span className="rounded bg-sage/20 px-1 text-sage">{t("contracts.redline.addedWord", { defaultValue: "added" })}</span>
            </span>
          )}
        </div>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink">
          {change.changeType === "modified" ? (
            <InlineDiff oldText={change.ourText ?? ""} newText={change.theirText ?? ""} />
          ) : change.changeType === "added" ? (
            <span className="rounded bg-sage/15 text-ink">{change.theirText}</span>
          ) : (
            <span className="text-terracotta line-through">{change.ourText}</span>
          )}
        </p>
      </div>
    </div>
  );
}
