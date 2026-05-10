/**
 * AddRelationshipDialog — modal for creating a new party_relationship edge.
 *
 * URL :id (the anchor party) is always treated as the parent (BE convention,
 * api-contracts.json); the user picks the child (counterparty) via a
 * search-as-you-type picker against /api/v1/parties.
 *
 * Required: relationshipType, childId.
 * Optional: ownershipPct, effectiveFrom/To, source (default manual),
 *           confidence (default 1.0), metadata (raw JSON).
 *
 * Submits POST /api/v1/parties/:id/relationships → toast → invalidate chain
 * + relationship-list queries. Closes on success.
 *
 * Self-loop guard (childId === anchorPartyId) is enforced client-side; BE
 * also raises 22023 'self_loop_not_allowed' as defence in depth.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { X, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useDebounce } from "@/hooks/useDebounce";
import { partyGraphService } from "@/services/api/party-graph.service";
import { partiesService } from "@/services/api/m_parity.service";
import { translateApiError } from "@/lib/translate-api-error";
import {
  RELATIONSHIP_TYPES,
  RELATIONSHIP_SOURCES,
  type CreateRelationshipPayload,
  type RelationshipType,
  type RelationshipSource,
} from "@/types/entities/party-graph.types";

// ─── Zod schema (T8 — form hygiene) ─────────────────────────────────────────

const createRelationshipFormSchema = z
  .object({
    childId: z.number().int().positive(),
    relationshipType: z.enum([
      "parent",
      "ubo",
      "subsidiary",
      "sub_contractor",
      "jv",
      "controlling_shareholder",
    ]),
    ownershipPct: z
      .number()
      .min(0)
      .max(100)
      .nullable()
      .optional(),
    effectiveFrom: z.string().optional().nullable(),
    effectiveTo: z.string().optional().nullable(),
    source: z.enum(["dnb", "sayari", "manual", "demo_seed"]),
    confidence: z.number().min(0).max(1),
    metadataRaw: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (
      val.effectiveFrom &&
      val.effectiveTo &&
      val.effectiveTo < val.effectiveFrom
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effectiveTo"],
        message: "endBeforeStart",
      });
    }
    if (val.metadataRaw && val.metadataRaw.trim().length > 0) {
      try {
        const parsed: unknown = JSON.parse(val.metadataRaw);
        if (
          parsed === null ||
          typeof parsed !== "object" ||
          Array.isArray(parsed)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["metadataRaw"],
            message: "notObject",
          });
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["metadataRaw"],
          message: "invalidJson",
        });
      }
    }
  });

interface FormState {
  childId: number | null;
  childLabel: string;
  relationshipType: RelationshipType | "";
  ownershipPct: string;
  effectiveFrom: string;
  effectiveTo: string;
  source: RelationshipSource;
  confidence: string;
  metadataRaw: string;
}

const INITIAL: FormState = {
  childId: null,
  childLabel: "",
  relationshipType: "",
  ownershipPct: "",
  effectiveFrom: "",
  effectiveTo: "",
  source: "manual",
  confidence: "1",
  metadataRaw: "",
};

export interface AddRelationshipDialogProps {
  open: boolean;
  onClose: () => void;
  /** The URL :id — always treated as the parent of the new edge. */
  anchorPartyId: number;
  /** Display name of the anchor party (for the dialog header). */
  anchorPartyName: string;
}

