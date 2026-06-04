/**
 * /app/legal/third-party-review/:id — review detail with per-clause findings.
 *
 * Layout:
 *   - Header: kicker + title (counterparty + reference + verdict pill + risk score)
 *   - Executive summary card
 *   - Per-clause findings (verdict pill + extracted text + ADNOC standard +
 *     suggested redline; Layla can override verdict / write her own redline)
 *   - Action bar: Export DOCX (real Word file), Mark as sent, Close
 */
import { useMemo, useState } from 'react';
import { createFileRoute, useParams, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/patterns';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { tpaService } from '@/services/api/tpa.service';
import { formatDateTime } from '@/utils/datetime';
import type { AiVerdict, ReviewFinding, ReviewStatus } from '@/types/tpa.types';

export const Route = createFileRoute('/app/legal/third-party-review/$id')({
  component: () => (
    <ErrorBoundary>
      <ReviewDetailView />
    </ErrorBoundary>
  ),
});

const VERDICT_TONE: Record<AiVerdict, { bg: string; text: string; ring: string }> = {
  accept: { bg: 'bg-sage-tint', text: 'text-sage-ink', ring: 'ring-sage-ink/20' },
  amend: { bg: 'bg-amber-tint/40', text: 'text-amber-ink', ring: 'ring-amber-ink/20' },
  reject: { bg: 'bg-terracotta/10', text: 'text-terracotta', ring: 'ring-terracotta/30' },
  missing: { bg: 'bg-surface', text: 'text-ink-subtle', ring: 'ring-border' },
  info: { bg: 'bg-surface', text: 'text-ink-subtle', ring: 'ring-border' },
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending_analysis: 'Pending analysis',
  analyzing: 'Analyzing',
  awaiting_review: 'Awaiting review',
  reviewed: 'Reviewed',
  redline_sent: 'Redline sent',
  closed_accepted: 'Closed · accepted',
  closed_rejected: 'Closed · rejected',
  failed: 'Failed',
};

function ReviewDetailView() {
  const params = useParams({ from: '/app/legal/third-party-review/$id' });
  const reviewId = Number(params.id);
  const canRead = useAuthStore(selectHasPermission('tpa.review.read'));
  const canAmend = useAuthStore(selectHasPermission('tpa.review.amend'));
  const qc = useQueryClient();

  const [expandedClause, setExpandedClause] = useState<number | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['tpa.review', reviewId],
    queryFn: () => tpaService.getReview(reviewId),
    enabled: canRead && Number.isFinite(reviewId) && reviewId > 0,
    staleTime: 15_000,
  });

  const setStatusMutation = useMutation({
    mutationFn: (vars: {
      reviewId: number;
      payload: Parameters<typeof tpaService.setStatus>[1];
    }) => tpaService.setStatus(vars.reviewId, vars.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tpa.review', reviewId] });
      qc.invalidateQueries({ queryKey: ['tpa.reviews'] });
      toast.success('Review status updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sortedFindings = useMemo(
    () =>
      data?.findings ? [...data.findings].sort((a, b) => a.displayOrder - b.displayOrder) : [],
    [data?.findings],
  );

  if (!canRead) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-ink-subtle">
        You do not have permission to view this review.
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-sm text-ink-subtle">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        <div className="mt-2">Loading review…</div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Card className="border-terracotta/30">
          <CardContent className="flex items-start gap-3 p-6 text-sm text-terracotta">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              <div className="font-medium">Failed to load review</div>
              <div className="mt-1 text-ink-subtle">
                {(error as Error)?.message ?? 'Unknown error'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const onMarkSent = () =>
    setStatusMutation.mutate({
      reviewId: data.id,
      payload: { status: 'redline_sent' },
    });

  const onMarkAccepted = () =>
    setStatusMutation.mutate({
      reviewId: data.id,
      payload: { status: 'closed_accepted' },
    });

  const onMarkRejected = () =>
    setStatusMutation.mutate({
      reviewId: data.id,
      payload: { status: 'closed_rejected' },
    });

  const onDownload = async () => {
    try {
      const { apiClient } = await import('@/lib/api-client');
      const response = await apiClient.get(tpaService.downloadRedlineUrl(data.id), {
        responseType: 'blob',
      });
      const blob = new Blob([response.data as BlobPart], {
        type:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Redline_${data.referenceCode}_${data.counterpartyName.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60)}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error((err as Error).message || 'Download failed');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6 lg:px-8"
    >
      {/* Header */}
      <div>
        <Link
          to="/app/legal/third-party-review"
          className="inline-flex items-center gap-1 text-xs text-ink-subtle hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" /> Back to reviews
        </Link>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-ink-subtle">
              {data.referenceCode} · {STATUS_LABEL[data.status]}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink md:text-3xl">
              {data.agreementTitle}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-subtle">
              <span>{data.counterpartyName}</span>
              <span>·</span>
              <span className="uppercase">{data.agreementType}</span>
              <span>·</span>
              <span>Playbook: {data.playbook?.nameEn ?? '—'}</span>
              <span>·</span>
              <span>Uploaded {formatDateTime(data.createdAt)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-1 h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canAmend && (
              <Button onClick={onDownload} className="gap-2">
                <Download className="h-4 w-4" /> Export DOCX redline
              </Button>
            )}
          </div>
        </div>
      </div>

      {data.status === 'failed' && data.llmError && (
        <Card className="border-terracotta/30 bg-terracotta/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-terracotta">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <div className="font-medium">Analysis failed</div>
              <div className="mt-1 text-xs">{data.llmError}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Overall verdict"
          value={(data.overallVerdict ?? '—').toUpperCase()}
          variant={
            data.overallVerdict === 'reject'
              ? 'risk'
              : data.overallVerdict === 'amend'
                ? 'warning'
                : 'default'
          }
        />
        <StatCard
          label="Risk score"
          value={data.riskScore !== null ? `${data.riskScore}/100` : '—'}
          delta={data.overallRisk ? `${data.overallRisk.toUpperCase()} risk` : undefined}
          variant={
            data.overallRisk === 'critical' || data.overallRisk === 'high'
              ? 'risk'
              : data.overallRisk === 'medium'
                ? 'warning'
                : 'default'
          }
        />
        <StatCard
          label="Findings"
          value={String(sortedFindings.length)}
          delta={`${data.acceptCount} accept · ${data.amendCount} amend · ${data.rejectCount} reject`}
        />
        <StatCard
          label="Conflicts"
          value={String(data.conflictCount)}
          delta="amend + reject combined"
        />
      </div>

      {/* Executive summary */}
      {data.executiveSummary && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-subtle">
              Executive summary
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
              {data.executiveSummary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Per-clause findings */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-subtle">
              Clause-by-clause findings
            </h2>
            <p className="mt-1 text-xs text-ink-subtle">
              Each finding compares the counterparty wording against the ADNOC playbook position.
              Click a row to see the proposed redline.
            </p>
          </div>

          {sortedFindings.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-subtle">
              No findings recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sortedFindings.map((f) => (
                <FindingRow
                  key={f.id}
                  finding={f}
                  expanded={expandedClause === f.id}
                  onToggle={() =>
                    setExpandedClause((cur) => (cur === f.id ? null : f.id))
                  }
                  reviewId={data.id}
                  canAmend={canAmend}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action bar */}
      {canAmend && data.status !== 'closed_accepted' && data.status !== 'closed_rejected' && (
        <Card className="border-border/60 bg-surface/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-xs text-ink-subtle">
              Status: <span className="font-medium text-ink">{STATUS_LABEL[data.status]}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.status === 'awaiting_review' && (
                <Button variant="outline" onClick={onMarkSent} disabled={setStatusMutation.isPending}>
                  Mark as redline sent
                </Button>
              )}
              {data.status === 'redline_sent' && (
                <>
                  <Button variant="outline" onClick={onMarkAccepted} disabled={setStatusMutation.isPending}>
                    <CheckCircle2 className="mr-1 h-4 w-4 text-sage-ink" /> Mark accepted
                  </Button>
                  <Button variant="outline" onClick={onMarkRejected} disabled={setStatusMutation.isPending}>
                    <XCircle className="mr-1 h-4 w-4 text-terracotta" /> Mark rejected
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Source document */}
      {data.documents.length > 0 && (
        <div className="text-xs text-ink-subtle">
          Source: {data.documents[0]?.fileName} · {((data.documents[0]?.sizeBytes ?? 0) / 1024).toFixed(1)} KB
        </div>
      )}
    </motion.div>
  );
}

function FindingRow({
  finding,
  expanded,
  onToggle,
  reviewId,
  canAmend,
}: {
  finding: ReviewFinding;
  expanded: boolean;
  onToggle: () => void;
  reviewId: number;
  canAmend: boolean;
}) {
  const effectiveVerdict = (finding.userVerdict ?? finding.aiVerdict) as AiVerdict;
  const tone = VERDICT_TONE[effectiveVerdict];
  const [editing, setEditing] = useState(false);
  const [redline, setRedline] = useState(
    finding.userRedline ?? finding.aiSuggestedRedline ?? '',
  );
  const [verdictOverride, setVerdictOverride] = useState<AiVerdict | ''>(
    finding.userVerdict ?? '',
  );
  const [notes, setNotes] = useState(finding.userNotes ?? '');
  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: () =>
      tpaService.updateFinding(reviewId, finding.id, {
        userVerdict: verdictOverride || undefined,
        userRedline: redline || undefined,
        userNotes: notes || undefined,
        resolutionStatus: 'amended_by_user',
      }),
    onSuccess: () => {
      toast.success('Override saved');
      qc.invalidateQueries({ queryKey: ['tpa.review', reviewId] });
      setEditing(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const proposedRedline = finding.userRedline ?? finding.aiSuggestedRedline;

  return (
    <div className="px-4 py-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 text-left"
      >
        <span
          className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}
        >
          {effectiveVerdict}
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium text-ink">
              {finding.displayOrder / 10 < 10 ? '' : ''}
              {finding.clauseTitle}
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-subtle">
              {finding.aiSeverity && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                    finding.aiSeverity === 'critical'
                      ? 'bg-terracotta/10 text-terracotta'
                      : finding.aiSeverity === 'high'
                        ? 'bg-amber-tint/40 text-amber-ink'
                        : 'bg-surface text-ink-subtle'
                  }`}
                >
                  {finding.aiSeverity}
                </span>
              )}
              {finding.extractedLocation && <span>· {finding.extractedLocation}</span>}
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </div>
          </div>
          {finding.aiRationale && !expanded && (
            <p className="mt-1 line-clamp-2 text-xs text-ink-subtle">{finding.aiRationale}</p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 rounded-md bg-surface/30 p-4 text-sm">
          {/* Counterparty wording */}
          {finding.extractedText ? (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                {effectiveVerdict === 'reject'
                  ? 'Counterparty wording (recommend deletion)'
                  : effectiveVerdict === 'amend'
                    ? 'Counterparty wording (proposed deletion)'
                    : 'Counterparty wording'}
              </div>
              <div
                className={`mt-1 rounded border-l-2 px-3 py-2 text-sm ${
                  effectiveVerdict === 'accept' || effectiveVerdict === 'info'
                    ? 'border-sage-ink/40 bg-sage-tint/30 text-ink'
                    : 'border-terracotta/40 bg-terracotta/5 text-terracotta line-through'
                }`}
              >
                {finding.extractedText}
              </div>
            </div>
          ) : (
            <div className="rounded border border-dashed border-border bg-surface/40 px-3 py-2 text-xs italic text-ink-subtle">
              {effectiveVerdict === 'missing'
                ? 'No corresponding clause was found in the counterparty agreement.'
                : 'No verbatim quote available.'}
            </div>
          )}

          {/* Insertion / redline / deletion-only note */}
          {effectiveVerdict === 'reject' ? (
            <div className="rounded border-l-2 border-terracotta/40 bg-terracotta/5 px-3 py-2 text-xs italic text-ink-subtle">
              ADNOC requests this clause be deleted in its entirety. No replacement language is
              offered as part of this redline; the topic will be addressed separately or its
              absence is acceptable to ADNOC.
            </div>
          ) : (
            proposedRedline && (effectiveVerdict === 'amend' || effectiveVerdict === 'missing') && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                  {effectiveVerdict === 'missing'
                    ? 'Proposed insertion (ADNOC standard)'
                    : 'Proposed redline'}
                </div>
                <div className="mt-1 rounded border-l-2 border-blue-500/60 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  {proposedRedline}
                </div>
              </div>
            )
          )}

          {/* Rationale + conflicts */}
          {finding.aiRationale && (
            <div className="text-xs text-ink-subtle">
              <span className="font-semibold">Rationale: </span>
              {finding.aiRationale}
            </div>
          )}
          {finding.aiConflictsWith.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-ink-subtle">Triggered:</span>
              {finding.aiConflictsWith.map((c, i) => (
                <span
                  key={i}
                  className="rounded bg-terracotta/10 px-2 py-0.5 text-[11px] text-terracotta"
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          {/* Playbook standard reference */}
          {finding.playbookStandard && (
            <details className="text-xs">
              <summary className="cursor-pointer text-ink-subtle">
                Reference: ADNOC standard wording
              </summary>
              <div className="mt-2 whitespace-pre-line rounded border border-border bg-background px-3 py-2 text-ink">
                {finding.playbookStandard}
              </div>
              {finding.playbookFallback && (
                <div className="mt-2 whitespace-pre-line rounded border border-border bg-background px-3 py-2 text-ink-subtle">
                  <span className="font-medium text-ink">Fallback: </span>
                  {finding.playbookFallback}
                </div>
              )}
            </details>
          )}

          {/* Override controls */}
          {canAmend && !editing && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1">
                <FileText className="h-3 w-3" /> Override verdict / edit redline
              </Button>
            </div>
          )}

          {canAmend && editing && (
            <div className="space-y-3 rounded border border-border bg-background p-3">
              <div>
                <label className="text-[11px] font-semibold uppercase text-ink-subtle">
                  Verdict override
                </label>
                <select
                  value={verdictOverride}
                  onChange={(e) => setVerdictOverride(e.target.value as AiVerdict | '')}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">Keep AI verdict ({finding.aiVerdict})</option>
                  <option value="accept">accept</option>
                  <option value="amend">amend</option>
                  <option value="reject">reject</option>
                  <option value="missing">missing</option>
                  <option value="info">info</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase text-ink-subtle">
                  Counsel redline (overrides AI suggestion in export)
                </label>
                <textarea
                  value={redline}
                  onChange={(e) => setRedline(e.target.value)}
                  rows={5}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase text-ink-subtle">
                  Counsel note
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  <X className="mr-1 h-3 w-3" /> Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save override'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
