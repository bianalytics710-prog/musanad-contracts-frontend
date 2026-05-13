/**
 * M15 / CR-G — Executive dashboard 3 additive sections.
 *
 * Appended AFTER existing R-EX content in ExecutiveDashboard.tsx.
 * Defensive guards: each section only renders when data is non-empty.
 *
 * Sections:
 *   1. WhatChangedToday — top 8 recent correlations (last 24h)
 *   2. RecommendedActions — top 8 with assigned-role chips + SLA
 *   3. ClausesTriggered — bar list for last7d / last30d window tabs
 *
 * T3 i18n, T5 semantic tokens, T6 a11y, T7 strict types, T12 formatDateTime.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Clock, Zap, FileText } from 'lucide-react';
import { formatDateTime } from '@/utils/datetime';
import type {
  WhatChangedTodayRow,
  RecommendedActionRow,
  ClausesTriggeredPayload,
  ClausesTriggeredRow,
} from '@/types/entities/crg-dashboards.types';

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatAedCompact(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return '—';
  try {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  } catch {
    if (num >= 1_000_000) return `AED ${(num / 1_000_000).toFixed(1)}M`;
    return `AED ${num.toFixed(0)}`;
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const colorMap: Record<string, string> = {
    critical: 'bg-terracotta/20 text-terracotta border-terracotta/30',
    high: 'bg-amber/20 text-amber border-amber/30',
    medium: 'bg-gold/20 text-ink border-gold/30',
    low: 'bg-sage/20 text-sage border-sage/30',
  };
  const cls = colorMap[severity.toLowerCase()] ?? 'bg-muted text-ink-muted border-border';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls}`}>
      {severity}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExecutiveCrgExtensionProps {
  whatChangedToday: WhatChangedTodayRow[];
  recommendedActions: RecommendedActionRow[];
  clausesTriggered: ClausesTriggeredPayload;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExecutiveCrgExtension({
  whatChangedToday,
  recommendedActions,
  clausesTriggered,
}: ExecutiveCrgExtensionProps) {
  const hasAny =
    whatChangedToday.length > 0 ||
    recommendedActions.length > 0 ||
    (clausesTriggered.last7d.length > 0 || clausesTriggered.last30d.length > 0);

  if (!hasAny) return null;

  return (
    <>
      {whatChangedToday.length > 0 && (
        <WhatChangedTodayCard rows={whatChangedToday} />
      )}
      {recommendedActions.length > 0 && (
        <RecommendedActionsCard rows={recommendedActions} />
      )}
      {(clausesTriggered.last7d.length > 0 || clausesTriggered.last30d.length > 0) && (
        <ClausesTriggeredCard payload={clausesTriggered} />
      )}
    </>
  );
}

// ─── What Changed Today ────────────────────────────────────────────────────────

function WhatChangedTodayCard({ rows }: { rows: WhatChangedTodayRow[] }) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t('executive.whatChangedToday.sectionAriaLabel')}
      className="rounded-lg border border-border bg-card p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-gold" aria-hidden />
        <h2 className="text-sm font-semibold text-ink">
          {t('executive.whatChangedToday.title')}
        </h2>
      </div>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.correlationId} className="flex items-start gap-3 rounded-md border border-border/60 bg-surface p-3">
            <SeverityBadge severity={row.severity} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">{row.headline}</p>
              {row.scenario && (
                <p className="mt-0.5 font-mono text-[10px] text-ink-muted">{row.scenario}</p>
              )}
              <p className="mt-0.5 text-xs text-ink-subtle">
                {formatDateTime(row.occurredAt)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-xs font-medium text-ink">
                {formatAedCompact(row.marAed)}
              </p>
              <Link
                to="/app/contracts/$id"
                params={{ id: row.contractId }}
                className="font-mono text-[10px] text-gold hover:underline"
              >
                {t('executive.whatChangedToday.viewContract')}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Recommended Actions ──────────────────────────────────────────────────────

function RecommendedActionsCard({ rows }: { rows: RecommendedActionRow[] }) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t('executive.recommendedActions.sectionAriaLabel')}
      className="rounded-lg border border-border bg-card p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber" aria-hidden />
        <h2 className="text-sm font-semibold text-ink">
          {t('executive.recommendedActions.title')}
        </h2>
      </div>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.correlationId} className="rounded-md border border-border/60 bg-surface p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {row.action ? (
                  <p className="text-sm font-medium text-ink">{row.action}</p>
                ) : (
                  <p className="text-sm text-ink-muted">
                    {t('executive.recommendedActions.noAction')}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {row.assignedRoles.map((role) => (
                    <span
                      key={role}
                      className="inline-flex rounded bg-gold/15 px-2 py-0.5 font-mono text-[10px] text-ink"
                    >
                      {role}
                    </span>
                  ))}
                  {row.slaHours != null && (
                    <span className="inline-flex items-center rounded bg-amber/15 px-2 py-0.5 font-mono text-[10px] text-amber">
                      {t('executive.recommendedActions.sla', { hours: row.slaHours })}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-xs font-medium text-ink">
                  {formatAedCompact(row.marAed)}
                </p>
                <Link
                  to="/app/contracts/$id"
                  params={{ id: row.contractId }}
                  className="font-mono text-[10px] text-gold hover:underline"
                >
                  {t('executive.recommendedActions.viewContract')}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Clauses Triggered ────────────────────────────────────────────────────────

type ClausesWindow = 'last7d' | 'last30d';

function ClausesTriggeredCard({ payload }: { payload: ClausesTriggeredPayload }) {
  const { t } = useTranslation();
  const [window, setWindow] = useState<ClausesWindow>('last7d');

  const rows: ClausesTriggeredRow[] = payload[window] ?? [];

  const chartData = rows.slice(0, 10).map((r) => ({
    name: r.clauseType,
    count: r.count,
    mar: Number(r.totalMarAed),
  }));

  return (
    <section
      aria-label={t('executive.clausesTriggered.sectionAriaLabel')}
      className="rounded-lg border border-border bg-card p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-sage" aria-hidden />
          <h2 className="text-sm font-semibold text-ink">
            {t('executive.clausesTriggered.title')}
          </h2>
        </div>
        <div
          role="group"
          aria-label={t('executive.clausesTriggered.windowGroupAriaLabel')}
          className="flex gap-1"
        >
          {(['last7d', 'last30d'] as ClausesWindow[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindow(w)}
              aria-pressed={window === w}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${window === w ? 'border-gold bg-gold/10 text-ink' : 'border-border bg-card text-ink-muted hover:border-gold/60 hover:text-ink'}`}
            >
              {t(`executive.clausesTriggered.window.${w}`)}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('executive.clausesTriggered.empty')}</p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 16, left: 4, bottom: 32 }}
            >
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: 'var(--ink-muted)' }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 10, fill: 'var(--ink-muted)' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                formatter={(v: number) => [v, t('executive.clausesTriggered.chart.count')]}
              />
              <Bar dataKey="count" fill="var(--sage)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export default ExecutiveCrgExtension;
