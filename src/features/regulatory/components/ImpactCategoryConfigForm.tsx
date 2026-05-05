/**
 * ImpactCategoryConfigForm (S15) — upsert form for impact_category.
 *
 * Mode: new. POST /api/v1/impact-categories with `key` in BODY (BE-OI-A —
 * NOT PUT /:key). Backend uses ON CONFLICT (key) DO UPDATE; the response
 * carries createdOrUpdated discriminator. We use the same form for both
 * create + edit; in edit mode, the `key` field is shown read-only since
 * mutating the natural identifier would violate referential integrity for
 * any downstream regulatory_update.category_id.
 *
 * AC mapping:
 *   AC-S15-01 — first call with a new key → created.
 *   AC-S15-02 — subsequent calls with same key → updated.
 *   AC-S15-03 — nameAr is required.
 *   AC-S15-04 — severityScale must be array of strings.
 *   AC-S15-05 — config.manage permission (legal_counsel denied).
 */
import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useUpsertImpactCategory } from "@/features/regulatory/hooks/useRegulatory";
import type {
  ImpactCategory,
  UpsertImpactCategoryDto,
} from "@/types/entities/regulatory.types";

interface Props {
  existing: ImpactCategory | null;
  open: boolean;
  onClose: () => void;
}

const schema = z.object({
  key: z
    .string()
    .min(1, "regulatory.errors.keyRequired")
    .regex(/^[a-z][a-z0-9_]*$/, "regulatory.errors.keyFormat")
    .max(64),
  nameEn: z.string().min(1, "regulatory.errors.nameEnRequired").max(120),
  nameAr: z.string().min(1, "regulatory.errors.nameArRequired").max(120),
  descriptionEn: z.string().max(1000).optional().or(z.literal("")),
  descriptionAr: z.string().max(1000).optional().or(z.literal("")),
  icon: z.string().max(64).optional().or(z.literal("")),
  colour: z.string().max(64).optional().or(z.literal("")),
  active: z.boolean().default(true),
  displayOrder: z.coerce.number().int().min(0).max(9999).default(99),
  // comma-separated; transformed below
  sources: z.string().optional(),
  severityScale: z.string().optional(),
  defaultClauseCategories: z.string().optional(),
  aiPromptContext: z.string().max(4000).optional().or(z.literal("")),
});

type FormData = z.input<typeof schema>;

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function toDto(data: FormData): UpsertImpactCategoryDto {
  const optStr = (v: unknown): string | null | undefined => {
    if (typeof v !== "string") return undefined;
    return v.length > 0 ? v : null;
  };
  return {
    key: data.key!,
    nameEn: data.nameEn!,
    nameAr: data.nameAr!,
    descriptionEn: optStr(data.descriptionEn),
    descriptionAr: optStr(data.descriptionAr),
    icon:
      typeof data.icon === "string" && data.icon.length > 0
        ? data.icon
        : undefined,
    colour:
      typeof data.colour === "string" && data.colour.length > 0
        ? data.colour
        : undefined,
    active: data.active,
    displayOrder:
      typeof data.displayOrder === "number" ? data.displayOrder : undefined,
    sources: parseList(data.sources),
    severityScale: parseList(data.severityScale),
    defaultClauseCategories: parseList(data.defaultClauseCategories),
    aiPromptContext: optStr(data.aiPromptContext),
  };
}

