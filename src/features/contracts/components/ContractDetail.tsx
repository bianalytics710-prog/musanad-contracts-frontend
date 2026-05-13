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
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
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
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
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
import { useMyPendingApprovals } from "@/features/approvals/hooks/useApprovals";
import { ApprovalDecisionDialog } from "@/features/approvals/components/ApprovalDecisionDialog";
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
  const [tab, setTab] = useState<Tab>("document");
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
  const canEdit = useAuthStore(selectHasPermission("contract.edit"));
  const canDelete = useAuthStore(selectHasPermission("contract.delete"));
  const canChangeStatus = useAuthStore(selectHasPermission("contract.status.update"));
  const canManageTags = useAuthStore(selectHasPermission("contract.tag.manage"));
  const canApprove = useAuthStore(selectHasPermission("approval.act"));
  const canReviewClauses = useAuthStore(selectHasPermission("clause.review"));
  // M14 — CR-F: Risk tab visible to roles with score.read (hidden for contract_recipient)
  const canReadRiskScore = useAuthStore(selectHasPermission("score.read"));
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
  const canSeePaymentsTab = canEdit && !isLegalCounselOnly && !isRecipientOnly;
  const canSeeSignaturesTab = canEdit && !isLegalCounselOnly && !isRecipientOnly;

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

  // R1 audit 8.1.4: surface a top-level Approve CTA on contract detail when
  // (a) the user holds approval.act and (b) they have a pending step on
  // this contract. Tapping it opens the existing ApprovalDecisionDialog
  // pre-bound to that step. Lovable embeds Approve in the header so the
  // approver can act without round-tripping to /approvals.
  const myPending = useMyPendingApprovals({ page: 1, limit: 100 }, { enabled: canApprove });
  const myPendingStep = useMemo(
    () => myPending.data?.data?.find((row) => row.contractId === contractId) ?? null,
    [myPending.data?.data, contractId],
  );
  const [approveOpen, setApproveOpen] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

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

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-4 p-6">
      <Breadcrumb contractNumber={contract.contractNumber} />

      {/* Compact header — matches Lovable's title + chips + ... menu */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{displayTitle}</h1>
          {/* R5 audit — Lovable parity: title (AR) translation paragraph below H1. */}
          {contract.titleAr && contract.titleAr !== displayTitle && (
            <p className="mt-1 text-sm text-ink-muted" dir="rtl">{contract.titleAr}</p>
          )}
          {!isAr && contract.titleEn && contract.titleAr && contract.titleAr !== contract.titleEn && (
            // EN view: show AR; AR view already shows AR as displayTitle and EN here
            null
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ContractStatusBadge status={contract.status} />
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-ink-muted">
              {contract.contractType
                ? t(`contractType.${contract.contractType}`, {
                    defaultValue: contract.contractType,
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                watchMutation.mutate({ id: contract.id, value: !(watching ?? false) })
              }
              disabled={watchMutation.isPending}
              className="hidden sm:inline-flex"
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
          {/* R1 audit 8.1.4: approver-perspective top-level Approve CTA. */}
          {myPendingStep && contract.status === "in_approval" && (
            <Button
              type="button"
              size="sm"
              onClick={() => setApproveOpen(true)}
              className="hidden sm:inline-flex"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("contracts.detail.actions.approve", { defaultValue: "Approve" })}
            </Button>
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
                  try {
                    const r = await signatureService.resolveSigningLinkForSelf(contract.id);
                    // Navigate to the public /sign/{token} route. Use a
                    // hard navigation since /sign is outside the auth shell.
                    window.location.href = `/sign/${encodeURIComponent(r.invitationTokenPlaintext)}`;
                  } catch (e) {
                    toast.error(translateApiError(e, t));
                  }
                }}
                className="hidden sm:inline-flex"
              >
                <FileSignature className="h-3.5 w-3.5" />
                {t("contracts.detail.actions.sign", { defaultValue: "Sign" })}
              </Button>
            )}
          {!isRecipientOnly && canEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTab("edit")}
              className="hidden sm:inline-flex"
            >
              <PencilLine className="h-3.5 w-3.5" />
              {t("common.edit")}
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
        {/* R1 audit 8.2.2: Edit / Payments / Signatures are drafter-context
            tabs. Lovable doesn't surface them to approvers. Gate by canEdit
            (proxy for "can mutate this contract"). */}
        {!isRecipientOnly && canEdit && (
          <TabButton active={tab === "edit"} onClick={() => setTab("edit")}>
            {t("contracts.detail.tabs.edit")}
          </TabButton>
        )}
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
      {tab === "overview" && <OverviewPanel contract={contract} canManageTags={canManageTags} />}
      {tab === "document" && (
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
      )}
      {tab === "attachments" && (
        <ContractAttachmentsTab
          contractId={contract.id}
          currentVersionId={currentVersionId}
        />
      )}
      {tab === "comments" && <ContractCommentsTab contractId={contract.id} />}
      {tab === "edit" && (
        <ContractEditForm contract={contract} onSaved={() => setTab("overview")} />
      )}
      {tab === "payments" && <PaymentScheduleTab contractId={contract.id} canEdit={canEdit} />}
      {tab === "versions" && <ContractVersionList contractId={contract.id} canCreate={canEdit} />}
      {tab === "activity" && <ContractActivityLog contractId={contract.id} />}
      {tab === "signatures" && (
        <ContractSignaturesTab
          contractId={contract.id}
          contractNumber={contract.contractNumber}
        />
      )}
      {tab === "tree" && <ContractTreeTimeline contractId={contract.id} />}
      {tab === "clauses" && <ContractClausesTab contractId={contract.id} />}
      {/* M14 — CR-F: Risk tab */}
      {tab === "risk" && <ContractRiskTab contractId={contract.id} />}

      {/* Inline AI insights — Lovable layout.
          R-RC1 — recipients are external counterparty signers and don't
          hold ai.invoke.contract; hide the panel rather than render an
          empty/forbidden state. */}
      {!isRecipientOnly && <ContractAIInsightsPanel contractId={contract.id} />}

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

      {/* R1 audit 8.1.4 — top-level Approve dialog (approver perspective).
          initialKind="approve" pre-selects the action so the user lands
          directly on the approve confirmation, matching Lovable's 1-click
          flow. */}
      {approveOpen && myPendingStep && (
        <ApprovalDecisionDialog
          stepId={myPendingStep.stepId}
          initialKind="approve"
          currentUserId={currentUserId}
          open={approveOpen}
          onClose={() => setApproveOpen(false)}
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
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
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
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("contracts.detail.summaryTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Detail label={t("contracts.fields.contractType")} value={contract.contractType} />
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
              <Detail label={t("contracts.fields.emirate")} value={contract.emirate ?? "—"} />
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
