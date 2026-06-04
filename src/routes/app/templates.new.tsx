import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { TemplateEditorForm } from "@/features/templates/components/TemplateEditorForm";
import { useCreateTemplate } from "@/features/templates/hooks/useTemplates";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/app/templates/new")({
  component: () => (
    <ErrorBoundary>
      <NewTemplateView />
    </ErrorBoundary>
  ),
});

function NewTemplateView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createMutation = useCreateTemplate();

  return (
    <div className="mx-auto w-full max-w-[1024px] space-y-4 p-6">
      <Link
        to="/app/templates"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-gold"
      >
        <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
        {t("templates.backToList", { defaultValue: "Back to templates" })}
      </Link>
      <header>
        <div className="mb-2 font-mono text-xs uppercase tracking-wider text-ink-subtle">
          {t("templates.kicker", { defaultValue: "Template library" })}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("templates.newScratch.title", { defaultValue: "New template — from scratch" })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("templates.newScratch.subtitle", {
            defaultValue:
              "Author the body in Markdown. Use {{snake_case}} tokens where party-specific values should be substituted.",
          })}
        </p>
      </header>

      <TemplateEditorForm
        submitLabel={t("templates.actions.save", { defaultValue: "Save template" })}
        isSubmitting={createMutation.isPending}
        onCancel={() => void navigate({ to: "/app/templates" })}
        onSubmit={async (input) => {
          const created = await createMutation.mutateAsync(input);
          void navigate({ to: "/app/templates/$id", params: { id: String(created.id) } });
        }}
      />
    </div>
  );
}