export function ImpactCategoryConfigForm({ existing, open, onClose }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [defaultLoaded, setDefaultLoaded] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      key: "",
      nameEn: "",
      nameAr: "",
      descriptionEn: "",
      descriptionAr: "",
      icon: "",
      colour: "",
      active: true,
      displayOrder: 99,
      sources: "",
      severityScale: "",
      defaultClauseCategories: "",
      aiPromptContext: "",
    },
  });

  // Reset to existing values when `existing` flips
  useEffect(() => {
    if (!open) {
      setDefaultLoaded(false);
      return;
    }
    if (existing && !defaultLoaded) {
      form.reset({
        key: existing.key,
        nameEn: existing.nameEn,
        nameAr: existing.nameAr,
        descriptionEn: existing.descriptionEn ?? "",
        descriptionAr: existing.descriptionAr ?? "",
        icon: existing.icon,
        colour: existing.colour,
        active: existing.active,
        displayOrder: existing.displayOrder,
        sources: existing.sources.join(", "),
        severityScale: existing.severityScale.join(", "),
        defaultClauseCategories: existing.defaultClauseCategories.join(", "),
        aiPromptContext: existing.aiPromptContext ?? "",
      });
      setDefaultLoaded(true);
    }
  }, [open, existing, defaultLoaded, form]);

  const mutation = useUpsertImpactCategory({
    onSuccess: () => {
      form.reset();
      onClose();
    },
  });

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !mutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, mutation.isPending]);

  if (!open) return null;

  const isEdit = existing !== null;
  const errKey = (k: string | undefined): string | undefined =>
    k ? t(k, { defaultValue: k }) : undefined;
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit((data) => {
    mutation.mutate(toDto(data));
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !mutation.isPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <h2 id={titleId} className="text-lg font-semibold text-ink">
            {isEdit
              ? t("regulatory.impactCategory.edit.title")
              : t("regulatory.impactCategory.create.title")}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={mutation.isPending}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form
          noValidate
          onSubmit={onSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="grid flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
            <Field
              label={t("regulatory.impactCategory.fields.key")}
              required
              error={errKey(errors.key?.message)}
            >
              <Input
                type="text"
                {...form.register("key")}
                disabled={mutation.isPending || isEdit}
                aria-invalid={errors.key ? "true" : "false"}
                placeholder="termination_clauses"
              />
            </Field>
            <Field
              label={t("regulatory.impactCategory.fields.displayOrder")}
              error={errKey(errors.displayOrder?.message)}
            >
              <Input
                type="number"
                {...form.register("displayOrder")}
                disabled={mutation.isPending}
              />
            </Field>
            <Field
              label={t("regulatory.impactCategory.fields.nameEn")}
              required
              error={errKey(errors.nameEn?.message)}
            >
              <Input
                type="text"
                {...form.register("nameEn")}
                disabled={mutation.isPending}
              />
            </Field>
            <Field
              label={t("regulatory.impactCategory.fields.nameAr")}
              required
              error={errKey(errors.nameAr?.message)}
            >
              <Input
                type="text"
                dir="rtl"
                lang="ar"
                {...form.register("nameAr")}
                disabled={mutation.isPending}
              />
            </Field>
            <Field
              label={t("regulatory.impactCategory.fields.icon")}
              error={errKey(errors.icon?.message)}
            >
              <Input
                type="text"
                {...form.register("icon")}
                disabled={mutation.isPending}
                placeholder="briefcase"
              />
            </Field>
            <Field
              label={t("regulatory.impactCategory.fields.colour")}
              error={errKey(errors.colour?.message)}
            >
              <Input
                type="text"
                {...form.register("colour")}
                disabled={mutation.isPending}
                placeholder="gold"
              />
            </Field>
            <Field
              label={t("regulatory.impactCategory.fields.severityScale")}
              error={errKey(errors.severityScale?.message)}
              helpText={t(
                "regulatory.impactCategory.helpText.severityScaleCommaSeparated",
              )}
              wide
            >
              <Input
                type="text"
                {...form.register("severityScale")}
                disabled={mutation.isPending}
                placeholder="low, medium, high, critical"
              />
            </Field>
            <Field
              label={t("regulatory.impactCategory.fields.sources")}
              error={errKey(errors.sources?.message)}
              wide
            >
              <Input
                type="text"
                {...form.register("sources")}
                disabled={mutation.isPending}
                placeholder="MoHRE, FTA"
              />
            </Field>
            <Field
              label={t("regulatory.impactCategory.fields.defaultClauseCategories")}
              error={errKey(errors.defaultClauseCategories?.message)}
              wide
            >
              <Input
                type="text"
                {...form.register("defaultClauseCategories")}
                disabled={mutation.isPending}
                placeholder="termination, payment"
              />
            </Field>
            <Field
              label={t("regulatory.impactCategory.fields.descriptionEn")}
              error={errKey(errors.descriptionEn?.message)}
              wide
            >
              <textarea
                {...form.register("descriptionEn")}
                disabled={mutation.isPending}
                rows={3}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Field>
            <Field
              label={t("regulatory.impactCategory.fields.descriptionAr")}
              error={errKey(errors.descriptionAr?.message)}
              wide
            >
              <textarea
                {...form.register("descriptionAr")}
                disabled={mutation.isPending}
                rows={3}
                dir="rtl"
                lang="ar"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Field>
            <Field
              label={t("regulatory.impactCategory.fields.aiPromptContext")}
              error={errKey(errors.aiPromptContext?.message)}
              helpText={t(
                "regulatory.impactCategory.helpText.aiPromptContextHint",
              )}
              wide
            >
              <textarea
                {...form.register("aiPromptContext")}
                disabled={mutation.isPending}
                rows={4}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                {...form.register("active")}
                disabled={mutation.isPending}
              />
              {t("regulatory.impactCategory.fields.active")}
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-border p-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? t("common.saving")
                : isEdit
                ? t("regulatory.impactCategory.edit.submit")
                : t("regulatory.impactCategory.create.submit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  wide?: boolean;
  children: React.ReactNode;
}

function Field({
  label,
  required,
  error,
  helpText,
  wide,
  children,
}: FieldProps) {
  return (
    <label
      className={`flex flex-col gap-1 text-sm ${wide ? "md:col-span-2" : ""}`}
    >
      <span className="font-medium text-ink">
        {label}
        {required && (
          <span className="ms-0.5 text-terracotta" aria-hidden="true">
            *
          </span>
        )}
      </span>
      {children}
      {helpText && !error && (
        <span className="text-xs text-ink-muted">{helpText}</span>
      )}
      {error && (
        <span role="alert" className="text-xs text-terracotta">
          {error}
        </span>
      )}
    </label>
  );
}
