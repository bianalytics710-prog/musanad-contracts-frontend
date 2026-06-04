/**
 * M22 — Download coverage report JSON for legal sign-off.
 * (PDF generation via M20 Puppeteer is a Phase-2 polish; v1 ships JSON
 *  download so the data is captured and signoff-able.)
 */
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { migrationService } from '@/services/api/migration.service';

interface Props {
  batchId: number;
}

export function CoverageReportButton({ batchId }: Props) {
  const { t } = useTranslation();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        const data = await migrationService.getCoverageReport(batchId);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `migration-coverage-batch-${batchId}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }}
      className="gap-1.5"
    >
      <Download className="h-3.5 w-3.5" />
      {t('admin.migration.coverage.cta', { defaultValue: 'Download coverage report' })}
    </Button>
  );
}
