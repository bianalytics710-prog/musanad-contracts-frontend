/**
 * RegulationDetailDrawer (S2) — full regulation detail incl. supersession chain.
 *
 * Mode: regenerate. Lovable's `regulations.index.tsx` rendered detail inline as
 * a side panel (1282L route file), heavily supabase-coupled. The v2.6
 * implementation surfaces fn_regulation_get_by_id (incl. recursive
 * supersededBy[] chain — AC-S2-02) in a focused dialog.
 *
 * AC mapping:
 *   AC-S2-01 — full payload incl. summaryEn/Ar, sourceUrl, tags, supersededBy.
 *   AC-S2-02 — supersededBy chain max 5 hops; rendered linearly.
 *   AC-S2-03 — 404 when id not found / soft-deleted; surfaced via error state.
 *
 * 13-checklist:
 *   T4 — explicit loading / error branches.
 *   T6 — role=dialog, aria-modal, focus trap, ESC closes.
 *   T7 — strict TS.
 *   T12 — formatDate for effectiveDate.
 *   T13 — no console.log of payload.
 */
import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { translateApiError } from "@/lib/translate-api-error";
import { formatDate } from "@/utils/datetime";
import { useRegulationById } from "@/features/regulatory/hooks/useRegulatory";

interface Props {
  regulationId: number;
  open: boolean;
  onClose: () => void;
}

export function RegulationDetailDrawer({
  regulationId,
  open,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, error } = useRegulationById(
    open ? regulationId : null,
  );

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-semibold text-ink">
              {data ? data.titleEn : t("regulatory.regulation.detail.loading")}
            </h2>
            {data && (
              <p className="mt-1 font-mono text-xs text-ink-muted">
                {data.referenceCode}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isError ? (
            <div
              role="alert"
              className="rounded-md border border-terracotta/30 bg-terracotta-tint/30 p-4 text-sm text-terracotta-ink"
            >
              {translateApiError(error, t)}
            </div>
          ) : isLoading || !data ? (
            <div role="status" aria-busy="true" className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 w-full animate-pulse rounded-md bg-muted/30"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Headline */}
              <section className="space-y-2">
                {data.titleAr && (
                  <p
                    dir="rtl"
                    className="text-base font-medium text-ink"
                    lang="ar"
                  >
                    {data.titleAr}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <Badge>
                    {t(
                      `regulatory.regulation.regulationType.${data.regulationType}`,
                    )}
                  </Badge>
                  {data.jurisdiction && (
                    <Badge>
                      {t(
                        `regulatory.regulation.jurisdiction.${data.jurisdiction}`,
                      )}
                    </Badge>
                  )}
                  <Badge>
                    {t(`regulatory.regulation.status.${data.status}`)}
                  </Badge>
                </div>
              </section>

              {/* Issuer */}
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {t("regulatory.regulation.fields.issuer")}
                </h3>
                <p className="text-sm text-ink">
                  <span className="font-mono text-xs text-ink-muted">
                    {data.issuer.code}
                  </span>{" "}
                  · {data.issuer.nameEn}
                  {data.issuer.nameAr ? (
                    <span lang="ar" dir="rtl" className="ms-2 text-ink-muted">
                      ({data.issuer.nameAr})
                    </span>
                  ) : null}
                </p>
              </section>

              {/* Effective date */}
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {t("regulatory.regulation.fields.effectiveDate")}
                </h3>
                <p className="font-mono text-sm">
                  {formatDate(data.effectiveDate)}
                </p>
              </section>

              {/* Summaries */}
              {(data.summaryEn || data.summaryAr) && (
                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {t("regulatory.regulation.fields.summary")}
                  </h3>
                  {data.summaryEn && (
                    <p className="whitespace-pre-wrap text-sm text-ink">
                      {data.summaryEn}
                    </p>
                  )}
                  {data.summaryAr && (
                    <p
                      dir="rtl"
                      lang="ar"
                      className="mt-2 whitespace-pre-wrap text-sm text-ink"
                    >
                      {data.summaryAr}
                    </p>
                  )}
                </section>
              )}

              {/* Tags */}
              {data.tags.length > 0 && (
                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {t("regulatory.regulation.fields.tags")}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {data.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-ink-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Source URL */}
              {data.sourceUrl && (
                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {t("regulatory.regulation.fields.sourceUrl")}
                  </h3>
                  <a
                    href={data.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-gold hover:underline"
                  >
                    {data.sourceUrl}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </section>
              )}

              {/* Supersession chain (AC-S2-02) */}
              {data.supersededBy.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {t("regulatory.regulation.detail.supersededByChain")}
                  </h3>
                  <ol className="space-y-2 border-s-2 border-amber/40 ps-4">
                    {data.supersededBy.map((item) => (
                      <li key={item.id} className="text-sm">
                        <div className="font-mono text-xs text-ink-muted">
                          {t("regulatory.regulation.detail.depthLabel", {
                            depth: item.depth,
                          })}{" "}
                          · {item.referenceCode}
                        </div>
                        <p className="text-ink">{item.titleEn}</p>
                        {item.titleAr && (
                          <p dir="rtl" lang="ar" className="text-ink-muted">
                            {item.titleAr}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium text-ink">
      {children}
    </span>
  );
}
