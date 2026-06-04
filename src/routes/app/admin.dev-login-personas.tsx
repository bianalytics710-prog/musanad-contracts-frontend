/**
 * /app/admin/dev-login-personas — toggle which dev personas appear on the
 * one-click login panel (mig 538). Platform admin only; gated by the
 * dev.login_personas.manage permission.
 *
 * 13-checklist:
 *   T1/T2 — service + React Query
 *   T3    — strings via t() with defaults
 *   T4    — loading / error / saved states
 *   T5    — semantic tokens only
 *   T6    — switch buttons are real <button> with aria-pressed
 *   T7    — no any
 *   T11   — wrapped by ErrorBoundary
 */
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Save, RotateCcw, ShieldCheck } from "lucide-react";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import { devLoginPersonasService } from "@/services/api/dev-login-personas.service";

export const Route = createFileRoute("/app/admin/dev-login-personas")({
  component: () => (
    <ErrorBoundary>
      <DevLoginPersonasPage />
    </ErrorBoundary>
  ),
});

/**
 * Mirror of the persona list in LoginForm.tsx. Kept here so the admin UI
 * can show every persona regardless of current visibility state.
 */
const ALL_PERSONAS = [
  { key: "super",      name: "System Admin",      role: "Super Admin",        initials: "SA" },
  { key: "platform",   name: "Omar Al Mansoori",  role: "Platform Admin",     initials: "OM" },
  { key: "legal",      name: "Layla Al Hashemi",  role: "Legal Counsel",      initials: "LH" },
  { key: "drafter",    name: "Hala Al Suwaidi",   role: "Contract Drafter",   initials: "HS" },
  { key: "approver",   name: "Aisha Al Nahyan",   role: "Contract Approver",  initials: "AN" },
  { key: "recipient",  name: "Rashid Al Awadi",   role: "Contract Recipient", initials: "RA" },
  { key: "executive",  name: "Eman Al Mazrouei",  role: "Executive",          initials: "EM" },
  { key: "operations", name: "Yusuf Al Falasi",   role: "Operations",         initials: "YF" },
  { key: "finance",    name: "Fatima Al Marri",   role: "Finance & Treasury", initials: "FM" },
  { key: "compliance", name: "Khalid Al Qubaisi", role: "Compliance & ESG",   initials: "KQ" },
  { key: "procurement",name: "Hessa Al Hamadi",   role: "Procurement Risk",   initials: "HH" },
] as const;

function DevLoginPersonasPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const canManage = useAuthStore(selectHasPermission("dev.login_personas.manage"));

  const { data: storedHidden, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["devLoginPersonasHiddenAdmin"],
    queryFn: () => devLoginPersonasService.getHidden(),
    staleTime: 30_000,
  });

  const [draft, setDraft] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (storedHidden && !draft) {
      setDraft(new Set(storedHidden));
    }
  }, [storedHidden, draft]);

  const dirty = (() => {
    if (!draft || !storedHidden) return false;
    if (draft.size !== storedHidden.length) return true;
    for (const k of storedHidden) {
      if (!draft.has(k)) return true;
    }
    return false;
  })();

  const saveMutation = useMutation({
    mutationFn: (hidden: string[]) => devLoginPersonasService.setHidden(hidden),
    onSuccess: () => {
      toast.success(
        t("admin.devPersonas.saved", { defaultValue: "Persona visibility saved." }),
      );
      void qc.invalidateQueries({ queryKey: ["devLoginPersonasHiddenAdmin"] });
      void qc.invalidateQueries({ queryKey: ["devLoginPersonasHidden"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (key: string) => {
    if (!draft) return;
    const next = new Set(draft);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setDraft(next);
  };

  const handleSave = () => {
    if (!draft) return;
    saveMutation.mutate(Array.from(draft));
  };

  const handleReset = () => {
    if (storedHidden) setDraft(new Set(storedHidden));
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[820px] space-y-4 p-6">
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-card" />
        ))}
      </div>
    );
  }

  if (isError || !draft) {
    return (
      <div className="mx-auto w-full max-w-[820px] p-6">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {(error as Error)?.message ?? t("common.error")}
          </p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()} className="mt-2">
            {t("common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const visibleCount = ALL_PERSONAS.length - draft.size;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[820px] space-y-5 p-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink">
            <ShieldCheck className="h-6 w-6 text-gold" aria-hidden />
            {t("admin.devPersonas.title", { defaultValue: "Login personas" })}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            {t("admin.devPersonas.intro", {
              defaultValue:
                "Toggle which personas appear on the one-click sign-in panel of the login page. Hidden personas can still authenticate with email + password.",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleReset} disabled={!dirty}>
            <RotateCcw className="me-1.5 h-3.5 w-3.5" aria-hidden />
            {t("common.reset", { defaultValue: "Reset" })}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!dirty || !canManage || saveMutation.isPending}
          >
            <Save className="me-1.5 h-3.5 w-3.5" aria-hidden />
            {saveMutation.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </header>

      {!canManage && (
        <p className="rounded-md border border-amber/40 bg-amber-tint/40 p-3 text-xs text-amber-ink">
          {t("admin.devPersonas.readOnly", {
            defaultValue:
              "You can view the current state but only platform admins can save changes (permission dev.login_personas.manage).",
          })}
        </p>
      )}

      <p className="text-xs text-ink-muted">
        {t("admin.devPersonas.summary", {
          defaultValue: "{{visible}} of {{total}} personas visible.",
          visible: visibleCount,
          total: ALL_PERSONAS.length,
        })}
      </p>

      <ul className="space-y-2">
        {ALL_PERSONAS.map((p) => {
          const hidden = draft.has(p.key);
          return (
            <li
              key={p.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-semibold text-gold">
                  {p.initials}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-ink">{p.name}</p>
                  <p className="text-[11px] text-ink-muted">{p.role}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggle(p.key)}
                disabled={!canManage}
                aria-pressed={!hidden}
                aria-label={hidden
                  ? t("admin.devPersonas.show", { defaultValue: "Show on login page" })
                  : t("admin.devPersonas.hide", { defaultValue: "Hide from login page" })}
                className={
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition " +
                  (hidden
                    ? "border-border bg-muted text-ink-muted hover:border-ink-muted"
                    : "border-sage/40 bg-sage/10 text-sage hover:border-sage")
                }
              >
                {hidden ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" aria-hidden />
                    {t("admin.devPersonas.hidden", { defaultValue: "Hidden" })}
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                    {t("admin.devPersonas.visible", { defaultValue: "Visible" })}
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
