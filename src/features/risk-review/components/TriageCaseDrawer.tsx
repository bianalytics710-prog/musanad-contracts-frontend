/**
 * 691 — TriageCaseDrawer. In-context detail for a Risk Triage item, opened from
 * the row "View" button. Replaces the old navigation to /app/risk-cases/{id}:
 * a triage item is an UNCONFIRMED potential risk, so the reviewer shouldn't be
 * dropped into the Risk Cases module before deciding. The reviewer sees the
 * evidence here — case body, the Source-system record (the SAP/ServiceNow/…
 * data that triggered it), and the correlation reason — and acts with
 * Confirm risk / Mark as noise right in the drawer. Only on Confirm does the
 * case move into Risk Cases.
 */
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ShieldOff, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { riskCaseService } from '@/services/api/risk-case.service';
import { OriginBadge } from '@/components/risk/OriginBadge';
import { PriorityBadge } from '@/components/risk-cases/Badges';
import { SourceSystemRecordCard } from '@/components/risk-cases/SourceSystemRecordCard';
import { BreachedObligationCard } from '@/components/risk-cases/BreachedObligationCard';
import type { RiskReviewRow } from '@/services/api/risk-review.service';

interface TriageCaseDrawerProps {
  /** The triage row being viewed; null = drawer closed. */
  row: RiskReviewRow | null;
  onClose: () => void;
  /** Confirm-risk — hands back to the parent's confirm flow (assignee modal). */
  onConfirm: (row: RiskReviewRow) => void;
  /** Mark-as-noise — dismiss the case. */
  onDismiss: (id: number) => void;
  dismissDisabled: boolean;
}

export function TriageCaseDrawer({
  row,
  onClose,
  onConfirm,
  onDismiss,
  dismissDisabled,
}: TriageCaseDrawerProps) {
  const { t } = useTranslation();
  const id = row ? Number(row.id) : 0;

  const { data: detail, isLoading, isError } = useQuery({
    queryKey: ['riskCase', id],
    queryFn: () => riskCaseService.getById(id),
    enabled: !!row && Number.isFinite(id) && id > 0,
    staleTime: 15_000,
  });

  const sourceSystemRecord =
    (detail as { sourceSystemRecord?: import('@/types/risk-case.types').SourceSystemRecord | null } | undefined)
      ?.sourceSystemRecord ?? null;
  const breachedObligation =
    (detail as { breachedObligation?: import('@/types/risk-case.types').BreachedObligation | null } | undefined)
      ?.breachedObligation ?? null;
  const matchReason = detail?.linkedCorrelation?.matchReason ?? null;
  const body = detail?.riskCase.body ?? row?.description ?? null;

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] w-[640px] max-w-[94vw] overflow-y-auto">
        {row && (
          <>
            <DialogHeader>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <OriginBadge origin={row.risk_origin} size="md" />
                <PriorityBadge priority={row.priority} />
                <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber">
                  {t('riskReview.tier2Badge', { defaultValue: 'Tier 2 · Review' })}
                </span>
              </div>
              <DialogTitle>{row.title}</DialogTitle>
              <DialogDescription>
                {t('riskTriage.drawer.subtitle', {
                  defaultValue:
                    'Review the evidence below, then confirm this as a risk or mark it as noise.',
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Case body */}
              {body && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-1 text-sm font-semibold text-ink">
                    {t('riskCases.detail.overview.body', { defaultValue: 'Summary' })}
                  </h3>
                  <p className="whitespace-pre-wrap text-sm text-ink">{body}</p>
                </div>
              )}

              {isLoading && (
                <div className="h-24 animate-pulse rounded-lg bg-muted" aria-hidden />
              )}

              {isError && (
                <div className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error" role="alert">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  {t('common.error', { defaultValue: 'Failed to load case detail.' })}
                </div>
              )}

              {/* Expected (contract obligation) vs actual (system record). */}
              {breachedObligation && <BreachedObligationCard obligation={breachedObligation} />}
              {/* The actual system record that triggered this internal risk. */}
              {sourceSystemRecord && <SourceSystemRecordCard record={sourceSystemRecord} />}

              {/* Why the engine flagged it. */}
              {matchReason && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-1 text-sm font-semibold text-ink">
                    {t('riskTriage.drawer.whyFlagged', { defaultValue: 'Why this was flagged' })}
                  </h3>
                  <p className="text-sm text-ink-muted">{matchReason}</p>
                </div>
              )}

              {/* Decision actions */}
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
                <Button
                  variant="ghost"
                  disabled={dismissDisabled}
                  onClick={() => {
                    onDismiss(id);
                    onClose();
                  }}
                >
                  <ShieldOff className="me-1 h-4 w-4" aria-hidden />
                  {t('riskReview.markNoise', { defaultValue: 'Mark as noise' })}
                </Button>
                <Button
                  onClick={() => {
                    onClose();
                    onConfirm(row);
                  }}
                >
                  <ShieldCheck className="me-1 h-4 w-4" aria-hidden />
                  {t('riskReview.confirmRisk', { defaultValue: 'Confirm risk' })}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
