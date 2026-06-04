/**
 * GenerateReportDialog — S-L-2 / S-L-3. Trigger a manual report run.
 *
 * The 'basic' parameter UI per HITL Q5: dateRange (optional) +
 * statusFilter (optional). Format is excel/pdf with compatibility derived
 * from template.reportKind ('both' enables both buttons; 'excel'/'pdf'
 * limits the available format).
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { reportService } from '@/services/api/report.service';
import { translateApiError } from '@/lib/translate-api-error';
import type {
  ReportTemplateUserListItem,
  ReportRunFormat,
  ReportParameterSchema,
} from '@/types/report.types';

interface Props {
  open: boolean;
  onClose: () => void;
  template: ReportTemplateUserListItem;
}

export function GenerateReportDialog({ open, onClose, template }: Props) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const qc = useQueryClient();
  const navigate = useNavigate();

  const allowedFormats = useMemo<ReportRunFormat[]>(() => {
    if (template.reportKind === 'both') return ['pdf', 'excel'];
    return [template.reportKind] as ReportRunFormat[];
  }, [template.reportKind]);

  const [format, setFormat] = useState<ReportRunFormat>(allowedFormats[0]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      const parameters: ReportParameterSchema = {};
      if (start && end) parameters.dateRange = { start, end };
      if (statusFilter.trim()) parameters.statusFilter = statusFilter.trim();
      return reportService.triggerRun(template.id, {
        format,
        triggeredBy: 'manual',
        parameters,
      });
    },
    onSuccess: async (res) => {
      // Inline-render path: BE returns status='complete' + signedUrl ready to
      // fetch. We download the bytes as a Blob (auth-header neutral; the URL
      // is short-lived) and trigger a browser download.
      if (res.status === 'failed' || !res.signedUrl) {
        toast.error(
          res.error
            ? `${t('reports.errors.triggerFailed', { defaultValue: 'Report generation failed' })}: ${res.error}`
            : t('reports.errors.triggerFailed', { defaultValue: 'Report generation failed' }),
        );
        return;
      }
      try {
        const fetchRes = await fetch(res.signedUrl);
        if (!fetchRes.ok) throw new Error(`Download failed (HTTP ${fetchRes.status})`);
        const blob = await fetchRes.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = res.format === 'excel' ? 'xlsx' : 'pdf';
        const displayName = template.displayNameEn ?? `report-${res.runId}`;
        a.download =
          res.fileName ??
          `${displayName.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80)}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success(
          t('reports.toasts.runComplete', { defaultValue: 'Report downloaded' }),
        );
        void qc.invalidateQueries({ queryKey: ['reportTemplates'] });
        onClose();
      } catch (downloadErr) {
        // Fall back: surface the run detail page so the user can retry the
        // signed-URL fetch from there.
        toast.error(
          (downloadErr as Error).message ??
            t('reports.errors.downloadFailed', { defaultValue: 'Download failed' }),
        );
        onClose();
        void navigate({
          to: '/app/reports/runs/$runId',
          params: { runId: String(res.runId) },
        });
      }
    },
    onError: (e: unknown) =>
      toast.error(translateApiError(e, t, 'reports.errors.triggerFailed')),
  });

  const displayName =
    isAr && template.displayNameAr ? template.displayNameAr : template.displayNameEn;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('reports.generate.title', { name: displayName })}</DialogTitle>
          <DialogDescription>
            {template.description ?? t('reports.generate.description')}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
          noValidate
        >
          <div>
            <span id="gen-report-format-label" className="mb-1 block text-sm font-medium text-ink">
              {t('reports.fields.format')}
              <span className="text-error ms-1" aria-hidden="true">*</span>
            </span>
            <div role="radiogroup" aria-labelledby="gen-report-format-label" className="flex gap-2">
              {allowedFormats.map((f) => (
                <label
                  key={f}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    format === f
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-surface text-ink hover:bg-muted'
                  }`}
                >
                  <input
                    type="radio"
                    name="gen-report-format"
                    value={f}
                    checked={format === f}
                    onChange={() => setFormat(f)}
                    className="sr-only"
                  />
                  <span>{t(`reports.formats.${f}`)}</span>
                </label>
              ))}
            </div>
          </div>

          <fieldset className="rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-medium text-ink-muted">
              {t('reports.fields.dateRange')}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="gen-report-start" className="mb-1 block text-xs text-ink-muted">
                  {t('reports.fields.startDate')}
                </label>
                <Input
                  id="gen-report-start"
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="gen-report-end" className="mb-1 block text-xs text-ink-muted">
                  {t('reports.fields.endDate')}
                </label>
                <Input
                  id="gen-report-end"
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <div>
            <label htmlFor="gen-report-status" className="mb-1 block text-sm font-medium text-ink">
              {t('reports.fields.statusFilter')}
            </label>
            <Input
              id="gen-report-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              placeholder={t('reports.fields.statusFilterHint')}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? t('reports.actions.generating', { defaultValue: 'Generating…' })
                : t('reports.actions.generate')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
