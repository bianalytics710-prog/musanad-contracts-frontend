/**
 * RegulatoryRadarDashboard (S6) — primary dashboard.
 *
 * Mode: REGENERATE — Lovable's `regulations.radar.tsx` (539L route file)
 * was tightly bound to non-existent supabase tables. We rebuild around
 * the live M5 endpoints:
 *
 *   - GET /api/v1/regulatory-updates (list filter)
 *   - GET /api/v1/regulatory-updates/:id (detail panel)
 *   - GET /api/v1/regulatory-impacts?regulatoryUpdateId= (impacted contracts)
 *
 * The radar visualization itself is HARDENED from Lovable
 * RegulatoryRadar.tsx → RegulatoryRadarChart (no supabase coupling).
 *
 * AC mapping:
 *   AC-S6-01..04 — radar scatter; quadrant by impact_category.
 *   AC-S6-05..07 — "AI explain" / "AI amendment" actions consume M4
 *                  endpoints (POST /api/v1/ai/regulatory-impact +
 *                  /api/v1/ai/regulatory-impact-summary). M5 wires the
 *                  sampleContracts array (closes M4-FE-OI-3).
 *   AC-S6-08 — severity filter; AC-S6-09 — date-range filter.
 *   AC-S6-10 — search debounced 300ms (T10).
 *   AC-S6-11 — contract_recipient denied by BE (403).
 *
 * 13-checklist:
 *   T1/T2 — service + React Query hooks.
 *   T3 — every label uses t().
 *   T4 — explicit loading / error / empty branches.
 *   T6 — keyboard-navigable selection on the radar; aria-live region for
 *        the detail panel.
 *   T10 — useDebounce(300) on search.
 *   T11 — wrapped at the route level.
 *   T12 — formatDate.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Plus,
  RefreshCw,
  Search,
  AlertCircle,
  Radar as RadarIcon,
  Zap,
  Clock,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { translateApiError } from "@/lib/translate-api-error";
import { useDebounce } from "@/hooks/useDebounce";
import { selectHasPermission, useAuthStore } from "@/store/auth.store";
import {
  useImpactCategoryList,
  useRegulatoryUpdateList,
} from "@/features/regulatory/hooks/useRegulatory";
import {
  REGULATORY_SEVERITY_VALUES,
  type ImpactCategory,
  type RegulatoryUpdateListItem,
  type RegulatoryUpdateListQuery,
  type RegulatorySeverity,
} from "@/types/entities/regulatory.types";
import {
  RegulatoryRadarChart,
  type RadarCategory,
  type RadarDot,
} from "./RegulatoryRadarChart";
import { RegulatoryUpdateDetailPanel } from "./RegulatoryUpdateDetailPanel";
import { RegulatoryUpdateCreateForm } from "./RegulatoryUpdateCreateForm";

const PAGE_SIZE = 100;

function toRadarDots(items: RegulatoryUpdateListItem[]): RadarDot[] {
  return items.map((u) => ({
    id: String(u.id),
    regulator: u.regulator.code,
    title: u.titleEn,
    publishedDate: u.publishedDate,
    severity: u.severity,
    impactCount: 0, // populated downstream when detail loads — radar dot size is severity-driven
    categoryId: u.category ? String(u.category.id) : null,
  }));
}

function toRadarCategories(categories: ImpactCategory[]): RadarCategory[] {
  return categories
    .filter((c) => c.active)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((c) => ({
      id: String(c.id),
      key: c.key,
      nameEn: c.nameEn,
      nameAr: c.nameAr,
      colour: c.colour,
    }));
}

export function RegulatoryRadarDashboard() {
  const { t } = useTranslation();
  const canManage = useAuthStore(selectHasPermission("regulations.manage"));

  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<RegulatorySeverity | "">("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  // Reset selection when filters change (could deselect an unmounted dot)
  useEffect(() => {
    setSelectedId(undefined);
  }, [debouncedSearch, severity, effectiveFrom, effectiveTo]);

  const query: RegulatoryUpdateListQuery = useMemo(
    () => ({
      page: 1,
      limit: PAGE_SIZE,
      severity: severity || undefined,
      effectiveFrom: effectiveFrom || undefined,
      effectiveTo: effectiveTo || undefined,
    }),
    [severity, effectiveFrom, effectiveTo],
  );

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useRegulatoryUpdateList(query);

  const { data: categoriesData } = useImpactCategoryList();

  // Filter list by search client-side (the BE endpoint doesn't expose a
  // text search param for regulatory_updates — keep filter local).
  const filteredItems = useMemo<RegulatoryUpdateListItem[]>(() => {
    const all = data?.data ?? [];
    if (!debouncedSearch.trim()) return all;
    const needle = debouncedSearch.toLowerCase();
    return all.filter(
      (u) =>
        u.titleEn.toLowerCase().includes(needle) ||
        (u.titleAr ?? "").toLowerCase().includes(needle) ||
        u.regulator.code.toLowerCase().includes(needle) ||
        (u.referenceNumber ?? "").toLowerCase().includes(needle),
    );
  }, [data, debouncedSearch]);

  const radarDots = useMemo(() => toRadarDots(filteredItems), [filteredItems]);
  const radarCategories = useMemo(
    () => toRadarCategories(categoriesData?.data ?? []),
    [categoriesData],
  );

  const stats = useMemo(() => {
    const all = data?.data ?? [];
    const critical = all.filter((u) => u.severity === "critical").length;
    const high = all.filter((u) => u.severity === "high").length;
    const next30 = all.filter((u) => {
      if (!u.effectiveDate) return false;
      const ed = new Date(u.effectiveDate).getTime();
      const days = (ed - Date.now()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 30;
    }).length;
    return { total: all.length, critical, high, next30 };
  }, [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] space-y-4 p-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("regulatory.radar.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("regulatory.radar.subtitle", {
              count: filteredItems.length,
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label={t("common.refresh", { defaultValue: "Refresh" })}
            title={t("common.refresh", { defaultValue: "Refresh" })}
          >
            {/* L62 — rename "Retry" → "Refresh"; "Retry" reads as a failure
                affordance even though the call succeeded. */}
            <RefreshCw className="h-4 w-4" />
            {t("common.refresh", { defaultValue: "Refresh" })}
          </Button>
          {canManage && (
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {t("regulatory.regulatoryUpdate.list.createButton")}
            </Button>
          )}
        </div>
      </header>

      {/* Stat strip */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <RadarIcon className="h-4 w-4 text-gold" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("regulatory.radar.stats.total", { defaultValue: "Tracked updates" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {stats.total}
          </p>
        </div>
        <div className={`rounded-lg border border-border bg-card p-4 ${stats.critical > 0 ? "border-l-2 border-l-terracotta" : ""}`}>
          <div className="flex items-center gap-2">
            <Zap className={`h-4 w-4 ${stats.critical > 0 ? "text-terracotta" : "text-ink-subtle"}`} />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("regulatory.radar.stats.critical", { defaultValue: "Critical" })}
            </p>
          </div>
          <p className={`mt-1.5 font-mono text-2xl font-semibold ${stats.critical > 0 ? "text-terracotta" : "text-ink"}`}>
            {stats.critical}
          </p>
        </div>
        <div className={`rounded-lg border border-border bg-card p-4 ${stats.high > 0 ? "border-l-2 border-l-amber" : ""}`}>
          <div className="flex items-center gap-2">
            <Shield className={`h-4 w-4 ${stats.high > 0 ? "text-amber-ink" : "text-ink-subtle"}`} />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("regulatory.radar.stats.high", { defaultValue: "High" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {stats.high}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-ink-subtle" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("regulatory.radar.stats.next30", { defaultValue: "Effective in 30 days" })}
            </p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
            {stats.next30}
          </p>
        </div>
      </section>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("regulatory.radar.searchPlaceholder")}
                aria-label={t("regulatory.radar.searchLabel")}
                className="ps-9"
              />
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="sr-only">
                {t("regulatory.regulatoryUpdate.fields.severity")}
              </span>
              <select
                aria-label={t("regulatory.regulatoryUpdate.fields.severity")}
                value={severity}
                onChange={(e) =>
                  setSeverity(e.target.value as RegulatorySeverity | "")
                }
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{t("regulatory.radar.allSeverities")}</option>
                {REGULATORY_SEVERITY_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {t(`regulatory.regulatoryUpdate.severity.${s}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-ink-muted">
                {t("regulatory.radar.effectiveFrom")}
              </span>
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                aria-label={t("regulatory.radar.effectiveFrom")}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-ink-muted">
                {t("regulatory.radar.effectiveTo")}
              </span>
              <Input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                aria-label={t("regulatory.radar.effectiveTo")}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardContent className="pt-6">
            {isError ? (
              <div
                role="alert"
                className="rounded-md border border-terracotta/30 bg-terracotta-tint/30 p-4 text-sm text-terracotta-ink"
              >
                <div className="flex items-center gap-2 font-medium">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  {translateApiError(error, t)}
                </div>
              </div>
            ) : isLoading ? (
              <div
                role="status"
                aria-busy="true"
                className="aspect-square w-full max-w-[600px] animate-pulse rounded-full bg-muted/30"
              />
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-ink-muted">
                <p>{t("regulatory.radar.empty")}</p>
              </div>
            ) : (
              <div className="aspect-square w-full max-w-[600px]">
                <RegulatoryRadarChart
                  dots={radarDots}
                  categories={radarCategories}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="min-h-[400px]">
          {selectedId !== undefined ? (
            <RegulatoryUpdateDetailPanel
              regulatoryUpdateId={Number(selectedId)}
              onClose={() => setSelectedId(undefined)}
            />
          ) : (
            <Card className="h-full">
              <CardContent className="flex h-full items-center justify-center pt-6 text-sm text-ink-muted">
                {t("regulatory.radar.selectHint")}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <RegulatoryUpdateCreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </motion.div>
  );
}
