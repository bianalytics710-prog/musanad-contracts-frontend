import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { TemplateEditorForm } from "@/features/templates/components/TemplateEditorForm";
import {
  useTemplateDetail,
  useUpdateTemplate,
} from "@/features/templates/hooks/useTemplates";

export const Route = createFileRoute("/app/templates/$id/edit")({
  component: () => (
    <ErrorBoundary>
      <EditTemplateView />
    </ErrorBoundary>
  ),
});

function EditTemplateView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const tplId = Number(id);
  const { data, isLoading, isError } = useTemplateDetail(
    Number.isInteger(tplId) ? tplId : null,
  );
  const updateMutation = useUpdateTemplate(tplId);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1024px] space-y-3 p-6">
        <div className="h-8 animate-pulse rounded-md bg-surface" />
        <div className="h-64 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-md p-12 text-center">
        <h1 className="text-base font-semibold text-ink">
          {t("templates.notFound", { defaultValue: "Template not found" })}
        </h1>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1024px] space-y-4 p-6">
      <Link
        to="/app/templates/$id"
        params={{ id: String(data.id) }}
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-gold"
      >
        <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
        {t("templates.backToDetail", { defaultValue: "Back to template" })}
      </Link>
      <header>
        <div className="mb-2 font-mono text-xs uppercase tracking-wider text-ink-subtle">
          {t("templates.kicker", { defaultValue: "Template library" })}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("templates.edit.title", {
            defaultValue: "Edit · {{name}}",
            name: data.nameEn,
          })}
        </h1>
      </header>

      <TemplateEditorForm
        initial={data}
        submitLabel={t("templates.actions.save", { defaultValue: "Save changes" })}
        isSubmitting={updateMutation.isPending}
        onCancel={() => void navigate({ to: "/app/templates/$id", params: { id: String(data.id) } })}
        onSubmit={async (input) => {
          const updated = await updateMutation.mutateAsync(input);
          void navigate({
            to: "/app/templates/$id",
            params: { id: String(updated.id) },
          });
        }}
      />
    </div>
  );
}
