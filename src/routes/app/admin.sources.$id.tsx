/**
 * /app/admin/sources/$id — OSINT source detail / edit form (S10).
 *
 * Surfaces every editable osint_source field, the credential entry control
 * (write-only — never echoes credentialRef), the test-pull button, and the
 * soft-delete confirmation. sourceId is rendered read-only (immutable per
 * AC-S3-08).
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { adminSourcesService } from "@/services/api/admin-sources.service";
import { translateApiError } from "@/lib/translate-api-error";
import { ApiError } from "@/lib/api-client";
import { formatDateTime } from "@/utils/datetime";
import { CredentialEntryField } from "@/components/sources/CredentialEntryField";
import { GeographyFilterEditor } from "@/components/sources/GeographyFilterEditor";
import { HealthStateBadge } from "@/components/sources/healthBadge";
import { RateLimitConfigEditor } from "@/components/sources/RateLimitConfigEditor";
import { SeverityMappingEditor } from "@/components/sources/SeverityMappingEditor";
import { TestPullButton } from "@/components/sources/TestPullButton";
import { formatRelative } from "@/components/sources/relativeTime";
import type {
  CredentialKind,
  DataClassification,
  GeographyFilter,
  OsintSourceDetail,
  RateLimitConfig,
  SeverityMapping,
  SourceFormat,
  SourceKind,
  UpdateOsintSourceDto,
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

const CLASSIFICATION_OPTIONS: DataClassification[] = [
  "demo",
  "pilot",
  "production",
];

export const Route = createFileRoute("/app/admin/sources/$id")({
  component: () => (
    <ErrorBoundary>
      <SourceDetailEditPage />
    </ErrorBoundary>
  ),
});

function SourceDetailEditPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id: idParam } = Route.useParams();
  const id = Number(idParam);

  const queryKey = ["admin-sources", "detail", id] as const;
  const { data, isLoading, isError, error, refetch } =
    useQuery<OsintSourceDetail>({
      queryKey,
      queryFn: () => adminSourcesService.getById(id),
      enabled: Number.isFinite(id) && id > 0,
      staleTime: 15_000,
    });

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="mx-auto w-full max-w-[800px] p-6">
        <p className="text-sm text-terracotta">
          {t("admin.sources.detail.invalidId", {
            defaultValue: "Invalid source identifier.",
          })}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[960px] space-y-3 p-6" aria-busy>
        <div className="h-8 w-1/3 animate-pulse rounded bg-surface" />
        <div className="h-48 animate-pulse rounded bg-surface" />
        <div className="h-32 animate-pulse rounded bg-surface" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto w-full max-w-[960px] space-y-3 p-6">
        <Link
          to="/app/admin/sources"
          className="inline-flex items-center text-xs text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="me-1 h-3.5 w-3.5" />
          {t("admin.sources.detail.back", {
            defaultValue: "Back to sources",
          })}
        </Link>
        <div className="rounded-lg border border-terracotta/40 bg-terracotta/5 p-6">
          <p className="text-sm text-terracotta">
            {translateApiError(error, t, "admin.sources.detail.fetchFailed")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => refetch()}
          >
            {t("admin.sources.error.retry", { defaultValue: "Retry" })}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SourceEditForm
      detail={data}
      onSavedRefetch={() => queryClient.invalidateQueries({ queryKey })}
      onDeleted={() => {
        queryClient.invalidateQueries({ queryKey: ["admin-sources"] });
        void navigate({ to: "/app/admin/sources" });
      }}
    />
  );
}

interface SourceEditFormProps {
  detail: OsintSourceDetail;
  onSavedRefetch: () => void;
  onDeleted: () => void;
}

function SourceEditForm({
  detail,
  onSavedRefetch,
  onDeleted,
}: SourceEditFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(detail.displayName);
  const [displayNameAr, setDisplayNameAr] = useState(detail.displayNameAr ?? "");
  const [kind, setKind] = useState<SourceKind>(detail.kind);
  const [url, setUrl] = useState(detail.url ?? "");
  const [format, setFormat] = useState<SourceFormat>(detail.format);
  const [refreshSeconds, setRefreshSeconds] = useState<number>(detail.refreshSeconds);
  const [sourceReliability, setSourceReliability] = useState<number>(
    detail.sourceReliability,
  );
  const [enabled, setEnabled] = useState<boolean>(detail.enabled);
  const [licensingNote, setLicensingNote] = useState<string>(
    detail.licensingNote ?? "",
  );
  const [dataClassification, setDataClassification] = useState<DataClassification>(
    detail.dataClassification,
  );
  const [rateLimit, setRateLimit] = useState<RateLimitConfig | null>(
    detail.rateLimit,
  );
  const [severityMapping, setSeverityMapping] = useState<SeverityMapping | null>(
    detail.severityMapping,
  );
  const [geographyFilter, setGeographyFilter] = useState<GeographyFilter | null>(
    detail.geographyFilter,
  );

  const [showDelete, setShowDelete] = useState<boolean>(false);
  const [credentialFieldError, setCredentialFieldError] = useState<string | null>(
    null,
  );

  // Re-sync local state when the upstream detail refreshes (after a save).
  useEffect(() => {
    setDisplayName(detail.displayName);
    setDisplayNameAr(detail.displayNameAr ?? "");
    setKind(detail.kind);
    setUrl(detail.url ?? "");
    setFormat(detail.format);
    setRefreshSeconds(detail.refreshSeconds);
    setSourceReliability(detail.sourceReliability);
    setEnabled(detail.enabled);
    setLicensingNote(detail.licensingNote ?? "");
    setDataClassification(detail.dataClassification);
    setRateLimit(detail.rateLimit);
    setSeverityMapping(detail.severityMapping);
    setGeographyFilter(detail.geographyFilter);
  }, [detail]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateOsintSourceDto) =>
      adminSourcesService.update(detail.id, payload),
    onSuccess: () => {
      toast.success(
        t("admin.sources.toast.updated", {
          defaultValue: "Source updated.",
        }),
      );
      onSavedRefetch();
    },
    onError: (err: unknown) =>
      toast.error(translateApiError(err, t, "admin.sources.toast.updateFailed")),
  });

  const credentialMutation = useMutation({
    mutationFn: (input: { credentialKind: CredentialKind; credentialRef: string }) =>
      adminSourcesService.setCredential(detail.id, input),
    onSuccess: () => {
      toast.success(
        t("admin.sources.toast.credentialSaved", {
          defaultValue: "Credential saved.",
        }),
      );
      setCredentialFieldError(null);
      onSavedRefetch();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 400) {
        setCredentialFieldError(
          err.message ||
            t("admin.sources.credential.formatError", {
              defaultValue:
                "credentialRef must use env: or vault: scheme.",
            }),
        );
      }
      toast.error(
        translateApiError(err, t, "admin.sources.toast.credentialFailed"),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminSourcesService.remove(detail.id),
    onSuccess: () => {
      toast.success(
        t("admin.sources.toast.deleted", {
          defaultValue: "Source deactivated. Existing signals remain queryable.",
        }),
      );
      queryClient.invalidateQueries({ queryKey: ["admin-source-health"] });
      onDeleted();
    },
    onError: (err: unknown) =>
      toast.error(translateApiError(err, t, "admin.sources.toast.deleteFailed")),
  });

  const handleSave = () => {
    const payload: UpdateOsintSourceDto = {
      displayName,
      displayNameAr: displayNameAr.trim() || undefined,
      kind,
      url: url.trim() || undefined,
      format,
      refreshSeconds,
      sourceReliability,
      enabled,
      licensingNote: licensingNote.trim() || undefined,
      dataClassification,
      rateLimit: rateLimit ?? undefined,
      severityMapping: severityMapping ?? undefined,
      geographyFilter: geographyFilter ?? undefined,
    };
    updateMutation.mutate(payload);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[960px] space-y-4 p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/app/admin/sources"
          className="inline-flex items-center text-xs text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="me-1 h-3.5 w-3.5" />
          {t("admin.sources.detail.back", {
            defaultValue: "Back to sources",
          })}
        </Link>
        {detail.health ? <HealthStateBadge state={detail.health.state} /> : null}
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {detail.displayName}
          </h1>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            {detail.sourceId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TestPullButton
            sourceId={detail.id}
            disabled={!detail.enabled}
            size="sm"
            onQueued={onSavedRefetch}
          />
        </div>
      </header>

      {detail.health ? (
        <section
          className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-3"
          aria-label={t("admin.sources.health.title", {
            defaultValue: "Source health",
          })}
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t("admin.sources.health.lastSuccess", {
                defaultValue: "Last success",
              })}
            </p>
            <p className="text-sm text-ink">
              {detail.health.lastSuccessAt
                ? formatRelative(detail.health.lastSuccessAt)
                : "—"}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t("admin.sources.health.lastFailure", {
                defaultValue: "Last failure",
              })}
            </p>
            <p className="text-sm text-ink">
              {detail.health.lastFailureAt
                ? formatRelative(detail.health.lastFailureAt)
                : "—"}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t("admin.sources.health.signals24h", {
                defaultValue: "Signals (24h)",
              })}
            </p>
            <p className="font-mono text-2xl font-semibold text-ink">
              {detail.health.signals24h}
            </p>
          </div>
        </section>
      ) : null}

      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-ink">
          {t("admin.sources.detail.basics", { defaultValue: "Basics" })}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="src-edit-sourceId" className="text-xs">
              {t("admin.sources.form.sourceId.label", {
                defaultValue: "Source ID",
              })}
            </Label>
            <Input
              id="src-edit-sourceId"
              value={detail.sourceId}
              readOnly
              disabled
              aria-describedby="src-edit-sourceId-hint"
            />
            <p
              id="src-edit-sourceId-hint"
              className="text-[11px] text-ink-muted"
            >
              {t("admin.sources.form.sourceId.immutable", {
                defaultValue: "Source ID is immutable after creation.",
              })}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="src-edit-displayName" className="text-xs">
              {t("admin.sources.form.displayName.label", {
                defaultValue: "Display name",
              })}
            </Label>
            <Input
              id="src-edit-displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="src-edit-displayNameAr" className="text-xs">
              {t("admin.sources.form.displayNameAr.label", {
                defaultValue: "Display name (Arabic)",
              })}
            </Label>
            <Input
              id="src-edit-displayNameAr"
              value={displayNameAr}
              onChange={(e) => setDisplayNameAr(e.target.value)}
              dir="rtl"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="src-edit-url" className="text-xs">
              {t("admin.sources.form.url.label", { defaultValue: "URL" })}
            </Label>
            <Input
              id="src-edit-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="src-edit-kind" className="text-xs">
              {t("admin.sources.form.kind.label", {
                defaultValue: "Kind",
              })}
            </Label>
            <select
              id="src-edit-kind"
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
            <Label htmlFor="src-edit-format" className="text-xs">
              {t("admin.sources.form.format.label", {
                defaultValue: "Format",
              })}
            </Label>
            <select
              id="src-edit-format"
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
            <Label htmlFor="src-edit-classification" className="text-xs">
              {t("admin.sources.form.dataClassification.label", {
                defaultValue: "Data classification",
              })}
            </Label>
            <select
              id="src-edit-classification"
              className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
              value={dataClassification}
              onChange={(e) =>
                setDataClassification(e.target.value as DataClassification)
              }
            >
              {CLASSIFICATION_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {t(`admin.sources.dataClassification.${c}`, {
                    defaultValue: c,
                  })}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="src-edit-refresh" className="text-xs">
              {t("admin.sources.form.refreshSeconds.label", {
                defaultValue: "Refresh (sec)",
              })}
            </Label>
            <Input
              id="src-edit-refresh"
              type="number"
              inputMode="numeric"
              min={60}
              value={refreshSeconds}
              onChange={(e) =>
                setRefreshSeconds(Math.max(0, Number(e.target.value) || 0))
              }
            />
            <p className="text-[11px] text-ink-muted">
              {t("admin.sources.form.refreshSeconds.minError", {
                defaultValue: "Must be at least 60 seconds.",
              })}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="src-edit-reliability" className="text-xs">
              {t("admin.sources.form.sourceReliability.label", {
                defaultValue: "Reliability",
              })}
            </Label>
            <div className="flex items-center gap-3">
              <input
                id="src-edit-reliability"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={sourceReliability}
                onChange={(e) => setSourceReliability(Number(e.target.value))}
                className="flex-1"
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={sourceReliability}
              />
              <span className="font-mono text-xs text-ink">
                {sourceReliability.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Switch
              id="src-edit-enabled"
              checked={enabled}
              onCheckedChange={(v) => setEnabled(Boolean(v))}
            />
            <Label htmlFor="src-edit-enabled" className="text-xs">
              {t("admin.sources.form.enabled.label", {
                defaultValue: "Enabled",
              })}
            </Label>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="src-edit-licensing" className="text-xs">
            {t("admin.sources.form.licensingNote.label", {
              defaultValue: "Licensing note",
            })}
          </Label>
          <Input
            id="src-edit-licensing"
            value={licensingNote}
            onChange={(e) => setLicensingNote(e.target.value)}
          />
        </div>
      </section>

      <RateLimitConfigEditor
        idPrefix="src-edit-rl"
        value={rateLimit}
        onChange={setRateLimit}
      />

      <SeverityMappingEditor
        idPrefix="src-edit-sm"
        value={severityMapping}
        onChange={setSeverityMapping}
      />

      <GeographyFilterEditor
        idPrefix="src-edit-gf"
        value={geographyFilter}
        onChange={setGeographyFilter}
      />

      <CredentialEntryField
        idPrefix="src-edit-cred"
        current={detail.credential}
        onSubmit={(input) => credentialMutation.mutate(input)}
        fieldError={credentialFieldError}
        isSubmitting={credentialMutation.isPending}
      />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <p className="font-mono text-[11px] text-ink-muted">
          {t("admin.sources.detail.lastUpdated", {
            defaultValue: "Last updated:",
          })}{" "}
          {formatDateTime(detail.updatedAt)}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowDelete(true)}
            disabled={updateMutation.isPending || deleteMutation.isPending}
          >
            <Trash2 className="me-2 h-4 w-4 text-terracotta" />
            {t("admin.sources.actions.delete", {
              defaultValue: "Delete source",
            })}
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            <Save className="me-2 h-4 w-4" />
            {updateMutation.isPending
              ? t("admin.sources.detail.saving", {
                  defaultValue: "Saving…",
                })
              : t("common.save", { defaultValue: "Save" })}
          </Button>
        </div>
      </section>

      {showDelete ? (
        <DeleteSourceConfirmDialog
          name={detail.displayName}
          onClose={() => setShowDelete(false)}
          onConfirm={() => {
            deleteMutation.mutate();
          }}
          isSubmitting={deleteMutation.isPending}
        />
      ) : null}
    </motion.div>
  );
}

function DeleteSourceConfirmDialog({
  name,
  onClose,
  onConfirm,
  isSubmitting,
}: {
  name: string;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("admin.sources.delete.confirm.title", {
              defaultValue: "Delete source",
            })}
          </DialogTitle>
          <DialogDescription>
            {t("admin.sources.delete.confirm.body", {
              defaultValue:
                'Soft-delete "{{name}}"? Existing signals will remain queryable.',
              name,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t("admin.sources.delete.deleting", {
                  defaultValue: "Deleting…",
                })
              : t("admin.sources.delete.confirmCta", {
                  defaultValue: "Delete source",
                })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
