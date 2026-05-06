/**
 * ContractAttachmentsTab — list + drag-drop upload + signed-URL download
 * for files attached to a contract. Files live in Supabase Storage; the
 * BE proxies upload (service-role) and signs short-lived download URLs.
 */
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  contractAttachmentsService,
  type ContractAttachment,
} from "@/services/api/contract-attachments.service";
import { translateApiError } from "@/lib/translate-api-error";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import { formatDateTime } from "@/utils/datetime";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ContractAttachmentsTabProps {
  contractId: number;
}

const MAX_FILE_BYTES = 50 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return FileImage;
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime === "text/csv") return FileSpreadsheet;
  if (mime === "application/pdf" || mime.includes("word") || mime === "text/plain") return FileText;
  return FileIcon;
}

export function ContractAttachmentsTab({ contractId }: ContractAttachmentsTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canUpload = useAuthStore(selectHasPermission("contract.attachment.write"));
  const canDelete = useAuthStore(selectHasPermission("contract.attachment.delete"));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadingName, setUploadingName] = useState<string | null>(null);

  const { data: attachments, isLoading, isError, error } = useQuery({
    queryKey: ["contract-attachments", contractId],
    queryFn: () => contractAttachmentsService.list(contractId),
    staleTime: 30_000,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => contractAttachmentsService.upload(contractId, file),
    onMutate: (file) => setUploadingName(file.name),
    onSuccess: () => {
      toast.success(t("contracts.attachments.uploaded", { defaultValue: "Attachment uploaded." }));
      void queryClient.invalidateQueries({ queryKey: ["contract-attachments", contractId] });
      void queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
    },
    onError: (err: ApiError | Error) => {
      toast.error(err instanceof ApiError ? translateApiError(err, t) : err.message);
    },
    onSettled: () => setUploadingName(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId: number) => contractAttachmentsService.remove(contractId, fileId),
    onSuccess: () => {
      toast.success(t("contracts.attachments.deleted", { defaultValue: "Attachment deleted." }));
      void queryClient.invalidateQueries({ queryKey: ["contract-attachments", contractId] });
      void queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
    },
    onError: (err: ApiError | Error) => {
      toast.error(err instanceof ApiError ? translateApiError(err, t) : err.message);
    },
  });

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      for (const file of list) {
        if (file.size > MAX_FILE_BYTES) {
          toast.error(
            t("contracts.attachments.tooLarge", {
              defaultValue: "{{name}} exceeds the 50 MB limit.",
              name: file.name,
            }),
          );
          continue;
        }
        uploadMutation.mutate(file);
      }
    },
    [uploadMutation, t],
  );

  const handleDownload = useCallback(
    async (att: ContractAttachment) => {
      try {
        const signed = await contractAttachmentsService.getDownloadUrl(contractId, att.id);
        // Trigger browser download via a transient anchor.
        const a = document.createElement("a");
        a.href = signed.url;
        a.download = signed.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (err) {
        toast.error(err instanceof ApiError ? translateApiError(err, t) : (err as Error).message);
      }
    },
    [contractId, t],
  );

  const handleDelete = useCallback(
    (att: ContractAttachment) => {
      if (
        !window.confirm(
          t("contracts.attachments.deleteConfirm", {
            defaultValue: 'Delete "{{name}}"? This cannot be undone.',
            name: att.filename,
          }),
        )
      ) {
        return;
      }
      deleteMutation.mutate(att.id);
    },
    [deleteMutation, t],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Paperclip className="h-4 w-4 text-gold" />
            {t("contracts.attachments.title", { defaultValue: "Attachments" })}
          </CardTitle>
          {canUpload && (
            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="me-1.5 h-3.5 w-3.5" />
              {t("contracts.attachments.upload", { defaultValue: "Upload" })}
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            disabled={uploadMutation.isPending}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {canUpload && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              "rounded-md border-2 border-dashed p-6 text-center text-xs transition-colors",
              dragOver ? "border-gold bg-gold/5 text-ink" : "border-border bg-surface text-ink-muted",
            )}
          >
            <Upload className="mx-auto mb-2 h-5 w-5 text-gold" />
            <p>
              {t("contracts.attachments.dropHint", {
                defaultValue: "Drop files here or click Upload (max 50 MB per file)",
              })}
            </p>
            {uploadingName && (
              <p className="mt-2 text-[11px] text-ink-subtle">
                {t("contracts.attachments.uploading", {
                  defaultValue: "Uploading {{name}}…",
                  name: uploadingName,
                })}
              </p>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-surface" />
            ))}
          </div>
        ) : isError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            {error instanceof ApiError ? translateApiError(error, t) : (error as Error).message}
          </p>
        ) : !attachments || attachments.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-subtle">
            {t("contracts.attachments.empty", { defaultValue: "No attachments yet." })}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {attachments.map((att) => {
              const Icon = iconFor(att.mimeType);
              return (
                <li
                  key={att.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface"
                >
                  <div className="rounded-md bg-gold/10 p-2">
                    <Icon className="h-4 w-4 text-gold" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{att.filename}</p>
                    <p className="text-[11px] text-ink-subtle">
                      {formatBytes(att.sizeBytes)} · {att.uploadedBy.firstName} {att.uploadedBy.lastName} ·{" "}
                      {formatDateTime(att.createdAt)}
                    </p>
                    {att.description && (
                      <p className="mt-0.5 text-[11px] italic text-ink-muted">{att.description}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(att)}
                    aria-label={t("contracts.attachments.download", { defaultValue: "Download" })}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {canDelete && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(att)}
                      disabled={deleteMutation.isPending}
                      aria-label={t("contracts.attachments.delete", { defaultValue: "Delete" })}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
