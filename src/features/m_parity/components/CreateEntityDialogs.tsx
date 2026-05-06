/**
 * R-LC3 — minimal create dialogs for the 4 author-able M_parity entities
 * (parties / templates / clauses / obligations). Per decision 5(b), legal
 * counsel can author the legal library + onboard parties + add obligations.
 *
 * Each dialog mirrors the same pattern: native <dialog>-style modal with a
 * vertical form, validation on the FE, POST to /api/v1/<entity> (the
 * BE function gates on contract.edit permission). On success, invalidates
 * the corresponding list query and closes the modal.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  partiesService,
  templatesService,
  clausesService,
  obligationsService,
  type CreatePartyInput,
  type CreateTemplateInput,
  type CreateClauseInput,
  type CreateObligationInput,
} from "@/services/api/m_parity.service";
import { translateApiError } from "@/lib/translate-api-error";

interface DialogShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  busy?: boolean;
}

function DialogShell({ open, onClose, title, children, busy }: DialogShellProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-lg border border-border bg-card shadow-xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="rounded-md p-1 text-ink-muted hover:bg-surface"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

// ─── Party create ────────────────────────────────────────────────────────────

interface CreatePartyDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: number) => void;
}

export function CreatePartyDialog({ open, onClose, onCreated }: CreatePartyDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState<CreatePartyInput>({
    partyType: "company",
    nameEn: "",
    nameAr: "",
    tradeLicenseNumber: "",
    emirate: "",
    contactEmail: "",
  });
  const m = useMutation({
    mutationFn: () => partiesService.create(form),
    onSuccess: (party) => {
      toast.success(t("parties.create.success", { defaultValue: "Party created" }));
      void qc.invalidateQueries({ queryKey: ["parties"] });
      if (party && typeof party.id === "number") onCreated?.(party.id);
      onClose();
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  return (
    <DialogShell open={open} onClose={onClose} busy={m.isPending} title={t("parties.create.title", { defaultValue: "New party" })}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        className="space-y-3 px-5 py-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("parties.fields.partyType", { defaultValue: "Type" })}>
            <select
              value={form.partyType}
              onChange={(e) => setForm({ ...form, partyType: e.target.value as "individual" | "company" })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="company">{t("parties.company", { defaultValue: "Company" })}</option>
              <option value="individual">{t("parties.individual", { defaultValue: "Individual" })}</option>
            </select>
          </Field>
          <Field label={t("parties.fields.emirate", { defaultValue: "Emirate" })}>
            <select
              value={form.emirate ?? ""}
              onChange={(e) => setForm({ ...form, emirate: e.target.value || null })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">—</option>
              <option value="abu_dhabi">Abu Dhabi</option>
              <option value="dubai">Dubai</option>
              <option value="sharjah">Sharjah</option>
              <option value="ajman">Ajman</option>
              <option value="fujairah">Fujairah</option>
              <option value="ras_al_khaimah">Ras Al Khaimah</option>
              <option value="umm_al_quwain">Umm Al Quwain</option>
            </select>
          </Field>
        </div>
        <Field label={t("parties.fields.nameEn", { defaultValue: "Name (English)" })} required>
          <Input
            required
            value={form.nameEn}
            onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
          />
        </Field>
        <Field label={t("parties.fields.nameAr", { defaultValue: "Name (Arabic)" })}>
          <Input
            value={form.nameAr ?? ""}
            onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
            dir="rtl"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("parties.fields.tradeLicenseNumber", { defaultValue: "Trade licence #" })}>
            <Input
              value={form.tradeLicenseNumber ?? ""}
              onChange={(e) => setForm({ ...form, tradeLicenseNumber: e.target.value })}
            />
          </Field>
          <Field label={t("parties.fields.contactEmail", { defaultValue: "Contact email" })}>
            <Input
              type="email"
              value={form.contactEmail ?? ""}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            />
          </Field>
        </div>
        <Footer onCancel={onClose} busy={m.isPending} canSubmit={form.nameEn.trim().length > 0} />
      </form>
    </DialogShell>
  );
}

// ─── Template create ────────────────────────────────────────────────────────

const CONTRACT_TYPES = [
  "employment",
  "vendor_services",
  "service",
  "advisory",
  "consultancy",
  "nda",
  "lease",
  "agency",
  "distribution",
  "shareholders",
  "llc_incorporation",
  "trademark_license",
  "franchise",
  "share_purchase",
  "master_services",
  "sow",
  "supply",
  "concession",
  "joint_venture",
  "settlement",
  "facilities",
  "management",
];

interface CreateTemplateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateTemplateDialog({ open, onClose }: CreateTemplateDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateTemplateInput>({
    nameEn: "",
    contractType: "employment",
    language: "en",
    descriptionEn: "",
    bodyEn: "",
  });
  const m = useMutation({
    mutationFn: () => templatesService.create(form),
    onSuccess: () => {
      toast.success(t("templates.create.success", { defaultValue: "Template created" }));
      void qc.invalidateQueries({ queryKey: ["templates"] });
      onClose();
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  return (
    <DialogShell open={open} onClose={onClose} busy={m.isPending} title={t("templates.create.title", { defaultValue: "New template" })}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        className="space-y-3 px-5 py-4"
      >
        <Field label={t("templates.fields.nameEn", { defaultValue: "Name (English)" })} required>
          <Input
            required
            value={form.nameEn}
            onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("templates.fields.contractType", { defaultValue: "Contract type" })} required>
            <select
              required
              value={form.contractType}
              onChange={(e) => setForm({ ...form, contractType: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {CONTRACT_TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {t(`contractType.${tp}`, { defaultValue: tp })}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("templates.fields.language", { defaultValue: "Language" })}>
            <select
              value={form.language ?? "en"}
              onChange={(e) => setForm({ ...form, language: e.target.value as "en" | "ar" | "bilingual" })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="en">English</option>
              <option value="ar">Arabic</option>
              <option value="bilingual">Bilingual</option>
            </select>
          </Field>
        </div>
        <Field label={t("templates.fields.descriptionEn", { defaultValue: "Description" })}>
          <textarea
            value={form.descriptionEn ?? ""}
            onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("templates.fields.bodyEn", { defaultValue: "Body (Markdown)" })}>
          <textarea
            value={form.bodyEn ?? ""}
            onChange={(e) => setForm({ ...form, bodyEn: e.target.value })}
            rows={8}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            placeholder="## 1. Recitals&#10;…"
          />
        </Field>
        <Footer onCancel={onClose} busy={m.isPending} canSubmit={form.nameEn.trim().length > 0 && !!form.contractType} />
      </form>
    </DialogShell>
  );
}

// ─── Clause create ──────────────────────────────────────────────────────────

const CLAUSE_CATEGORIES = [
  "confidentiality",
  "non_compete",
  "payment",
  "termination",
  "force_majeure",
  "ip",
  "data_protection",
  "dispute_resolution",
  "governing_law",
  "indemnity",
  "emiratisation",
  "assignment",
  "liability",
  "notice",
  "warranties",
];

interface CreateClauseDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateClauseDialog({ open, onClose }: CreateClauseDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateClauseInput>({
    category: "confidentiality",
    titleEn: "",
    bodyEn: "",
    variant: "standard",
  });
  const m = useMutation({
    mutationFn: () => clausesService.create(form),
    onSuccess: () => {
      toast.success(t("clauses.create.success", { defaultValue: "Clause created" }));
      void qc.invalidateQueries({ queryKey: ["clauses"] });
      onClose();
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  return (
    <DialogShell open={open} onClose={onClose} busy={m.isPending} title={t("clauses.create.title", { defaultValue: "New clause" })}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        className="space-y-3 px-5 py-4"
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
              onChange={(e) => setForm({ ...form, variant: e.target.value as "standard" | "alternative" | "fallback" })}
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
            value={form.bodyEn}
            onChange={(e) => setForm({ ...form, bodyEn: e.target.value })}
            rows={6}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Footer onCancel={onClose} busy={m.isPending} canSubmit={form.titleEn.trim().length > 0 && form.bodyEn.trim().length > 0} />
      </form>
    </DialogShell>
  );
}

// ─── Obligation create ──────────────────────────────────────────────────────

interface CreateObligationDialogProps {
  open: boolean;
  onClose: () => void;
  /** Optional preset contractId (when invoked from a contract detail). */
  contractId?: number;
}

