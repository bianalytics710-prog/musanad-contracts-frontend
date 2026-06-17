/**
 * /app/legal/third-party-review — Third-Party Agreement Assessment list view.
 *
 * Design-system parity with Contracts / Approvals / Advisory Queue:
 *   - kicker + H1 + subtitle
 *   - StatCard strip (Pending / Awaiting review / Sent / Reject rate)
 *   - filter toolbar (search + status + agreement type)
 *   - Card-wrapped table, mono-uppercase 10px headers, group hover
 *   - single View action linking to detail page
 *   - "New review" CTA links to /new (upload form)
 */
import { useMemo, useState, type ChangeEvent } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightIcon,
  FileText,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/patterns';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { tpaService } from '@/services/api/tpa.service';
import { formatDateTime } from '@/utils/datetime';
import type { ReviewListItem, ReviewStatus } from '@/types/tpa.types';

export const Route = createFileRoute('/app/legal/third-party-review/')({
  component: () => (
    <ErrorBoundary>
      <ThirdPartyReviewListView />
    </ErrorBoundary>
  ),
});

const STATUS_TONE: Record<ReviewStatus, string> = {
  pending_analysis: 'bg-amber-tint/40 text-amber-ink',
  analyzing: 'bg-amber-tint/40 text-amber-ink',
  awaiting_review: 'bg-gold/10 text-ink',
  reviewed: 'bg-sage-tint text-sage-ink',
  redline_sent: 'bg-blue-50 text-blue-700',
  closed_accepted: 'bg-sage-tint text-sage-ink',
  closed_rejected: 'bg-terracotta/10 text-terracotta',
  failed: 'bg-terracotta/10 text-terracotta',
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

const PAGE_SIZE = 25;

// 2026-06-15 — statuses an LC may set manually via fn_tpa_review_set_status.
// A TPA is analysed on upload, so it never sits in 'awaiting_review' with a
// verdict already attached — the manual lifecycle runs reviewed → redline_sent
// → closed. (pending_analysis / analyzing / failed are system-managed.)
type AmendableStatus =
  | 'reviewed'
  | 'redline_sent'
  | 'closed_accepted'
  | 'closed_rejected';
const AMENDABLE_STATUSES: AmendableStatus[] = [
  'reviewed',
  'redline_sent',
  'closed_accepted',
  'closed_rejected',
];

function ThirdPartyReviewListView() {
  const { t } = useTranslation();
  const canRead = useAuthStore(selectHasPermission('tpa.review.read'));
  const canCreate = useAuthStore(selectHasPermission('tpa.review.create'));
  const canAmend = useAuthStore(selectHasPermission('tpa.review.amend'));

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['tpa.reviews', { page, status: statusFilter }],
    queryFn: () =>
      tpaService.listReviews({
        status: statusFilter || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
    enabled: canRead,
    staleTime: 30_000,
  });

  const rawItems = data?.data ?? [];
  const pagination = data?.pagination;

  const items = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return rawItems.filter((r) => {
      if (q) {
        const hay = `${r.referenceCode} ${r.counterpartyName} ${r.agreementTitle} ${r.createdByName ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (typeFilter && r.agreementType !== typeFilter) return false;
      return true;
    });
  }, [rawItems, debouncedSearch, typeFilter]);

  const typeOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: Array<{ value: string; label: string }> = [];
    for (const r of rawItems) {
      if (!r.agreementType || seen.has(r.agreementType)) continue;
      seen.add(r.agreementType);
      opts.push({ value: r.agreementType, label: r.agreementType.toUpperCase() });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [rawItems]);

  const totals = useMemo(() => {
    let pending = 0;
    let awaiting = 0;
    let sent = 0;
    let rejected = 0;
    for (const r of rawItems) {
      if (r.status === 'pending_analysis' || r.status === 'analyzing') pending++;
      if (r.status === 'awaiting_review') awaiting++;
      if (r.status === 'redline_sent' || r.status === 'closed_accepted') sent++;
      if (r.overallVerdict === 'reject' || r.status === 'closed_rejected') rejected++;
    }
    return { pending, awaiting, sent, rejected };
  }, [rawItems]);

  const totalRecords = pagination?.total ?? rawItems.length;
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / PAGE_SIZE)) : 1;
  const hasActiveFilters = debouncedSearch.trim() || statusFilter || typeFilter;

  if (!canRead) {
    return (
      <div className="rounded-md border border-border bg-surface/40 p-6 text-sm text-ink-subtle">
        {t('tpa.list.forbidden', {
          defaultValue: 'You do not have permission to view third-party reviews.',
        })}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-6 lg:px-8"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-ink-subtle">
            {t('tpa.list.kicker', { defaultValue: 'Legal Counsel · Third-Party Review' })}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            {t('tpa.list.title', { defaultValue: 'Third-party agreement review' })}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-subtle">
            {t('tpa.list.subtitle', {
              defaultValue:
                'Upload counterparty paper, compare against the ADNOC playbook, and export a Word redline ready to send back.',
            })}
          </p>
        </div>
        {canCreate && (
          <Link to="/app/legal/third-party-review/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t('tpa.list.cta.new', { defaultValue: 'New review' })}
            </Button>
          </Link>
        )}
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label={t('tpa.list.kpi.pending', { defaultValue: 'Pending analysis' })}
          value={String(totals.pending)}
        />
        <StatCard
          label={t('tpa.list.kpi.awaiting', { defaultValue: 'Awaiting review' })}
          value={String(totals.awaiting)}
        />
        <StatCard
          label={t('tpa.list.kpi.sent', { defaultValue: 'Redlined / sent' })}
          value={String(totals.sent)}
        />
        <StatCard
          label={t('tpa.list.kpi.rejected', { defaultValue: 'Rejected / closed' })}
          value={String(totals.rejected)}
          variant={totals.rejected > 0 ? 'risk' : 'default'}
        />
      </div>

      {/* Filter toolbar */}
      <Card className="border-border/60 bg-surface/30">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <Input
              value={searchInput}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)}
              placeholder={t('tpa.list.search', {
                defaultValue: 'Search reference, counterparty, title…',
              })}
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ReviewStatus | '');
              setPage(1);
            }}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">{t('tpa.list.filter.allStatuses', { defaultValue: 'All statuses' })}</option>
            {(Object.keys(STATUS_LABEL) as ReviewStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">{t('tpa.list.filter.allTypes', { defaultValue: 'All types' })}</option>
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput('');
                setStatusFilter('');
                setTypeFilter('');
                setPage(1);
              }}
            >
              <X className="mr-1 h-3 w-3" /> Clear
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1 h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-ink-subtle">Loading reviews…</div>
          ) : isError ? (
            <div className="flex items-center gap-3 p-6 text-sm text-terracotta">
              <AlertTriangle className="h-4 w-4" />
              {(error as Error)?.message ?? 'Failed to load reviews'}
            </div>
          ) : items.length === 0 ? (
            <EmptyState canCreate={canCreate} hasFilters={Boolean(hasActiveFilters)} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/40 text-left font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Counterparty / agreement</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Verdict</th>
                    <th className="px-4 py-3 text-right">Risk</th>
                    <th className="px-4 py-3">Uploaded</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <ReviewRow key={r.id} row={r} canAmend={canAmend} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && totalRecords > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-ink-subtle">
          <div>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalRecords)} of{' '}
            {totalRecords}
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="px-3 py-1">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// 2026-06-15 — inline status override for LC (tpa.review.amend). Calls
// POST /tpa/reviews/:id/status (fn_tpa_review_set_status). System statuses
// (pending_analysis/analyzing/failed) show as a disabled current option so the
// pill still reads correctly, but only the 5 amendable targets are selectable.
function StatusSelect({ reviewId, status }: { reviewId: number; status: ReviewStatus }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (next: AmendableStatus) => tpaService.setStatus(reviewId, { status: next }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tpa.reviews'] });
      toast.success('Review status updated');
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't update the status."),
  });
  const isSystemStatus = !(AMENDABLE_STATUSES as ReviewStatus[]).includes(status);
  return (
    <span className={`relative inline-flex items-center rounded-full ${STATUS_TONE[status]}`}>
      <select
        value={status}
        disabled={mutation.isPending}
        onChange={(e) => mutation.mutate(e.target.value as AmendableStatus)}
        aria-label="Override review status"
        title="Change status"
        className="cursor-pointer appearance-none rounded-full border-0 bg-transparent py-0.5 ps-2.5 pe-6 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
      >
        {isSystemStatus && (
          <option value={status} disabled>
            {STATUS_LABEL[status]}
          </option>
        )}
        {AMENDABLE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-1.5 h-3 w-3 opacity-70"
        aria-hidden="true"
      />
    </span>
  );
}

function ReviewRow({ row, canAmend }: { row: ReviewListItem; canAmend: boolean }) {
  const verdictTone =
    row.overallVerdict === 'reject'
      ? 'text-terracotta'
      : row.overallVerdict === 'amend'
        ? 'text-amber-ink'
        : row.overallVerdict === 'accept'
          ? 'text-sage-ink'
          : 'text-ink-subtle';
  return (
    <tr className="group border-b border-border/60 last:border-b-0 hover:bg-surface/50">
      <td className="px-4 py-3 font-mono text-xs text-ink-subtle">{row.referenceCode}</td>
      <td className="px-4 py-3">
        <div className="font-medium text-ink">{row.counterpartyName}</div>
        <div className="line-clamp-1 text-xs text-ink-subtle">{row.agreementTitle}</div>
      </td>
      <td className="px-4 py-3 text-xs uppercase text-ink-subtle">{row.agreementType}</td>
      <td className="px-4 py-3">
        {canAmend ? (
          <StatusSelect reviewId={row.id} status={row.status} />
        ) : (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_TONE[row.status]}`}
          >
            {STATUS_LABEL[row.status]}
          </span>
        )}
      </td>
      {/* Verdict mirrors the detail view: shown whenever the AI analysis has
          produced one (null only for a brand-new, not-yet-analysed review). */}
      <td className={`px-4 py-3 text-sm font-medium uppercase ${verdictTone}`}>
        {row.overallVerdict ?? '—'}
      </td>
      <td className="px-4 py-3 text-right">
        {row.riskScore !== null ? (
          <span className="font-mono text-sm font-semibold text-ink">{row.riskScore}</span>
        ) : (
          <span className="text-ink-subtle">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-ink-subtle">{formatDateTime(row.createdAt)}</td>
      <td className="px-4 py-3 text-right">
        <Link
          to="/app/legal/third-party-review/$id"
          params={{ id: String(row.id) }}
          className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:text-ink-strong"
        >
          View <ChevronRightIcon className="h-3 w-3" />
        </Link>
      </td>
    </tr>
  );
}

function EmptyState({ canCreate, hasFilters }: { canCreate: boolean; hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <FileText className="h-10 w-10 text-ink-subtle" />
      <div>
        <h3 className="text-sm font-semibold text-ink">
          {hasFilters ? 'No reviews match your filters' : 'No third-party reviews yet'}
        </h3>
        <p className="mt-1 max-w-md text-sm text-ink-subtle">
          {hasFilters
            ? 'Try removing a filter or clearing the search.'
            : 'Upload a counterparty agreement to compare it against the ADNOC playbook and produce a Word redline.'}
        </p>
      </div>
      {!hasFilters && canCreate && (
        <Link to="/app/legal/third-party-review/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> New review
          </Button>
        </Link>
      )}
    </div>
  );
}
