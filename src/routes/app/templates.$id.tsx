import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft, FileStack, Languages } from "lucide-react";
import { templatesService } from "@/services/api/m_parity.service";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

export const Route = createFileRoute("/app/templates/$id")({
  component: () => (
    <ErrorBoundary>
      <TemplateDetailView />
    </ErrorBoundary>
  ),
});

function TemplateDetailView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const { id } = Route.useParams();
  const tplId = Number(id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["template", tplId],
    queryFn: () => templatesService.getById(tplId),
    enabled: Number.isInteger(tplId),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1024px] space-y-4 p-6">
        <div className="h-8 animate-pulse rounded-md bg-surface" />
        <div className="h-32 animate-pulse rounded-lg bg-surface" />
        <div className="h-72 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-md p-12 text-center">
        <h1 className="text-base font-semibold text-ink">
          {t("templates.notFound", { defaultValue: "Template not found" })}
        </h1>
        <Link
          to="/app/templates"
          className="mt-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t("templates.backToList", { defaultValue: "Back to templates" })}
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1024px] space-y-4 p-6"
    >
      <Link
        to="/app/templates"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-gold"
      >
        <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
        {t("templates.backToList", { defaultValue: "Back to templates" })}
      </Link>

      <section className="rounded-lg border border-border border-l-4 border-l-gold bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                {data.contractType.replace(/_/g, " ")}
              </span>
              {data.language === "bilingual" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-gold/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gold">
                  <Languages className="h-3 w-3" />
                  AR · EN
                </span>
              )}
              <span className="font-mono text-[11px] text-ink-subtle">
                {data.usageCount}× used
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-ink">
              {isAr && data.nameAr ? data.nameAr : data.nameEn}
            </h1>
            {data.descriptionEn && !isAr && (
              <p className="mt-1 text-sm text-ink-muted">{data.descriptionEn}</p>
            )}
            {data.descriptionAr && isAr && (
              <p className="mt-1 text-sm text-ink-muted" dir="rtl">
                {data.descriptionAr}
              </p>
            )}
          </div>
          <FileStack className="h-10 w-10 text-gold" />
        </div>
        {data.regulatoryTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.regulatoryTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] text-ink-subtle"
              >
                {tag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </section>

      {data.bodyEn && !isAr && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            {t("templates.bodyEn", { defaultValue: "Template body (EN)" })}
          </h2>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-surface p-3 text-xs text-ink">
            {data.bodyEn}
          </pre>
        </section>
      )}
      {data.bodyAr && isAr && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            {t("templates.bodyAr", { defaultValue: "Template body (AR)" })}
          </h2>
          <pre
            className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-surface p-3 text-xs text-ink"
            dir="rtl"
          >
            {data.bodyAr}
          </pre>
        </section>
      )}
    </motion.div>
  );
}
