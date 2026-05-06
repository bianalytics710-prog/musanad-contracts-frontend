/**
 * ContractActivityLog (S11) — activity timeline newest first.
 *
 * Mode: harden — Activity tab adapted from ContractCenterTabs.tsx in the
 * Lovable repo. Reads via fn_contract_activity_list with optional
 * activityType filter.
 *
 * AC mapping:
 *   AC-S11-01..03 — fn_contract_activity_list with default limit=50.
 *   AC-S11-04     — actor null when soft-deleted; rendered as a generic placeholder.
 *   AC-S11-05..06 — error path surfaced via data-state branches.
 */
import { useMemo, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  CheckCircle2,
  Eye,
  FilePlus2,
  FileSignature,
  PencilLine,
  PenLine,
  RefreshCw,
  ShieldOff,
  Sparkles,
  Tag,
  Trash2,
  Undo2,
  Upload,
  Inbox,
  Send,
  ShieldCheck,
  UserCheck,
  UserX,
  TimerReset,
  ArrowRightLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContractActivity } from "@/features/contracts/hooks/useContracts";
import { formatDateTime } from "@/utils/datetime";
import {
  ACTIVITY_TYPE_VALUES,
  isStatusChangedMetadata,
  isTaggedMetadata,
  isVersionCreatedMetadata,
  type ActivityType,
  type ContractActivity,
  type ContractActivityListQuery,
} from "@/types/entities/contract.types";
import { cn } from "@/lib/utils";
import { ContractStatusBadge } from "./ContractStatusBadge";

interface ContractActivityLogProps {
  contractId: number;
}

const ICONS: Record<
  ActivityType,
  React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  created: FilePlus2,
  updated: PencilLine,
  status_changed: CheckCircle2,
  version_created: RefreshCw,
  tagged: Tag,
  soft_deleted: Trash2,
  restored: Undo2,
  // M1b additive — import lifecycle events.
  import_batch_started: Upload,
  import_batch_completed: Inbox,
  // M2 additive — approval lifecycle events.
  submitted_for_approval: Send,
  approval_decided: ShieldCheck,
  approval_reassigned: ArrowRightLeft,
  approval_escalated: TimerReset,
  approval_delegated: UserCheck,
  // M3 additive — signature lifecycle events.
  sent_for_signature: FileSignature,
  signer_viewed: Eye,
  signer_signed: PenLine,
  signer_declined: UserX,
  fully_executed: Sparkles,
  signature_invalidated: ShieldOff,
};

const ICON_TONE: Record<ActivityType, string> = {
  created: "bg-sage-tint text-sage-ink",
  updated: "bg-slate-tint text-slate-ink",
  status_changed: "bg-gold-tint text-gold",
  version_created: "bg-plum-tint text-plum-ink",
  tagged: "bg-amber-tint text-amber-ink",
  soft_deleted: "bg-terracotta-tint text-terracotta-ink",
  restored: "bg-sage-tint text-sage-ink",
  // M1b additive
  import_batch_started: "bg-slate-tint text-slate-ink",
  import_batch_completed: "bg-sage-tint text-sage-ink",
  // M2 additive
  submitted_for_approval: "bg-slate-tint text-slate-ink",
  approval_decided: "bg-sage-tint text-sage-ink",
  approval_reassigned: "bg-amber-tint text-amber-ink",
  approval_escalated: "bg-amber-tint text-amber-ink",
  approval_delegated: "bg-plum-tint text-plum-ink",
  // M3 additive
  sent_for_signature: "bg-slate-tint text-slate-ink",
  signer_viewed: "bg-amber-tint text-amber-ink",
  signer_signed: "bg-sage-tint text-sage-ink",
  signer_declined: "bg-terracotta-tint text-terracotta-ink",
  fully_executed: "bg-sage-tint text-sage-ink",
  signature_invalidated: "bg-terracotta-tint text-terracotta-ink",
};

