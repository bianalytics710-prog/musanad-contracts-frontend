/**
 * Unit-3 / R-CES H3 — ICV Certificate Upload Dialog.
 *
 * Multipart upload to POST /api/v1/compliance/contracts/:contractId/icv-certificate.
 * Accepts PDF, PNG, JPG.
 * Optional: validUntil date (YYYY-MM-DD).
 *
 * Uses native FormData multipart upload via apiClient.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translateApiError } from "@/lib/translate-api-error";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { apiClient } from "@/lib/api-client";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const MAX_FILE_MB = 10;

interface IcvUploadResult {
  attachmentId: string;
  contractId: string;
  kind: "icv_certificate";
  validUntil?: string;
}

interface IcvCertificateUploadDialogProps {
  contractId: string | null;
  open: boolean;
  onClose: () => void;
}

export function IcvCertificateUploadDialog({
  contractId,
  open,
  onClose,
}: IcvCertificateUploadDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const titleId = useId();
  const fileInputId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validUntil, setValidUntil] = useState("");
  const [fileErr, setFileErr] = useState<string | null>(null);

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (open) {
      setFile(null);
      setValidUntil("");
      setFileErr(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const m = useMutation({
    mutationFn: async () => {
      if (!contractId) throw new Error("missing contractId");
      if (!file) throw new Error("file-required");

      const formData = new FormData();
      formData.append("file", file);
      if (validUntil) formData.append("validUntil", validUntil);

      const { data } = await apiClient.post<{ success: boolean; data: IcvUploadResult }>(
        `/api/v1/compliance/contracts/${contractId}/icv-certificate`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data.data;
    },
    onSuccess: () => {
      toast.success(t("compliance.actions.icvUpload.success"));
      void qc.invalidateQueries({ queryKey: ["dashboards-crg", "compliance-esg"] });
      onClose();
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFileErr(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setFileErr(t("compliance.actions.icvUpload.fileTypeError"));
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILE_MB * 1024 * 1024) {
      setFileErr(t("compliance.actions.icvUpload.fileSizeError", { maxMb: MAX_FILE_MB }));
      setFile(null);
      return;
    }
    setFile(selected);
  };

  if (!open || !contractId) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !m.isPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {t("compliance.actions.icvUpload.title")}
          </h2>
          <button
            type="button"
            onClick={() => !m.isPending && onClose()}
            className="rounded-md p-1 text-ink-muted hover:bg-surface"
            aria-label={t("common.close", { defaultValue: "Close" })}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!file) {
              setFileErr(t("compliance.actions.icvUpload.fileRequired"));
              return;
            }
            m.mutate();
          }}
          className="space-y-3 px-5 py-4"
        >
          <p className="text-xs text-ink-muted">{t("compliance.actions.icvUpload.description")}</p>

          <label className="block" htmlFor={fileInputId}>
            <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              {t("compliance.actions.icvUpload.fileLabel")}
              <span className="ms-0.5 text-terracotta">*</span>
            </span>
            <div
              className={`mt-1 flex cursor-pointer items-center gap-3 rounded-md border-2 border-dashed px-4 py-3 transition ${
                fileErr ? "border-terracotta/60 bg-terracotta/5" : "border-border bg-muted/30 hover:border-gold/60"
              }`}
            >
              <Upload className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                {file ? (
                  <p className="truncate text-sm text-ink">{file.name}</p>
                ) : (
                  <p className="text-sm text-ink-muted">
                    {t("compliance.actions.icvUpload.filePlaceholder")}
                  </p>
                )}
                <p className="text-[10px] text-ink-subtle">PDF, PNG, JPG · max {MAX_FILE_MB} MB</p>
              </div>
            </div>
            <input
              id={fileInputId}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              className="sr-only"
            />
            {fileErr && (
              <p className="mt-0.5 text-xs text-terracotta" role="alert">
                {fileErr}
              </p>
            )}
          </label>

          <label className="block">
            <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              {t("compliance.actions.icvUpload.validUntilLabel")}
            </span>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={m.isPending}
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button type="submit" size="sm" disabled={m.isPending || !file}>
              {m.isPending
                ? t("compliance.actions.icvUpload.uploading")
                : t("compliance.actions.icvUpload.confirm")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
