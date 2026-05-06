import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft, Quote } from "lucide-react";
import { clausesService } from "@/services/api/m_parity.service";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

export const Route = createFileRoute("/app/clauses/$id")({
  component: () => (
    <ErrorBoundary>
      <ClauseDetailView />
    </ErrorBoundary>
  ),
});

const variantTone: Record<string, string> = {
  standard: "bg-sage/15 text-sage",
  alternative: "bg-amber/15 text-amber-ink",
  fallback: "bg-terracotta/15 text-terracotta",
};

function ClauseDetailView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const { id } = Route.useParams();
  const cid = Number(id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["clause", cid],
    queryFn: () => clausesService.getById(cid),
    enabled: Number.isInteger(cid),
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
          {t("clauses.notFound", { defaultValue: "Clause not found" })}
        </h1>
        <Link
          to="/app/clauses"
          className="mt-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t("clauses.backToList", { defaultValue: "Back to clauses" })}
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
        to="/app/clauses"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-gold"
      >
        <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
        {t("clauses.backToList", { defaultValue: "Back to clauses" })}
      </Link>

      <section className="rounded-lg border border-border border-l-4 border-l-gold bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                {data.category.replace(/_/g, " ")}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                  variantTone[data.variant] ?? ""
                }`}
              >
                {data.variant}
              </span>
              <span className="font-mono text-[11px] text-ink-subtle">
                {data.usageCount}× used
              </span>
            </div>
            <h1 className="mt-2 text-xl font-semibold text-ink">
              {isAr && data.titleAr ? data.titleAr : data.titleEn}
            </h1>
          </div>
          <Quote className="h-10 w-10 text-gold" />
        </div>
        {data.regulatoryRefs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.regulatoryRefs.map((r) => (
              <span
                key={r}
                className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] text-ink-subtle"
              >
                {r.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold text-ink">
          {t("clauses.body", { defaultValue: "Clause body" })}
        </h2>
        <pre className="whitespace-pre-wrap rounded-md bg-surface p-3 text-xs text-ink">
          {isAr && data.bodyAr ? data.bodyAr : data.bodyEn}
        </pre>
      </section>

      {(data.legalCommentaryEn || data.legalCommentaryAr) && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            {t("clauses.commentary", { defaultValue: "Legal commentary" })}
          </h2>
          <p className="text-sm text-ink-muted">
            {isAr && data.legalCommentaryAr
              ? data.legalCommentaryAr
              : data.legalCommentaryEn}
          </p>
        </section>
      )}
    </motion.div>
  );
}
