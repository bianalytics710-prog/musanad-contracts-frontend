/**
 * /app/admin/industry-catalogs/$industryId — catalog detail (R-IL Phase E).
 *
 * Sub-tabs:
 *   - Benchmarks      — pricing_benchmark_catalog CRUD for this industry
 *   - Cost components — cost_component_catalog CRUD for this industry
 *
 * Tenant overrides surface inline (filter dropdown) — Platform Admin can
 * scope a row to a single tenant by setting tenantId on upsert. v1 ships
 * with ADNOC only; the filter is a no-op until additional tenants exist.
 *
 * Gated by platform.catalog.manage.
 */
import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ChevronLeft, Layers, UserPlus } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import {
  industryCatalogService,
  type BenchmarkInput,
  type CostComponentInput,
  type BenchmarkCatalogRow,
  type CostComponentCatalogRow,
} from '@/services/api/industry-catalog.service';
import {
  adminTenantService,
  type CreateTenantInput,
} from '@/services/api/admin-tenant.service';

export const Route = createFileRoute('/app/admin/industry-catalogs/$industryId')({
  component: () => (
    <ErrorBoundary>
      <IndustryCatalogDetail />
    </ErrorBoundary>
  ),
});

type Tab = 'benchmarks' | 'cost-components';

function IndustryCatalogDetail() {
  const { t } = useTranslation();
  const { industryId } = Route.useParams();
  const id = Number(industryId);
  const canManage = useAuthStore(selectHasPermission('platform.catalog.manage'));
  const canManageTenants = useAuthStore(selectHasPermission('tenant.manage'));
  const [tab, setTab] = useState<Tab>('benchmarks');
  const [addTenantOpen, setAddTenantOpen] = useState(false);

  // Load industries list (cheap; gives us the displayLabel for this id).
  const { data: industries } = useQuery({
    queryKey: ['admin-industries'],
    queryFn: () => industryCatalogService.listIndustries(),
    enabled: canManage,
    staleTime: 60_000,
  });
  const industry = industries?.find((i) => i.id === id);

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
      {/* Header */}
      <div>
        <Link
          to="/app/admin/industry-catalogs"
          className="mb-2 inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {t('admin.industryCatalogs.detail.back', { defaultValue: 'Back to industries' })}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-gold/10 p-2">
              <Layers className="h-5 w-5 text-gold" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">
                {industry?.displayLabelEn ?? t('common.loading', { defaultValue: 'Loading…' })}
              </h1>
              <p className="font-mono text-[11px] text-ink-subtle">{industry?.code ?? ''}</p>
            </div>
          </div>
          {canManageTenants && industry && (
            <Button size="sm" variant="outline" onClick={() => setAddTenantOpen(true)}>
              <UserPlus className="me-1 h-4 w-4" aria-hidden="true" />
              {t('admin.industryCatalogs.detail.addTenant', { defaultValue: 'Add tenant' })}
            </Button>
          )}
        </div>
        {industry?.description && (
          <p className="mt-2 text-sm text-ink-muted">{industry.description}</p>
        )}
        {industry && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-muted">
            <span className="font-mono uppercase tracking-wider text-[10px] text-ink-subtle">
              {t('admin.industryCatalogs.col.tenants', { defaultValue: 'Tenants' })}:
            </span>
            <span className="font-semibold text-ink">{industry.tenantCount}</span>
          </p>
        )}
      </div>

      {/* Add-tenant dialog */}
      {industry && (
        <AddTenantDialog
          open={addTenantOpen}
          onClose={() => setAddTenantOpen(false)}
          industryId={industry.id}
          industryLabel={industry.displayLabelEn}
        />
      )}

      {/* Sub-tabs */}
      <div role="tablist" className="flex gap-1 border-b border-border">
        <button
          role="tab"
          aria-selected={tab === 'benchmarks'}
          onClick={() => setTab('benchmarks')}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === 'benchmarks' ? 'border-gold text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}
        >
          {t('admin.industryCatalogs.tabs.benchmarks', { defaultValue: 'Benchmarks' })}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'cost-components'}
          onClick={() => setTab('cost-components')}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === 'cost-components' ? 'border-gold text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}
        >
          {t('admin.industryCatalogs.tabs.costComponents', { defaultValue: 'Cost components' })}
        </button>
      </div>

      {tab === 'benchmarks' && <BenchmarksTab industryId={id} />}
      {tab === 'cost-components' && <CostComponentsTab industryId={id} />}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Benchmarks tab
