/**
 * ContractDetail (S2) — single-contract detail surface with tabbed sections.
 *
 * Mode: harden — adapted from the Lovable contracts.$id.tsx + ContractCenterTabs
 * components. The Lovable implementation shipped 2,900+ combined lines of
 * supabase-coupled UI; this M1a version preserves the same visual idiom
 * (header card + status badge + tag chips + tabbed content) but routes every
 * data call through the M1a service layer.
 *
 * Tabs:
 *   - Overview      — read-only summary + tags editor (S8)
 *   - Edit          — ContractEditForm (S4)
 *   - Versions      — ContractVersionList (S9, S10)
 *   - Activity      — ContractActivityLog (S11)
 *   - Tree          — ContractTreeTimeline (S7)
 *
 * Header actions:
 *   - "Update status" → ContractStatusDialog (S6)
 *   - "Delete"        → ContractDeleteDialog (S5)
 *
 * AC mapping:
 *   AC-S2-01 — full Contract object via fn_contract_get_by_id.
 *   AC-S2-02 — 404 surfaced via the data-state branches.
 *   AC-S2-03 — 403 surfaced via the data-state branches.
 *   AC-S2-04 — bodyEn/bodyAr displayed but never console.logged (T13).
 *   AC-S2-05 — drafted_by/reviewed_by/approved_by null when user soft-deleted.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
// E26 fix — title-case + acronym preservation for contract_type chip.
import { humanizeLabel as humanizeContractType } from "@/features/dashboards/components/dashboard-primitives";
import {
  ArrowLeft,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileEdit,
  FileSignature,
  FileStack,
  RotateCcw,
  GitBranch,
  History,
  Languages,
  MoreHorizontal,
  PencilLine,
  Power,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
  Archive,
  FileText as FileTextIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useContract } from "@/features/contracts/hooks/useContracts";
import { formatDate, formatDateTime } from "@/utils/datetime";
import { cn } from "@/lib/utils";
import { translateApiError } from "@/lib/translate-api-error";
import { useAuthStore, selectHasPermission, selectUser } from "@/store/auth.store";
import { ContractStatusBadge } from "./ContractStatusBadge";
import { ContractStatusDialog } from "./ContractStatusDialog";
import { ContractDeleteDialog } from "./ContractDeleteDialog";
import { ContractEditForm } from "./ContractEditForm";
import { ContractTagsEditor } from "./ContractTagsEditor";
import { ContractVersionList } from "./ContractVersionList";
import { ContractActivityLog } from "./ContractActivityLog";
import { ContractTreeTimeline } from "./ContractTreeTimeline";
import { PaymentScheduleTab } from "./PaymentScheduleTab";
import { ExportPdfDialog } from "./ExportPdfDialog";
import { ContractDocumentTab } from "./ContractDocumentTab";
import { ContractInfoCards } from "./ContractInfoCards";
import { ContractApprovalChainCard } from "./ContractApprovalChainCard";
import { ContractAIInsightsPanel } from "./ContractAIInsightsPanel";
import { ContractAttachmentsTab } from "./ContractAttachmentsTab";
import { ContractCommentsTab } from "./ContractCommentsTab";
// M11 — Document Ingestion Pipeline
import { DocumentTabExtension } from "@/components/contracts/DocumentTabExtension";
import { IngestionStatusBadge } from "@/components/contracts/IngestionStatusBadge";
// M12 — Clause Extraction
import { ContractClausesTab } from "@/components/contracts/ContractClausesTab";
import { documentIngestionService } from "@/services/api/document-ingestion.service";
// M14 — CR-F — Risk Scoring
import { ContractRiskTab } from "./ContractRiskTab";
import { useContractVersions } from "@/features/contracts/hooks/useContracts";
import { ContractSignaturesTab } from "@/features/signatures/components/ContractSignaturesTab";
import { useApprovalChainByContract } from "@/features/approvals/hooks/useApprovals";
import { ApprovalDecisionDialog } from "@/features/approvals/components/ApprovalDecisionDialog";
import { SubmitForApprovalDialog } from "@/features/approvals/components/SubmitForApprovalDialog";
import { approvalService } from "@/services/api/approval.service";
import { signatureService } from "@/services/api/signature.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import type { Contract, ContractStatus, UserRef } from "@/types/entities/contract.types";

type Tab =
  | "overview"
  | "document"
  | "attachments"
  | "comments"
  | "edit"
  | "payments"
  | "versions"
  | "activity"
  | "tree"
  | "signatures"
  | "clauses"
  | "risk";

interface ContractDetailProps {
  contractId: number;
}

export function ContractDetail({ contractId }: ContractDetailProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  // R-LC2 LC-E10 — default tab → Document (Lovable parity; was "overview").
  // A28 (Aisha audit fix 2026-06-01) — approvers want metadata + parties +
  // approval stages on landing, not the legal body text. Default to overview
  // again; the Document tab is one click away.
  const [tab, setTab] = useState<Tab>("overview");
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusPreset, setStatusPreset] = useState<ContractStatus | undefined>(undefined);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // M1b — Export PDF dialog state.
  const [exportPdfOpen, setExportPdfOpen] = useState(false);
  // R-LC2 LC-E11 — track preset language so the same dialog can serve
  // both "Export PDF" (single-language) and "Export bilingual PDF" entries.
  const [exportPdfLanguage, setExportPdfLanguage] = useState<"en" | "ar" | "bilingual">("bilingual");

  // FE-C3 — defense-in-depth RBAC gating. BE returns 403 if a user without
  // a permission still hits the endpoint; these flags simply hide actions.
  const canEditPerm = useAuthStore(selectHasPermission("contract.edit"));
  // D57 — elevated-editor + privileged-role flags computed here; the
  // contract-aware portion (own-draft) is computed below once `data` is
  // loaded into `contract`, since the row is needed to inspect status and
  // draftedBy.id.
  const isElevatedEditor = useAuthStore(
    selectHasPermission("contract.edit.all"),
  );
  const isPrivilegedRole = useAuthStore(
    selectHasPermission("clause.review"), // legal_counsel proxy for redlining
  );
  const canDelete = useAuthStore(selectHasPermission("contract.delete"));
  const canChangeStatus = useAuthStore(selectHasPermission("contract.status.update"));
  const canManageTags = useAuthStore(selectHasPermission("contract.tag.manage"));
  const canApprove = useAuthStore(selectHasPermission("approval.act"));
  const canReviewClauses = useAuthStore(selectHasPermission("clause.review"));
  // M14 — CR-F: Risk tab visible to roles with score.read (hidden for contract_recipient)
  const canReadRiskScore = useAuthStore(selectHasPermission("score.read"));
  // BUG-006 fix (QA Phase 3 autonomous run 2026-05-31): executive + other read-all
  // roles lack ai.invoke.contract but the panel was always rendered → auto-fired
  // summary stream produced 403 + spam console errors. Gate panel on permission.
  const canUseAiInsights = useAuthStore(selectHasPermission("ai.invoke.contract"));
  // R-LC2 LC-E9 — legal counsel may keep Edit (for redlining) but does not
  // need Payments / Signatures tabs (drafter/admin context). Hide both
  // when the active user role is exactly legal_counsel.
  // R-RC1 — recipients are external counterparty signers. They sign;
  // they don't draft, edit, version, or audit. Hide every drafter-context
  // surface (Overview/Edit/Payments/Versions/Activity/Signatures/Tree),
  // hide the AI insights panel, and narrow the More-actions menu to
  // export-only.
  const userRole = useAuthStore((s) => s.user?.role.name ?? null);
  const isLegalCounselOnly = userRole === "legal_counsel";
  const isRecipientOnly = userRole === "contract_recipient";
  const isApproverOnly = userRole === "contract_approver";
  // Demo-gap fix 2026-06-08 — Grounded summary is the static metadata-bound
  // blurb shown above the streaming AI panel. For legal_counsel + approver
  // the richer 5-tab AI Insights panel below already covers Summary + Key
  // terms + Risk flags + Obligations + Regulatory, so the Grounded card
  // is duplicate noise. Hide it for those two personas; everyone else
  // (drafter / executive / platform admin) still sees it as a baseline.
  const hideGroundedSummary = isLegalCounselOnly || isApproverOnly;
  // D57 — canSeePaymentsTab + canSeeSignaturesTab depend on canEdit, which
  // is finalised below once `contract` is loaded. These two derived flags
  // are likewise computed after the `const contract = data` line.

  const { data, isLoading, isError, error, refetch } = useContract(contractId);

  // M11 — fetch versions to obtain the current version's ID for ingestion polling.
  // The Contract entity only exposes currentVersion (number), not the row ID.
  const versionsQuery = useContractVersions(contractId, { limit: 1 });
  const currentVersionId = versionsQuery.data?.data?.[0]?.id ?? null;

  // M11 — ingestion status polling for the Document tab.
  // Poll every 2s while status is pending/extracting; stop once terminal.
  const ingestionQuery = useQuery({
    queryKey: ["ingestionStatus", contractId, currentVersionId],
    queryFn: () =>
      documentIngestionService.getIngestionStatus(contractId, currentVersionId!),
    enabled: currentVersionId !== null,
    refetchInterval: (queryData) => {
      const status = queryData.state.data?.ingestionStatus;
      if (status === "pending" || status === "extracting") return 2_000;
      return false;
    },
    // Poll up to 60 seconds (30 × 2s intervals) then stop
    staleTime: 5_000,
    retry: false,
  });

  // 2026-06-04 — derive my pending step from THIS contract's approval chain
  // instead of the whole my-pending queue. The previous implementation fired
  // GET /approvals/my-pending?limit=100 then filtered to this contract, which
  // forced a slow, unrelated round-trip and made the action button take ~30s
  // to appear on the detail page. The chain endpoint is already needed for
  // the chain card below and scopes the data to this contract only.
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const currentRoleName = useAuthStore((s) => s.user?.role?.name ?? null);
  // canApprove gate is FE-only; even if the chain loads for a non-approver
  // the derivation below returns null (no role match) and the trigger button
  // stays hidden — so we don't need to disable the query separately.
  // v611 — also enable the chain query for drafters so the resubmission
  // banner + Submit-for-approval button can read the latest decision
  // note. Cheap scoped query; covered by the same endpoint cache.
  const chainQuery = useApprovalChainByContract(
    canApprove || currentRoleName === "contract_drafter" ? contractId : null,
  );
  const myPendingStep = useMemo(() => {
    const steps = chainQuery.data?.steps ?? [];
    const match = steps.find((s) => {
      if (s.status !== "pending") return false;
      const explicit =
        (s.approverUser?.id != null && s.approverUser.id === currentUserId) ||
        (s.delegatedTo?.id != null && s.delegatedTo.id === currentUserId) ||
        (s.reassignedTo?.id != null && s.reassignedTo.id === currentUserId);
      const roleFallback =
        s.approverUser == null &&
        s.delegatedTo == null &&
        s.reassignedTo == null &&
        !!currentRoleName &&
        s.approverRole === currentRoleName;
      return explicit || roleFallback;
    });
    return match ? { stepId: match.id } : null;
  }, [chainQuery.data?.steps, currentUserId, currentRoleName]);
  const [approveOpen, setApproveOpen] = useState(false);

  // v611 — find the latest request_resubmission decision across the chain
  // so the drafter sees a clear callout of what the approver asked for.
  // Decisions inside each step are ASC by decided_at (per BE contract).
  const lastResubmissionNote = useMemo(() => {
    const steps = chainQuery.data?.steps ?? [];
    let best: { note: string; decidedBy: string; decidedAt: string } | null = null;
    for (const s of steps) {
      for (const d of s.decisions ?? []) {
        if (d.decision !== "request_resubmission") continue;
        if (!d.decisionNote) continue;
        if (!best || d.decidedAt > best.decidedAt) {
          best = {
            note: d.decisionNote,
            decidedBy: [d.decidedBy?.firstName, d.decidedBy?.lastName].filter(Boolean).join(" ") || "Approver",
            decidedAt: d.decidedAt,
          };
        }
      }
    }
    return best;
  }, [chainQuery.data?.steps]);

  // v611 — drafter-facing Submit for approval dialog state.
  const [submitOpen, setSubmitOpen] = useState(false);

  // v611.3 — Inline Edit panel state. Edit is no longer a tab; the
  // header "Edit" button opens this panel above the tabs and the page
  // smooth-scrolls to it via editPanelRef so the drafter lands on the
  // form. Save / Cancel collapse it back.
  const [editOpen, setEditOpen] = useState(false);
  const editPanelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (editOpen && editPanelRef.current) {
      editPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [editOpen]);

  // R5 audit — Watch toggle. Local state for UX; we don't have a GET-watch
  // endpoint so we start unset and let the user toggle. The watch tab on
  // /app/approvals reflects the actual server state.
  const [watching, setWatching] = useState<boolean | null>(null);
  const qc = useQueryClient();
  const watchMutation = useMutation({
    mutationFn: ({ id, value }: { id: number; value: boolean }) =>
      approvalService.setContractWatch(id, value),
    onSuccess: (_data, variables) => {
      setWatching(variables.value);
      void qc.invalidateQueries({ queryKey: ["approval", "watching"] });
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1280px] space-y-4 p-6">
        <div
          className="h-24 animate-pulse rounded-lg bg-surface"
          aria-busy="true"
          aria-label={t("common.loading")}
        />
        <div className="h-64 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  if (isError || !data) {
    const status = error?.status;
    const messageKey =
      status === 404
        ? "contracts.detail.notFound"
        : status === 403
          ? "contracts.detail.forbidden"
          : "common.error";
    return (
      <div className="mx-auto w-full max-w-md p-12 text-center">
        <h1 className="text-base font-semibold text-ink">{t(messageKey)}</h1>
        {error && status !== 404 && status !== 403 && (
          <p className="mt-2 text-sm text-destructive">{translateApiError(error, t)}</p>
        )}
        <div className="mt-4 flex justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void navigate({ to: "/app/contracts" })}
          >
            <ArrowLeft className="h-4 w-4" />
            {t("contracts.detail.backToList")}
          </Button>
          {status !== 404 && status !== 403 && (
            <Button type="button" size="sm" onClick={() => void refetch()}>
              {t("common.retry")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const contract = data;
  const isAr = i18n.language?.startsWith("ar");
  const displayTitle = isAr && contract.titleAr ? contract.titleAr : contract.titleEn;

  // D57 — drafter's contract.edit scope is "edit-own-while-draft" only.
  // Now that `contract` is loaded, finalise canEdit by combining the
  // contract-aware own-draft check with the elevated-editor + privileged
  // perms computed above. A contract in active / in_approval / fully_signed
  // is locked even for the drafter who created it; legal_counsel keeps
  // Edit for redlining; contract.edit.all keeps Edit for admins.
  const isOwnDraft =
    contract.status === "draft" &&
    contract.draftedBy?.id != null &&
    contract.draftedBy.id === currentUserId;
  const canEdit =
    canEditPerm && (isOwnDraft || isElevatedEditor || isPrivilegedRole);
  const canSeePaymentsTab = canEdit && !isLegalCounselOnly && !isRecipientOnly;
  const canSeeSignaturesTab = canEdit && !isLegalCounselOnly && !isRecipientOnly;

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-4 p-6">
      <Breadcrumb contractNumber={contract.contractNumber} />

      {/* v611 — Resubmission banner. Only shows when the drafter owns
          this contract AND there is a request_resubmission note on the
          chain (set by an approver). Mirrors the Legal-Counsel approval
          feedback so the drafter knows WHY the contract came back. */}
      {isOwnDraft &&
        currentRoleName === "contract_drafter" &&
        lastResubmissionNote && (
          <div
            role="status"
            className="rounded-md border border-amber/40 bg-amber-tint/40 px-4 py-3 text-sm text-amber-ink"
          >
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider">
              {t("contracts.detail.resubmission.kicker", {
                defaultValue: "Changes requested by {{name}}",
                name: lastResubmissionNote.decidedBy,
              })}
            </div>
            <p className="whitespace-pre-line">{lastResubmissionNote.note}</p>
            <p className="mt-1 font-mono text-[10px] text-amber-ink/80">
              {formatDateTime(lastResubmissionNote.decidedAt)}
            </p>
          </div>
        )}

      {/* Compact header — matches Lovable's title + chips + ... menu */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{displayTitle}</h1>
          {/* Re-audit fix — only show the OTHER language translation when
              actor is on AR (showing EN as secondary). When actor is on EN
              keep the header clean — the Arabic title is noise in the EN
              experience and clutters the demo screen. */}
          {isAr && contract.titleEn && contract.titleEn !== displayTitle && (
            <p className="mt-1 text-sm text-ink-muted">{contract.titleEn}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ContractStatusBadge status={contract.status} />
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-ink-muted">
              {/* E26 fix — title-case + acronym preservation
                  ("services" → "Services", "epc" → "EPC"). */}
              {contract.contractType
                ? t(`contractType.${contract.contractType}`, {
                    defaultValue: humanizeContractType(contract.contractType),
                  })
                : "—"}
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
              {contract.language === "bilingual"
                ? "AR · EN"
                : (contract.language?.toUpperCase() ?? "—")}
            </span>
            <span className="ms-2 text-[11px] text-ink-subtle">
              {t("contracts.detail.updatedAt", { when: formatDateTime(contract.updatedAt) })}
            </span>
            {/* M11 — Ingestion status badge (only when we have status data) */}
            {ingestionQuery.data?.ingestionStatus && (
              <IngestionStatusBadge
                status={ingestionQuery.data.ingestionStatus}
                engine={ingestionQuery.data.extractionEngine}
                confidence={ingestionQuery.data.ocrConfidenceAvg}
              />
            )}
          </div>
        </div>
        <div className="flex items-start gap-2">
          {/* R5 audit — Watch toggle. R-RC1 — recipients are external
              counterparty signers; the Watch toggle is a drafter/approver
              affordance, not relevant to a one-off signer. */}
          {!isRecipientOnly && (
            // E27 fix — title attribute clarifies what the button does;
            // aria-pressed conveys current state to screen readers.
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                watchMutation.mutate({ id: contract.id, value: !(watching ?? false) })
              }
              disabled={watchMutation.isPending}
              className="hidden sm:inline-flex"
              aria-pressed={!!watching}
              title={watching
                ? t("contracts.detail.actions.unwatchTitle", { defaultValue: "You are subscribed to this contract. Click to unsubscribe from change alerts." })
                : t("contracts.detail.actions.watchTitle", { defaultValue: "Subscribe to change alerts for this contract." })}
            >
              {watching ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  {t("contracts.detail.actions.unwatch", { defaultValue: "Unwatch" })}
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  {t("contracts.detail.actions.watch", { defaultValue: "Watch" })}
                </>
              )}
            </Button>
          )}
          {/* 2026-06-04 — single "Action" CTA. The decision (approve / reject /
              request resubmission / delegate) is chosen INSIDE the dialog;
              the trigger does not pre-select. */}
          {myPendingStep && contract.status === "in_approval" && (
            <Button
              type="button"
              size="sm"
              onClick={() => setApproveOpen(true)}
              className="hidden sm:inline-flex"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("contracts.detail.actions.action", { defaultValue: "Action" })}
            </Button>
          )}
          {/* v611 — drafter Submit-for-approval CTA. Shows when the
              actor is the drafter of this contract AND the contract is
              currently a draft (initial submission OR resubmission after
              a request_resubmission decision sent it back). Opens the
              existing SubmitForApprovalDialog which previews the chain
              and POSTs to /submit-for-approval. */}
          {isOwnDraft && currentRoleName === "contract_drafter" && (
            <>
              {/* v611.3 — Inline Edit button. Opens the edit panel above
                  the tabs and smooth-scrolls to it so the drafter can
                  amend the body, save, then click Resubmit. */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
                className="hidden sm:inline-flex"
              >
                <PencilLine className="h-3.5 w-3.5" />
                {t("contracts.detail.actions.edit", { defaultValue: "Edit" })}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setSubmitOpen(true)}
                className="hidden sm:inline-flex"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {lastResubmissionNote
                  ? t("contracts.detail.actions.resubmit", { defaultValue: "Resubmit for approval" })
                  : t("contracts.detail.actions.submit", { defaultValue: "Submit for approval" })}
              </Button>
            </>
          )}
          {/* R-RC1 — recipient-perspective top-level Sign CTA. Visible when
              the user is a contract_recipient AND the contract is in a
              signable bucket.
              R-RC2 — click resolves the actor's pending invitation server-
              side (caller-bound BE fn), receives a fresh plaintext token,
              and navigates to the public /sign/{token} signing UI. The
              old invitation is rolled to invalidate any leaked link. */}
          {isRecipientOnly &&
            ["awaiting_counterparty", "awaiting_signature_employer", "awaiting_signature_counterparty"].includes(
              contract.status as never,
            ) && (
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  // Open a placeholder window *synchronously* during the
                  // user click so popup blockers don't intercept it. We
                  // then mint the token and rewrite the popup's URL.
                  // (window.open after an await is treated as non-gesture
                  // and silently demoted to same-tab on many browsers.)
                  const popup = window.open("about:blank", "_blank", "noopener,noreferrer");
                  try {
                    const r = await signatureService.resolveSigningLinkForSelf(contract.id);
                    const url = `/sign/${encodeURIComponent(r.invitationTokenPlaintext)}`;
                    if (popup && !popup.closed) {
                      popup.location.href = url;
                    } else {
                      // popup blocked → fall back to same-tab nav
                      window.location.href = url;
                    }
                  } catch (e) {
                    if (popup && !popup.closed) popup.close();
                    toast.error(translateApiError(e, t));
                  }
                }}
                className="hidden sm:inline-flex"
              >
                <FileSignature className="h-3.5 w-3.5" />
                {t("contracts.detail.actions.sign", { defaultValue: "Sign" })}
              </Button>
            )}
          {/* D54 — duplicate "Edit" header button removed. The Edit tab in
              the tab strip below is the canonical entry point; rendering
              the same affordance twice in different chrome (top-right
              button + 5th tab) was confusing without adding value. */}
          {/* L45 — Draft Cure Notice action surfaced to legal_counsel.
              Links to the advisory queue with the contract pre-filtered so Layla
              lands on (or can create) a cure notice tied to this contract. */}
          {isLegalCounselOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                navigate({
                  to: "/app/legal/advisory-queue",
                  search: { contract: String(contract.id) } as never,
                })
              }
              className="hidden sm:inline-flex border-gold/30 text-gold hover:bg-gold/5"
            >
              <FileEdit className="h-3.5 w-3.5" />
              {t("contracts.detail.actions.draftCureNotice", {
                defaultValue: "Draft Cure Notice",
              })}
            </Button>
          )}
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={t("contracts.detail.moreActions", { defaultValue: "More actions" })}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuLabel>
                  {t("contracts.detail.moreActions", { defaultValue: "More actions" })}
                </DropdownMenuLabel>
                {/* R-RC1 — recipient More-actions menu narrows to export-only.
                    Recipients are external counterparty signers; never show
                    Duplicate / Save-as-template / Amend / Renew / Terminate /
                    Archive / Delete. */}
                {!isRecipientOnly && (
                  <DropdownMenuItem
                    onSelect={() =>
                      toast.info(
                        t("contracts.detail.actions.duplicateComingSoon", {
                          defaultValue: "Duplicate is coming in a future module.",
                        }),
                      )
                    }
                  >
                    <Copy className="me-2 h-3.5 w-3.5" />
                    {t("contracts.detail.actions.duplicate", { defaultValue: "Duplicate" })}
                  </DropdownMenuItem>
                )}
                {!isRecipientOnly && (
                  <DropdownMenuItem
                    onSelect={() =>
                      toast.info(
                        t("contracts.detail.actions.saveAsTemplateComingSoon", {
                          defaultValue: "Save as template is coming in a future module.",
                        }),
                      )
                    }
                  >
                    <FileStack className="me-2 h-3.5 w-3.5" />
                    {t("contracts.detail.actions.saveAsTemplate", {
                      defaultValue: "Save as template",
                    })}
                  </DropdownMenuItem>
                )}
                {/* R0 audit bug 8.5.1: Export is read-only — anyone who can
                    read the contract can export it. Lovable shows this for
                    every role. */}
                {/* R-LC2 LC-E11 — separate Export PDF (single-language) item
                    matches Lovable. Defaults dialog language to current
                    contract.language (or "en" fallback). */}
                <DropdownMenuItem
                  onSelect={() => {
                    setExportPdfLanguage(
                      contract.language === "ar" ? "ar" : "en",
                    );
                    setExportPdfOpen(true);
                  }}
                >
                  <FileTextIcon className="me-2 h-3.5 w-3.5" />
                  {t("contracts.detail.actions.exportPdf", {
                    defaultValue: "Export PDF",
                  })}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setExportPdfLanguage("bilingual");
                    setExportPdfOpen(true);
                  }}
                >
                  <Languages className="me-2 h-3.5 w-3.5" />
                  {t("contracts.detail.actions.exportBilingualPdf", {
                    defaultValue: "Export bilingual PDF",
                  })}
                </DropdownMenuItem>
                {/* R5 audit 8.5.2 + R-LC2 LC-E13: Amend / Renew items match
                    Lovable. Both items disabled unless contract.status is
                    fully_signed (Lovable parity).
                    R-RC1 — hidden for recipient role. */}
                {!isRecipientOnly && (
                  <DropdownMenuItem
                    disabled={contract.status !== "fully_signed"}
                    onSelect={() =>
                      toast.info(
                        t("contracts.detail.actions.amendComingSoon", {
                          defaultValue:
                            "Amend will be available when the contract amendment workflow ships.",
                        }),
                      )
                    }
                  >
                    <FileSignature className="me-2 h-3.5 w-3.5" />
                    {t("contracts.detail.actions.amend", { defaultValue: "Amend" })}
                  </DropdownMenuItem>
                )}
                {!isRecipientOnly && (
                  <DropdownMenuItem
                    disabled={contract.status !== "fully_signed"}
                    onSelect={() =>
                      toast.info(
                        t("contracts.detail.actions.renewComingSoon", {
                          defaultValue:
                            "Renew will be available when the contract renewal workflow ships.",
                        }),
                      )
                    }
                  >
                    <RotateCcw className="me-2 h-3.5 w-3.5" />
                    {t("contracts.detail.actions.renew", { defaultValue: "Renew" })}
                  </DropdownMenuItem>
                )}
                {!isRecipientOnly && canChangeStatus && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => {
                        setStatusPreset(undefined);
                        setStatusOpen(true);
                      }}
                    >
                      <History className="me-2 h-3.5 w-3.5" />
                      {t("contracts.status.action")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        toast.info(
                          t("contracts.detail.actions.terminateComingSoon", {
                            defaultValue:
                              "Terminate transition is not yet wired to a BE endpoint.",
                          }),
                        )
                      }
                    >
                      <Power className="me-2 h-3.5 w-3.5 text-destructive" />
                      {t("contracts.detail.actions.terminate", {
                        defaultValue: "Terminate",
                      })}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        toast.info(
                          t("contracts.detail.actions.archiveComingSoon", {
                            defaultValue:
                              "Archive transition is not yet wired to a BE endpoint.",
                          }),
                        )
                      }
                    >
                      <Archive className="me-2 h-3.5 w-3.5" />
                      {t("contracts.detail.actions.archive", {
                        defaultValue: "Archive",
                      })}
                    </DropdownMenuItem>
                  </>
                )}
                {!isRecipientOnly && canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setDeleteOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="me-2 h-3.5 w-3.5" />
                      {t("common.delete")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      {/* Three info cards (Lovable layout) */}
      <ContractInfoCards
        contract={contract}
        clauseCount={(() => {
          // R-LC0 LC-E7 — derive clause count from body markdown H2 headings.
          const body = contract.bodyEn ?? contract.bodyAr ?? "";
          if (!body) return undefined;
          const matches = body.match(/^##\s+\d+\.|^##\s+[A-Za-z]/gm);
          return matches?.length ?? undefined;
        })()}
      />

      {/* R-LC2 LC-E8 — approval chain visualization (Lovable parity).
          Renders only when the contract has an active or completed chain. */}
      {(["in_approval", "approved", "rejected", "resubmission_requested"] as const).includes(
        contract.status as never,
      ) && <ContractApprovalChainCard contractId={contract.id} />}

      {/* v611.3 — Inline edit panel. Opens above the tabs when the drafter
          clicks the header "Edit" button. Mount unconditionally + toggle
          render so the smooth-scroll target exists across re-renders. */}
      {editOpen && canEdit && !isRecipientOnly && (
        <div ref={editPanelRef} role="region" aria-label="Edit contract">
          <ContractEditForm
            contract={contract}
            onSaved={() => setEditOpen(false)}
            onCancel={() => setEditOpen(false)}
          />
        </div>
      )}

      {/* Tabs */}
      <div
        role="tablist"
        aria-label={t("contracts.detail.tabsLabel")}
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {/* R-RC1 — recipients see only Document / Attachments / Comments / Activity.
            Overview / Edit / Payments / Versions / Signatures / Tree are drafter
            or admin context surfaces and are hidden here. */}
        {!isRecipientOnly && (
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
            {t("contracts.detail.tabs.overview")}
          </TabButton>
        )}
        <TabButton active={tab === "document"} onClick={() => setTab("document")}>
          <FileTextIcon className="h-3.5 w-3.5" />
          {t("contracts.detail.tabs.document", { defaultValue: "Document" })}
        </TabButton>
        <TabButton active={tab === "attachments"} onClick={() => setTab("attachments")}>
          {t("contracts.detail.tabs.attachments", { defaultValue: "Attachments" })}
        </TabButton>
        <TabButton active={tab === "comments"} onClick={() => setTab("comments")}>
          {t("contracts.detail.tabs.comments", { defaultValue: "Comments" })}
        </TabButton>
        {/* v611.3 — Edit tab removed. Per drafter feedback, editing now
            lives in an inline panel triggered by the "Edit" button in
            the header. Keeps the tab bar focused on read-only views. */}
        {canSeePaymentsTab && (
          <TabButton active={tab === "payments"} onClick={() => setTab("payments")}>
            <Wallet className="h-3.5 w-3.5" />
            {t("contracts.detail.tabs.payments")}
          </TabButton>
        )}
        {!isRecipientOnly && (
          <TabButton active={tab === "versions"} onClick={() => setTab("versions")}>
            {t("contracts.detail.tabs.versions")}
          </TabButton>
        )}
        <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>
          {t("contracts.detail.tabs.activity")}
        </TabButton>
        {canSeeSignaturesTab && (
          <TabButton active={tab === "signatures"} onClick={() => setTab("signatures")}>
            {t("contracts.detail.tabs.signatures")}
          </TabButton>
        )}
        {!isRecipientOnly && (
          <TabButton active={tab === "tree"} onClick={() => setTab("tree")}>
            <GitBranch className="h-3.5 w-3.5" />
            {t("contracts.detail.tabs.tree")}
          </TabButton>
        )}
        {/* M12 — Clause extraction tab (clause.review or platform_admin) */}
        {canReviewClauses && !isRecipientOnly && (
          <TabButton active={tab === "clauses"} onClick={() => setTab("clauses")}>
            {t("contracts.detail.tabs.clauses", { defaultValue: "Clauses" })}
          </TabButton>
        )}
        {/* M14 — CR-F: Risk tab (score.read; hidden for recipient) */}
        {canReadRiskScore && !isRecipientOnly && (
          <TabButton active={tab === "risk"} onClick={() => setTab("risk")}>
            {t("contracts.detail.tabs.risk", { defaultValue: "Risk" })}
          </TabButton>
        )}
      </div>

      {/* Tab panels */}
      {/* E25 fix — wrap each conditionally-rendered tab body in
          <div role="tabpanel"> so screen readers can pair the active
          <button role="tab"> with its panel content. */}
      {tab === "overview" && (
        <div role="tabpanel" aria-labelledby="tab-overview">
          <OverviewPanel contract={contract} canManageTags={canManageTags} />
        </div>
      )}
      {tab === "document" && (
        <div role="tabpanel" aria-labelledby="tab-document">
          <DocumentTabExtension
            contractId={contract.id}
            versionId={currentVersionId ?? 0}
            ingestionStatus={
              currentVersionId ? ingestionQuery.data?.ingestionStatus : undefined
            }
            extractionEngine={ingestionQuery.data?.extractionEngine}
            pageCount={ingestionQuery.data?.pageCount}
            lowConfidencePageCount={ingestionQuery.data?.lowConfidencePageCount}
          >
            <ContractDocumentTab contract={contract} />
          </DocumentTabExtension>
        </div>
      )}
      {tab === "attachments" && (
        <div role="tabpanel" aria-labelledby="tab-attachments">
          <ContractAttachmentsTab
            contractId={contract.id}
            currentVersionId={currentVersionId}
          />
        </div>
      )}
      {tab === "comments" && (
        <div role="tabpanel" aria-labelledby="tab-comments">
          <ContractCommentsTab contractId={contract.id} />
        </div>
      )}
      {tab === "edit" && (
        <div role="tabpanel" aria-labelledby="tab-edit">
          <ContractEditForm contract={contract} onSaved={() => setTab("overview")} />
        </div>
      )}
      {tab === "payments" && (
        <div role="tabpanel" aria-labelledby="tab-payments">
          <PaymentScheduleTab contractId={contract.id} canEdit={canEdit} />
        </div>
      )}
      {tab === "versions" && (
        <div role="tabpanel" aria-labelledby="tab-versions">
          <ContractVersionList contractId={contract.id} canCreate={canEdit} />
        </div>
      )}
      {tab === "activity" && (
        <div role="tabpanel" aria-labelledby="tab-activity">
          <ContractActivityLog contractId={contract.id} />
        </div>
      )}
      {tab === "signatures" && (
        <div role="tabpanel" aria-labelledby="tab-signatures">
          <ContractSignaturesTab
            contractId={contract.id}
            contractNumber={contract.contractNumber}
          />
        </div>
      )}
      {tab === "tree" && (
        <div role="tabpanel" aria-labelledby="tab-tree">
          <ContractTreeTimeline contractId={contract.id} />
        </div>
      )}
      {tab === "clauses" && (
        <div role="tabpanel" aria-labelledby="tab-clauses">
          <ContractClausesTab contractId={contract.id} />
        </div>
      )}
      {/* M14 — CR-F: Risk tab */}
      {tab === "risk" && (
        <div role="tabpanel" aria-labelledby="tab-risk">
          <ContractRiskTab contractId={contract.id} />
        </div>
      )}

      {/* L42 + L43 — Grounded AI summary card.
          When contract.ai_summary_en/ar is populated (seeded with grounded
          metadata-aware text), render it directly above the streaming AI
          panel. This prevents the streaming LLM from fabricating financial
          values (e.g. "AED 500,000" on a AED 4.22B contract) and keeps
          credible content on screen for the demo audience. */}
      {!isRecipientOnly && !hideGroundedSummary && (contract.aiSummaryEn || contract.aiSummaryAr) && (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="text-base font-semibold text-ink">
              {t("contracts.detail.groundedSummary.title", { defaultValue: "Grounded summary" })}
            </h2>
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
              {t("contracts.detail.groundedSummary.tag", { defaultValue: "Metadata-bound" })}
            </span>
          </div>
          <p
            className="whitespace-pre-wrap text-sm leading-6 text-ink-muted"
            dir={i18n.language?.startsWith("ar") ? "rtl" : "ltr"}
          >
            {i18n.language?.startsWith("ar")
              ? contract.aiSummaryAr ?? contract.aiSummaryEn ?? ""
              : contract.aiSummaryEn ?? contract.aiSummaryAr ?? ""}
          </p>
          {/* E-rev-10 — append a deterministic risk-profile blurb so the audience
              sees WHY the contract is high/low risk. Renders only when
              ai_risk_score is set (avoids "n/a" noise on draft contracts). */}
          {typeof contract.aiRiskScore === "number" && contract.aiRiskScore > 0 && (
            <div className="mt-4 rounded-lg border border-border/60 bg-surface p-3">
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  {t("contracts.detail.groundedSummary.riskProfile", { defaultValue: "Risk profile" })}
                </span>
                <span
                  className={
                    contract.aiRiskScore >= 60
                      ? "rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive"
                      : contract.aiRiskScore >= 30
                      ? "rounded-full bg-amber-tint/40 px-2 py-0.5 text-[10px] font-medium text-amber-ink"
                      : "rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                  }
                >
                  {contract.aiRiskScore} / 100 ·{" "}
                  {contract.aiRiskScore >= 60
                    ? t("risk.score.gauge.high", { defaultValue: "High risk" })
                    : contract.aiRiskScore >= 30
                    ? t("risk.score.gauge.medium", { defaultValue: "Medium risk" })
                    : t("risk.score.gauge.low", { defaultValue: "Low risk" })}
                </span>
              </div>
              <p className="text-xs leading-5 text-ink-muted">
                {contract.aiRiskScore >= 60
                  ? t("contracts.detail.groundedSummary.highRiskBlurb", {
                      defaultValue:
                        "This contract carries elevated risk driven by contract value, complexity of obligations, and regulatory touch points. Review the Risk tab for the five-dimension breakdown and any external correlation signals that may shift the score.",
                    })
                  : contract.aiRiskScore >= 30
                  ? t("contracts.detail.groundedSummary.mediumRiskBlurb", {
                      defaultValue:
                        "Risk profile is moderate. Standard indemnity, payment, and termination provisions apply; routine monitoring is sufficient.",
                    })
                  : t("contracts.detail.groundedSummary.lowRiskBlurb", {
                      defaultValue:
                        "Risk profile is low. Limited value at stake and a single regulatory footprint; no immediate escalation indicated.",
                    })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Inline AI insights — Lovable layout.
          R-RC1 — recipients are external counterparty signers and don't
          hold ai.invoke.contract; hide the panel rather than render an
          empty/forbidden state.
          BUG-006 fix — Eman Executive + other read-all roles also lack
          ai.invoke.contract; the panel previously rendered + auto-fired
          a 403 stream. Now gated explicitly on canUseAiInsights.
          L42/L43 fix — also hide the streaming AI panel when the contract
          has no clauses extracted AND no body text — the LLM will fabricate
          financial details that contradict metadata. */}
      {!isRecipientOnly && canUseAiInsights && !!(contract.bodyEn?.trim() || contract.bodyAr?.trim()) && (
        <ContractAIInsightsPanel contractId={contract.id} />
      )}

      {/* Modals */}
      {statusOpen && (
        <ContractStatusDialog
          contractId={contract.id}
          contractNumber={contract.contractNumber}
          currentStatus={contract.status}
          open={statusOpen}
          onClose={() => {
            setStatusOpen(false);
            setStatusPreset(undefined);
          }}
          presetTarget={statusPreset}
        />
      )}
      {deleteOpen && (
        <ContractDeleteDialog
          contractId={contract.id}
          contractNumber={contract.contractNumber}
          contractTitle={displayTitle}
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          redirectOnSuccess
        />
      )}
      {exportPdfOpen && (
        <ExportPdfDialog
          contractId={contract.id}
          contractNumber={contract.contractNumber}
          open={exportPdfOpen}
          onClose={() => setExportPdfOpen(false)}
          initialLanguage={exportPdfLanguage}
        />
      )}

      {/* 2026-06-04 — Action dialog. No initialKind so the approver explicitly
          picks approve / reject / request_resubmission / delegate inside. */}
      {approveOpen && myPendingStep && (
        <ApprovalDecisionDialog
          stepId={myPendingStep.stepId}
          currentUserId={currentUserId}
          open={approveOpen}
          onClose={() => setApproveOpen(false)}
        />
      )}

      {/* v611 — drafter Submit-for-approval dialog. Previews the chain
          + POSTs to /contracts/:id/submit-for-approval. Triggered from
          the new Submit/Resubmit button in the header. */}
      {submitOpen && (
        <SubmitForApprovalDialog
          contractId={contract.id}
          contractType={contract.contractType}
          valueAed={contract.valueAed ?? 0}
          open={submitOpen}
          onClose={() => setSubmitOpen(false)}
        />
      )}

    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ContractMetricStrip({ contract }: { contract: Contract }) {
  const { t } = useTranslation();
  const daysToExpiry = useMemo(() => {
    if (!contract.endDate) return null;
    const end = new Date(contract.endDate).getTime();
    return Math.floor((end - Date.now()) / (1000 * 60 * 60 * 24));
  }, [contract.endDate]);

  const expiryClass =
    daysToExpiry == null
      ? "text-ink-muted"
      : daysToExpiry < 0
        ? "text-terracotta"
        : daysToExpiry <= 30
          ? "text-amber-ink"
          : "text-ink";

  const expiryLabel =
    daysToExpiry == null
      ? "—"
      : daysToExpiry < 0
        ? t("contracts.detail.metrics.expiredAgo", {
            count: Math.abs(daysToExpiry),
            defaultValue: "Expired {{count}}d ago",
          })
        : t("contracts.detail.metrics.expiresIn", {
            count: daysToExpiry,
            defaultValue: "{{count}} d to expiry",
          });

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-3.5 w-3.5 text-gold" />
          <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
            {t("contracts.fields.valueAed")}
          </p>
        </div>
        <p className="mt-1.5 font-mono text-xl font-semibold text-ink">
          {contract.valueAed === null
            ? "—"
            : `${contract.currency} ${contract.valueAed.toLocaleString()}`}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <CalendarClock className={`h-3.5 w-3.5 ${expiryClass}`} />
          <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
            {t("contracts.detail.metrics.expiry", { defaultValue: "Expiry" })}
          </p>
        </div>
        <p className={`mt-1.5 font-mono text-xl font-semibold ${expiryClass}`}>
          {expiryLabel}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <FileSignature className="h-3.5 w-3.5 text-ink-subtle" />
          <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
            {t("contracts.detail.metrics.attachments", {
              defaultValue: "Attachments",
            })}
          </p>
        </div>
        <p className="mt-1.5 font-mono text-xl font-semibold text-ink">
          {contract.attachmentCount}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-ink-subtle" />
          <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
            {t("contracts.detail.metrics.versions", {
              defaultValue: "Versions",
            })}
          </p>
        </div>
        <p className="mt-1.5 font-mono text-xl font-semibold text-ink">
          v{contract.currentVersion}
        </p>
      </div>
    </section>
  );
}

interface BreadcrumbProps {
  contractNumber: string;
}

function Breadcrumb({ contractNumber }: BreadcrumbProps) {
  const { t, i18n } = useTranslation();
  // FE-C6 — locale-aware chevron: in RTL the visual flow is right-to-left,
  // so the separator should point left.
  const isRtl = i18n.language?.startsWith("ar");
  const Chevron = isRtl ? ChevronLeft : ChevronRight;
  return (
    <nav className="flex items-center gap-1 text-xs text-ink-muted">
      <Link to="/app/contracts" className="hover:text-ink">
        {t("contracts.title")}
      </Link>
      <Chevron className="h-3 w-3 text-ink-subtle" aria-hidden="true" />
      <span className="font-mono text-ink">{contractNumber}</span>
    </nav>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** E25 fix — used as id so role=tabpanel can pair via aria-labelledby. */
  panelId?: string;
}

function TabButton({ active, onClick, children, panelId }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      id={panelId}
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        active ? "border-gold text-ink" : "border-transparent text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

interface OverviewPanelProps {
  contract: Contract;
  /** Defense-in-depth flag — when false, tags render read-only. */
  canManageTags: boolean;
}

function OverviewPanel({ contract, canManageTags }: OverviewPanelProps) {
  const { t } = useTranslation();
  // R19+R20 (Rashid audit 2026-06-01) — gate the People + Tags sub-cards
  // so external counterparty signers don't see internal personnel + triage
  // tags on the Document overview.
  const userRole = useAuthStore((s) => s.user?.role.name ?? null);
  const isRecipientOnly = userRole === "contract_recipient";
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("contracts.detail.summaryTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              {/* L38 — humanize contractType metadata field (was lowercase slug). */}
              <Detail
                label={t("contracts.fields.contractType")}
                value={contract.contractType ? humanizeContractType(contract.contractType) : "—"}
              />
              <Detail
                label={t("contracts.fields.language")}
                value={t(`contracts.languageOptions.${contract.language}`, {
                  defaultValue: contract.language,
                })}
              />
              <Detail
                label={t("contracts.fields.valueAed")}
                value={
                  contract.valueAed === null
                    ? "—"
                    : `${contract.currency} ${contract.valueAed.toLocaleString()}`
                }
              />
              <Detail
                label={t("contracts.fields.startDate")}
                value={formatDate(contract.startDate)}
              />
              <Detail label={t("contracts.fields.endDate")} value={formatDate(contract.endDate)} />
              <Detail
                label={t("contracts.fields.signedAt")}
                value={formatDateTime(contract.signedAt)}
              />
              <Detail
                label={t("contracts.fields.expiryNoticeDays")}
                value={String(contract.expiryNoticeDays)}
              />
              {/* L39 — humanize emirate slug (abu_dhabi → Abu Dhabi). */}
              <Detail
                label={t("contracts.fields.emirate")}
                value={contract.emirate ? humanizeContractType(contract.emirate) : "—"}
              />
              <Detail
                label={t("contracts.fields.governingLaw")}
                value={
                  contract.governingLaw
                    ? t(`contracts.governingLawOptions.${contract.governingLaw}`, {
                        defaultValue: contract.governingLaw,
                      })
                    : "—"
                }
              />
              <Detail
                label={t("contracts.fields.jurisdictionCourt")}
                value={contract.jurisdictionCourt ?? "—"}
              />
              <Detail
                label={t("contracts.fields.attachmentCount")}
                value={String(contract.attachmentCount)}
              />
              <Detail
                label={t("contracts.fields.commentCount")}
                value={String(contract.commentCount)}
              />
            </dl>
          </CardContent>
        </Card>

        {(contract.bodyEn || contract.bodyAr) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("contracts.detail.bodyTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contract.bodyEn && (
                <BodyBlock label={t("contracts.fields.bodyEn")} body={contract.bodyEn} />
              )}
              {contract.bodyAr && (
                <BodyBlock label={t("contracts.fields.bodyAr")} body={contract.bodyAr} rtl />
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        {/* R19 (Rashid audit 2026-06-01) — hide "People" (Drafted by /
            Reviewed by / Approved by) from Recipient view. Internal team
            members aren't disclosed to external counterparty signers. */}
        {!isRecipientOnly && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("contracts.detail.peopleTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Person label={t("contracts.detail.draftedBy")} user={contract.draftedBy} />
              <Person label={t("contracts.detail.reviewedBy")} user={contract.reviewedBy} />
              <Person label={t("contracts.detail.approvedBy")} user={contract.approvedBy} />
            </CardContent>
          </Card>
        )}

        {/* R20 (Rashid audit 2026-06-01) — hide internal triage Tags from
            Recipient view (High Value / Multi Year / etc. are portfolio
            management labels, not signer-relevant). */}
        {!isRecipientOnly && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("contracts.tags.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ContractTagsEditor
                contractId={contract.id}
                initialTags={contract.tags}
                editable={canManageTags}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface DetailProps {
  label: string;
  value: string;
}

function Detail({ label, value }: DetailProps) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

interface PersonProps {
  label: string;
  user: UserRef | null;
}

function Person({ label, user }: PersonProps) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">{label}</p>
      <p className="mt-0.5 text-sm text-ink">
        {user ? `${user.firstName} ${user.lastName}` : t("contracts.detail.unassigned")}
      </p>
    </div>
  );
}

interface BodyBlockProps {
  label: string;
  body: string;
  rtl?: boolean;
}

function BodyBlock({ label, body, rtl }: BodyBlockProps) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">{label}</p>
      <pre
        className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-surface p-3 text-sm text-ink"
        dir={rtl ? "rtl" : "ltr"}
      >
        {body}
      </pre>
    </div>
  );
}

export default ContractDetail;
