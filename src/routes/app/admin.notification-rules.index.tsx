/**
 * /app/admin/notification-rules — module-first notification rule registry.
 *
 * Inspired by ServiceNow / Jira / Salesforce: rules are grouped by MODULE
 * (Contracts / Approvals / Signatures / …). Each module shows its events,
 * each event shows its rules. Editor lets admin pick the module → event →
 * channels (multi, with per-channel template) → recipients (multi-row
 * picker: role / user / context / email) → condition / priority / cooldown.
 *
 * Single source of truth: rule changes immediately affect what the
 * fn_notification_dispatch fires across the platform. The dispatcher is wired
 * for contract.expiry_30day + report.delivered; remaining events follow the
 * same pattern (documented in mig 584).
 *
 * Gate: platform.notifications.manage.
 */
import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  FileSignature,
  Globe2,
  HardHat,
  Mail,
  MessageCircle,
  MessageSquare,
  Pencil,
  Plus,
  Server,
  Slack,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import {
  adminNotificationRulesService,
  type NotificationRuleRow,
  type NotificationRuleDetail,
  type NotificationRuleUpsertV2Input,
  type NotificationEventTypeRow,
  type ContextResolverRow,
  type RuleChannel,
  type RulePriority,
  type RecipientType,
} from "@/services/api/admin-notification-rules.service";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/admin/notification-rules/")({
  component: () => (
    <ErrorBoundary>
      <NotificationRulesList />
    </ErrorBoundary>
  ),
});

// ── Module catalogue ─────────────────────────────────────────────────────
const MODULE_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  contract:   { label: "Contracts",        icon: FileText },
  approval:   { label: "Approvals",        icon: CheckCircle2 },
  signature:  { label: "Signatures",       icon: FileSignature },
  comment:    { label: "Comments",         icon: MessageCircle },
  advisory:   { label: "Advisory",         icon: Sparkles },
  impact:     { label: "Impact signals",   icon: Eye },
  regulatory: { label: "Regulatory",       icon: Globe2 },
  import:     { label: "Imports",          icon: HardHat },
  user:       { label: "User account",     icon: UsersIcon },
  watch:      { label: "Watch list",       icon: Briefcase },
  obligation: { label: "Obligations",      icon: Bell },
  report:     { label: "Reports",          icon: Server },
  system:     { label: "System",           icon: Server },
};

const CHANNEL_OPTIONS: RuleChannel[] = ["email", "in_app", "teams_capture", "slack_capture"];
const CHANNEL_LABEL: Record<RuleChannel, string> = {
  email: "Email",
  in_app: "In-app",
  teams_capture: "Teams (captured)",
  slack_capture: "Slack (captured)",
};
const CHANNEL_ICON: Record<RuleChannel, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  in_app: Bell,
  teams_capture: MessageSquare,
  slack_capture: Slack,
};

const PRIORITY_OPTIONS: RulePriority[] = ["low", "medium", "high", "critical"];
const RECIPIENT_TYPES: RecipientType[] = ["context", "role", "user", "email"];
const RECIPIENT_TYPE_LABEL: Record<RecipientType, string> = {
  context: "From context (assignee, drafter, etc.)",
  role:    "All users in role",
  user:    "Specific user (by ID)",
  email:   "External email",
};