// ─────────────────────────────────────────────────────────────
function emptyBenchmark(industryId: number): BenchmarkInput {
  return {
    industryId,
    tenantId: null,
    code: '',
    displayLabelEn: '',
    displayLabelAr: null,
    unitLabel: 'USD/bbl',
    volumeUnitLabel: 'bbl',
    typicalLow: 60,
    typicalHigh: 140,
    kickerText: null,
    isFx: false,
    sortOrder: 100,
  };
}

function BenchmarksTab({ industryId }: { industryId: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: rows, isLoading } = useQuery({
    queryKey: ['admin-benchmarks', industryId],
    queryFn: () => industryCatalogService.listBenchmarks(industryId),
    staleTime: 30_000,
  });

  const [editing, setEditing] = useState<BenchmarkCatalogRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<BenchmarkInput>(emptyBenchmark(industryId));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) return industryCatalogService.updateBenchmark(editing.id, form);
      return industryCatalogService.createBenchmark(industryId, form);
    },
    onSuccess: () => {
      toast.success(t('common.saved', { defaultValue: 'Saved' }));
      void qc.invalidateQueries({ queryKey: ['admin-benchmarks', industryId] });
      void qc.invalidateQueries({ queryKey: ['admin-industries'] });
      void qc.invalidateQueries({ queryKey: ['index-linked-catalog-benchmarks'] });
      setEditing(null);
      setCreating(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => industryCatalogService.deactivateBenchmark(id),
    onSuccess: () => {
      toast.success(t('common.deactivated', { defaultValue: 'Deactivated' }));
      void qc.invalidateQueries({ queryKey: ['admin-benchmarks', industryId] });
      void qc.invalidateQueries({ queryKey: ['admin-industries'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function openCreate() {
    setForm(emptyBenchmark(industryId));
    setEditing(null);
    setCreating(true);
  }

  function openEdit(row: BenchmarkCatalogRow) {
    setForm({
      industryId: row.industryId,
      tenantId: row.tenantId,
      code: row.code,
      displayLabelEn: row.displayLabelEn,
      displayLabelAr: row.displayLabelAr,
      unitLabel: row.unitLabel,
      volumeUnitLabel: row.volumeUnitLabel,
      typicalLow: row.typicalLow ? parseFloat(row.typicalLow) : null,
      typicalHigh: row.typicalHigh ? parseFloat(row.typicalHigh) : null,
      kickerText: row.kickerText,
      isFx: row.isFx,
      sortOrder: row.sortOrder,
    });
    setEditing(row);
    setCreating(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="me-1 h-4 w-4" aria-hidden="true" />
          {t('admin.industryCatalogs.benchmarks.add', { defaultValue: 'Add benchmark' })}
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-surface" aria-hidden="true" />
          ))}
        </div>
      )}

      {!isLoading && rows && rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface">
                  <tr className="text-left">
                    <th scope="col" className="px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('admin.industryCatalogs.col.code', { defaultValue: 'Code' })}
                    </th>
                    <th scope="col" className="px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('admin.industryCatalogs.col.label', { defaultValue: 'Label' })}
                    </th>
                    <th scope="col" className="px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('admin.industryCatalogs.col.unit', { defaultValue: 'Unit' })}
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('admin.industryCatalogs.col.typicalRange', { defaultValue: 'Typical range' })}
                    </th>
                    <th scope="col" className="px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('admin.industryCatalogs.col.scope', { defaultValue: 'Scope' })}
                    </th>
                    <th scope="col" className="px-3 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.filter((r) => r.isActive).map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-3 font-mono text-xs text-ink">{row.code}</td>
                      <td className="px-3 py-3 text-ink">
                        {row.displayLabelEn}
                        {row.isFx && (
                          <span className="ms-2 rounded-full bg-sage/10 px-2 py-0.5 text-[10px] font-medium text-sage-ink">FX</span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-ink-muted">{row.unitLabel}</td>
                      <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-ink-muted">
                        {row.typicalLow && row.typicalHigh
                          ? `${parseFloat(row.typicalLow).toFixed(0)}–${parseFloat(row.typicalHigh).toFixed(0)}`
                          : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${row.tenantId ? 'bg-gold/10 text-gold' : 'bg-muted text-ink-muted'}`}>
                          {row.tenantId
                            ? t('admin.industryCatalogs.scope.tenant', { defaultValue: 'Tenant' })
                            : t('admin.industryCatalogs.scope.industry', { defaultValue: 'Industry' })}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(row)} className="rounded p-1 text-ink-muted hover:text-ink" aria-label="Edit">
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(t('admin.industryCatalogs.confirmDeactivate', { defaultValue: 'Deactivate this row?' }))) {
                                deactivateMutation.mutate(row.id);
                              }
                            }}
                            className="rounded p-1 text-ink-muted hover:text-terracotta"
                            aria-label="Deactivate"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Editor dialog */}
      <Dialog open={creating} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t('admin.industryCatalogs.benchmarks.edit', { defaultValue: 'Edit benchmark' })
                : t('admin.industryCatalogs.benchmarks.add', { defaultValue: 'Add benchmark' })}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <FormRow label="Code">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!!editing} />
            </FormRow>
            <FormRow label="Display label (EN)">
              <Input value={form.displayLabelEn} onChange={(e) => setForm({ ...form, displayLabelEn: e.target.value })} />
            </FormRow>
            <FormRow label="Display label (AR)">
              <Input value={form.displayLabelAr ?? ''} onChange={(e) => setForm({ ...form, displayLabelAr: e.target.value || null })} />
            </FormRow>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Unit label">
                <Input value={form.unitLabel} onChange={(e) => setForm({ ...form, unitLabel: e.target.value })} />
              </FormRow>
              <FormRow label="Volume unit">
                <Input value={form.volumeUnitLabel} onChange={(e) => setForm({ ...form, volumeUnitLabel: e.target.value })} />
              </FormRow>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Typical low">
                <Input
                  type="number"
                  step="0.01"
                  value={form.typicalLow ?? ''}
                  onChange={(e) => setForm({ ...form, typicalLow: e.target.value === '' ? null : parseFloat(e.target.value) })}
                />
              </FormRow>
              <FormRow label="Typical high">
                <Input
                  type="number"
                  step="0.01"
                  value={form.typicalHigh ?? ''}
                  onChange={(e) => setForm({ ...form, typicalHigh: e.target.value === '' ? null : parseFloat(e.target.value) })}
                />
              </FormRow>
            </div>
            <FormRow label="Kicker text">
              <Input value={form.kickerText ?? ''} onChange={(e) => setForm({ ...form, kickerText: e.target.value || null })} />
            </FormRow>
            <FormRow label="Sort order">
              <Input
                type="number"
                value={form.sortOrder ?? 100}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 100 })}
              />
            </FormRow>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.isFx ?? false}
                onChange={(e) => setForm({ ...form, isFx: e.target.checked })}
              />
              {t('admin.industryCatalogs.benchmarks.isFx', { defaultValue: 'FX benchmark (hidden from price column)' })}
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCreating(false); setEditing(null); }}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.code || !form.displayLabelEn}>
              {saveMutation.isPending ? t('common.saving', { defaultValue: 'Saving…' }) : t('common.save', { defaultValue: 'Save' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Cost components tab
// ─────────────────────────────────────────────────────────────
function emptyCostComponent(industryId: number): CostComponentInput {
  return {
    industryId,
    tenantId: null,
    code: '',
    displayLabelEn: '',
    displayLabelAr: null,
    sign: '-',
    isRevenue: false,
    sortOrder: 100,
    description: null,
  };
}

function CostComponentsTab({ industryId }: { industryId: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: rows, isLoading } = useQuery({
    queryKey: ['admin-cost-components', industryId],
    queryFn: () => industryCatalogService.listCostComponents(industryId),
    staleTime: 30_000,
  });

  const [editing, setEditing] = useState<CostComponentCatalogRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CostComponentInput>(emptyCostComponent(industryId));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) return industryCatalogService.updateCostComponent(editing.id, form);
      return industryCatalogService.createCostComponent(industryId, form);
    },
    onSuccess: () => {
      toast.success(t('common.saved', { defaultValue: 'Saved' }));
      void qc.invalidateQueries({ queryKey: ['admin-cost-components', industryId] });
      void qc.invalidateQueries({ queryKey: ['admin-industries'] });
      setEditing(null);
      setCreating(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => industryCatalogService.deactivateCostComponent(id),
    onSuccess: () => {
      toast.success(t('common.deactivated', { defaultValue: 'Deactivated' }));
      void qc.invalidateQueries({ queryKey: ['admin-cost-components', industryId] });
      void qc.invalidateQueries({ queryKey: ['admin-industries'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function openCreate() {
    setForm(emptyCostComponent(industryId));
    setEditing(null);
    setCreating(true);
  }

  function openEdit(row: CostComponentCatalogRow) {
    setForm({
      industryId: row.industryId,
      tenantId: row.tenantId,
      code: row.code,
      displayLabelEn: row.displayLabelEn,
      displayLabelAr: row.displayLabelAr,
      sign: row.sign,
      isRevenue: row.isRevenue,
      sortOrder: row.sortOrder,
      description: row.description,
    });
    setEditing(row);
    setCreating(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="me-1 h-4 w-4" aria-hidden="true" />
          {t('admin.industryCatalogs.costComponents.add', { defaultValue: 'Add cost component' })}
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-surface" aria-hidden="true" />
          ))}
        </div>
      )}

      {!isLoading && rows && rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface">
                  <tr className="text-left">
                    <th scope="col" className="px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('admin.industryCatalogs.col.sortOrder', { defaultValue: 'Order' })}
                    </th>
                    <th scope="col" className="px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('admin.industryCatalogs.col.code', { defaultValue: 'Code' })}
                    </th>
                    <th scope="col" className="px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('admin.industryCatalogs.col.label', { defaultValue: 'Label' })}
                    </th>
                    <th scope="col" className="px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('admin.industryCatalogs.col.sign', { defaultValue: 'Sign' })}
                    </th>
                    <th scope="col" className="px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('admin.industryCatalogs.col.scope', { defaultValue: 'Scope' })}
                    </th>
                    <th scope="col" className="px-3 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.filter((r) => r.isActive).map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-3 font-mono text-xs tabular-nums text-ink-muted">{row.sortOrder}</td>
                      <td className="px-3 py-3 font-mono text-xs text-ink">{row.code}</td>
                      <td className="px-3 py-3 text-ink">
                        {row.displayLabelEn}
                        {row.isRevenue && (
                          <span className="ms-2 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">Revenue</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${row.sign === '+' ? 'bg-success/10 text-success' : 'bg-terracotta/10 text-terracotta'}`}>
                          {row.sign}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${row.tenantId ? 'bg-gold/10 text-gold' : 'bg-muted text-ink-muted'}`}>
                          {row.tenantId
                            ? t('admin.industryCatalogs.scope.tenant', { defaultValue: 'Tenant' })
                            : t('admin.industryCatalogs.scope.industry', { defaultValue: 'Industry' })}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(row)} className="rounded p-1 text-ink-muted hover:text-ink" aria-label="Edit">
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(t('admin.industryCatalogs.confirmDeactivate', { defaultValue: 'Deactivate this row?' }))) {
                                deactivateMutation.mutate(row.id);
                              }
                            }}
                            className="rounded p-1 text-ink-muted hover:text-terracotta"
                            aria-label="Deactivate"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Editor dialog */}
      <Dialog open={creating} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t('admin.industryCatalogs.costComponents.edit', { defaultValue: 'Edit cost component' })
                : t('admin.industryCatalogs.costComponents.add', { defaultValue: 'Add cost component' })}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <FormRow label="Code">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!!editing} />
            </FormRow>
            <FormRow label="Display label (EN)">
              <Input value={form.displayLabelEn} onChange={(e) => setForm({ ...form, displayLabelEn: e.target.value })} />
            </FormRow>
            <FormRow label="Display label (AR)">
              <Input value={form.displayLabelAr ?? ''} onChange={(e) => setForm({ ...form, displayLabelAr: e.target.value || null })} />
            </FormRow>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Sign">
                <select
                  value={form.sign}
                  onChange={(e) => {
                    const sign = e.target.value as '+' | '-';
                    setForm({ ...form, sign, isRevenue: sign === '+' ? form.isRevenue : false });
                  }}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  <option value="+">+ (revenue / add)</option>
                  <option value="-">- (cost / subtract)</option>
                </select>
              </FormRow>
              <FormRow label="Sort order">
                <Input
                  type="number"
                  value={form.sortOrder ?? 100}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 100 })}
                />
              </FormRow>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.isRevenue ?? false}
                disabled={form.sign === '-'}
                onChange={(e) => setForm({ ...form, isRevenue: e.target.checked })}
              />
              {t('admin.industryCatalogs.costComponents.isRevenue', { defaultValue: 'Revenue (requires + sign)' })}
            </label>
            <FormRow label="Description">
              <textarea
                value={form.description ?? ''}
                onChange={(e) => setForm({ ...form, description: e.target.value || null })}
                rows={2}
                className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
              />
            </FormRow>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCreating(false); setEditing(null); }}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.code || !form.displayLabelEn}>
              {saveMutation.isPending ? t('common.saving', { defaultValue: 'Saving…' }) : t('common.save', { defaultValue: 'Save' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-ink-muted">
      <span>{label}</span>
      {children}
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// R-IL Phase G — Add tenant dialog. Industry is pre-selected from the
// parent page; Platform Admin enters slug + display name + name. On save
// the tenant is created tagged to this industry so its Index-Linked
// Contracts module has a catalog to render with.
// ─────────────────────────────────────────────────────────────
function AddTenantDialog({
  open,
  onClose,
  industryId,
  industryLabel,
}: {
  open: boolean;
  onClose: () => void;
  industryId: number;
  industryLabel: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateTenantInput>({
    slug: '',
    displayName: '',
    name: '',
    industryId,
    riskAppetite: 'standard',
  });

  // Reset form when dialog re-opens for a new industry context.
  function resetAndClose() {
    setForm({ slug: '', displayName: '', name: '', industryId, riskAppetite: 'standard' });
    onClose();
  }

  const createMutation = useMutation({
    mutationFn: () => adminTenantService.create(form),
    onSuccess: (result) => {
      toast.success(
        t('admin.industryCatalogs.tenant.created', {
          defaultValue: 'Tenant created: {{name}}',
          name: result.displayName,
        }),
      );
      void qc.invalidateQueries({ queryKey: ['admin-industries'] });
      resetAndClose();
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      const msg = e.response?.data?.error?.message ?? e.message ?? 'Failed to create tenant';
      toast.error(msg);
    },
  });

  // Auto-suggest slug from display name. Lowercase, replace non-alphanumeric
  // with hyphens, collapse consecutive hyphens, trim leading/trailing.
  function deriveSlug(label: string): string {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {t('admin.industryCatalogs.tenant.dialogTitle', {
              defaultValue: 'Add tenant',
            })}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="rounded-md border border-border bg-surface p-3 text-xs">
            <p className="text-ink-muted">
              {t('admin.industryCatalogs.tenant.industryLabel', {
                defaultValue: 'Industry',
              })}
            </p>
            <p className="mt-0.5 font-medium text-ink">{industryLabel}</p>
            <p className="mt-1 text-[11px] text-ink-subtle">
              {t('admin.industryCatalogs.tenant.industryNote', {
                defaultValue:
                  'The tenant inherits this industry’s pricing benchmarks and cost components.',
              })}
            </p>
          </div>
          <FormRow label={t('admin.industryCatalogs.tenant.displayName', { defaultValue: 'Display name' })}>
            <Input
              value={form.displayName}
              onChange={(e) => {
                const v = e.target.value;
                setForm({
                  ...form,
                  displayName: v,
                  name: form.name || v,
                  slug: form.slug || deriveSlug(v),
                });
              }}
              placeholder={t('admin.industryCatalogs.tenant.displayNamePlaceholder', {
                defaultValue: 'e.g. Acme Construction',
              })}
            />
          </FormRow>
          <FormRow label={t('admin.industryCatalogs.tenant.name', { defaultValue: 'Legal name' })}>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('admin.industryCatalogs.tenant.namePlaceholder', {
                defaultValue: 'Legal entity name (used in audit log + contract metadata)',
              })}
            />
          </FormRow>
          <FormRow label={t('admin.industryCatalogs.tenant.slug', { defaultValue: 'Slug' })}>
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="acme-construction"
            />
            <span className="text-[11px] text-ink-subtle">
              {t('admin.industryCatalogs.tenant.slugHelp', {
                defaultValue: 'Lowercase + hyphens. Used in URLs and exports.',
              })}
            </span>
          </FormRow>
          <FormRow label={t('admin.industryCatalogs.tenant.riskAppetite', { defaultValue: 'Risk appetite' })}>
            <select
              value={form.riskAppetite ?? 'standard'}
              onChange={(e) => setForm({ ...form, riskAppetite: e.target.value as 'low' | 'standard' | 'aggressive' })}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="standard">Standard</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </FormRow>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={resetAndClose} disabled={createMutation.isPending}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !form.slug || !form.displayName || !form.name}
          >
            {createMutation.isPending
              ? t('common.saving', { defaultValue: 'Saving…' })
              : t('admin.industryCatalogs.tenant.create', { defaultValue: 'Create tenant' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