export function CreateObligationDialog({ open, onClose, contractId }: CreateObligationDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateObligationInput>({
    contractId: contractId ?? 0,
    titleEn: "",
    obligationType: "payment",
    recurrence: "once",
    responsibleParty: "our_party",
    status: "open",
  });
  const m = useMutation({
    mutationFn: () => obligationsService.create(form),
    onSuccess: () => {
      toast.success(t("obligations.create.success", { defaultValue: "Obligation added" }));
      void qc.invalidateQueries({ queryKey: ["obligations"] });
      onClose();
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  return (
    <DialogShell open={open} onClose={onClose} busy={m.isPending} title={t("obligations.create.title", { defaultValue: "Add obligation" })}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        className="space-y-3 px-5 py-4"
      >
        {!contractId && (
          <Field label={t("obligations.fields.contractId", { defaultValue: "Contract ID" })} required>
            <Input
              type="number"
              required
              value={form.contractId || ""}
              onChange={(e) => setForm({ ...form, contractId: Number(e.target.value) })}
              placeholder="e.g. 7"
            />
            <p className="mt-1 text-[10px] text-ink-subtle">
              {t("obligations.fields.contractIdHelp", {
                defaultValue: "Numeric ID of the contract this obligation belongs to.",
              })}
            </p>
          </Field>
        )}
        <Field label={t("obligations.fields.titleEn", { defaultValue: "Title" })} required>
          <Input
            required
            value={form.titleEn}
            onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("obligations.fields.obligationType", { defaultValue: "Type" })}>
            <select
              value={form.obligationType}
              onChange={(e) => setForm({ ...form, obligationType: e.target.value as CreateObligationInput["obligationType"] })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="payment">Payment</option>
              <option value="delivery">Delivery</option>
              <option value="reporting">Reporting</option>
              <option value="renewal">Renewal</option>
              <option value="compliance">Compliance</option>
              <option value="notice">Notice</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label={t("obligations.fields.dueDate", { defaultValue: "Due date" })}>
            <Input
              type="date"
              value={form.dueDate ?? ""}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value || null })}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("obligations.fields.recurrence", { defaultValue: "Recurrence" })}>
            <select
              value={form.recurrence ?? "once"}
              onChange={(e) => setForm({ ...form, recurrence: e.target.value as CreateObligationInput["recurrence"] })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="once">Once</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
            </select>
          </Field>
          <Field label={t("obligations.fields.responsibleParty", { defaultValue: "Responsible" })}>
            <select
              value={form.responsibleParty ?? "our_party"}
              onChange={(e) => setForm({ ...form, responsibleParty: e.target.value as CreateObligationInput["responsibleParty"] })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="our_party">Our party</option>
              <option value="counterparty">Counterparty</option>
              <option value="both">Both</option>
            </select>
          </Field>
        </div>
        <Footer
          onCancel={onClose}
          busy={m.isPending}
          canSubmit={!!form.contractId && form.contractId > 0 && form.titleEn.trim().length > 0}
        />
      </form>
    </DialogShell>
  );
}

// ─── shared subcomponents ───────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
        {label}
        {required && <span className="ms-0.5 text-terracotta">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Footer({
  onCancel,
  busy,
  canSubmit,
}: {
  onCancel: () => void;
  busy: boolean;
  canSubmit: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
      <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
        {t("common.cancel", { defaultValue: "Cancel" })}
      </Button>
      <Button type="submit" size="sm" disabled={busy || !canSubmit}>
        {busy
          ? t("common.saving", { defaultValue: "Saving…" })
          : t("common.create", { defaultValue: "Create" })}
      </Button>
    </div>
  );
}
