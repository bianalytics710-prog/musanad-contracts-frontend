/**
 * /app/admin/industry-catalogs — Industry catalogs list (R-IL Phase E + H).
 *
 * Lists all industries with the counts of tenants, benchmarks, and cost
 * components. Drill into a row to manage its catalogs.
 *
 * Phase H — Add industry button + dialog, so Platform Admin can register
 * new industries (e.g. Construction, FMCG Distribution) and then seed
 * their benchmarks + cost components from the detail page.
 *
 * Gated by platform.catalog.manage (granted to platform_admin + Super Admin).
 */
import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight, Layers, Plus } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import {
  industryCatalogService,
  type IndustryInput,
} from '@/services/api/industry-catalog.service';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const Route = createFileRoute('/app/admin/industry-catalogs/')({
  component: () => (
    <ErrorBoundary>
      <IndustryCatalogsList />
    </ErrorBoundary>
  ),
});

function IndustryCatalogsList() {
  const { t } = useTranslation();
  const canManage = useAuthStore(selectHasPermission('platform.catalog.manage'));
  const [addOpen, setAddOpen] = useState(false);

  const { data: industries, isLoading, isError } = useQuery({
    queryKey: ['admin-industries'],
    queryFn: () => industryCatalogService.listIndustries(),
    enabled: canManage,
    staleTime: 60_000,
  });

  if (!canManage) {
    return (
      <div className="mx-auto w-full max-w-[1200px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">{t('common.accessDenied')}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1200px] space-y-6 p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t('admin.industryCatalogs.kicker', { defaultValue: 'Platform configuration' })}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t('admin.industryCatalogs.title', { defaultValue: 'Industry catalogs' })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t('admin.industryCatalogs.subtitle', {
              defaultValue:
                'Manage pricing benchmarks and cost components per industry. Tenants inherit their industry’s catalog plus any tenant-specific overrides you add.',
            })}
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="me-1 h-4 w-4" aria-hidden="true" />
          {t('admin.industryCatalogs.add', { defaultValue: 'Add industry' })}
        </Button>
      </div>

      <AddIndustryDialog open={addOpen} onClose={() => setAddOpen(false)} />

      {isLoading && (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-surface" aria-hidden="true" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-4 text-sm text-error">
          {t('admin.industryCatalogs.errors.fetchFailed', {
            defaultValue: 'Failed to load industry catalogs.',
          })}
        </div>
      )}

      {!isLoading && !isError && industries && industries.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">
            {t('admin.industryCatalogs.empty', {
              defaultValue: 'No industries configured. Click “Add industry” to begin.',
            })}
          </p>
        </div>
      )}

      {!isLoading && !isError && industries && industries.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {industries.map((ind) => (
                <li key={ind.id}>
                  <Link
                    to="/app/admin/industry-catalogs/$industryId"
                    params={{ industryId: String(ind.id) }}
                    className="flex items-center gap-4 px-4 py-4 hover:bg-surface/50"
                  >
                    <div className="rounded-md bg-gold/10 p-2">
                      <Layers className="h-5 w-5 text-gold" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-ink">
                        {ind.displayLabelEn}
                      </p>
                      <p className="truncate font-mono text-[11px] text-ink-subtle">{ind.code}</p>
                      {ind.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{ind.description}</p>
                      )}
                    </div>
                    <div className="hidden flex-row gap-6 text-end sm:flex">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
                          {t('admin.industryCatalogs.col.tenants', { defaultValue: 'Tenants' })}
                        </p>
                        <p className="font-mono text-sm tabular-nums text-ink">{ind.tenantCount}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
                          {t('admin.industryCatalogs.col.benchmarks', { defaultValue: 'Benchmarks' })}
                        </p>
                        <p className="font-mono text-sm tabular-nums text-ink">{ind.benchmarkCount}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
                          {t('admin.industryCatalogs.col.costComponents', { defaultValue: 'Cost components' })}
                        </p>
                        <p className="font-mono text-sm tabular-nums text-ink">{ind.costComponentCount}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-ink-muted" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Phase H — Add-industry dialog.
// Code is required + immutable after create (FK target stability).
// Auto-derived from display label as a slug suggestion.
// ─────────────────────────────────────────────────────────────
function AddIndustryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState<IndustryInput>({
    code: '',
    displayLabelEn: '',
    displayLabelAr: null,
    description: null,
  });

  function reset() {
    setForm({ code: '', displayLabelEn: '', displayLabelAr: null, description: null });
    onClose();
  }

  const createMutation = useMutation({
    mutationFn: () => industryCatalogService.createIndustry(form),
    onSuccess: () => {
      toast.success(
        t('admin.industryCatalogs.industry.created', {
          defaultValue: 'Industry created: {{label}}',
          label: form.displayLabelEn,
        }),
      );
      void qc.invalidateQueries({ queryKey: ['admin-industries'] });
      reset();
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      const msg = e.response?.data?.error?.message ?? e.message ?? 'Failed to create industry';
      toast.error(msg);
    },
  });

  function deriveCode(label: string): string {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_{2,}/g, '_');
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {t('admin.industryCatalogs.industry.dialogTitle', { defaultValue: 'Add industry' })}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <label className="grid gap-1 text-xs text-ink-muted">
            <span>{t('admin.industryCatalogs.industry.displayLabelEn', { defaultValue: 'Display label (EN)' })}</span>
            <Input
              value={form.displayLabelEn}
              onChange={(e) => {
                const v = e.target.value;
                setForm({
                  ...form,
                  displayLabelEn: v,
                  code: form.code || deriveCode(v),
                });
              }}
              placeholder={t('admin.industryCatalogs.industry.displayLabelPlaceholder', {
                defaultValue: 'e.g. Construction',
              })}
            />
          </label>
          <label className="grid gap-1 text-xs text-ink-muted">
            <span>{t('admin.industryCatalogs.industry.displayLabelAr', { defaultValue: 'Display label (AR)' })}</span>
            <Input
              value={form.displayLabelAr ?? ''}
              onChange={(e) => setForm({ ...form, displayLabelAr: e.target.value || null })}
              placeholder="البناء"
            />
          </label>
          <label className="grid gap-1 text-xs text-ink-muted">
            <span>{t('admin.industryCatalogs.industry.code', { defaultValue: 'Code' })}</span>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="construction"
            />
            <span className="text-[11px] text-ink-subtle">
              {t('admin.industryCatalogs.industry.codeHelp', {
                defaultValue: 'Lowercase + underscores. Used as FK target — immutable after create.',
              })}
            </span>
          </label>
          <label className="grid gap-1 text-xs text-ink-muted">
            <span>{t('admin.industryCatalogs.industry.description', { defaultValue: 'Description' })}</span>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value || null })}
              rows={2}
              className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
              placeholder={t('admin.industryCatalogs.industry.descriptionPlaceholder', {
                defaultValue: 'What does this industry cover? Helps other admins pick the right catalog.',
              })}
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={reset} disabled={createMutation.isPending}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !form.code || !form.displayLabelEn}
          >
            {createMutation.isPending
              ? t('common.saving', { defaultValue: 'Saving…' })
              : t('admin.industryCatalogs.industry.create', { defaultValue: 'Create industry' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