export function ContractActivityLog({ contractId }: ContractActivityLogProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<ActivityType | "">("");

  const query: ContractActivityListQuery = useMemo(
    () => ({
      page: 1,
      limit: 50,
      activityType: filter || undefined,
    }),
    [filter],
  );

  const { data, isLoading, isError, error, refetch } = useContractActivity(contractId, query);

  const handleFilterChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setFilter((ACTIVITY_TYPE_VALUES as readonly string[]).includes(v) ? (v as ActivityType) : "");
  };

  const items = data?.data ?? [];

  // R5 audit 8.4.1 — filter pills (All / Reviews / Approvals / Signatures /
  // Comments / Edits) instead of the 21-value <select>. Pills map to type
  // groups; selecting "All" clears the filter.
  const PILL_GROUPS: Array<{ key: string; label: string; types?: ActivityType[] }> = [
    { key: "all", label: t("contracts.activity.pills.all", { defaultValue: "All" }) },
    {
      key: "reviews",
      label: t("contracts.activity.pills.reviews", { defaultValue: "Reviews" }),
      types: ["status_changed"],
    },
    {
      key: "approvals",
      label: t("contracts.activity.pills.approvals", { defaultValue: "Approvals" }),
      types: [
        "submitted_for_approval",
        "approval_decided",
        "approval_reassigned",
        "approval_escalated",
        "approval_delegated",
      ],
    },
    {
      key: "signatures",
      label: t("contracts.activity.pills.signatures", { defaultValue: "Signatures" }),
      types: [
        "sent_for_signature",
        "signer_viewed",
        "signer_signed",
        "signer_declined",
        "fully_executed",
        "signature_invalidated",
      ],
    },
    {
      key: "edits",
      label: t("contracts.activity.pills.edits", { defaultValue: "Edits" }),
      types: ["created", "updated", "version_created", "tagged", "soft_deleted", "restored"],
    },
  ];
  // Find the active pill key from the current filter (single-type select).
  const activePillKey = filter
    ? PILL_GROUPS.find((g) => g.types?.includes(filter as ActivityType))?.key ?? "all"
    : "all";

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">{t("contracts.activity.title")}</CardTitle>
        </div>
        {/* R5 audit 8.4.1 — filter pills */}
        <div role="tablist" className="flex flex-wrap gap-1">
          {PILL_GROUPS.map((g) => (
            <button
              key={g.key}
              role="tab"
              type="button"
              aria-selected={activePillKey === g.key}
              onClick={() => {
                // R5 — single-type filter; group pills set the FIRST mapped
                // type. Power users can still narrow further with the
                // dropdown below.
                if (g.key === "all") setFilter("");
                else if (g.types && g.types.length > 0) setFilter(g.types[0]);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activePillKey === g.key
                  ? "bg-gold/20 text-ink"
                  : "border border-border text-ink-muted hover:bg-surface"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="activity-filter" className="text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("contracts.activity.filterLabel", { defaultValue: "Type" })}
          </label>
          <select
            id="activity-filter"
            value={filter}
            onChange={handleFilterChange}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-ink shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">{t("common.all")}</option>
            {ACTIVITY_TYPE_VALUES.map((v) => (
              <option key={v} value={v}>
                {t(`contracts.activity.types.${v}`, { defaultValue: v })}
              </option>
            ))}
          </select>
        </div>
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
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <Activity className="h-6 w-6 text-ink-subtle" aria-hidden="true" />
            <p className="text-sm text-ink-muted">{t("contracts.activity.empty")}</p>
          </div>
        ) : (
          <ol className="relative space-y-3 ps-6">
            <span aria-hidden="true" className="absolute inset-y-2 start-[10px] w-px bg-border" />
            {items.map((a) => (
              <ActivityItem key={a.id} activity={a} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

interface ActivityItemProps {
  activity: ContractActivity;
}

function ActivityItem({ activity }: ActivityItemProps) {
  const { t } = useTranslation();
  const Icon = ICONS[activity.activityType] ?? Activity;
  const tone = ICON_TONE[activity.activityType] ?? "bg-surface text-ink";
  const actorName = activity.actor
    ? `${activity.actor.firstName} ${activity.actor.lastName}`
    : t("contracts.activity.unknownActor");

  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -start-6 top-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-background",
          tone,
        )}
      >
        <Icon className="h-3 w-3" aria-hidden={true} />
      </span>
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-ink">
              {t(`contracts.activity.types.${activity.activityType}`, {
                defaultValue: activity.activityType,
              })}
            </p>
            {activity.descriptionEn && (
              <p className="mt-0.5 text-xs text-ink-muted">{activity.descriptionEn}</p>
            )}
            <p className="mt-1 text-[11px] text-ink-subtle">
              {t("contracts.activity.byActor", { actor: actorName })} ·{" "}
              {formatDateTime(activity.createdAt)}
            </p>
          </div>
          <ActivityMetadata activity={activity} />
        </div>
      </div>
    </li>
  );
}

function ActivityMetadata({ activity }: { activity: ContractActivity }) {
  const { t } = useTranslation();
  const m = activity.metadata;
  if (!m) return null;

  if (isStatusChangedMetadata(m)) {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <ContractStatusBadge status={m.fromStatus} />
        <span className="text-[10px] text-ink-subtle" aria-hidden="true">
          →
        </span>
        <ContractStatusBadge status={m.toStatus} />
      </div>
    );
  }
  if (isVersionCreatedMetadata(m)) {
    return (
      <span className="shrink-0 rounded-full bg-plum-tint px-2 py-0.5 text-[10px] font-medium text-plum-ink">
        v{m.versionNumber}
      </span>
    );
  }
  if (isTaggedMetadata(m)) {
    return (
      <div className="shrink-0 text-[10px] text-ink-subtle">
        {m.added.length > 0 && (
          <span className="me-1 text-sage-ink">
            +{m.added.length} {t("contracts.activity.tagsAdded")}
          </span>
        )}
        {m.removed.length > 0 && (
          <span className="text-terracotta-ink">
            -{m.removed.length} {t("contracts.activity.tagsRemoved")}
          </span>
        )}
      </div>
    );
  }
  return null;
}

export default ContractActivityLog;
