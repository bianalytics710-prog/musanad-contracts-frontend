import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Languages } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { templatesService, type TemplateListItem } from "@/services/api/m_parity.service";

interface TemplatePreviewDialogProps {
  template: TemplateListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLACEHOLDER_RE = /\{\{[a-zA-Z0-9_]+\}\}/g;

function extractPlaceholders(...sources: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const src of sources) {
    if (!src) continue;
    const matches = src.match(PLACEHOLDER_RE);
    if (!matches) continue;
    for (const m of matches) set.add(m);
  }
  return [...set].sort();
}

function HighlightedBody({ text, dir = "ltr" }: { text: string; dir?: "ltr" | "rtl" }) {
  const parts = useMemo(() => {
    const segments: Array<{ kind: "text" | "ph"; value: string }> = [];
    let cursor = 0;
    for (const match of text.matchAll(PLACEHOLDER_RE)) {
      const idx = match.index ?? 0;
      if (idx > cursor) segments.push({ kind: "text", value: text.slice(cursor, idx) });
      segments.push({ kind: "ph", value: match[0] });
      cursor = idx + match[0].length;
    }
    if (cursor < text.length) segments.push({ kind: "text", value: text.slice(cursor) });
    return segments;
  }, [text]);

  return (
    <pre
      dir={dir}
      className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-surface p-3 text-xs text-ink"
    >
      {parts.map((p, i) =>
        p.kind === "ph" ? (
          <span
            key={i}
            className="rounded bg-gold/15 px-1 font-mono text-[11px] text-gold"
          >
            {p.value}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </pre>
  );
}

export function TemplatePreviewDialog({
  template,
  open,
  onOpenChange,
}: TemplatePreviewDialogProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["template", template?.id],
    queryFn: () => templatesService.getById(template!.id),
    enabled: open && !!template,
    staleTime: 60_000,
  });

  const placeholders = useMemo(
    () => extractPlaceholders(data?.bodyEn, data?.bodyAr),
    [data?.bodyEn, data?.bodyAr],
  );

  const title = template ? (isAr && template.nameAr ? template.nameAr : template.nameEn) : "";
  const description = template
    ? isAr && template.descriptionAr
      ? template.descriptionAr
      : template.descriptionEn
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          {template && (
            <DialogDescription className="flex flex-wrap gap-1.5 pt-1">
              <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                {template.contractType.replace(/_/g, " ")}
              </span>
              {template.regulatoryTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] text-ink-subtle"
                >
                  {tag.replace(/_/g, " ")}
                </span>
              ))}
              {template.language === "bilingual" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-gold/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gold">
                  <Languages className="h-3 w-3" />
                  AR · EN
                </span>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {description && (
          <section>
            <h4 className="mb-1 text-xs font-semibold text-ink">
              {t("templates.preview.description", { defaultValue: "Description" })}
            </h4>
            <p className="text-sm text-ink-muted" dir={isAr && template?.descriptionAr ? "rtl" : "ltr"}>
              {description}
            </p>
          </section>
        )}

        {isLoading && (
          <div className="space-y-3">
            <div className="h-6 w-32 animate-pulse rounded-md bg-surface" />
            <div className="h-32 animate-pulse rounded-md bg-surface" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive">
            {t("templates.preview.loadError", { defaultValue: "Failed to load template body." })}
          </p>
        )}

        {data && (
          <>
            <section>
              <h4 className="mb-2 text-xs font-semibold text-ink">
                {t("templates.preview.placeholders", {
                  defaultValue: "Placeholders ({{count}})",
                  count: placeholders.length,
                })}
              </h4>
              {placeholders.length === 0 ? (
                <p className="text-xs text-ink-subtle">
                  {t("templates.preview.noPlaceholders", {
                    defaultValue: "This template has no placeholder tokens.",
                  })}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {placeholders.map((ph) => (
                    <span
                      key={ph}
                      className="rounded bg-gold/10 px-1.5 py-0.5 font-mono text-[11px] text-gold"
                    >
                      {ph}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h4 className="mb-2 text-xs font-semibold text-ink">
                {t("templates.preview.bodyPreview", { defaultValue: "Body preview" })}
              </h4>
              <div className="grid gap-3 lg:grid-cols-2">
                {data.bodyEn && (
                  <div>
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("templates.preview.english", { defaultValue: "English" })}
                    </p>
                    <HighlightedBody text={data.bodyEn} />
                  </div>
                )}
                {data.bodyAr && (
                  <div>
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t("templates.preview.arabic", { defaultValue: "Arabic" })}
                    </p>
                    <HighlightedBody text={data.bodyAr} dir="rtl" />
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close", { defaultValue: "Close" })}
          </Button>
          {template && (
            <Link
              to="/app/contracts/compose"
              search={{ template_id: template.id }}
              onClick={() => onOpenChange(false)}
            >
              <Button type="button" className="bg-gold text-ink hover:bg-gold-hover">
                {t("templates.useTemplate", { defaultValue: "Use this template" })}
                <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
              </Button>
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
