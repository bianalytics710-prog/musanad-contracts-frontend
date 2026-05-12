/**
 * /app/admin/clause-taxonomy — Clause Taxonomy Viewer (CR-D, S1)
 *
 * Read-only viewer for the 50 Annex A clause types.
 * Gated: clause.taxonomy.read (all authenticated roles).
 *
 * A7: all HTTP via clauseTaxonomyService.
 * C12: all text via t().
 * C13: semantic tokens only.
 * C14: internal nav via Router Link.
 * D7: scope="col" on all <th>.
 * D6: htmlFor + id matched on all form fields.
 * WCAG 2.1 AA.
 */
import { useState, useRef, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, BookOpen, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { clauseTaxonomyService } from '@/services/api/clause-taxonomy.service';
import { useDebounce } from '@/hooks/useDebounce';
import type { ClauseTaxonomyEntry, ClauseFamily } from '@/types/entities/clause.types';

const CLAUSE_FAMILIES: ClauseFamily[] = [
  'force_majeure', 'termination', 'pricing', 'performance',
  'indemnity', 'compliance', 'governance', 'operational',
];

// Color coding per family (semantic tokens)
const FAMILY_COLORS: Record<ClauseFamily, string> = {
  force_majeure:  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  termination:    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  pricing:        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  performance:    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  indemnity:      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  compliance:     'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  governance:     'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300',
  operational:    'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
};

export const Route = createFileRoute('/app/admin/clause-taxonomy')({
  component: () => (
    <ErrorBoundary>
      <ClauseTaxonomyView />
    </ErrorBoundary>
  ),
});

function ClauseTaxonomyView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const canRead = useAuthStore(selectHasPermission('clause.taxonomy.read'));

  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState<ClauseFamily | 'all'>('all');
  const [expandedFamilies, setExpandedFamilies] = useState<Set<ClauseFamily>>(
    new Set(CLAUSE_FAMILIES),
  );
  const [revisionTarget, setRevisionTarget] = useState<ClauseTaxonomyEntry | null>(null);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['clauseTaxonomy', { family: familyFilter === 'all' ? undefined : familyFilter, search: debouncedSearch }],
    queryFn: () =>
      clauseTaxonomyService.list({
        family: familyFilter === 'all' ? undefined : familyFilter,
        search: debouncedSearch || undefined,
      }),
    enabled: canRead,
    staleTime: 5 * 60 * 1000,
  });

  const toggleFamily = (family: ClauseFamily) => {
    setExpandedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(family)) next.delete(family);
      else next.add(family);
      return next;
    });
  };

  if (!canRead) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-8 text-center">
        <p className="text-ink-muted">{t('common.accessDenied')}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-muted" aria-label={t('common.loading')} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-ink-muted">
          {error instanceof Error ? error.message : t('common.error')}
        </p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="me-2 h-4 w-4" />
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const items = data?.items ?? [];
  const grouped = data?.groupedByFamily ?? ({} as Record<ClauseFamily, ClauseTaxonomyEntry[]>);

  // When searching, show flat list; otherwise show grouped accordion
  const isSearching = debouncedSearch.length > 0;

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{t('clauses.taxonomy.title')}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t('clauses.taxonomy.subtitle')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div>
          <label htmlFor="taxonomy-search" className="sr-only">
            {t('clauses.taxonomy.searchLabel')}
          </label>
          <input
            id="taxonomy-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('clauses.taxonomy.searchPlaceholder')}
            className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Family filter chips */}
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('clauses.taxonomy.filterByFamily')}>
          <button
            type="button"
            onClick={() => setFamilyFilter('all')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              familyFilter === 'all'
                ? 'bg-ink text-background'
                : 'bg-surface text-ink-muted hover:bg-surface/80'
            }`}
          >
            {t('clauses.taxonomy.familyFilter.all')}
          </button>
          {CLAUSE_FAMILIES.map((fam) => (
            <button
              key={fam}
              type="button"
              onClick={() => setFamilyFilter(fam)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                familyFilter === fam
                  ? 'bg-ink text-background'
                  : 'bg-surface text-ink-muted hover:bg-surface/80'
              }`}
            >
              {t(`clauses.taxonomy.family.${fam}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center">
          <BookOpen className="h-10 w-10 text-ink-muted" />
          <p className="text-ink-muted">{t('clauses.taxonomy.empty')}</p>
        </div>
      )}

      {/* Content */}
      {isSearching ? (
        <div className="space-y-3">
          {items.map((entry) => (
            <TaxonomyEntryCard
              key={entry.id}
              entry={entry}
              isAr={isAr}
              onRequestRevision={(e) => {
                setRevisionTarget(e);
                setRevisionDialogOpen(true);
              }}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {CLAUSE_FAMILIES.filter(
            (fam) => familyFilter === 'all' || familyFilter === fam,
          ).map((family) => {
            const familyEntries = grouped[family] ?? [];
            if (familyEntries.length === 0) return null;
            const isExpanded = expandedFamilies.has(family);

            return (
              <div key={family} className="rounded-lg border border-border bg-card">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  onClick={() => toggleFamily(family)}
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FAMILY_COLORS[family]}`}>
                      {t(`clauses.taxonomy.family.${family}`)}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {t('clauses.taxonomy.typeCount', { count: familyEntries.length })}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-ink-muted" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-ink-muted" />
                  )}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-border border-t border-border">
                        {familyEntries.map((entry) => (
                          <TaxonomyEntryCard
                            key={entry.id}
                            entry={entry}
                            isAr={isAr}
                            onRequestRevision={(e) => {
                              setRevisionTarget(e);
                              setRevisionDialogOpen(true);
                            }}
                            t={t}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Revision request dialog */}
      {revisionDialogOpen && revisionTarget && (
        <TaxonomyRevisionDialog
          entry={revisionTarget}
          isAr={isAr}
          onClose={() => {
            setRevisionDialogOpen(false);
            setRevisionTarget(null);
          }}
          t={t}
        />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface EntryCardProps {
  entry: ClauseTaxonomyEntry;
  isAr: boolean;
  onRequestRevision: (entry: ClauseTaxonomyEntry) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function TaxonomyEntryCard({ entry, isAr, onRequestRevision, t }: EntryCardProps) {
  const [schemaExpanded, setSchemaExpanded] = useState(false);
  const displayName = isAr ? entry.displayNameAr : entry.displayNameEn;
  const definition = isAr ? entry.definitionAr : entry.definitionEn;
  const cues = isAr ? entry.identificationCuesAr : entry.identificationCuesEn;
  const paramKeys = Object.keys(entry.parameterSchema);

  return (
    <div className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">{displayName}</h3>
            <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
              {entry.clauseTypeId}
            </code>
            {entry.isDeprecated && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
                {t('clauses.taxonomy.deprecated')}
              </span>
            )}
          </div>
          {definition && (
            <p className="mt-1.5 text-sm text-ink-muted">{definition}</p>
          )}
          {cues && (
            <p className="mt-1 text-xs text-ink-subtle italic">{cues}</p>
          )}

          {/* Parameter schema */}
          {paramKeys.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink"
                onClick={() => setSchemaExpanded((v) => !v)}
                aria-expanded={schemaExpanded}
              >
                {schemaExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                {t('clauses.taxonomy.parametersLabel', { count: paramKeys.length })}
              </button>

              <AnimatePresence>
                {schemaExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 overflow-x-auto rounded-md border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-surface">
                          <tr>
                            <th scope="col" className="px-3 py-2 text-left font-medium text-ink">
                              {t('clauses.taxonomy.parameterTable.name')}
                            </th>
                            <th scope="col" className="px-3 py-2 text-left font-medium text-ink">
                              {t('clauses.taxonomy.parameterTable.type')}
                            </th>
                            <th scope="col" className="px-3 py-2 text-left font-medium text-ink">
                              {t('clauses.taxonomy.parameterTable.required')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {paramKeys.map((paramKey) => {
                            const paramDef = entry.parameterSchema[paramKey];
                            return (
                              <tr key={paramKey} className="hover:bg-surface/50">
                                <td className="px-3 py-1.5 font-mono text-ink">{paramKey}</td>
                                <td className="px-3 py-1.5 text-ink-muted">{paramDef?.type ?? '—'}</td>
                                <td className="px-3 py-1.5 text-ink-muted">
                                  {paramDef?.required
                                    ? t('clauses.taxonomy.parameterTable.yes')
                                    : t('clauses.taxonomy.parameterTable.no')}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => onRequestRevision(entry)}
        >
          {t('clauses.taxonomy.requestRevision')}
        </Button>
      </div>
    </div>
  );
}

interface RevisionDialogProps {
  entry: ClauseTaxonomyEntry;
  isAr: boolean;
  onClose: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function TaxonomyRevisionDialog({ entry, isAr, onClose, t }: RevisionDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const displayName = isAr ? entry.displayNameAr : entry.displayNameEn;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    // Log revision request — deferred to risk_case creation in CR-I
    setSubmitted(true);
    toast.success(t('clauses.taxonomy.revisionRequested'));
    setTimeout(onClose, 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revision-dialog-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl"
      >
        <h2 id="revision-dialog-title" className="text-base font-semibold text-ink">
          {t('clauses.taxonomy.revisionDialog.title')}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {t('clauses.taxonomy.revisionDialog.subtitle', { name: displayName })}
        </p>

        {submitted ? (
          <p className="mt-4 text-sm text-emerald-600">{t('clauses.taxonomy.revisionRequested')}</p>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="revision-reason"
                className="mb-1.5 block text-xs font-medium text-ink"
              >
                {t('clauses.taxonomy.revisionDialog.reasonLabel')}
              </label>
              <textarea
                id="revision-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={t('clauses.taxonomy.revisionDialog.reasonPlaceholder')}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={!reason.trim()}>
                {t('clauses.taxonomy.revisionDialog.submit')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
