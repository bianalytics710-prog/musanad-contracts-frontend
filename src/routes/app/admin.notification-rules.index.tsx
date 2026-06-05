/**
 * /app/admin/notification-rules — Platform Admin trigger-rule registry.
 *
 * Each row = ONE (event_type, channel, template_id) combination. Group by
 * category so the admin can scan related events together. Per-row toggle
 * flips is_enabled immediately (and the dispatch fn now short-circuits on
 * disabled rules — see mig 580 fn_notification_send refactor).
 *
 * Gate: platform.notifications.manage.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Slack,
  ToggleLeft,
  ToggleRight,
  Trash2,
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
  type NotificationEventTypeRow,
  type NotificationRuleInput,
  type RuleChannel,
  type RulePriority,
} from "@/services/api/admin-notification-rules.service";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/admin/notification-rules/")({
  component: () => (
    <ErrorBoundary>
      <NotificationRulesList />
    </ErrorBoundary>
  ),
});

const CHANNEL_OPTIONS: RuleChannel[] = [
  "email",
  "in_app",
  "teams_capture",
  "slack_capture",
];

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

const CATEGORY_LABEL: Record<string, string> = {
  approval: "Approval",
  contract: "Contract lifecycle",
  signature: "Signature",
  comment: "Comments",
  advisory: "Advisory",
  impact: "Impact signals",
  regulatory: "Regulatory",
  import: "Imports",
  user: "User account",
  watch: "Watch list",
  system: "System",
};

function NotificationRulesList() {
  const { t } = useTranslation();
  const canManage = useAuthStore(
    selectHasPermission("platform.notifications.manage"),
  );

  const [channel, setChannel] = useState<RuleChannel | "">("");
  const [search, setSearch] = useState<string>("");
  // null = closed. {row:null} = create. {row:<existing>} = edit.
  const [editorState, setEditorState] = useState<
    { row: NotificationRuleRow | null } | null
  >(null);

  const params = useMemo(
    () => ({
      channel: channel || undefined,
      search: search.trim() || undefined,
    }),
    [channel, search],
  );

  const { data: rules = [], isLoading, isError } = useQuery({
    queryKey: ["admin-notification-rules", params],
    queryFn: () => adminNotificationRulesService.list(params),
    enabled: canManage,
    staleTime: 30_000,
  });

  // Group by category, then by event_type within category.
  const grouped = useMemo(() => {
    const byCategory = new Map<string, Map<string, NotificationRuleRow[]>>();
    for (const r of rules) {
      let cat = byCategory.get(r.eventCategory);
      if (!cat) {
        cat = new Map<string, NotificationRuleRow[]>();
        byCategory.set(r.eventCategory, cat);
      }
      const list = cat.get(r.eventType) ?? [];
      list.push(r);
      cat.set(r.eventType, list);
    }
    return byCategory;
  }, [rules]);

  const totals = useMemo(() => {
    let enabled = 0;
    let disabled = 0;
    for (const r of rules) {
      if (r.isEnabled) enabled++;
      else disabled++;
    }
    return { enabled, disabled, total: rules.length };
  }, [rules]);

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
            {t("admin.notificationRules.kicker", {
              defaultValue: "Workflow & rules",
            })}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("admin.notificationRules.title", {
              defaultValue: "Notification rules",
            })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("admin.notificationRules.subtitle", {
              defaultValue:
                "For each event the platform emits, decide whether to send the notification, on which channel, using which template. Toggling a rule off silences the corresponding email or in-app message immediately.",
            })}
          </p>
        </div>
        <Button onClick={() => setEditorState({ row: null })}>
          <Plus className="me-1 h-4 w-4" />
          {t("admin.notificationRules.add", { defaultValue: "Add rule" })}
        </Button>
      </header>

      {/* Totals + filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <div className="space-y-1">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("admin.notificationRules.filter.channel", { defaultValue: "Channel" })}
          </span>
          <select
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
            value={channel}
            onChange={(e) => setChannel(e.target.value as RuleChannel | "")}
          >
            <option value="">{t("common.all", { defaultValue: "All" })}</option>
            {CHANNEL_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="relative min-w-[220px] flex-1 space-y-1">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("admin.notificationRules.filter.search", { defaultValue: "Search" })}
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.notificationRules.filter.searchPh", {
                defaultValue: "Search by template id or event name…",
              })}
              className="ps-9"
            />
          </div>
        </div>
        <div className="ms-auto flex items-end gap-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("admin.notificationRules.enabled", { defaultValue: "Enabled" })}:{" "}
            <span className="font-semibold text-sage">{totals.enabled}</span>
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("admin.notificationRules.disabled", { defaultValue: "Disabled" })}:{" "}
            <span className="font-semibold text-terracotta">{totals.disabled}</span>
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("admin.notificationRules.total", { defaultValue: "Total" })}:{" "}
            <span className="font-semibold text-ink">{totals.total}</span>
          </span>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3" aria-busy>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-surface" aria-hidden />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-terracotta/40 bg-terracotta/5 p-6 text-center">
          <p className="text-sm text-terracotta">
            {t("admin.notificationRules.error.fetch", {
              defaultValue: "Failed to load notification rules.",
            })}
          </p>
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t("admin.notificationRules.empty", {
              defaultValue: "No rules matching the current filters.",
            })}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([category, eventMap]) => (
            <CategorySection
              key={category}
              category={category}
              eventMap={eventMap}
              onEdit={(row) => setEditorState({ row })}
            />
          ))}
        </div>
      )}

      <RuleEditorDialog
        open={editorState !== null}
        onClose={() => setEditorState(null)}
        existing={editorState?.row ?? null}
      />
    </motion.div>
  );
}

function CategorySection({
  category,
  eventMap,
  onEdit,
}: {
  category: string;
  eventMap: Map<string, NotificationRuleRow[]>;
  onEdit: (row: NotificationRuleRow) => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
          {CATEGORY_LABEL[category] ?? category}
        </div>
        <div className="divide-y divide-border rounded-md border border-border">
          {Array.from(eventMap.entries()).map(([eventType, rows]) => (
            <EventGroup
              key={eventType}
              eventType={eventType}
              rows={rows}
              onEdit={onEdit}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EventGroup({
  eventType,
  rows,
  onEdit,
}: {
  eventType: string;
  rows: NotificationRuleRow[];
  onEdit: (row: NotificationRuleRow) => void;
}) {
  const [expanded, setExpanded] = useState<boolean>(true);
  const enabledCount = rows.filter((r) => r.isEnabled).length;
  const head = rows[0];
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-start hover:bg-surface/50"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {head.eventDisplayName}
            </p>
            <p className="truncate font-mono text-[11px] text-ink-subtle">
              {eventType}
            </p>
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
          {enabledCount}/{rows.length} enabled
        </span>
      </button>
      {expanded && (
        <ul className="divide-y divide-border border-t border-border bg-surface/30">
          {rows.map((row) => (
            <RuleRow key={row.id} row={row} onEdit={() => onEdit(row)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RuleRow({
  row,
  onEdit,
}: {
  row: NotificationRuleRow;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const Icon = CHANNEL_ICON[row.channel];

  const toggleMutation = useMutation({
    mutationFn: (next: boolean) =>
      adminNotificationRulesService.setEnabled(row.id, next),
    onSuccess: (res) => {
      toast.success(
        res.isEnabled
          ? t("admin.notificationRules.toggle.on", {
              defaultValue: "Enabled — {{name}} will fire on next event.",
              name: row.eventDisplayName,
            })
          : t("admin.notificationRules.toggle.off", {
              defaultValue: "Disabled — {{name}} will be suppressed.",
              name: row.eventDisplayName,
            }),
      );
      void qc.invalidateQueries({ queryKey: ["admin-notification-rules"] });
    },
    onError: () => {
      toast.error(
        t("admin.notificationRules.toggle.failed", {
          defaultValue: "Failed to toggle rule.",
        }),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminNotificationRulesService.deactivate(row.id),
    onSuccess: () => {
      toast.success(
        t("admin.notificationRules.deleted", {
          defaultValue: "Rule removed.",
        }),
      );
      void qc.invalidateQueries({ queryKey: ["admin-notification-rules"] });
    },
    onError: () => {
      toast.error(
        t("admin.notificationRules.deleteFailed", {
          defaultValue: "Failed to remove rule.",
        }),
      );
    },
  });

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="rounded-md bg-gold/10 p-1.5">
        <Icon className="h-4 w-4 text-gold" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
            {CHANNEL_LABEL[row.channel]}
          </span>
          <PriorityPill priority={row.priority} />
          {!row.isEnabled && (
            <span className="rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-terracotta">
              {t("admin.notificationRules.disabledTag", { defaultValue: "Disabled" })}
            </span>
          )}
          {row.isSystemDefault && (
            <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t("admin.notificationRules.systemDefault", { defaultValue: "System default" })}
            </span>
          )}
        </div>
        <p className="truncate font-mono text-[11px] text-ink-subtle">
          {row.templateId}
        </p>
        {row.description && (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-muted">{row.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleMutation.mutate(!row.isEnabled)}
          disabled={toggleMutation.isPending}
          title={
            row.isEnabled
              ? t("admin.notificationRules.disableHint", { defaultValue: "Click to disable" })
              : t("admin.notificationRules.enableHint", { defaultValue: "Click to enable" })
          }
        >
          {row.isEnabled ? (
            <ToggleRight className="h-5 w-5 text-sage" />
          ) : (
            <ToggleLeft className="h-5 w-5 text-ink-muted" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          title={t("common.edit", { defaultValue: "Edit" })}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (
              confirm(
                t("admin.notificationRules.confirmDelete", {
                  defaultValue: "Remove this rule? You can re-add it later.",
                }),
              )
            ) {
              deleteMutation.mutate();
            }
          }}
          disabled={deleteMutation.isPending}
          title={t("common.delete", { defaultValue: "Delete" })}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

function PriorityPill({ priority }: { priority: NotificationRuleRow["priority"] }) {
  const palette =
    priority === "critical"
      ? "bg-terracotta/15 text-terracotta"
      : priority === "high"
        ? "bg-amber/15 text-amber-ink"
        : priority === "medium"
          ? "bg-surface text-ink-muted"
          : "bg-surface text-ink-subtle";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        palette,
      )}
    >
      {priority}
    </span>
  );
}

// ─── Editor dialog ───────────────────────────────────────────────────────

const PRIORITY_OPTIONS: RulePriority[] = ["low", "medium", "high", "critical"];

interface AudienceForm {
  roles: string;            // comma-separated
  userIds: string;          // comma-separated ints
  additionalEmails: string; // comma-separated
}

interface EditorForm {
  eventType: string;
  templateId: string;
  channel: RuleChannel;
  isEnabled: boolean;
  priority: RulePriority;
  cooldownMinutes: number;
  description: string;
  audience: AudienceForm;
  conditionJson: string; // raw JSON in textarea
}

function blankForm(): EditorForm {
  return {
    eventType: "",
    templateId: "",
    channel: "email",
    isEnabled: true,
    priority: "medium",
    cooldownMinutes: 0,
    description: "",
    audience: { roles: "", userIds: "", additionalEmails: "" },
    conditionJson: "",
  };
}

function rowToForm(row: NotificationRuleRow): EditorForm {
  const aud = (row.audience ?? {}) as Record<string, unknown>;
  const arr = (k: string): string => {
    const v = aud[k];
    if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
    return "";
  };
  return {
    eventType: row.eventType,
    templateId: row.templateId,
    channel: row.channel,
    isEnabled: row.isEnabled,
    priority: row.priority,
    cooldownMinutes: row.cooldownMinutes,
    description: row.description ?? "",
    audience: {
      roles: arr("roles"),
      userIds: arr("userIds"),
      additionalEmails: arr("additionalEmails"),
    },
    conditionJson: row.condition ? JSON.stringify(row.condition, null, 2) : "",
  };
}

function formToInput(f: EditorForm): NotificationRuleInput {
  const splitCsv = (s: string): string[] =>
    s.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
  const splitCsvInt = (s: string): number[] =>
    splitCsv(s)
      .map((x) => Number(x))
      .filter((n) => Number.isInteger(n) && n > 0);

  const audience: Record<string, unknown> = {};
  const roles = splitCsv(f.audience.roles);
  const userIds = splitCsvInt(f.audience.userIds);
  const emails = splitCsv(f.audience.additionalEmails);
  if (roles.length > 0) audience.roles = roles;
  if (userIds.length > 0) audience.userIds = userIds;
  if (emails.length > 0) audience.additionalEmails = emails;

  let condition: Record<string, unknown> | null = null;
  const raw = f.conditionJson.trim();
  if (raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        condition = parsed as Record<string, unknown>;
      }
    } catch {
      // Caller validates before submit; keep null here.
    }
  }

  return {
    eventType: f.eventType,
    templateId: f.templateId,
    channel: f.channel,
    isEnabled: f.isEnabled,
    audience,
    condition,
    priority: f.priority,
    cooldownMinutes: f.cooldownMinutes,
    description: f.description.trim().length === 0 ? null : f.description.trim(),
  };
}

function RuleEditorDialog({
  open,
  onClose,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  existing: NotificationRuleRow | null;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = !!existing;

  const [form, setForm] = useState<EditorForm>(() =>
    existing ? rowToForm(existing) : blankForm(),
  );

  // Re-seed form on open / row swap.
  // Cheap reset; dialog mounts/unmounts on parent toggle anyway.
  useEffectOnRowSwap(existing, open, setForm);

  // Event-type catalogue for the dropdown.
  const { data: eventTypes = [] } = useQuery({
    queryKey: ["admin-notification-event-types"],
    queryFn: () => adminNotificationRulesService.eventTypes(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const conditionParseError = useMemo(() => {
    const raw = form.conditionJson.trim();
    if (raw.length === 0) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return t("admin.notificationRules.condition.objectRequired", {
          defaultValue: "Condition must be a JSON object (e.g. { \"contract.valueAed\": { \"gte\": 1000000 } }).",
        });
      }
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid JSON";
    }
  }, [form.conditionJson, t]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const input = formToInput(form);
      return isEdit && existing
        ? adminNotificationRulesService.update(existing.id, input)
        : adminNotificationRulesService.create(input);
    },
    onSuccess: () => {
      toast.success(
        isEdit
          ? t("admin.notificationRules.updated", { defaultValue: "Rule updated." })
          : t("admin.notificationRules.created", { defaultValue: "Rule created." }),
      );
      void qc.invalidateQueries({ queryKey: ["admin-notification-rules"] });
      onClose();
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      const msg =
        e.response?.data?.error?.message ??
        e.message ??
        t("admin.notificationRules.saveFailed", {
          defaultValue: "Failed to save rule.",
        });
      toast.error(msg);
    },
  });

  const canSubmit =
    form.eventType.length > 0 &&
    form.templateId.length > 0 &&
    form.channel.length > 0 &&
    !conditionParseError &&
    !saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t("admin.notificationRules.editor.editTitle", { defaultValue: "Edit notification rule" })
              : t("admin.notificationRules.editor.addTitle", { defaultValue: "Add notification rule" })}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-ink-muted">
            <span>{t("admin.notificationRules.fields.eventType", { defaultValue: "Event type" })}</span>
            <select
              value={form.eventType}
              onChange={(e) => setForm({ ...form, eventType: e.target.value })}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="">— select —</option>
              {eventTypes.map((et: NotificationEventTypeRow) => (
                <option key={et.code} value={et.code}>
                  {et.displayName} ({et.code})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-ink-muted">
            <span>{t("admin.notificationRules.fields.channel", { defaultValue: "Channel" })}</span>
            <select
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value as RuleChannel })}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-ink-muted sm:col-span-2">
            <span>{t("admin.notificationRules.fields.templateId", { defaultValue: "Template ID" })}</span>
            <Input
              value={form.templateId}
              onChange={(e) => setForm({ ...form, templateId: e.target.value })}
              placeholder="approval.pending.in_app"
            />
            <span className="text-[11px] text-ink-subtle">
              {t("admin.notificationRules.fields.templateIdHelp", {
                defaultValue: "Must match an existing notification_template.template_id (see /admin/email-templates).",
              })}
            </span>
          </label>
          <label className="grid gap-1 text-xs text-ink-muted">
            <span>{t("admin.notificationRules.fields.priority", { defaultValue: "Priority" })}</span>
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
            <span>{t("admin.notificationRules.fields.cooldown", { defaultValue: "Cooldown (minutes)" })}</span>
            <Input
              type="number"
              min={0}
              value={form.cooldownMinutes}
              onChange={(e) => setForm({ ...form, cooldownMinutes: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
              className="h-4 w-4 cursor-pointer accent-gold"
            />
            <span>
              {t("admin.notificationRules.fields.isEnabled", {
                defaultValue: "Enabled — fire this notification on the event",
              })}
            </span>
          </label>
          <label className="grid gap-1 text-xs text-ink-muted sm:col-span-2">
            <span>{t("admin.notificationRules.fields.description", { defaultValue: "Description" })}</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
              placeholder={t("admin.notificationRules.fields.descriptionPh", {
                defaultValue: "Why this rule exists, who asked for it, etc.",
              })}
            />
          </label>

          <div className="sm:col-span-2 mt-2 rounded-md border border-border bg-surface/30 p-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t("admin.notificationRules.fields.audience", { defaultValue: "Audience (optional override)" })}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-xs text-ink-muted">
                <span>{t("admin.notificationRules.fields.audienceRoles", { defaultValue: "Roles" })}</span>
                <Input
                  value={form.audience.roles}
                  onChange={(e) =>
                    setForm({ ...form, audience: { ...form.audience, roles: e.target.value } })
                  }
                  placeholder="legal_counsel, platform_admin"
                />
              </label>
              <label className="grid gap-1 text-xs text-ink-muted">
                <span>{t("admin.notificationRules.fields.audienceUserIds", { defaultValue: "User IDs" })}</span>
                <Input
                  value={form.audience.userIds}
                  onChange={(e) =>
                    setForm({ ...form, audience: { ...form.audience, userIds: e.target.value } })
                  }
                  placeholder="12, 34, 56"
                />
              </label>
              <label className="grid gap-1 text-xs text-ink-muted">
                <span>{t("admin.notificationRules.fields.audienceEmails", { defaultValue: "Extra emails" })}</span>
                <Input
                  value={form.audience.additionalEmails}
                  onChange={(e) =>
                    setForm({ ...form, audience: { ...form.audience, additionalEmails: e.target.value } })
                  }
                  placeholder="cfo@example.com"
                />
              </label>
            </div>
            <p className="mt-2 text-[11px] text-ink-subtle">
              {t("admin.notificationRules.fields.audienceHelp", {
                defaultValue: "Empty = use whoever the call site supplied. v1 stores audience for documentation; evaluation comes in a later iteration.",
              })}
            </p>
          </div>

          <label className="grid gap-1 text-xs text-ink-muted sm:col-span-2">
            <span>{t("admin.notificationRules.fields.condition", { defaultValue: "Condition (JSON, optional)" })}</span>
            <textarea
              value={form.conditionJson}
              onChange={(e) => setForm({ ...form, conditionJson: e.target.value })}
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-2 py-1 font-mono text-xs"
              placeholder={`{ "contract.valueAed": { "gte": 1000000 } }`}
            />
            {conditionParseError && (
              <span className="text-[11px] text-terracotta">{conditionParseError}</span>
            )}
            <span className="text-[11px] text-ink-subtle">
              {t("admin.notificationRules.fields.conditionHelp", {
                defaultValue: "Optional predicates against the event payload. v1 stores it for the future evaluator.",
              })}
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saveMutation.isPending}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!canSubmit}>
            {saveMutation.isPending
              ? t("common.saving", { defaultValue: "Saving…" })
              : isEdit
                ? t("common.save", { defaultValue: "Save" })
                : t("admin.notificationRules.editor.create", { defaultValue: "Create rule" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Re-seed editor form whenever the open state or row swaps.
import { useEffect } from "react";
function useEffectOnRowSwap(
  existing: NotificationRuleRow | null,
  open: boolean,
  setForm: React.Dispatch<React.SetStateAction<EditorForm>>,
) {
  useEffect(() => {
    if (!open) return;
    setForm(existing ? rowToForm(existing) : blankForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);
}
