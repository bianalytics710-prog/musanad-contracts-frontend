import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import {
  useTemplateDetail,
  useDeleteTemplate,
} from "@/features/templates/hooks/useTemplates";
import { ConfirmDialog } from "@/features/imports/components/ConfirmDialog";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import type { TemplatePlaceholderKind } from "@/services/api/m_parity.service";

export const Route = createFileRoute("/app/templates/$id/")({
  component: () => (
    <ErrorBoundary>
      <TemplateDetailView />
    </ErrorBoundary>
  ),
});

const PLACEHOLDER_KIND_BADGE: Record<TemplatePlaceholderKind, string> = {
  party: "bg-gold/10 text-gold",
  date: "bg-sage/20 text-sage-ink",
  currency: "bg-amber-tint text-amber-ink",
  number: "bg-surface text-ink-muted",
  text: "bg-surface text-ink-subtle",
};

function TemplateDetailView() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const { id } = Route.useParams();
  const tplId = Number(id);
  const navigate = useNavigate();
  const canEdit = useAuthStore(selectHasPermission("contract.edit"));

  const { data, isLoading, isError } = useTemplateDetail(
    Number.isInteger(tplId) ? tplId : null,
  );
  const deleteMutation = useDeleteTemplate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Build a regex once to highlight every {{token}} occurrence in either body.
  const tokenRegex = useMemo(
    () => /(\{\{[a-z][a-z0-9_]*\}\})/g,
    [],
  );

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1280px] space-y-4 p-6">
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

  const displayName = isAr && data.nameAr ? data.nameAr : data.nameEn;
  const displayDescription =
    isAr && data.descriptionAr ? data.descriptionAr : data.descriptionEn;

  const onDeleteConfirmed = async () => {
    try {
      await deleteMutation.mutateAsync(data.id);
      setConfirmDelete(false);
      void navigate({ to: "/app/templates" });
    } catch {
      // Toast already raised by hook.
    }
  };

  const useTemplate = () =>
    void navigate({
      to: "/app/contracts/compose",
      search: { template_id: data.id } as unknown as Record<string, never>,
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <Link
        to="/app/templates"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-gold"
      >
        <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
        {t("templates.backToList", { defaultValue: "Back to templates" })}
      </Link>

      <header className="space-y-3">
        <div className="font-mono text-xs uppercase tracking-wider text-ink-subtle">
          {t("templates.kicker", { defaultValue: "Template library" })}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {displayName}
          </h1>
          <div className="flex items-center gap-2">
            {canEdit && (
              <>
                <Link
                  to="/app/templates/$id/edit"
                  params={{ id: String(data.id) }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-ink transition-colors hover:bg-surface"
                >
                  <Pencil className="h-4 w-4" />
                  {t("templates.actions.edit", { defaultValue: "Edit" })}
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("templates.actions.delete", { defaultValue: "Delete" })}
                </Button>
              </>
            )}
            <Button onClick={useTemplate}>
              <Sparkles className="h-4 w-4" />
              {t("templates.actions.use", { defaultValue: "Use this template" })}
            </Button>
          </div>
        </div>

        {/* Chips row matching the screenshots */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-gold/15 px-3 py-1 text-xs font-medium text-gold">
            {data.contractType.replace(/_/g, " ")}
          </span>
          {data.regulatoryReference && (
            <span className="inline-flex items-center rounded-full bg-amber-tint px-3 py-1 text-xs font-medium text-amber-ink">
              {data.regulatoryReference}
            </span>
          )}
          {data.regulatoryTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-surface px-3 py-1 text-xs text-ink-muted"
            >
              {tag}
            </span>
          ))}
          {data.language === "bilingual" && (
            <span className="inline-flex items-center rounded-full bg-sage-tint px-3 py-1 text-xs font-medium text-sage-ink">
              {t("templates.bilingual", { defaultValue: "Bilingual" })}
            </span>
          )}
          <span className="font-mono text-[11px] text-ink-subtle">
            {t("templates.usedTimes", {
              defaultValue: "{{count}}× used",
              count: data.usageCount,
            })}
          </span>
        </div>
      </header>

      {/* Description */}
      {displayDescription && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t("templates.descriptionKicker", { defaultValue: "Description" })}
            </div>
            <p
              className="text-sm text-ink"
              dir={isAr && data.descriptionAr ? "rtl" : "ltr"}
            >
              {displayDescription}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Placeholders grid */}
      {data.placeholders.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t("templates.placeholdersKicker", {
                defaultValue: "Placeholders ({{count}})",
                count: data.placeholders.length,
              })}
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {data.placeholders.map((p) => (
                <li
                  key={p.key}
                  className={
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs " +
                    PLACEHOLDER_KIND_BADGE[p.kind]
                  }
                  title={
                    (isAr && p.labelAr ? p.labelAr : p.labelEn) +
                    " · " +
                    p.kind +
                    (p.required ? " · required" : "")
                  }
                >
                  {"{{" + p.key + "}}"}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Body preview — bilingual side-by-side when both present */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("templates.bodyPreviewKicker", { defaultValue: "Body preview" })}
          </div>
          {data.bodyEn && data.bodyAr ? (
            <div className="grid gap-4 md:grid-cols-2">
              <BodyColumn
                body={data.bodyEn}
                tokenRegex={tokenRegex}
                dir="ltr"
                label="EN"
              />
              <BodyColumn
                body={data.bodyAr}
                tokenRegex={tokenRegex}
                dir="rtl"
                label="AR"
              />
            </div>
          ) : data.bodyAr ? (
            <BodyColumn
              body={data.bodyAr}
              tokenRegex={tokenRegex}
              dir="rtl"
              label="AR"
            />
          ) : (
            <BodyColumn
              body={data.bodyEn ?? ""}
              tokenRegex={tokenRegex}
              dir="ltr"
              label="EN"
            />
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title={t("templates.confirmDeleteTitle", { defaultValue: "Delete template?" })}
        description={t("templates.confirmDeleteDescription", {
          defaultValue:
            "This will hide the template from the library. Existing contracts that referenced it are unaffected.",
        })}
        confirmLabel={t("templates.actions.delete", { defaultValue: "Delete" })}
        destructive
        isPending={deleteMutation.isPending}
        onConfirm={() => void onDeleteConfirmed()}
        onClose={() => setConfirmDelete(false)}
      />
    </motion.div>
  );
}

function BodyColumn({
  body,
  tokenRegex,
  dir,
  label,
}: {
  body: string;
  tokenRegex: RegExp;
  dir: "ltr" | "rtl";
  label: "EN" | "AR";
}) {
  // Split into alternating text/token chunks; render tokens with the gold pill.
  const parts = useMemo(() => body.split(tokenRegex), [body, tokenRegex]);
  return (
    <div className="space-y-1.5">
      <div className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <pre
        dir={dir}
        className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface/40 p-3 text-xs leading-relaxed text-ink"
      >
        {parts.map((chunk, i) =>
          /^\{\{[a-z][a-z0-9_]*\}\}$/.test(chunk) ? (
            <span
              key={i}
              className="mx-0.5 inline-block rounded-sm bg-gold/15 px-1 font-mono text-[11px] text-gold"
            >
              {chunk}
            </span>
          ) : (
            <span key={i}>{chunk}</span>
          ),
        )}
      </pre>
    </div>
  );
}
