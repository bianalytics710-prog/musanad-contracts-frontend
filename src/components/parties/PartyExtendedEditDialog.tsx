/**
 * PartyExtendedEditDialog — modal for the editable subset of a Party.
 *
 * Wraps the existing M_parity Party fields (nameEn / nameAr / contact /
 * legal / jurisdiction / address) AND the new M9 (CR-B) editable subset:
 *   - parentId / uboId  (party pickers — null = explicit unset)
 *   - aliases           (multi-input chip field)
 *   - esgScore          (0..100 slider)
 *   - icvStatus         (5-value dropdown)
 *   - icvPct            (0..100 percent)
 *   - icvLastChecked    (date-time)
 *   - metadata          (raw JSON)
 *
 * READ-ONLY (Q-DA4 lock — never editable manually):
 *   - sanctionsStatus / sanctionsLastChecked / sanctionsMatchSignalId
 *
 * Submits PATCH /api/v1/parties/:id (fn_party_update) → toast → invalidates
 * the party detail query.
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
import { partiesService } from "@/services/api/m_parity.service";
import { translateApiError } from "@/lib/translate-api-error";
import {
  ICV_STATUSES,
  type IcvStatus,
  type PartyAlias,
  type PartyDetail,
  type PartyUpdatePayload,
} from "@/types/entities/party-graph.types";
import { PartyAliasesField } from "./PartyAliasesField";
import { SanctionsStatusBadge } from "./SanctionsStatusBadge";
import { formatDateTime } from "@/utils/datetime";

// Zod runs at submit time; values starting as strings are coerced before
// running through the schema.

const editFormSchema = z
  .object({
    nameEn: z.string().min(1).max(200).optional(),
    nameAr: z.string().max(200).nullable().optional(),
    contactEmail: z.string().email().max(255).nullable().optional().or(z.literal("")),
    contactPhone: z.string().max(40).nullable().optional(),
    registeredAddress: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    tradeLicenseNumber: z.string().max(80).nullable().optional(),
    tradeLicenseIssuer: z.string().max(80).nullable().optional(),
    parentId: z.number().int().positive().nullable().optional(),
    uboId: z.number().int().positive().nullable().optional(),
    esgScore: z.number().int().min(0).max(100).nullable().optional(),
    icvStatus: z
      .enum(["certified", "expired", "downgraded", "pending", "none"])
      .nullable()
      .optional(),
    icvPct: z.number().min(0).max(100).nullable().optional(),
    metadataRaw: z.string().optional(),
  })
  .superRefine((val, ctx) => {
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
  nameEn: string;
  nameAr: string;
  contactEmail: string;
  contactPhone: string;
  registeredAddress: string;
  notes: string;
  tradeLicenseNumber: string;
  tradeLicenseIssuer: string;
  parentId: number | null;
  parentLabel: string;
  parentTouched: boolean;
  uboId: number | null;
  uboLabel: string;
  uboTouched: boolean;
  aliases: PartyAlias[];
  esgScore: string;
  icvStatus: IcvStatus | "";
  icvPct: string;
  metadataRaw: string;
}

function fromParty(p: PartyDetail): FormState {
  return {
    nameEn: p.nameEn ?? "",
    nameAr: p.nameAr ?? "",
    contactEmail: p.contactEmail ?? "",
    contactPhone: p.contactPhone ?? "",
    registeredAddress: p.registeredAddress ?? "",
    notes: p.notes ?? "",
    tradeLicenseNumber: p.tradeLicenseNumber ?? "",
    tradeLicenseIssuer: p.tradeLicenseIssuer ?? "",
    parentId: p.parentId,
    parentLabel: p.parentId ? `#${p.parentId}` : "",
    parentTouched: false,
    uboId: p.uboId,
    uboLabel: p.uboId ? `#${p.uboId}` : "",
    uboTouched: false,
    aliases: Array.isArray(p.aliases) ? p.aliases : [],
    esgScore: p.esgScore !== null && p.esgScore !== undefined ? String(p.esgScore) : "",
    icvStatus: p.icvStatus ?? "",
    icvPct: p.icvPct !== null && p.icvPct !== undefined ? String(p.icvPct) : "",
    metadataRaw:
      p.metadata && Object.keys(p.metadata).length > 0
        ? JSON.stringify(p.metadata, null, 2)
        : "",
  };
}

export interface PartyExtendedEditDialogProps {
  open: boolean;
  onClose: () => void;
  party: PartyDetail;
}

export function PartyExtendedEditDialog({
  open,
  onClose,
  party,
}: PartyExtendedEditDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const formId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  const [form, setForm] = useState<FormState>(() => fromParty(party));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm(fromParty(party));
      setErrors({});
    }
  }, [open, party]);

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
    mutationFn: (payload: PartyUpdatePayload) =>
      partiesService.updateExtended(party.id, payload),
    onSuccess: () => {
      toast.success(t("parties.dialog.editParty.success"));
      void qc.invalidateQueries({ queryKey: ["party", party.id] });
      void qc.invalidateQueries({ queryKey: ["parties"] });
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

    // Self-reference guard (BE also enforces — defence in depth).
    if (form.parentId === party.id) {
      newErrors.parentId = t("parties.dialog.editParty.errors.selfReference");
    }
    if (form.uboId === party.id) {
      newErrors.uboId = t("parties.dialog.editParty.errors.selfReference");
    }

    const esgScoreNum =
      form.esgScore.trim() === "" ? null : Number(form.esgScore);
    const icvPctNum = form.icvPct.trim() === "" ? null : Number(form.icvPct);

    const parse = editFormSchema.safeParse({
      nameEn: form.nameEn || undefined,
      nameAr: form.nameAr || null,
      contactEmail: form.contactEmail || null,
      contactPhone: form.contactPhone || null,
      registeredAddress: form.registeredAddress || null,
      notes: form.notes || null,
      tradeLicenseNumber: form.tradeLicenseNumber || null,
      tradeLicenseIssuer: form.tradeLicenseIssuer || null,
      parentId: form.parentTouched ? form.parentId : undefined,
      uboId: form.uboTouched ? form.uboId : undefined,
      esgScore: esgScoreNum,
      icvStatus: form.icvStatus || null,
      icvPct: icvPctNum,
      metadataRaw: form.metadataRaw,
    });

    if (!parse.success) {
      for (const issue of parse.error.issues) {
        const key = issue.path.join(".");
        if (key === "contactEmail")
          newErrors.contactEmail = t("parties.dialog.editParty.errors.email");
        else if (key === "esgScore")
          newErrors.esgScore = t("parties.dialog.editParty.errors.esgScoreRange");
        else if (key === "icvPct")
          newErrors.icvPct = t("parties.dialog.editParty.errors.icvPctRange");
        else if (key === "metadataRaw")
          newErrors.metadataRaw =
            issue.message === "invalidJson"
              ? t("parties.dialog.editParty.errors.metadataInvalidJson")
              : t("parties.dialog.editParty.errors.metadataNotObject");
        else if (key === "nameEn")
          newErrors.nameEn = t("parties.dialog.editParty.errors.required");
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

    // Build the payload — omit fields the user didn't change to avoid
    // accidentally overwriting on the BE side.
    const payload: PartyUpdatePayload = {
      nameEn: form.nameEn || undefined,
      nameAr: form.nameAr === "" ? null : form.nameAr,
      contactEmail: form.contactEmail === "" ? null : form.contactEmail,
      contactPhone: form.contactPhone === "" ? null : form.contactPhone,
      registeredAddress:
        form.registeredAddress === "" ? null : form.registeredAddress,
      notes: form.notes === "" ? null : form.notes,
      tradeLicenseNumber:
        form.tradeLicenseNumber === "" ? null : form.tradeLicenseNumber,
      tradeLicenseIssuer:
        form.tradeLicenseIssuer === "" ? null : form.tradeLicenseIssuer,
      aliases: form.aliases,
      esgScore: esgScoreNum,
      icvStatus: form.icvStatus === "" ? null : form.icvStatus,
      icvPct: icvPctNum,
      metadata: metadataObj,
    };

    if (form.parentTouched) payload.parentId = form.parentId;
    if (form.uboTouched) payload.uboId = form.uboId;

    mutation.mutate(payload);
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
        className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2
            id={`${formId}-title`}
            className="text-base font-semibold text-ink"
          >
            {t("parties.dialog.editParty.title")}
          </h2>
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
          className="space-y-4 px-5 py-4 max-h-[75vh] overflow-y-auto"
          noValidate
        >
          {/* Read-only sanctions block (Q-DA4) */}
          <section className="rounded-md border border-border bg-surface p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t("parties.dialog.editParty.sanctionsReadOnly")}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <SanctionsStatusBadge status={party.sanctionsStatus} />
              {party.sanctionsLastChecked && (
                <span className="font-mono text-[11px] text-ink-muted">
                  {t("parties.sanctions.lastChecked")}:{" "}
                  {formatDateTime(party.sanctionsLastChecked)}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[10px] text-ink-subtle">
              {t("parties.dialog.editParty.sanctionsHelp")}
            </p>
          </section>

          {/* Identity */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id={`${formId}-nameEn`}
              label={t("parties.fields.nameEn", {
                defaultValue: "Name (English)",
              })}
              required
              error={errors.nameEn}
            >
              <Input
                id={`${formId}-nameEn`}
                value={form.nameEn}
                onChange={(e) => setField("nameEn", e.target.value)}
                disabled={mutation.isPending}
              />
            </Field>
            <Field
              id={`${formId}-nameAr`}
              label={t("parties.fields.nameAr", {
                defaultValue: "Name (Arabic)",
              })}
            >
              <Input
                id={`${formId}-nameAr`}
                value={form.nameAr}
                dir="rtl"
                onChange={(e) => setField("nameAr", e.target.value)}
                disabled={mutation.isPending}
              />
            </Field>
          </div>

          {/* Contact */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id={`${formId}-email`}
              label={t("parties.fields.contactEmail", {
                defaultValue: "Contact email",
              })}
              error={errors.contactEmail}
            >
              <Input
                id={`${formId}-email`}
                type="email"
                value={form.contactEmail}
                onChange={(e) => setField("contactEmail", e.target.value)}
                disabled={mutation.isPending}
              />
            </Field>
            <Field
              id={`${formId}-phone`}
              label={t("parties.fields.contactPhone", {
                defaultValue: "Contact phone",
              })}
            >
              <Input
                id={`${formId}-phone`}
                value={form.contactPhone}
                onChange={(e) => setField("contactPhone", e.target.value)}
                disabled={mutation.isPending}
              />
            </Field>
          </div>

          {/* Legal / jurisdiction */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id={`${formId}-trade`}
              label={t("parties.fields.tradeLicenseNumber", {
                defaultValue: "Trade licence #",
              })}
            >
              <Input
                id={`${formId}-trade`}
                value={form.tradeLicenseNumber}
                onChange={(e) => setField("tradeLicenseNumber", e.target.value)}
                disabled={mutation.isPending}
              />
            </Field>
            <Field
              id={`${formId}-issuer`}
              label={t("parties.fields.tradeLicenseIssuer", {
                defaultValue: "Issuer",
              })}
            >
              <Input
                id={`${formId}-issuer`}
                value={form.tradeLicenseIssuer}
                onChange={(e) => setField("tradeLicenseIssuer", e.target.value)}
                disabled={mutation.isPending}
              />
            </Field>
          </div>

          {/* Parent / UBO pickers */}
          <div className="grid gap-3 sm:grid-cols-2">
            <PartyPickerField
              id={`${formId}-parent`}
              label={t("parties.dialog.editParty.parentLabel")}
              currentPartyId={party.id}
              valueId={form.parentId}
              valueLabel={form.parentLabel}
              onSelect={(p) => {
                setForm((f) => ({
                  ...f,
                  parentId: p?.id ?? null,
                  parentLabel: p?.label ?? "",
                  parentTouched: true,
                }));
                setErrors((e) => ({ ...e, parentId: "" }));
              }}
              error={errors.parentId}
              disabled={mutation.isPending}
              clearable
            />
            <PartyPickerField
              id={`${formId}-ubo`}
              label={t("parties.dialog.editParty.uboLabel")}
              currentPartyId={party.id}
              valueId={form.uboId}
              valueLabel={form.uboLabel}
              onSelect={(p) => {
                setForm((f) => ({
                  ...f,
                  uboId: p?.id ?? null,
                  uboLabel: p?.label ?? "",
                  uboTouched: true,
                }));
                setErrors((e) => ({ ...e, uboId: "" }));
              }}
              error={errors.uboId}
              disabled={mutation.isPending}
              clearable
            />
          </div>

          {/* Aliases (multi-input chip list) */}
          <PartyAliasesField
            value={form.aliases}
            onChange={(next) => setField("aliases", next)}
            disabled={mutation.isPending}
            inputId={`${formId}-aliases`}
          />

          {/* ESG / ICV */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              id={`${formId}-esg`}
              label={t("parties.dialog.editParty.esgScoreLabel")}
              error={errors.esgScore}
              help={t("parties.dialog.editParty.esgScoreHelp")}
            >
              <Input
                id={`${formId}-esg`}
                type="number"
                min={0}
                max={100}
                step={1}
                value={form.esgScore}
                onChange={(e) => setField("esgScore", e.target.value)}
                disabled={mutation.isPending}
                placeholder="—"
              />
            </Field>
            <Field
              id={`${formId}-icvStatus`}
              label={t("parties.dialog.editParty.icvStatusLabel")}
            >
              <select
                id={`${formId}-icvStatus`}
                value={form.icvStatus}
                onChange={(e) =>
                  setField("icvStatus", e.target.value as IcvStatus | "")
                }
                disabled={mutation.isPending}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">
                  {t("parties.dialog.editParty.icvStatusPlaceholder")}
                </option>
                {ICV_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`parties.icv.${snakeToCamel(s)}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              id={`${formId}-icvPct`}
              label={t("parties.dialog.editParty.icvPctLabel")}
              error={errors.icvPct}
            >
              <Input
                id={`${formId}-icvPct`}
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={form.icvPct}
                onChange={(e) => setField("icvPct", e.target.value)}
                disabled={mutation.isPending}
                placeholder="—"
              />
            </Field>
          </div>

          {/* Metadata */}
          <Field
            id={`${formId}-metadata`}
            label={t("parties.dialog.editParty.metadataLabel")}
            error={errors.metadataRaw}
            help={t("parties.dialog.editParty.metadataHelp")}
          >
            <textarea
              id={`${formId}-metadata`}
              value={form.metadataRaw}
              onChange={(e) => setField("metadataRaw", e.target.value)}
              disabled={mutation.isPending}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder='{"verified_via": "manual"}'
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
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending
                ? t("common.saving", { defaultValue: "Saving…" })
                : t("common.save", { defaultValue: "Save" })}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}

// ─── Reusable party picker (similar to AddRelationshipDialog's) ─────────────

interface PartyPickerFieldProps {
  id: string;
  label: string;
  currentPartyId: number;
  valueId: number | null;
  valueLabel: string;
  onSelect: (p: { id: number; label: string } | null) => void;
  error?: string;
  disabled?: boolean;
  clearable?: boolean;
}

function PartyPickerField({
  id,
  label,
  currentPartyId,
  valueId,
  valueLabel,
  onSelect,
  error,
  disabled,
  clearable,
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
    enabled: open,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const items = data?.data ?? [];
    return items.filter((p) => p.id !== currentPartyId);
  }, [data, currentPartyId]);

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted"
      >
        {label}
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
            placeholder={t("parties.dialog.editParty.pickerPlaceholder")}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className="h-7 w-full border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
          {valueId && !open && (
            <Check className="h-3.5 w-3.5 text-sage" aria-hidden />
          )}
          {clearable && valueId && !open && (
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setSearch("");
              }}
              className="rounded-md p-0.5 text-ink-muted hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("common.clear", { defaultValue: "Clear" })}
              disabled={disabled}
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
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
                {t("parties.dialog.editParty.noPartyResults")}
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
                      label: isAr && p.nameAr ? p.nameAr : p.nameEn,
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

// ─── shared field wrapper ───────────────────────────────────────────────────

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
      <div className="mt-1">{children}</div>
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

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => (c as string).toUpperCase());
}
