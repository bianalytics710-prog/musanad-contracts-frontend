/**
 * /app/admin/audit — Consolidated activity log.
 *
 * A cross-contract version of the per-contract Activity tab: every contract's
 * lifecycle events (created, submitted, approved, sent for signature, signed,
 * status changed, …) in one feed, newest first. Sourced from contract_activity
 * via fn_activity_feed_list — NOT the raw audit_log grid. Filters: contract,
 * person, type, date.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Search,
  Activity,
  FilePlus2,
  PencilLine,
  CheckCircle2,
  RefreshCw,
  Tag,
  Trash2,
  Undo2,
  Send,
  ShieldCheck,
  ArrowRightLeft,
  TimerReset,
  UserCheck,
  FileSignature,
  Eye,
  PenLine,
  UserX,
  Sparkles,
  ShieldOff,
  FileDown,
  Radar,
  ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import {
  adminAuditService,
  type ActivityFeedQuery,
  type ActivityFeedRow,
} from "@/services/api/admin-audit.service";
import { adminUsersService } from "@/services/api/admin-users.service";
import { chatMentionsService } from "@/services/api/chat-mentions.service";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDateTime } from "@/utils/datetime";

export const Route = createFileRoute("/app/admin/audit/")({
  component: () => (
    <ErrorBoundary>
      <AdminActivityView />
    </ErrorBoundary>
  ),
});

type IconCmp = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

// Icon + tone per activity type (mirrors the contract Activity tab).
const TYPE_ICON: Record<string, IconCmp> = {
  created: FilePlus2,
  updated: PencilLine,
  status_changed: CheckCircle2,
  version_created: RefreshCw,
  tagged: Tag,
  soft_deleted: Trash2,
  restored: Undo2,
  exported: FileDown,
  amendment_initiated: RefreshCw,
  regulatory_impact_detected: Radar,
  submitted_for_approval: Send,
  approval_decided: ShieldCheck,
  approval_reassigned: ArrowRightLeft,
  approval_escalated: TimerReset,
  approval_delegated: UserCheck,
  sent_for_signature: FileSignature,
  signer_viewed: Eye,
  signer_signed: PenLine,
  signer_declined: UserX,
  fully_executed: Sparkles,
  signature_invalidated: ShieldOff,
};

const TYPE_TONE: Record<string, string> = {
  created: "bg-sage/15 text-sage",
  status_changed: "bg-gold/15 text-gold",
  version_created: "bg-plum-tint text-plum-ink",
  tagged: "bg-amber/15 text-amber",
  soft_deleted: "bg-terracotta/15 text-terracotta",
  restored: "bg-sage/15 text-sage",
  submitted_for_approval: "bg-slate-tint text-slate-ink",
  approval_decided: "bg-sage/15 text-sage",
  approval_escalated: "bg-amber/15 text-amber",
  sent_for_signature: "bg-slate-tint text-slate-ink",
  signer_signed: "bg-sage/15 text-sage",
  signer_declined: "bg-terracotta/15 text-terracotta",
  fully_executed: "bg-sage/15 text-sage",
  signature_invalidated: "bg-terracotta/15 text-terracotta",
  regulatory_impact_detected: "bg-amber/15 text-amber",
};

// Curated type filter options (value → label).
const TYPE_OPTIONS: Array<[string, string]> = [
  ["created", "Created"],
  ["updated", "Updated"],
  ["status_changed", "Status changed"],
  ["version_created", "New version"],
  ["tagged", "Tags changed"],
  ["submitted_for_approval", "Submitted for approval"],
  ["approval_decided", "Approval decided"],
  ["approval_reassigned", "Approval reassigned"],
  ["approval_escalated", "Approval escalated"],
  ["approval_delegated", "Approval delegated"],
  ["sent_for_signature", "Sent for signature"],
  ["signer_viewed", "Signer viewed"],
  ["signer_signed", "Signer signed"],
  ["signer_declined", "Signer declined"],
  ["fully_executed", "Fully executed"],
  ["signature_invalidated", "Signature invalidated"],
  ["amendment_initiated", "Amendment initiated"],
  ["regulatory_impact_detected", "Regulatory impact"],
  ["exported", "Exported"],
  ["soft_deleted", "Soft-deleted"],
  ["restored", "Restored"],
];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS);

function humanizeType(t: string): string {
  if (TYPE_LABEL[t]) return TYPE_LABEL[t];
  const s = t.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function prettyStatus(s: unknown): string {
  return typeof s === "string" ? s.replace(/_/g, " ") : String(s ?? "");
}

function AdminActivityView() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ActivityFeedQuery>({});
  const [draftActor, setDraftActor] = useState<number | "">("");
  const [draftType, setDraftType] = useState("");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  // Contract typeahead.
  const [contractPick, setContractPick] = useState<{ id: number; label: string } | null>(null);
  const [contractQuery, setContractQuery] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const blurTimer = useRef<number | null>(null);
  const debouncedContractQuery = useDebounce(contractQuery, 250);

  const { data: contractResults } = useQuery({
    queryKey: ["activity-contract-typeahead", debouncedContractQuery],
    queryFn: () => chatMentionsService.searchContracts(debouncedContractQuery, 8),
    enabled:
      debouncedContractQuery.trim().length >= 2 && contractPick?.label !== contractQuery,
    staleTime: 30_000,
  });
  const contractSuggestions = contractResults?.results ?? [];

  const usersQuery = useQuery({
    queryKey: ["admin-users", "all", "for-activity"],
    queryFn: () => adminUsersService.list({ limit: 100 }),
    staleTime: 5 * 60_000,
  });

  const query: ActivityFeedQuery = useMemo(
    () => ({ ...filters, page, limit: 50 }),
    [filters, page],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin-activity", query],
    queryFn: () => adminAuditService.activityFeed(query),
    staleTime: 30_000,
  });

  const items = data?.data ?? [];
  const totalRows = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;

  const apply = () => {
    setPage(1);
    setFilters({
      contractId: contractPick?.id ?? undefined,
      actorId: draftActor === "" ? undefined : draftActor,
      activityType: draftType || undefined,
      dateFrom: draftFrom ? new Date(draftFrom).toISOString() : undefined,
      dateTo: draftTo ? new Date(draftTo).toISOString() : undefined,
    });
  };

  const clear = () => {
    setContractPick(null);
    setContractQuery("");
    setShowSuggest(false);
    setDraftActor("");
    setDraftType("");
    setDraftFrom("");
    setDraftTo("");
    setFilters({});
    setPage(1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1100px] space-y-4 p-6"
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("admin.audit.title", { defaultValue: "Activity log" })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("admin.audit.subtitle", {
            defaultValue:
              "Every contract action across the workspace — who did what, and when. Newest first.",
          })}
        </p>
      </header>

      {/* Filters */}
      <div className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-5">
        <Field id="act-contract" label={t("admin.audit.filters.contract", { defaultValue: "Contract" })}>
          <div className="relative">
            <Input
              id="act-contract"
              value={contractQuery}
              autoComplete="off"
              placeholder={t("admin.audit.filters.contractPlaceholder", {
                defaultValue: "Type a contract no.…",
              })}
              onChange={(e) => {
                setContractQuery(e.target.value);
                setContractPick(null);
                setShowSuggest(true);
              }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => {
                blurTimer.current = window.setTimeout(() => setShowSuggest(false), 150);
              }}
            />
            {showSuggest && contractSuggestions.length > 0 && !contractPick && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                {contractSuggestions.map((s) => (
                  <li key={s.id ?? s.label}>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-start text-sm hover:bg-surface focus:bg-surface focus:outline-none"
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => {
                        if (s.id == null) return;
                        setContractPick({ id: s.id, label: s.label });
                        setContractQuery(s.label);
                        setShowSuggest(false);
                        if (blurTimer.current) window.clearTimeout(blurTimer.current);
                      }}
                    >
                      <span className="font-medium text-ink">{s.label}</span>
                      {s.subLabel && <span className="ms-2 text-xs text-ink-muted">{s.subLabel}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Field>
        <Field id="act-person" label={t("admin.audit.filters.actor", { defaultValue: "Person" })}>
          <select
            id="act-person"
            value={draftActor}
            onChange={(e) => setDraftActor(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-ink"
          >
            <option value="">{t("common.any", { defaultValue: "Any" })}</option>
            {(usersQuery.data?.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        </Field>
        <Field id="act-type" label={t("admin.audit.filters.type", { defaultValue: "Type" })}>
          <select
            id="act-type"
            value={draftType}
            onChange={(e) => setDraftType(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-ink"
          >
            <option value="">{t("common.any", { defaultValue: "Any" })}</option>
            {TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {t(`contracts.activity.types.${value}`, { defaultValue: label })}
              </option>
            ))}
          </select>
        </Field>
        <Field id="act-from" label={t("admin.audit.filters.dateFrom", { defaultValue: "From" })}>
          <Input id="act-from" type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} />
        </Field>
        <Field id="act-to" label={t("admin.audit.filters.dateTo", { defaultValue: "To" })}>
          <Input id="act-to" type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} />
        </Field>
        <div className="flex items-end gap-2 md:col-span-5">
          <Button onClick={apply}>
            <Search className="me-2 h-4 w-4" />
            {t("common.apply", { defaultValue: "Apply" })}
          </Button>
          <Button variant="ghost" onClick={clear}>
            {t("common.clear", { defaultValue: "Clear" })}
          </Button>
          <span className="ms-auto text-xs text-ink-subtle">
            {totalRows.toLocaleString()} {t("admin.audit.eventsLabel", { defaultValue: "events" })}
          </span>
        </div>
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-surface" aria-hidden />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <Activity className="mx-auto mb-2 h-6 w-6 text-ink-subtle" aria-hidden />
          <p className="text-sm text-ink-muted">
            {t("admin.audit.empty", { defaultValue: "No activity matches the filters." })}
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {items.map((row) => (
              <ActivityRow key={row.id} row={row} />
            ))}
          </ul>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-ink-subtle">
              {t("admin.audit.pagination.label", {
                defaultValue: "Page {{page}} of {{totalPages}}",
                page,
                totalPages,
              })}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                {t("common.previous", { defaultValue: "Previous" })}
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                {t("common.next", { defaultValue: "Next" })}
              </Button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

function ActivityRow({ row }: { row: ActivityFeedRow }) {
  const { t } = useTranslation();
  const Icon = TYPE_ICON[row.activityType] ?? Activity;
  const tone = TYPE_TONE[row.activityType] ?? "bg-surface text-ink-muted";
  const actorName = row.actor
    ? `${row.actor.firstName} ${row.actor.lastName}`.trim()
    : t("contracts.activity.systemActor", { defaultValue: "System" });
  const meta = row.metadata ?? {};
  const fromStatus = (meta as Record<string, unknown>).fromStatus;
  const toStatus = (meta as Record<string, unknown>).toStatus;

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${tone}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium text-ink">
            {t(`contracts.activity.types.${row.activityType}`, { defaultValue: humanizeType(row.activityType) })}
          </span>
          {fromStatus != null && toStatus != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink-muted">
              {prettyStatus(fromStatus)}
              <ArrowRight className="h-3 w-3" aria-hidden />
              {prettyStatus(toStatus)}
            </span>
          )}
        </div>
        {row.descriptionEn && (
          <p className="mt-0.5 truncate text-xs text-ink-muted" title={row.descriptionEn}>
            {row.descriptionEn}
          </p>
        )}
        <p className="mt-1 text-[11px] text-ink-subtle">
          <Link
            to="/app/contracts/$id"
            params={{ id: String(row.contractId) }}
            className="font-mono text-gold hover:underline"
          >
            {row.contractNumber}
          </Link>
          <span className="mx-1.5">·</span>
          {t("contracts.activity.byActor", { defaultValue: "by {{actor}}", actor: actorName })}
          <span className="mx-1.5">·</span>
          {formatDateTime(row.createdAt)}
        </p>
      </div>
    </li>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium uppercase tracking-wider text-ink-subtle">
        {label}
      </label>
      {children}
    </div>
  );
}
