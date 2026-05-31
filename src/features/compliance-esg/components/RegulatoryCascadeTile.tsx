/**
 * CR-M — Regulatory Cascade dashboard tile.
 * CR-T — Added mini headcount-band donut chart.
 *
 * Additive component mounted in the Compliance & ESG dashboard.
 * Fetches cascade list summary (latest run) and links to the full route.
 *
 * A7: service call only (no apiClient import here).
 * C13: semantic tokens only.
 * C14: Router Link for navigation.
 * T3: all strings via t().
 * T4: three data states.
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { ShieldAlert, ChevronRight, AlertTriangle } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { ChartCard } from '@/components/charts';
import { regulatoryCascadeService } from '@/services/api/regulatory-cascade.service';
import { formatDateTime } from '@/utils/datetime';
import type { HeadcountBand } from '@/types/entities/regulatory-cascade.types';

function formatAedCompact(n: number): string {
  try {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  } catch {
    if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
    return `AED ${n.toFixed(0)}`;
  }
}

// Semantic colour tokens for headcount bands
const DONUT_COLORS: Record<HeadcountBand, string> = {
  '<20':   'var(--color-ink-muted)',
  '20-49': 'var(--color-chart-1)',
  '50+':   'var(--color-chart-4)',
};

export function RegulatoryCascadeTile() {
  const { t } = useTranslation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['regulatory-cascade-list', { limit: 1, offset: 0 }],
    queryFn: () => regulatoryCascadeService.list({ limit: 1, offset: 0 }),
    staleTime: 60_000,
  });

  const latestRun = data?.data?.[0];
  const total = data?.pagination.total ?? 0;

  // Build mini donut data from the latest run summary.byBand
  const donutData = (() => {
    if (!latestRun?.summary?.byBand) return [];
    const byBand = latestRun.summary.byBand;
    const bands: HeadcountBand[] = ['<20', '20-49', '50+'];
    return bands
      .map((b) => ({ band: b, count: byBand[b]?.total ?? 0 }))
      .filter((d) => d.count > 0);
  })();

  return (
    <section
      className="rounded-lg border border-border bg-card p-4"
      aria-label={t('regulatory.cascade.tile.ariaLabel')}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-terracotta" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">
            {t('regulatory.cascade.tile.title')}
          </h2>
        </div>
        <Link
          to="/app/compliance/regulatory-cascade"
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary rounded"
          aria-label={t('regulatory.cascade.tile.viewAll')}
        >
          {t('regulatory.cascade.tile.viewAll')}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-2" aria-busy="true">
          <div className="h-4 w-full animate-pulse rounded bg-surface" aria-hidden="true" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-surface" aria-hidden="true" />
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-xs text-error" role="alert">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t('regulatory.cascade.tile.errorLoading')}
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {total === 0 ? (
            <p className="text-sm text-ink-muted">
              {t('regulatory.cascade.tile.noRuns')}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-muted">
                  {t('regulatory.cascade.tile.totalRuns')}
                </span>
                <span className="font-mono text-sm font-semibold text-ink tabular-nums">
                  {total}
                </span>
              </div>

              {latestRun && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-muted">
                      {t('regulatory.cascade.tile.latestRun')}
                    </span>
                    <span className="text-xs text-ink">
                      {formatDateTime(latestRun.runAt, { showTime: false })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-muted">
                      {t('regulatory.cascade.tile.affectedContractors')}
                    </span>
                    <span className="font-mono text-sm font-semibold text-terracotta tabular-nums">
                      {latestRun.affectedContractorCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-muted">
                      {t('regulatory.cascade.tile.penaltyExposure')}
                    </span>
                    <span className="font-mono text-sm font-semibold text-ink tabular-nums">
                      {formatAedCompact(latestRun.totalPenaltyMinAed)}
                      {' – '}
                      {formatAedCompact(latestRun.totalPenaltyMaxAed)}
                    </span>
                  </div>

                  {/* Mini headcount-band donut */}
                  {donutData.length > 0 && (
                    <ChartCard
                      title=""
                      subtitle={t('regulatory.cascade.charts.headcountDonut.subtitle')}
                      height={140}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={donutData}
                            dataKey="count"
                            nameKey="band"
                            innerRadius={30}
                            outerRadius={50}
                            paddingAngle={2}
                          >
                            {donutData.map((entry) => (
                              <Cell
                                key={entry.band}
                                fill={DONUT_COLORS[entry.band as HeadcountBand] ?? 'var(--color-chart-3)'}
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}
                </>
              )}

              <Link
                to="/app/compliance/regulatory-cascade"
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={t('regulatory.cascade.tile.openCascade')}
              >
                {t('regulatory.cascade.tile.openCascade')}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
