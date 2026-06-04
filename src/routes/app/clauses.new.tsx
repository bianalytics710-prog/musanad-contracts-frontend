/**
 * /app/clauses/new — "From scratch" form for a single clause.
 *
 * Page-level mirror of the inline CreateClauseDialog. The URL-driven layout
 * matches the Templates flow (templates.new.tsx) so refresh + back/fwd both
 * work cleanly.
 *
 * On submit → POST /api/v1/clauses then navigate to /app/clauses (the new
 * clause will be auto-selected via the master-detail's first-row default).
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import {
  clausesService,
  type CreateClauseInput,
} from "@/services/api/m_parity.service";
import { translateApiError } from "@/lib/translate-api-error";

export const Route = createFileRoute("/app/clauses/new")({
  component: () => (
    <ErrorBoundary>
      <NewClauseView />
    </ErrorBoundary>
  ),
});

const CLAUSE_CATEGORIES = [
  "confidentiality",
  "non_compete",
  "payment",
  "termination",
  "force_majeure",
  "intellectual_property",
  "data_protection",
  "dispute_resolution",
  "governing_law",
  "indemnity",
  "assignment",
  "liability",
  "notice",
  "warranties",
] as const;

function NewClauseView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateClauseInput>({
    category: "confidentiality",
    titleEn: "",
    bodyEn: "",
    variant: "standard",
  });

  const createMutation = useMutation({
    mutationFn: () => clausesService.create(form),
    onSuccess: () => {
      toast.success(t("clauses.create.success", { defaultValue: "Clause created" }));
      void qc.invalidateQueries({ queryKey: ["clauses"] });
      void navigate({ to: "/app/clauses" });
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  const canSubmit =
    form.titleEn.trim().length > 0 &&
    form.bodyEn.trim().length > 0 &&
    form.category.length > 0;

  return (
    <div className="mx-auto w-full max-w-[1024px] space-y-4 p-6">
      <Link
        to="/app/clauses"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-gold"
      >
        <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
        {t("clauses.backToList", { defaultValue: "Back to clauses" })}
      </Link>
      <header>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
          {t("clauses.kicker", { defaultValue: "Clause library" })}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("clauses.newScratch.title", { defaultValue: "New clause — from scratch" })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("clauses.newScratch.subtitle", {
            defaultValue:
              "Pick a category + variant, then write the clause body in English (and Arabic if you have it).",
          })}
        </p>
      </header>

      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) createMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("clauses.fields.category", { defaultValue: "Category" })} required>
                <select
                  required
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CLAUSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {t(`clauseCategory.${cat}`, { defaultValue: cat.replace(/_/g, " ") })}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("clauses.fields.variant", { defaultValue: "Variant" })}>
                <select
                  value={form.variant ?? "standard"}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      variant: e.target.value as "standard" | "alternative" | "fallback",
                    })
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="standard">Standard</option>
                  <option value="alternative">Alternative</option>
                  <option value="fallback">Fallback</option>
                </select>
              </Field>
            </div>

            <Field label={t("clauses.fields.titleEn", { defaultValue: "Title (English)" })} required>
              <Input
                required
                value={form.titleEn}
                onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
              />
            </Field>
            <Field label={t("clauses.fields.titleAr", { defaultValue: "Title (Arabic)" })}>
              <Input
                value={form.titleAr ?? ""}
                onChange={(e) => setForm({ ...form, titleAr: e.target.value })}
                dir="rtl"
              />
            </Field>

            <Field label={t("clauses.fields.bodyEn", { defaultValue: "Body (English)" })} required>
              <textarea
                required
                rows={8}
                value={form.bodyEn}
                onChange={(e) => setForm({ ...form, bodyEn: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-5 text-ink"
              />
            </Field>
            <Field label={t("clauses.fields.bodyAr", { defaultValue: "Body (Arabic)" })}>
              <textarea
                rows={6}
                value={form.bodyAr ?? ""}
                onChange={(e) => setForm({ ...form, bodyAr: e.target.value })}
                dir="rtl"
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-5 text-ink"
              />
            </Field>

            <Field
              label={t("clauses.fields.legalCommentaryEn", {
                defaultValue: "Legal commentary (optional)",
              })}
            >
              <textarea
                rows={3}
                value={form.legalCommentaryEn ?? ""}
                onChange={(e) =>
                  setForm({ ...form, legalCommentaryEn: e.target.value || null })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-ink"
                placeholder={t("clauses.fields.legalCommentaryHint", {
                  defaultValue:
                    "Short practitioner note — when to use this variant, what risks it covers.",
                })}
              />
            </Field>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => void navigate({ to: "/app/clauses" })}
                disabled={createMutation.isPending}
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </Button>
              <Button type="submit" disabled={!canSubmit || createMutation.isPending}>
                {createMutation.isPending
                  ? t("common.saving", { defaultValue: "Saving…" })
                  : t("clauses.actions.save", { defaultValue: "Save clause" })}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink">
        {label}
        {required && <span className="ms-0.5 text-terracotta">*</span>}
      </span>
      {children}
    </label>
  );
}
