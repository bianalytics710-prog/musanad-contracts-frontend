/**
 * SourceFormDialog — Add OSINT source dialog.
 *
 * Used by /app/admin/sources "Add source" button. On success, the parent
 * invalidates the source-list query and (optionally) navigates to the
 * detail-edit page so the admin can immediately set the credential.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminSourcesService } from "@/services/api/admin-sources.service";
import { translateApiError } from "@/lib/translate-api-error";
import type {
  CreateOsintSourceDto,
  SourceFormat,
  SourceKind,
} from "@/types/entities/osint.types";

const KIND_OPTIONS: SourceKind[] = [
  "sanctions",
  "news",
  "weather",
  "commodity",
  "fx",
  "social",
  "regulatory",
  "internal",
];

const FORMAT_OPTIONS: SourceFormat[] = ["xml", "csv", "json", "rss", "api"];

const formSchema = z.object({
  sourceId: z
    .string()
    .min(1, "Required")
    .max(200)
    .regex(/^[a-z0-9_]+$/i, "Use letters, digits, and underscores only"),
  displayName: z.string().min(1, "Required").max(200),
  displayNameAr: z.string().max(200).optional(),
  kind: z.enum([
    "sanctions",
    "news",
    "weather",
    "commodity",
    "fx",
    "social",
    "regulatory",
    "internal",
  ] as const),
  url: z
    .string()
    .url("Must be a valid URL")
    .or(z.literal(""))
    .optional(),
  format: z.enum(["xml", "csv", "json", "rss", "api"] as const),
  refreshSeconds: z.number().int().min(60),
  sourceReliability: z.number().min(0).max(1),
  enabled: z.boolean(),
});

type FormErrors = Partial<Record<keyof z.infer<typeof formSchema>, string>>;

interface SourceFormDialogProps {
  onClose: () => void;
  /** Optional callback fired after the source is created. Receives the new id. */
  onCreated?: (newId: number) => void;
}