function NotificationRulesList() {
  const { t } = useTranslation();
  const canManage = useAuthStore(
    selectHasPermission("platform.notifications.manage"),
  );

  const [activeModule, setActiveModule] = useState<string | null>(null);
  // editorState:
  //   { ruleId: number, ... }                     → edit existing (loads detail)
  //   { ruleId: null, sourceRuleId: null, ... }   → blank create
  //   { ruleId: null, sourceRuleId: number, ... } → override (clone from a system default)
  const [editorState, setEditorState] = useState<
    {
      ruleId: number | null;
      sourceRuleId: number | null;
      defaultModule: string | null;
    } | null
  >(null);

  const { data: rules = [], isLoading, isError } = useQuery({
    queryKey: ["admin-notification-rules-v2"],
    queryFn: () => adminNotificationRulesService.list({}),
    enabled: canManage,
    staleTime: 30_000,
  });

  // Group by module → event → rules.
  const grouped = useMemo(() => {
    const byModule = new Map<string, Map<string, NotificationRuleRow[]>>();
    for (const r of rules) {
      const mod = (r as unknown as { module?: string }).module ?? r.eventCategory;
      let evMap = byModule.get(mod);
      if (!evMap) {
        evMap = new Map();
        byModule.set(mod, evMap);
      }
      const list = evMap.get(r.eventType) ?? [];
      list.push(r);
      evMap.set(r.eventType, list);
    }
    return byModule;
  }, [rules]);

  const moduleOrder = useMemo(
    () =>
      Array.from(grouped.keys()).sort((a, b) =>
        (MODULE_META[a]?.label ?? a).localeCompare(MODULE_META[b]?.label ?? b),
      ),
    [grouped],
  );

  // Default selected module = first available.
  useEffect(() => {
    if (activeModule === null && moduleOrder.length > 0) {
      setActiveModule(moduleOrder[0]);
    }
  }, [activeModule, moduleOrder]);

  if (!canManage) {
    return (
      <div className="mx-auto w-full max-w-[1200px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t("common.accessDenied", { defaultValue: "Access denied" })}
          </p>
        </div>
      </div>
    );
  }

  const activeEventMap = activeModule ? grouped.get(activeModule) : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("admin.notificationRules.kicker", { defaultValue: "Workflow & rules" })}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("admin.notificationRules.title", { defaultValue: "Notification rules" })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("admin.notificationRules.subtitle.v2", {
              defaultValue:
                "Every notification the platform sends is controlled here. Browse by module, pick an event, configure channels + recipients. Disabled rules are silenced immediately across the platform.",
            })}
          </p>
        </div>
        <Button
          onClick={() =>
            setEditorState({ ruleId: null, sourceRuleId: null, defaultModule: activeModule })
          }
        >
          <Plus className="me-1 h-4 w-4" />
          {t("admin.notificationRules.add", { defaultValue: "Add rule" })}
        </Button>
      </header>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-lg bg-surface" aria-busy />
      ) : isError ? (
        <div className="rounded-lg border border-terracotta/40 bg-terracotta/5 p-6 text-center">
          <p className="text-sm text-terracotta">
            {t("admin.notificationRules.error.fetch", {
              defaultValue: "Failed to load notification rules.",
            })}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          {/* Module rail */}
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {moduleOrder.map((mod) => {
                  const eventCount = grouped.get(mod)?.size ?? 0;
                  const ruleCount = Array.from(grouped.get(mod)?.values() ?? []).reduce(
                    (a, b) => a + b.length,
                    0,
                  );
                  const meta = MODULE_META[mod] ?? { label: mod, icon: Bell };
                  const Icon = meta.icon;
                  const active = activeModule === mod;
                  return (
                    <li key={mod}>
                      <button
                        type="button"
                        onClick={() => setActiveModule(mod)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-3 text-start hover:bg-surface/50",
                          active && "bg-gold/5 border-s-2 border-gold",
                        )}
                      >
                        <div
                          className={cn(
                            "rounded-md p-1.5",
                            active ? "bg-gold/15 text-gold" : "bg-surface text-ink-muted",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">
                            {meta.label}
                          </p>
                          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                            {eventCount} event{eventCount === 1 ? "" : "s"} · {ruleCount} rule
                            {ruleCount === 1 ? "" : "s"}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {/* Detail pane */}
          <Card>
            <CardContent className="space-y-3 p-4">
              {!activeEventMap || activeEventMap.size === 0 ? (
                <p className="text-sm text-ink-muted">
                  {t("admin.notificationRules.noEvents", {
                    defaultValue: "No events for this module yet.",
                  })}
                </p>
              ) : (
                Array.from(activeEventMap.entries()).map(([eventType, eventRules]) => (
                  <EventGroup
                    key={eventType}
                    eventType={eventType}
                    rows={eventRules}
                    onEdit={(id) =>
                      setEditorState({
                        ruleId: id,
                        sourceRuleId: null,
                        defaultModule: activeModule,
                      })
                    }
                    onOverride={(srcId) =>
                      setEditorState({
                        ruleId: null,
                        sourceRuleId: srcId,
                        defaultModule: activeModule,
                      })
                    }
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <RuleEditorDialog
        open={editorState !== null}
        onClose={() => setEditorState(null)}
        ruleId={editorState?.ruleId ?? null}
        sourceRuleId={editorState?.sourceRuleId ?? null}
        defaultModule={editorState?.defaultModule ?? null}
      />
    </motion.div>
  );
}

// ── Event group (collapsible) ────────────────────────────────────────────

function EventGroup({
  eventType,
  rows,
  onEdit,
  onOverride,
}: {
  eventType: string;
  rows: NotificationRuleRow[];
  onEdit: (ruleId: number) => void;
  onOverride: (sourceRuleId: number) => void;
}) {
  const [expanded, setExpanded] = useState<boolean>(true);
  const enabled = rows.filter((r) => r.isEnabled).length;
  const head = rows[0];
  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-start hover:bg-surface/50"
      >
        <div className="flex min-w-0 items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {head.eventDisplayName}
            </p>
            <p className="truncate font-mono text-[11px] text-ink-subtle">{eventType}</p>
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
          {enabled}/{rows.length} enabled
        </span>
      </button>
      {expanded && (
        <ul className="divide-y divide-border border-t border-border bg-surface/30">
          {rows.map((row) => (
            <RuleRow
              key={row.id}
              row={row}
              onEdit={() => onEdit(row.id)}
              onOverride={() => onOverride(row.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function RuleRow({
  row,
  onEdit,
  onOverride,
}: {
  row: NotificationRuleRow;
  onEdit: () => void;
  onOverride: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const Icon = CHANNEL_ICON[row.channel];

  const toggle = useMutation({
    mutationFn: (next: boolean) =>
      adminNotificationRulesService.setEnabled(row.id, next),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-notification-rules-v2"] });
    },
  });
  const del = useMutation({
    mutationFn: () => adminNotificationRulesService.deactivate(row.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-notification-rules-v2"] });
      toast.success(
        t("admin.notificationRules.deleted", { defaultValue: "Rule removed." }),
      );
    },
  });

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <div className="rounded-md bg-gold/10 p-1.5">
        <Icon className="h-4 w-4 text-gold" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
            {CHANNEL_LABEL[row.channel]}
          </span>
          <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {row.priority}
          </span>
          {!row.isEnabled && (
            <span className="rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-terracotta">
              disabled
            </span>
          )}
          {row.isSystemDefault && (
            <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              system default
            </span>
          )}
        </div>
        <p className="truncate font-mono text-[11px] text-ink-subtle">
          {row.templateId}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => toggle.mutate(!row.isEnabled)}
        disabled={toggle.isPending}
      >
        {row.isEnabled ? (
          <ToggleRight className="h-5 w-5 text-sage" />
        ) : (
          <ToggleLeft className="h-5 w-5 text-ink-muted" />
        )}
      </Button>
      <Button variant="ghost" size="icon" onClick={onEdit} title="Edit">
        <Pencil className="h-4 w-4" />
      </Button>
      {row.isSystemDefault && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onOverride}
          title="Create a tenant-specific override of this system default"
          className="text-xs"
        >
          Override
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          if (confirm(t("admin.notificationRules.confirmDelete", { defaultValue: "Remove this rule?" }))) {
            del.mutate();
          }
        }}
        disabled={del.isPending}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

// ── Editor dialog ────────────────────────────────────────────────────────

function RuleEditorDialog({
  open,
  onClose,
  ruleId,
  sourceRuleId,
  defaultModule,
}: {
  open: boolean;
  onClose: () => void;
  ruleId: number | null;
  sourceRuleId: number | null;
  defaultModule: string | null;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = ruleId !== null;
  const isOverride = !isEdit && sourceRuleId !== null;
  // Load detail when editing OR when cloning a system default for override.
  const loadId = isEdit ? ruleId : sourceRuleId;
  const detail = useQuery({
    queryKey: ["admin-notification-rule-detail", loadId],
    queryFn: () => adminNotificationRulesService.getDetail(loadId!),
    enabled: open && loadId !== null,
    staleTime: 0,
  });

  // Reference catalogues.
  const eventTypes = useQuery({
    queryKey: ["admin-notification-event-types"],
    queryFn: () => adminNotificationRulesService.eventTypes(),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const contextResolvers = useQuery({
    queryKey: ["admin-notification-context-resolvers"],
    queryFn: () => adminNotificationRulesService.contextResolvers(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const [form, setForm] = useState<NotificationRuleUpsertV2Input>(() =>
    blankForm(defaultModule),
  );
  const [conditionRaw, setConditionRaw] = useState<string>("");

  // Re-seed form on dialog open / row swap.
  useEffect(() => {
    if (!open) return;
    // Edit OR override mode → both populate from detail. Override saves as new.
    if ((isEdit || isOverride) && detail.data) {
      const seeded = detailToForm(detail.data);
      // For override, mark the name so admin sees it's a clone of a system default.
      setForm(
        isOverride
          ? { ...seeded, name: seeded.name + " (tenant override)" }
          : seeded,
      );
      setConditionRaw(
        detail.data.condition ? JSON.stringify(detail.data.condition, null, 2) : "",
      );
    } else if (!isEdit && !isOverride) {
      setForm(blankForm(defaultModule));
      setConditionRaw("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, isOverride, detail.data?.id]);

  const conditionError = useMemo(() => {
    const raw = conditionRaw.trim();
    if (raw.length === 0) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        return "Condition must be a JSON object.";
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid JSON";
    }
  }, [conditionRaw]);

  // Event types filtered by module.
  const moduleEvents = useMemo(() => {
    if (!eventTypes.data) return [];
    return eventTypes.data.filter((et) => et.category === form.module);
  }, [eventTypes.data, form.module]);

  const save = useMutation({
    mutationFn: () => {
      let condition: Record<string, unknown> | null = null;
      const raw = conditionRaw.trim();
      if (raw.length > 0) {
        try { condition = JSON.parse(raw); } catch { condition = null; }
      }
      const payload: NotificationRuleUpsertV2Input = { ...form, condition };
      return isEdit
        ? adminNotificationRulesService.updateV2(ruleId!, payload)
        : adminNotificationRulesService.createV2(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Rule updated." : "Rule created.");
      void qc.invalidateQueries({ queryKey: ["admin-notification-rules-v2"] });
      onClose();
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(
        e.response?.data?.error?.message ?? e.message ?? "Failed to save rule.",
      );
    },
  });

  const canSubmit =
    form.module.length > 0 &&
    form.name.trim().length > 0 &&
    form.eventType.length > 0 &&
    form.channels.length > 0 &&
    form.channels.every((c) => c.channel && c.templateSlug.length > 0) &&
    form.recipients.length > 0 &&
    form.recipients.every((r) => r.recipientType && r.recipientValue.length > 0) &&
    !conditionError &&
    !save.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[760px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? "Edit notification rule"
              : isOverride
                ? "Create tenant-specific override"
                : "Add notification rule"}
          </DialogTitle>
        </DialogHeader>

        {isOverride && (
          <div className="rounded-md border border-gold/30 bg-gold/5 px-3 py-2 text-[12px] text-ink">
            You're cloning a system default. Saving creates a new rule scoped to
            your tenant — it will take precedence over the system default for
            this event. The original system rule remains untouched.
          </div>
        )}

        {(isEdit || isOverride) && detail.isLoading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-ink-muted">
                <span>Module</span>
                <select
                  value={form.module}
                  onChange={(e) => setForm({ ...form, module: e.target.value, eventType: "" })}
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">— select —</option>
                  {Object.entries(MODULE_META).map(([code, meta]) => (
                    <option key={code} value={code}>{meta.label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-ink-muted">
                <span>Trigger event</span>
                <select
                  value={form.eventType}
                  onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                  disabled={!form.module}
                >
                  <option value="">— select —</option>
                  {moduleEvents.map((et) => (
                    <option key={et.code} value={et.code}>
                      {et.displayName} ({et.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-ink-muted sm:col-span-2">
                <span>Rule name</span>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Notify legal counsel on high-value contracts"
                />
              </label>
              <label className="grid gap-1 text-xs text-ink-muted sm:col-span-2">
                <span>Description</span>
                <textarea
                  value={form.description ?? ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value || null })}
                  rows={2}
                  className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                />
              </label>
              <label className="grid gap-1 text-xs text-ink-muted">
                <span>Priority</span>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as RulePriority })}
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-ink-muted">
                <span>Cooldown (minutes)</span>
                <Input
                  type="number"
                  min={0}
                  value={form.cooldownMinutes}
                  onChange={(e) =>
                    setForm({ ...form, cooldownMinutes: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.isEnabled}
                  onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
                  className="h-4 w-4 cursor-pointer accent-gold"
                />
                <span>Enabled</span>
              </label>
            </div>

            {/* Channels */}
            <div className="rounded-md border border-border bg-surface/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  Channels & templates
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      ...form,
                      channels: [...form.channels, { channel: "in_app", templateSlug: "" }],
                    })
                  }
                >
                  <Plus className="me-1 h-3.5 w-3.5" /> Add channel
                </Button>
              </div>
              {form.channels.length === 0 ? (
                <p className="text-[11px] text-ink-muted">No channels yet — add one.</p>
              ) : (
                <ul className="space-y-2">
                  {form.channels.map((c, i) => (
                    <li key={i} className="flex flex-wrap items-end gap-2">
                      <select
                        value={c.channel}
                        onChange={(e) => {
                          const next = [...form.channels];
                          next[i] = { ...next[i], channel: e.target.value as RuleChannel };
                          setForm({ ...form, channels: next });
                        }}
                        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                      >
                        {CHANNEL_OPTIONS.map((ch) => (
                          <option key={ch} value={ch}>{CHANNEL_LABEL[ch]}</option>
                        ))}
                      </select>
                      <Input
                        value={c.templateSlug}
                        onChange={(e) => {
                          const next = [...form.channels];
                          next[i] = { ...next[i], templateSlug: e.target.value };
                          setForm({ ...form, channels: next });
                        }}
                        placeholder="template slug (e.g. approval.pending.in_app)"
                        className="min-w-[260px] flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setForm({
                            ...form,
                            channels: form.channels.filter((_, idx) => idx !== i),
                          })
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Recipients */}
            <div className="rounded-md border border-border bg-surface/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  Recipients
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      ...form,
                      recipients: [
                        ...form.recipients,
                        { recipientType: "role", recipientValue: "" },
                      ],
                    })
                  }
                >
                  <Plus className="me-1 h-3.5 w-3.5" /> Add recipient
                </Button>
              </div>
              {form.recipients.length === 0 ? (
                <p className="text-[11px] text-ink-muted">No recipients yet — add one.</p>
              ) : (
                <ul className="space-y-2">
                  {form.recipients.map((r, i) => (
                    <li key={i} className="flex flex-wrap items-end gap-2">
                      <select
                        value={r.recipientType}
                        onChange={(e) => {
                          const next = [...form.recipients];
                          next[i] = {
                            ...next[i],
                            recipientType: e.target.value as RecipientType,
                            recipientValue: "",
                          };
                          setForm({ ...form, recipients: next });
                        }}
                        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                      >
                        {RECIPIENT_TYPES.map((rt) => (
                          <option key={rt} value={rt}>{RECIPIENT_TYPE_LABEL[rt]}</option>
                        ))}
                      </select>
                      <RecipientValueInput
                        recipientType={r.recipientType}
                        value={r.recipientValue}
                        contextResolvers={contextResolvers.data ?? []}
                        onChange={(v) => {
                          const next = [...form.recipients];
                          next[i] = { ...next[i], recipientValue: v };
                          setForm({ ...form, recipients: next });
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setForm({
                            ...form,
                            recipients: form.recipients.filter((_, idx) => idx !== i),
                          })
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-ink-subtle">
                Tip: "From context" lets the rule pick the right person dynamically based
                on the event — e.g. the contract assignee, the approval requester, the
                watchers list. Pick the resolver that matches what your team needs to know.
              </p>
            </div>

            <label className="grid gap-1 text-xs text-ink-muted">
              <span>Condition (JSON, optional)</span>
              <textarea
                value={conditionRaw}
                onChange={(e) => setConditionRaw(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-2 py-1 font-mono text-xs"
                placeholder={`{ "contract.valueAed": { "gte": 1000000 } }`}
              />
              {conditionError && (
                <span className="text-[11px] text-terracotta">{conditionError}</span>
              )}
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!canSubmit}>
            {save.isPending ? "Saving…" : isEdit ? "Save" : "Create rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecipientValueInput({
  recipientType,
  value,
  contextResolvers,
  onChange,
}: {
  recipientType: RecipientType;
  value: string;
  contextResolvers: ContextResolverRow[];
  onChange: (v: string) => void;
}) {
  if (recipientType === "context") {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[260px] flex-1 h-9 rounded-md border border-input bg-transparent px-2 text-sm"
      >
        <option value="">— pick resolver —</option>
        {contextResolvers.map((cr) => (
          <option key={cr.code} value={cr.code}>{cr.label}</option>
        ))}
      </select>
    );
  }
  const placeholder =
    recipientType === "role"
      ? "role code (e.g. legal_counsel)"
      : recipientType === "user"
        ? "user id (e.g. 42)"
        : "email address";
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={recipientType === "user" ? "number" : "text"}
      className="min-w-[220px] flex-1"
    />
  );
}

function blankForm(module: string | null): NotificationRuleUpsertV2Input {
  return {
    module: module ?? "",
    name: "",
    description: null,
    eventType: "",
    isEnabled: true,
    priority: "medium",
    condition: null,
    cooldownMinutes: 0,
    dedupeKey: null,
    ordering: 100,
    channels: [{ channel: "in_app", templateSlug: "" }],
    recipients: [{ recipientType: "context", recipientValue: "caller" }],
  };
}

function detailToForm(d: NotificationRuleDetail): NotificationRuleUpsertV2Input {
  return {
    module: d.module,
    name: d.name,
    description: d.description,
    eventType: d.eventType,
    isEnabled: d.isEnabled,
    priority: d.priority,
    condition: d.condition,
    cooldownMinutes: d.cooldownMinutes,
    dedupeKey: d.dedupeKey,
    ordering: d.ordering,
    channels: d.channels.map((c) => ({
      channel: c.channel,
      templateSlug: c.templateSlug,
      subjectOverride: c.subjectOverride,
      bodyOverride: c.bodyOverride,
    })),
    recipients: d.recipients.map((r) => ({
      recipientType: r.recipientType,
      recipientValue: r.recipientValue,
    })),
  };
}
