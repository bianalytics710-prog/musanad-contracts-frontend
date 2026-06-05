/**
 * /app/admin/email-templates/new — create a new notification template.
 *
 * Minimal form: template ID (dotted lowercase slug) + channel + subjects +
 * bodies + optional parameter_schema. POSTs to fn_notification_template_create
 * via the new BE endpoint. On success, navigates to the edit page of the
 * created row so admin can refine.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft, Save } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminNotificationTemplatesService } from "@/services/api/admin/notification-templates.service";
import { useAuthStore } from "@/store/auth.store";
import {
  NOTIFICATION_TEMPLATE_CHANNELS,
  type NotificationTemplateChannel,
} from "@/types/admin/notification-templates.types";

export const Route = createFileRoute("/app/admin/email-templates/new")({
  component: () => (
    <ErrorBoundary>
      <EmailTemplateNewView />
    </ErrorBoundary>
  ),
});

function EmailTemplateNewView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const hasPermission =
    user?.permissions.includes("notification.template.manage") ?? false;

  const [templateId, setTemplateId] = useState("");
  const [channel, setChannel] = useState<NotificationTemplateChannel>("email");
  const [subjectEn, setSubjectEn] = useState("");
  const [subjectAr, setSubjectAr] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [bodyAr, setBodyAr] = useState("");
  const [paramSchemaRaw, setParamSchemaRaw] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      let parameterSchema: Record<string, unknown> | null = null;
      const raw = paramSchemaRaw.trim();
      if (raw.length > 0) {
        try {
          parameterSchema = JSON.parse(raw);
        } catch {
          throw new Error("Parameter schema is not valid JSON");
        }
      }
      return adminNotificationTemplatesService.create({
        templateId: templateId.trim(),
        channel,
        subjectEn: subjectEn.trim() || null,
        subjectAr: subjectAr.trim() || null,
        bodyEn: bodyEn.trim(),
        bodyAr: bodyAr.trim() || null,
        parameterSchema,
      });
    },
    onSuccess: (row) => {
      toast.success(
        t("admin.emailTemplates.created", {
          defaultValue: "Template created: {{slug}}",
          slug: row.templateId,
        }),
      );
      void navigate({
        to: "/app/admin/email-templates/$id",
        params: { id: String(row.id) },
      });
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      const msg =
        e.response?.data?.error?.message ??
        e.message ??
        t("admin.emailTemplates.createFailed", { defaultValue: "Failed to create template" });
      toast.error(msg);
    },
  });

  if (!hasPermission) {
    return (
      <div className="mx-auto w-full max-w-[800px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t("common.forbidden", {
              defaultValue: "You do not have permission to access this page.",
            })}
          </p>
        </div>
      </div>
    );
  }

  const slugValid =
    templateId.length === 0 || /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(templateId);
  const canSubmit =
    templateId.trim().length > 0 &&
    slugValid &&
    bodyEn.trim().length > 0 &&
    !save.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[960px] space-y-4 p-6"
    >
      <Link
        to="/app/admin/email-templates"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-gold"
      >
        <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
        {t("admin.emailTemplates.back", { defaultValue: "Back to message templates" })}
      </Link>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("admin.emailTemplates.new", { defaultValue: "New message template" })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("admin.emailTemplates.newSubtitle", {
            defaultValue:
              "Register a new notification template for email, in-app, Teams or Slack. Use the same slug in your notification rules to wire dispatch.",
          })}
        </p>
      </header>

      <div className="space-y-4 rounded-lg border border-border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-ink-muted">
            <span>{t("admin.emailTemplates.field.slug", { defaultValue: "Template ID (slug)" })}</span>
            <Input
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value.trim().toLowerCase())}
              placeholder="contract.expiry_60day.in_app"
              aria-invalid={!slugValid}
            />
            {!slugValid && (
              <span className="text-[11px] text-terracotta">
                Use dotted lowercase: e.g. <code>contract.expiry_60day.in_app</code>
              </span>
            )}
          </label>
          <label className="grid gap-1 text-xs text-ink-muted">
            <span>{t("admin.emailTemplates.field.channel", { defaultValue: "Channel" })}</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as NotificationTemplateChannel)}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {NOTIFICATION_TEMPLATE_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          {/* Subject only applies to email channel — in_app / teams / slack
              messages render the body straight into the feed without a separate
              subject line. */}
          {channel === "email" && (
            <>
              <label className="grid gap-1 text-xs text-ink-muted">
                <span>{t("admin.emailTemplates.field.subjectEn", { defaultValue: "Subject (EN)" })}</span>
                <Input
                  value={subjectEn}
                  onChange={(e) => setSubjectEn(e.target.value)}
                  placeholder="Contract {{contractNumber}} expires soon"
                />
              </label>
              <label className="grid gap-1 text-xs text-ink-muted" dir="rtl">
                <span>{t("admin.emailTemplates.field.subjectAr", { defaultValue: "Subject (AR)" })}</span>
                <Input
                  value={subjectAr}
                  onChange={(e) => setSubjectAr(e.target.value)}
                  placeholder="ينتهي العقد {{contractNumber}} قريبًا"
                />
              </label>
            </>
          )}
          <label className="grid gap-1 text-xs text-ink-muted sm:col-span-2">
            <span>{t("admin.emailTemplates.field.bodyEn", { defaultValue: "Body (EN)" })}</span>
            <textarea
              value={bodyEn}
              onChange={(e) => setBodyEn(e.target.value)}
              rows={8}
              className="w-full rounded-md border border-input bg-transparent px-2 py-1 font-mono text-xs"
              placeholder={`Hello {{recipientName}},\n\nContract {{contractNumber}} expires on {{endDate}}.`}
            />
          </label>
          <label className="grid gap-1 text-xs text-ink-muted sm:col-span-2" dir="rtl">
            <span>{t("admin.emailTemplates.field.bodyAr", { defaultValue: "Body (AR)" })}</span>
            <textarea
              value={bodyAr}
              onChange={(e) => setBodyAr(e.target.value)}
              rows={8}
              className="w-full rounded-md border border-input bg-transparent px-2 py-1 font-mono text-xs"
              placeholder="If empty, the EN body will be mirrored on save."
              dir="rtl"
            />
          </label>
          <label className="grid gap-1 text-xs text-ink-muted sm:col-span-2">
            <span>
              {t("admin.emailTemplates.field.paramSchema", {
                defaultValue: "Parameter schema (JSON, optional)",
              })}
            </span>
            <textarea
              value={paramSchemaRaw}
              onChange={(e) => setParamSchemaRaw(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-2 py-1 font-mono text-xs"
              placeholder={`{ "contractNumber": "string", "endDate": "string" }`}
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Link
            to="/app/admin/email-templates"
            className="inline-flex items-center rounded-md px-3 py-2 text-sm text-ink-muted hover:bg-surface"
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Link>
          <Button onClick={() => save.mutate()} disabled={!canSubmit}>
            <Save className="me-1 h-4 w-4" />
            {save.isPending
              ? t("common.saving", { defaultValue: "Saving…" })
              : t("admin.emailTemplates.create", { defaultValue: "Create template" })}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