export function AddRelationshipDialog({
  open,
  onClose,
  anchorPartyId,
  anchorPartyName,
}: AddRelationshipDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const formId = useId();

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset on close.
  useEffect(() => {
    if (!open) {
      setForm(INITIAL);
      setErrors({});
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !mutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: (payload: CreateRelationshipPayload) =>
      partyGraphService.createRelationship(anchorPartyId, payload),
    onSuccess: () => {
      toast.success(t("parties.dialog.addRelationship.success"));
      void qc.invalidateQueries({
        queryKey: ["party-chain-summary", anchorPartyId],
      });
      void qc.invalidateQueries({
        queryKey: ["party-relationships", anchorPartyId],
      });
      onClose();
    },
    onError: (e) => {
      toast.error(translateApiError(e, t));
    },
  });

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mutation.isPending) return;

    const newErrors: Record<string, string> = {};
    if (!form.childId) {
      newErrors.childId = t("parties.dialog.addRelationship.errors.childRequired");
    }
    if (form.childId === anchorPartyId) {
      newErrors.childId = t("parties.dialog.addRelationship.errors.selfLoop");
    }
    if (!form.relationshipType) {
      newErrors.relationshipType = t(
        "parties.dialog.addRelationship.errors.typeRequired",
      );
    }

    const ownershipPctNum =
      form.ownershipPct.trim() === "" ? null : Number(form.ownershipPct);
    const confidenceNum = form.confidence.trim() === "" ? 1 : Number(form.confidence);

    const parse = createRelationshipFormSchema.safeParse({
      childId: form.childId ?? 0,
      relationshipType: form.relationshipType || undefined,
      ownershipPct: ownershipPctNum,
      effectiveFrom: form.effectiveFrom || null,
      effectiveTo: form.effectiveTo || null,
      source: form.source,
      confidence: confidenceNum,
      metadataRaw: form.metadataRaw,
    });

    if (!parse.success) {
      for (const issue of parse.error.issues) {
        const key = issue.path.join(".");
        if (key === "ownershipPct")
          newErrors.ownershipPct = t(
            "parties.dialog.addRelationship.errors.ownershipPctRange",
          );
        else if (key === "confidence")
          newErrors.confidence = t(
            "parties.dialog.addRelationship.errors.confidenceRange",
          );
        else if (key === "effectiveTo")
          newErrors.effectiveTo = t(
            "parties.dialog.addRelationship.errors.endBeforeStart",
          );
        else if (key === "metadataRaw")
          newErrors.metadataRaw =
            issue.message === "invalidJson"
              ? t("parties.dialog.addRelationship.errors.metadataInvalidJson")
              : t("parties.dialog.addRelationship.errors.metadataNotObject");
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    let metadataObj: Record<string, unknown> | undefined = undefined;
    if (form.metadataRaw.trim().length > 0) {
      try {
        metadataObj = JSON.parse(form.metadataRaw) as Record<string, unknown>;
      } catch {
        metadataObj = undefined;
      }
    }

    mutation.mutate({
      childId: form.childId as number,
      relationshipType: form.relationshipType as RelationshipType,
      ownershipPct: ownershipPctNum,
      effectiveFrom: form.effectiveFrom || null,
      effectiveTo: form.effectiveTo || null,
      source: form.source,
      confidence: confidenceNum,
      metadata: metadataObj,
    });
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${formId}-title`}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !mutation.isPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl rounded-lg border border-border bg-card shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <h2
              id={`${formId}-title`}
              className="text-base font-semibold text-ink"
            >
              {t("parties.dialog.addRelationship.title")}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {t("parties.dialog.addRelationship.description", {
                anchor: anchorPartyName,
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !mutation.isPending && onClose()}
            className="rounded-md p-1 text-ink-muted hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("common.close", { defaultValue: "Close" })}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <form
          onSubmit={onSubmit}
          className="space-y-3 px-5 py-4 max-h-[70vh] overflow-y-auto"
          noValidate
        >
          {/* Child party picker */}
          <PartyPickerField
            id={`${formId}-child`}
            label={t("parties.dialog.addRelationship.childLabel")}
            required
            anchorPartyId={anchorPartyId}
            valueId={form.childId}
            valueLabel={form.childLabel}
            onSelect={(p) => {
              setField("childId", p.id);
              setField("childLabel", p.label);
              setErrors((e) => ({ ...e, childId: "" }));
            }}
            error={errors.childId}
            disabled={mutation.isPending}
          />

          {/* Relationship type */}
          <Field
            id={`${formId}-type`}
            label={t("parties.dialog.addRelationship.relationshipTypeLabel")}
            required
            error={errors.relationshipType}
          >
            <select
              id={`${formId}-type`}
              value={form.relationshipType}
              onChange={(e) =>
                setField("relationshipType", e.target.value as RelationshipType | "")
              }
              disabled={mutation.isPending}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">
                {t("parties.dialog.addRelationship.relationshipTypePlaceholder")}
              </option>
              {RELATIONSHIP_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {t(`parties.chain.relationshipType.${snakeToCamel(rt)}`)}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id={`${formId}-ownership`}
              label={t("parties.dialog.addRelationship.ownershipPctLabel")}
              error={errors.ownershipPct}
            >
              <Input
                id={`${formId}-ownership`}
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={form.ownershipPct}
                onChange={(e) => setField("ownershipPct", e.target.value)}
                disabled={mutation.isPending}
                placeholder="—"
              />
            </Field>
            <Field
              id={`${formId}-confidence`}
              label={t("parties.dialog.addRelationship.confidenceLabel")}
            >
              <Input
                id={`${formId}-confidence`}
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={form.confidence}
                onChange={(e) => setField("confidence", e.target.value)}
                disabled={mutation.isPending}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id={`${formId}-from`}
              label={t("parties.dialog.addRelationship.effectiveFromLabel")}
            >
              <Input
                id={`${formId}-from`}
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => setField("effectiveFrom", e.target.value)}
                disabled={mutation.isPending}
              />
            </Field>
            <Field
              id={`${formId}-to`}
              label={t("parties.dialog.addRelationship.effectiveToLabel")}
              error={errors.effectiveTo}
            >
              <Input
                id={`${formId}-to`}
                type="date"
                value={form.effectiveTo}
                onChange={(e) => setField("effectiveTo", e.target.value)}
                disabled={mutation.isPending}
              />
            </Field>
          </div>

          <Field
            id={`${formId}-source`}
            label={t("parties.dialog.addRelationship.sourceLabel")}
          >
            <select
              id={`${formId}-source`}
              value={form.source}
              onChange={(e) =>
                setField("source", e.target.value as RelationshipSource)
              }
              disabled={mutation.isPending}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {RELATIONSHIP_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {t(`parties.dialog.addRelationship.source.${s}`)}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id={`${formId}-metadata`}
            label={t("parties.dialog.addRelationship.metadataLabel")}
            error={errors.metadataRaw}
            help={t("parties.dialog.addRelationship.metadataHelp")}
          >
            <textarea
              id={`${formId}-metadata`}
              value={form.metadataRaw}
              onChange={(e) => setField("metadataRaw", e.target.value)}
              disabled={mutation.isPending}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder='{"note": "..."}'
            />
          </Field>

          <footer className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                mutation.isPending ||
                !form.childId ||
                !form.relationshipType
              }
            >
              {mutation.isPending
                ? t("common.saving", { defaultValue: "Saving…" })
                : t("parties.dialog.addRelationship.submit")}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}

// ─── Party search picker (debounced — T10) ──────────────────────────────────

interface PartyPickerFieldProps {
  id: string;
  label: string;
  required?: boolean;
  anchorPartyId: number;
  valueId: number | null;
  valueLabel: string;
  onSelect: (p: { id: number; label: string }) => void;
  error?: string;
  disabled?: boolean;
}

function PartyPickerField({
  id,
  label,
  required,
  anchorPartyId,
  valueId,
  valueLabel,
  onSelect,
  error,
  disabled,
}: PartyPickerFieldProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(search, 300);
  const errorId = `${id}-error`;

  const { data, isLoading } = useQuery({
    queryKey: ["party-picker", debounced],
    queryFn: () =>
      partiesService.list({ q: debounced || undefined, limit: 20 }),
    enabled: open && (debounced.length === 0 || debounced.length >= 1),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const items = data?.data ?? [];
    return items.filter((p) => p.id !== anchorPartyId);
  }, [data, anchorPartyId]);

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted"
      >
        {label}
        {required && <span className="ms-0.5 text-terracotta">*</span>}
      </label>
      <div className="relative mt-1">
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-ink-subtle" aria-hidden />
          <Input
            id={id}
            type="text"
            value={open ? search : valueLabel}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            disabled={disabled}
            placeholder={t("parties.dialog.addRelationship.childPlaceholder")}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className="h-7 w-full border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
          {valueId && !open && (
            <Check className="h-3.5 w-3.5 text-sage" aria-hidden />
          )}
        </div>
        {open && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
            {isLoading && (
              <p className="px-3 py-2 text-xs text-ink-subtle">
                {t("common.loading", { defaultValue: "Loading…" })}
              </p>
            )}
            {!isLoading && filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-ink-subtle">
                {t("parties.dialog.addRelationship.noPartyResults")}
              </p>
            )}
            {!isLoading &&
              filtered.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => {
                    onSelect({
                      id: p.id,
                      label:
                        isAr && p.nameAr ? p.nameAr : p.nameEn,
                    });
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-start text-sm hover:bg-surface focus-visible:bg-surface focus-visible:outline-none"
                >
                  <span className="min-w-0 truncate text-ink">
                    {isAr && p.nameAr ? p.nameAr : p.nameEn}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                    {p.partyType}
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-[11px] text-terracotta">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Generic field wrapper (D6 — htmlFor/id pairing) ────────────────────────

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  help?: string;
  children: React.ReactNode;
}

function Field({ id, label, required, error, help, children }: FieldProps) {
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted"
      >
        {label}
        {required && <span className="ms-0.5 text-terracotta">*</span>}
      </label>
      <div
        className="mt-1"
        aria-describedby={
          [error ? errorId : null, help ? helpId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
      >
        {children}
      </div>
      {help && (
        <p id={helpId} className="mt-1 text-[10px] text-ink-subtle">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-[11px] text-terracotta">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function snakeToCamel(s: string): string {
  // sub_contractor → subContractor; controlling_shareholder → controllingShareholder.
  return s.replace(/_([a-z])/g, (_, c) => (c as string).toUpperCase());
}
