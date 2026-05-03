/**
 * ExportXlsxButton (S5) — Export the current filtered contract list to XLSX.
 *
 * Sits in the ContractListView header. Forwards the active filter set to
 * the BE export endpoint as query params so the workbook reflects exactly
 * what the user is seeing.
 *
 * AC mapping:
 *   AC-S5-01: GET /contracts/export.xlsx → application/vnd.openxml…sheet.
 *   AC-S5-02: header row + one row per contract; body excluded server-side.
 *   AC-S5-03: 403 (lacks contract.export) — translateApiError surfaces.
 *   AC-S5-04: role-aware visibility preserved server-side.
 *   AC-S5-05: server clamps maxRows; X-Export-Truncated:true header → toast.
 *   AC-S5-09: backend exceljs per G6 — FE bundle DOES NOT include xlsx.
 *
 * Permission gate: defense-in-depth via selectHasPermission('contract.export').
 * BE remains source of truth on 403.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import { contractExportService } from "@/services/api/contract-export.service";
import { downloadBlobWithHeaders } from "@/lib/format-blob-download";
import { translateApiError } from "@/lib/translate-api-error";
import type { ContractExportXlsxQueryParams } from "@/types/entities/payment-schedule.types";

interface ExportXlsxButtonProps {
  /** Current filter state from the list view — passed straight through. */
  filter: ContractExportXlsxQueryParams;
  /** Disable while parent is fetching the live list (cosmetic). */
  disabled?: boolean;
}

export function ExportXlsxButton({ filter, disabled = false }: ExportXlsxButtonProps) {
  const { t } = useTranslation();
  const canExport = useAuthStore(selectHasPermission("contract.export"));
  const [submitting, setSubmitting] = useState(false);

  if (!canExport) return null;

  const fallbackFilename = (() => {
    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    return `contracts-${stamp}.xlsx`;
  })();

  const handleClick = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { blob, headers } = await contractExportService.exportXlsx(filter);
      downloadBlobWithHeaders(
        blob,
        headers,
        fallbackFilename,
        // F-FE-M3: validate XLSX MIME — protects against the BE returning
        // an HTML error page or wrong format that the user wouldn't notice
        // until they tried to open the download.
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      // AC-S5-05: surface the truncation header as a toast so the user
      // knows to refine their filter for the missing rows.
      if (headers.get("x-export-truncated") === "true") {
        toast.warning(t("contracts.export.xlsx.truncatedToast"));
      } else {
        toast.success(t("contracts.export.xlsx.successToast"));
      }
    } catch (err) {
      // F-FE-M2: rely on translateApiError — apiClient errors are ApiError,
      // and a BlobContentTypeMismatchError falls through to the generic
      // fallback toast.
      toast.error(translateApiError(err, t, "errors.export.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={submitting || disabled}
      aria-label={t("contracts.export.xlsx.ariaLabel")}
    >
      <Download className="h-4 w-4" />
      {submitting ? t("contracts.export.xlsx.exporting") : t("contracts.export.xlsx.button")}
    </Button>
  );
}

export default ExportXlsxButton;
