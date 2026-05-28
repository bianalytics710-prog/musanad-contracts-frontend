/**
 * /app/admin/sources — OSINT source registry list (S9).
 *
 * Tile-per-source list with health badges, filterable by kind / state /
 * search. Add button opens SourceFormDialog. Permission gate: source.read
 * (platform_admin / executive). Sidebar visibility is governed by the
 * source.read permission via the existing role mapping.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { DownloadCloud, Plus, RefreshCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { adminSourcesService } from "@/services/api/admin-sources.service";
import { useDebounce } from "@/hooks/useDebounce";
import { translateApiError } from "@/lib/translate-api-error";
import { SourceTile } from "@/components/sources/SourceTile";
import { SourceFormDialog } from "@/components/sources/SourceFormDialog";
import { SourceHealthMonitor } from "@/components/sources/SourceHealthMonitor";
import type {
  HealthState,
  SourceKind,
} from "@/types/entities/osint.types";

export const Route = createFileRoute("/app/admin/sources/")({
  component: () => (
    <ErrorBoundary>
      <SourceListView />
    </ErrorBoundary>
  ),
});

const KIND_OPTIONS: SourceKind[] = [
  "sanctions",
  "news",
  "weather",
  "commodity",
  "fx",
  "social",
  "regulatory",
  "internal",
];

const STATE_OPTIONS: HealthState[] = [
  "healthy",
  "degraded",
  "failing",
  "unauthorised",
];

function SourceListView() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<SourceKind | "">("");
  const [state, setState] = useState<HealthState | "">("");
  const [search, setSearch] = useState<string>("");
  const [showAdd, setShowAdd] = useState<boolean>(false);
  const debouncedSearch = useDebounce(search, 300);

  const params = useMemo(
    () => ({
      kind: kind || undefined,
      state: state || undefined,
      search: debouncedSearch || undefined,
      limit: 100,
    }),
    [kind, state, debouncedSearch],
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-sources", params],
    queryFn: () => adminSourcesService.list(params),
    staleTime: 30_000,
  });

  const sources = data?.data ?? [];
  const total = data?.pagination.total ?? sources.length;

  const pullNow = useMutation({
    mutationFn: () => adminSourcesService.pullNow(),
    onSuccess: (res) => {
      toast.success(
        t("admin.sources.pullNow.done", {
          defaultValue:
            "Pull complete — {{inserted}} new signal(s) from {{processed}} source(s).",
          inserted: res.inserted,
          processed: res.processed,
        }),
      );
      void refetch();
    },
    onError: (err: unknown) =>
      toast.error(translateApiError(err, t, "admin.sources.pullNow.failed")),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("admin.sources.title", { defaultValue: "Sources" })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("admin.sources.subtitle", {
              defaultValue: "Manage external OSINT data sources.",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => pullNow.mutate()}
            disabled={pullNow.isPending}
          >
            <DownloadCloud className="me-2 h-4 w-4" />
            {pullNow.isPending
              ? t("admin.sources.pullNow.running", { defaultValue: "Pulling…" })
              : t("admin.sources.pullNow.button", { defaultValue: "Pull now" })}
          </Button>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t("admin.sources.actions.add", { defaultValue: "Add source" })}
          </Button>
        </div>
      </header>

      <SourceHealthMonitor variant="compact" />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <div className="space-y-1">
          <Label
            htmlFor="src-filter-kind"
            className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
          >
            {t("admin.sources.filters.kind", { defaultValue: "Kind" })}
          </Label>
          <select
            id="src-filter-kind"
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as SourceKind | "")}
          >
            <option value="">
              {t("admin.sources.filter.kind.all", { defaultValue: "All" })}
            </option>
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {t(`admin.sources.kind.${k}`, { defaultValue: k })}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label
            htmlFor="src-filter-state"
            className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
          >
            {t("admin.sources.filters.state", { defaultValue: "Health" })}
          </Label>
          <select
            id="src-filter-state"
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
            value={state}
            onChange={(e) => setState(e.target.value as HealthState | "")}
          >
            <option value="">
              {t("admin.sources.filter.state.all", { defaultValue: "All" })}
            </option>
            {STATE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`admin.sources.health.state.${s}`, { defaultValue: s })}
              </option>
            ))}
          </select>
        </div>
        <div className="relative min-w-[220px] flex-1 space-y-1">
          <Label
            htmlFor="src-filter-search"
            className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
          >
            {t("admin.sources.filters.search", { defaultValue: "Search" })}
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input
              id="src-filter-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.sources.filter.search.placeholder", {
                defaultValue: "Search by source ID or display name…",
              })}
              className="ps-9"
            />
          </div>
        </div>
        <div className="ms-auto flex items-end">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("admin.sources.totalLabel", {
              defaultValue: "Total",
            })}{": "}
            <span className="font-semibold text-ink">{total}</span>
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-lg bg-surface"
              aria-hidden
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-terracotta/40 bg-terracotta/5 p-6 text-center">
          <p className="text-sm text-terracotta">
            {translateApiError(error, t, "admin.sources.error.fetch")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => refetch()}
          >
            <RefreshCcw className="me-2 h-3.5 w-3.5" />
            {t("admin.sources.error.retry", { defaultValue: "Retry" })}
          </Button>
        </div>
      ) : sources.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm font-medium text-ink">
            {t("admin.sources.empty.title", {
              defaultValue: "No sources configured",
            })}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {t("admin.sources.empty.body", {
              defaultValue: "Add your first OSINT source to start ingesting signals.",
            })}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="me-2 h-3.5 w-3.5" />
            {t("admin.sources.actions.add", { defaultValue: "Add source" })}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((s) => (
            <SourceTile key={s.id} source={s} />
          ))}
        </div>
      )}

      {showAdd ? (
        <SourceFormDialog onClose={() => setShowAdd(false)} />
      ) : null}
    </motion.div>
  );
}
