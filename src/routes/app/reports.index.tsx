/**
 * /app/reports — Report Library, grouped by section.
 *
 * Each role sees a curated 5-7 report set split into 2 sections (e.g. Drafter
 * = "My work" + "Productivity"). The BE returns sectionKey per template; this
 * page renders a section heading + a card grid per group. Templates with no
 * sectionKey fall under "Other".
 */
import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, FileBarChart, FileSpreadsheet, FileText, Play } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { reportService } from '@/services/api/report.service';
import { formatDateTime } from '@/utils/datetime';
import type {
  ReportTemplateUserListItem,
  ReportTemplateAdminListItem,
} from '@/types/report.types';
import { GenerateReportDialog } from '@/components/reports/GenerateReportDialog';

export const Route = createFileRoute('/app/reports/')({
  component: () => (
    <ErrorBoundary>
      <ReportLibraryView />
    </ErrorBoundary>
  ),
});

const SECTION_LABEL: Record<string, { en: string; ar: string }> = {
  board_brief:        { en: 'Board & Brief',          ar: 'مجلس الإدارة والملخّص' },
  risk_exposure:      { en: 'Risk & Exposure',        ar: 'المخاطر والتعرّض' },
  my_work:            { en: 'My work',                ar: 'أعمالي' },
  productivity:       { en: 'Productivity',           ar: 'الإنتاجية' },
  advisory:           { en: 'Advisory work',          ar: 'الأعمال الاستشارية' },
  regulatory_clause:  { en: 'Regulatory & Clause',    ar: 'تنظيمي وبنود' },
  my_queue:           { en: 'My queue',               ar: 'قائمتي' },
  decisions:          { en: 'Decision history',       ar: 'سجل القرارات' },
};

// Stable order for cross-role consistency (My-work first, history last).
const SECTION_ORDER = [
  'board_brief', 'my_queue', 'my_work', 'advisory',
  'risk_exposure', 'productivity', 'regulatory_clause', 'decisions',
] as const;

function sectionLabel(key: string | null, isAr: boolean): string {
  if (!key) return isAr ? 'أخرى' : 'Other';
  const e = SECTION_LABEL[key];
  if (!e) return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return isAr ? e.ar : e.en;
}

function ReportLibraryView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const [selected, setSelected] = useState<ReportTemplateUserListItem | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reportTemplates', 'userMode'],
    queryFn: () => reportService.listTemplates({ adminMode: false }),
    staleTime: 60_000,
  });

  const items = (data?.data ?? []) as Array<
    ReportTemplateUserListItem | ReportTemplateAdminListItem
  >;

  // Group templates by sectionKey, preserving SECTION_ORDER + alphabetical
  // tail for any unknown keys, and placing nulls last.
  const grouped = useMemo(() => {
    const buckets = new Map<string, ReportTemplateUserListItem[]>();
    for (const tpl of items) {
      const key = tpl.sectionKey ?? '__other__';
      const arr = buckets.get(key);
      if (arr) arr.push(tpl);
      else buckets.set(key, [tpl]);
    }
    const known = SECTION_ORDER.filter((k) => buckets.has(k));
    const unknown = Array.from(buckets.keys())
      .filter((k) => k !== '__other__' && !SECTION_ORDER.includes(k as (typeof SECTION_ORDER)[number]))
      .sort();
    const ordered: Array<{ key: string; templates: ReportTemplateUserListItem[] }> = [];
    for (const k of [...known, ...unknown]) ordered.push({ key: k, templates: buckets.get(k)! });
    if (buckets.has('__other__')) ordered.push({ key: '__other__', templates: buckets.get('__other__')! });
    return ordered;
  }, [items]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] space-y-6 p-6"
    >
      <header>
        <h1 className="text-2xl font-semibold text-ink">{t('reports.library.title')}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t('reports.library.subtitle')}</p>
      </header>

      {isLoading && (
        <div className="flex h-48 items-center justify-center">
          <svg className="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 rounded-lg border border-error/30 bg-error/5 p-4" role="alert">
          <AlertTriangle className="h-5 w-5 text-error" aria-hidden="true" />
          <p className="text-sm text-error">{(error as Error)?.message ?? t('common.error')}</p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card">
          <p className="text-sm text-ink-muted">{t('reports.library.empty')}</p>
        </div>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="space-y-8">
          {grouped.map(({ key, templates }) => (
            <section key={key} className="space-y-3">
              <div className="flex items-baseline gap-3">
                <h2 className="font-mono text-xs uppercase tracking-wider text-ink-subtle">
                  {sectionLabel(key === '__other__' ? null : key, !!isAr)}
                </h2>
                <span className="text-xs text-ink-subtle">{templates.length}</span>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((tpl) => (
                  <TemplateCard key={tpl.id} tpl={tpl} isAr={!!isAr} onSelect={setSelected} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {selected && (
        <GenerateReportDialog
          open={!!selected}
          onClose={() => setSelected(null)}
          template={selected}
        />
      )}
    </motion.div>
  );
}

function TemplateCard({
  tpl,
  isAr,
  onSelect,
}: {
  tpl: ReportTemplateUserListItem;
  isAr: boolean;
  onSelect: (tpl: ReportTemplateUserListItem) => void;
}) {
  const { t } = useTranslation();
  const displayName = isAr && tpl.displayNameAr ? tpl.displayNameAr : tpl.displayNameEn;
  const KindIcon =
    tpl.reportKind === 'excel'
      ? FileSpreadsheet
      : tpl.reportKind === 'pdf'
        ? FileText
        : FileBarChart;
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <KindIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
          {t(`reports.kinds.${tpl.reportKind}`)}
        </span>
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-ink">{displayName}</h3>
        {tpl.description && (
          <p className="mt-1 text-xs text-ink-muted line-clamp-2" title={tpl.description}>
            {tpl.description}
          </p>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          {tpl.lastRunAt
            ? t('reports.library.lastRun', {
                date: formatDateTime(tpl.lastRunAt, { showTime: true }),
                defaultValue: `Last generated ${formatDateTime(tpl.lastRunAt, { showTime: true })}`,
              })
            : t('reports.library.neverGenerated', { defaultValue: 'Never generated' })}
        </p>
      </div>
      <Button size="sm" onClick={() => onSelect(tpl)}>
        <Play className="me-1 h-3.5 w-3.5" aria-hidden="true" />
        {t('reports.actions.generate')}
      </Button>
    </li>
  );
}