export function SourceFormDialog({
  onClose,
  onCreated,
}: SourceFormDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [sourceId, setSourceId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [displayNameAr, setDisplayNameAr] = useState("");
  const [kind, setKind] = useState<SourceKind>("news");
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<SourceFormat>("rss");
  const [refreshSeconds, setRefreshSeconds] = useState<number>(900);
  const [sourceReliability, setSourceReliability] = useState<number>(0.85);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [errors, setErrors] = useState<FormErrors>({});

  const createMutation = useMutation({
    mutationFn: (payload: CreateOsintSourceDto) =>
      adminSourcesService.create(payload),
    onSuccess: (created) => {
      toast.success(
        t("admin.sources.toast.created", {
          defaultValue: "Source created.",
        }),
      );
      queryClient.invalidateQueries({ queryKey: ["admin-sources"] });
      queryClient.invalidateQueries({ queryKey: ["admin-source-health"] });
      onCreated?.(created.id);
      void navigate({
        to: "/app/admin/sources/$id",
        params: { id: String(created.id) },
      });
    },
    onError: (err: unknown) =>
      toast.error(translateApiError(err, t, "admin.sources.toast.createFailed")),
  });

  const handleSubmit = () => {
    const result = formSchema.safeParse({
      sourceId: sourceId.trim(),
      displayName: displayName.trim(),
      displayNameAr: displayNameAr.trim() || undefined,
      kind,
      url: url.trim() || undefined,
      format,
      refreshSeconds,
      sourceReliability,
      enabled,
    });
    if (!result.success) {
      const fe: FormErrors = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0];
        if (typeof path === "string") {
          fe[path as keyof FormErrors] = issue.message;
        }
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    const payload: CreateOsintSourceDto = {
      sourceId: result.data.sourceId,
      displayName: result.data.displayName,
      displayNameAr: result.data.displayNameAr,
      kind: result.data.kind,
      url: result.data.url || undefined,
      format: result.data.format,
      refreshSeconds: result.data.refreshSeconds,
      sourceReliability: result.data.sourceReliability,
      enabled: result.data.enabled,
    };
    createMutation.mutate(payload);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("admin.sources.add.title", { defaultValue: "Add OSINT source" })}
          </DialogTitle>
          <DialogDescription>
            {t("admin.sources.add.description", {
              defaultValue:
                "Register a new external feed. After creation, set the credential and trigger a test pull from the detail page.",
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="src-sourceId" className="text-xs">
                {t("admin.sources.form.sourceId.label", {
                  defaultValue: "Source ID",
                })}
              </Label>
              <Input
                id="src-sourceId"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                placeholder="ofac_sdn"
                autoFocus
              />
              {errors.sourceId ? (
                <p className="text-xs text-terracotta">{errors.sourceId}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="src-displayName" className="text-xs">
                {t("admin.sources.form.displayName.label", {
                  defaultValue: "Display name",
                })}
              </Label>
              <Input
                id="src-displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="OFAC SDN List"
              />
              {errors.displayName ? (
                <p className="text-xs text-terracotta">{errors.displayName}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="src-displayNameAr" className="text-xs">
                {t("admin.sources.form.displayNameAr.label", {
                  defaultValue: "Display name (Arabic)",
                })}
              </Label>
              <Input
                id="src-displayNameAr"
                value={displayNameAr}
                onChange={(e) => setDisplayNameAr(e.target.value)}
                dir="rtl"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="src-url" className="text-xs">
                {t("admin.sources.form.url.label", { defaultValue: "URL" })}
              </Label>
              <Input
                id="src-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/feed.xml"
              />
              {errors.url ? (
                <p className="text-xs text-terracotta">{errors.url}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="src-kind" className="text-xs">
                {t("admin.sources.form.kind.label", {
                  defaultValue: "Kind",
                })}
              </Label>
              <select
                id="src-kind"
                className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value as SourceKind)}
              >
                {KIND_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {t(`admin.sources.kind.${k}`, { defaultValue: k })}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="src-format" className="text-xs">
                {t("admin.sources.form.format.label", {
                  defaultValue: "Format",
                })}
              </Label>
              <select
                id="src-format"
                className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
                value={format}
                onChange={(e) => setFormat(e.target.value as SourceFormat)}
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {t(`admin.sources.format.${f}`, {
                      defaultValue: f.toUpperCase(),
                    })}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="src-refresh" className="text-xs">
                {t("admin.sources.form.refreshSeconds.label", {
                  defaultValue: "Refresh (sec)",
                })}
              </Label>
              <Input
                id="src-refresh"
                type="number"
                inputMode="numeric"
                min={60}
                value={refreshSeconds}
                onChange={(e) =>
                  setRefreshSeconds(Math.max(0, Number(e.target.value) || 0))
                }
              />
              {errors.refreshSeconds ? (
                <p className="text-xs text-terracotta">
                  {t("admin.sources.form.refreshSeconds.minError", {
                    defaultValue: "Must be at least 60 seconds.",
                  })}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="src-reliability" className="text-xs">
                {t("admin.sources.form.sourceReliability.label", {
                  defaultValue: "Reliability (0–1)",
                })}
              </Label>
              <Input
                id="src-reliability"
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={sourceReliability}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) setSourceReliability(n);
                }}
              />
              {errors.sourceReliability ? (
                <p className="text-xs text-terracotta">
                  {errors.sourceReliability}
                </p>
              ) : null}
            </div>
            <div className="flex items-end gap-2">
              <Switch
                id="src-enabled"
                checked={enabled}
                onCheckedChange={(v) => setEnabled(Boolean(v))}
              />
              <Label htmlFor="src-enabled" className="text-xs">
                {t("admin.sources.form.enabled.label", {
                  defaultValue: "Enabled",
                })}
              </Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending
              ? t("admin.sources.add.saving", {
                  defaultValue: "Creating…",
                })
              : t("admin.sources.add.confirm", {
                  defaultValue: "Create source",
                })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
