/**
 * /app/admin/config — 7-tab workspace settings (M10/CR-C extended from 3→7).
 *
 *   General         — editable workspace defaults.
 *   UAE Pass        — editable OIDC config (sandbox toggle).
 *   Branding        — links to /admin/branding for logo/color editing.
 *   Security        — session timeouts, password policy, MFA, IP allowlist.
 *   Email           — daily limits, from address, enabled toggle.
 *   Calendar        — weekend days, working hours, holidays.
 *   Audit Retention — retention_days (1..3650).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Settings, ShieldCheck, Palette, Lock, Mail, Calendar, Archive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import {
  adminSettingsService,
  type SettingCategory,
  type SystemSettingRow,
} from "@/services/api/admin-settings.service";
import { translateApiError } from "@/lib/translate-api-error";
import { toast } from "sonner";

// Extended category type including M10 additions
type ExtendedSettingCategory =
  | SettingCategory
  | 'security'
  | 'email'
  | 'calendar'
  | 'audit_retention';

export const Route = createFileRoute("/app/admin/config")({
  component: () => (
    <ErrorBoundary>
      <AdminConfigView />
    </ErrorBoundary>
  ),
});

const TAB_META: Record<
  ExtendedSettingCategory,
  { labelKey: string; defaultLabel: string; icon: React.ComponentType<{ className?: string }> }
> = {
  general: {
    labelKey: "admin.config.tabs.general",
    defaultLabel: "General",
    icon: Settings,
  },
  uae_pass: {
    labelKey: "admin.config.tabs.uaePass",
    defaultLabel: "UAE Pass",
    icon: ShieldCheck,
  },
  branding: {
    labelKey: "admin.config.tabs.branding",
    defaultLabel: "Branding",
    icon: Palette,
  },
  security: {
    labelKey: "admin.systemSettings.tabs.security",
    defaultLabel: "Security",
    icon: Lock,
  },
  email: {
    labelKey: "admin.systemSettings.tabs.email",
    defaultLabel: "Email",
    icon: Mail,
  },
  calendar: {
    labelKey: "admin.systemSettings.tabs.calendar",
    defaultLabel: "Calendar",
    icon: Calendar,
  },
  audit_retention: {
    labelKey: "admin.systemSettings.tabs.auditRetention",
    defaultLabel: "Audit Retention",
    icon: Archive,
  },
};

function AdminConfigView() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ExtendedSettingCategory>("general");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => adminSettingsService.list(),
    staleTime: 60_000,
  });

  const settings = data?.settings ?? [];
  const grouped = useMemo(() => {
    const m: Record<ExtendedSettingCategory, SystemSettingRow[]> = {
      general: [],
      uae_pass: [],
      branding: [],
      security: [],
      email: [],
      calendar: [],
      audit_retention: [],
    };
    for (const s of settings) {
      const cat = s.category as ExtendedSettingCategory;
      if (cat in m) m[cat].push(s);
    }
    return m;
  }, [settings]);

  const tabs: ExtendedSettingCategory[] = [
    "general",
    "uae_pass",
    "branding",
    "security",
    "email",
    "calendar",
    "audit_retention",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[960px] space-y-4 p-6"
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("admin.config.title", { defaultValue: "Configuration" })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("admin.config.subtitle", {
            defaultValue:
              "Workspace-level defaults. General + UAE Pass are editable; Branding is read-only.",
          })}
        </p>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-border" role="tablist">
        {tabs.map((c) => {
          const Icon = TAB_META[c].icon;
          const isActive = tab === c;
          return (
            <button
              key={c}
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(c)}
              className={
                isActive
                  ? "flex items-center gap-2 border-b-2 border-gold px-4 py-2 text-sm font-medium text-gold"
                  : "flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm text-ink-muted hover:text-ink"
              }
            >
              <Icon className="h-4 w-4" />
              {t(TAB_META[c].labelKey, { defaultValue: TAB_META[c].defaultLabel })}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded bg-surface"
              aria-hidden
            />
          ))}
        </div>
      ) : tab === 'branding' ? (
        <div className="space-y-3">
          <div className="rounded-md border border-border bg-surface/40 px-3 py-2 text-xs text-ink-subtle">
            {t("admin.config.branding.readOnly", {
              defaultValue:
                "Branding values (logo, colors, footer) can be edited on the dedicated Branding page.",
            })}
          </div>
          <Link
            to="/app/admin/branding"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm text-ink hover:bg-surface"
          >
            <Palette className="h-4 w-4 text-gold" />
            {t("admin.config.branding.editLink", { defaultValue: "Open Branding editor" })}
          </Link>
          <SettingsTab category="branding" rows={grouped.branding} />
        </div>
      ) : (
        <SettingsTab category={tab} rows={grouped[tab] ?? []} />
      )}
    </motion.div>
  );
}

function SettingsTab({
  category,
  rows,
}: {
  category: ExtendedSettingCategory;
  rows: SystemSettingRow[];
}) {
  const { t } = useTranslation();
  const readOnly = category === "branding";

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <p className="text-sm text-ink-muted">
          {t("admin.config.empty", { defaultValue: "No settings in this tab." })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {readOnly && (
        <div className="rounded-md border border-border bg-surface/40 px-3 py-2 text-xs text-ink-subtle">
          {t("admin.config.branding.readOnly", {
            defaultValue:
              "Branding values are read-only in this UI. Contact the platform team to change them.",
          })}
        </div>
      )}
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {rows.map((row) => (
          <SettingRow key={row.key} row={row} readOnly={readOnly} />
        ))}
      </div>
    </div>
  );
}

function SettingRow({
  row,
  readOnly,
}: {
  row: SystemSettingRow;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string>(formatValueForInput(row.value));

  useEffect(() => {
    setDraft(formatValueForInput(row.value));
  }, [row.value]);

  const updateMutation = useMutation({
    mutationFn: () =>
      adminSettingsService.set(row.key, parseValueForApi(row.value, draft)),
    onSuccess: () => {
      toast.success(
        t("admin.config.toast.saved", { defaultValue: "Setting saved." }),
      );
      void queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (err: unknown) =>
      toast.error(translateApiError(err, t, "admin.config.errors.saveFailed")),
  });

  const dirty = draft !== formatValueForInput(row.value);
  const valueKind = inferKind(row.value);
  const inputType = valueKind === "number" ? "number" : "text";

  return (
    <div className="grid grid-cols-1 items-start gap-3 px-4 py-3 sm:grid-cols-[1fr_2fr_auto]">
      <div>
        <p className="font-mono text-xs text-ink">{row.key}</p>
        {row.description && (
          <p className="mt-0.5 text-xs text-ink-subtle">{row.description}</p>
        )}
      </div>
      {valueKind === "boolean" ? (
        <BooleanToggle
          value={Boolean(row.value)}
          onChange={(v) => {
            if (readOnly) return;
            adminSettingsService
              .set(row.key, v)
              .then(() =>
                queryClient.invalidateQueries({
                  queryKey: ["admin-settings"],
                }),
              )
              .catch((err: unknown) =>
                toast.error(
                  translateApiError(
                    err,
                    t,
                    "admin.config.errors.saveFailed",
                  ),
                ),
              );
          }}
          disabled={readOnly}
        />
      ) : (
        <Input
          type={inputType}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={readOnly}
          className="font-mono text-sm"
        />
      )}
      <div className="sm:justify-self-end">
        {valueKind !== "boolean" && (
          <Button
            size="sm"
            disabled={readOnly || !dirty || updateMutation.isPending}
            onClick={() => updateMutation.mutate()}
          >
            {t("common.save", { defaultValue: "Save" })}
          </Button>
        )}
      </div>
    </div>
  );
}

function BooleanToggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-border accent-gold"
      />
      <span className="text-sm text-ink">{value ? "Enabled" : "Disabled"}</span>
    </label>
  );
}

function formatValueForInput(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return JSON.stringify(value);
}

function parseValueForApi(original: unknown, draft: string): unknown {
  const kind = inferKind(original);
  if (kind === "number") {
    const n = Number(draft);
    return Number.isFinite(n) ? n : draft;
  }
  if (kind === "boolean") {
    return draft === "true";
  }
  return draft;
}

function inferKind(value: unknown): "string" | "number" | "boolean" | "object" {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object" && value !== null) return "object";
  return "string";
}
