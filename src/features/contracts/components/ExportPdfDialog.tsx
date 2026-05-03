/**
 * ExportPdfDialog (S4) — Modal trigger for PDF export.
 *
 * AC mapping:
 *   AC-S4-01: GET /contracts/:id/export.pdf?language=<en|ar|bilingual> →
 *             application/pdf binary; Content-Disposition handled by helper.
 *   AC-S4-02: PDF includes head + tags + body + payment schedule (BE-side).
 *   AC-S4-03: 404 surfaced via translateApiError(err).
 *   AC-S4-04: 403 surfaced — gated also by selectHasPermission('contract.export').
 *   AC-S4-05: language radio defaults to 'bilingual'.
 *   AC-S4-07: backend Puppeteer per G6 — FE bundle DOES NOT include jspdf.
 *   AC-S4-09: BE rate-limits via exportRateLimiter; FE just shows the 429 toast.
 *   AC-S4-10: includeAttachments toggle is DISABLED until Attachments module.
 *
 * Why fetch() not axios: the binary response body needs to land as a Blob
 * cleanly without the JSON-envelope interceptor. See contract-export.service.ts
 * for the full rationale.
 *
 * useFocusTrap (FE-C4) traps focus inside the modal while open.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { contractExportService } from "@/services/api/contract-export.service";
import { downloadBlobWithHeaders } from "@/lib/format-blob-download";
import { translateApiError } from "@/lib/translate-api-error";
import { cn } from "@/lib/utils";
import { CONTRACT_LANGUAGE_VALUES, type ContractLanguage } from "@/types/entities/contract.types";

interface ExportPdfDialogProps {
  contractId: number;
  contractNumber: string;
  open: boolean;
  onClose: () => void;
}

export function ExportPdfDialog({
  contractId,
  contractNumber,
  open,
  onClose,
}: ExportPdfDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [language, setLanguage] = useState<ContractLanguage>("bilingual");
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useFocusTrap(dialogRef, open);

  // Reset selection on open.
  useEffect(() => {
    if (open) {
      setLanguage("bilingual");
      setIncludeAttachments(false);
    }
  }, [open]);

  // Escape closes when not in flight.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const { blob, headers } = await contractExportService.exportPdf(contractId, {
        language,
        includeAttachments,
      });
      downloadBlobWithHeaders(
        blob,
        headers,
        // Fallback filename — BE always sends Content-Disposition but defend.
        `${contractNumber}-${language}.pdf`,
        // F-FE-M3: validate the response is actually a PDF — protects
        // against the BE returning an HTML error page or wrong format.
        "application/pdf",
      );
      toast.success(t("contracts.export.pdf.successToast"));
      onClose();
    } catch (err) {
      // F-FE-M2: errors from apiClient are ApiError; translateApiError
      // maps the HTTP code → export-specific i18n key with a generic
      // fallback. A BlobContentTypeMismatchError lands here too — it's a
      // plain Error so it falls through to the fallback toast.
      toast.error(translateApiError(err, t, "errors.export.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {t("contracts.export.pdf.title")}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {t("contracts.export.pdf.description", { number: contractNumber })}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={submitting}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form noValidate onSubmit={handleSubmit} className="mt-5 space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-ink-muted">
              {t("contracts.export.pdf.languageLabel")}
            </legend>
            <div className="flex flex-wrap gap-3">
              {CONTRACT_LANGUAGE_VALUES.map((lang) => (
                <label key={lang} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="export-language"
                    value={lang}
                    checked={language === lang}
                    onChange={() => setLanguage(lang)}
                    disabled={submitting}
                    className="h-4 w-4 cursor-pointer accent-ink"
                  />
                  <span>{t(`contracts.languageOptions.${lang}`, { defaultValue: lang })}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="rounded-md border border-dashed border-border bg-surface/30 p-3">
            <label className="inline-flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeAttachments}
                onChange={(e) => setIncludeAttachments(e.target.checked)}
                disabled
                aria-disabled="true"
                className={cn("mt-1 h-4 w-4 cursor-not-allowed accent-ink", "opacity-50")}
              />
              <span>
                <span className="font-medium text-ink">
                  {t("contracts.export.pdf.includeAttachmentsLabel")}
                </span>
                <span className="mt-0.5 block text-[11px] text-ink-subtle">
                  {t("contracts.export.pdf.includeAttachmentsDeferred")}
                </span>
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              <Download className="h-4 w-4" />
              {submitting ? t("contracts.export.pdf.exporting") : t("contracts.export.pdf.submit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ExportPdfDialog;
