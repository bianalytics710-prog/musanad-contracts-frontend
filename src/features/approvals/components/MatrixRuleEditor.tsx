/**
 * MatrixRuleEditor (S5) — admin form for upsert/replace of approval matrix
 * rules for a (contract_type, value range) pair.
 *
 * Submits PUT /api/v1/admin/approval-matrix — fn_approval_matrix_set is
 * idempotent (same body re-saves to the same end state). Server enforces
 * step-order continuity (1..N), parallelGroup === stepOrder, valueMax >=
 * valueMin, and all role-name lookups; we mirror those rules client-side
 * for fast feedback but the BE is authoritative.
 *
 * AC mapping:
 *   AC-S5-01..05 — atomic set + step-order + parallel-group + role checks.
 *   AC-S5-06 — pg_advisory_xact_lock at BE; FE just submits.
 *   AC-S5-07 — failed validation = atomic rollback (BE).
 *
 * 13-checklist mapping:
 *   T1/T2 — service through approvalMatrixService + React Query.
 *   T3    — every label uses t().
 *   T6    — useFocusTrap + Esc-close; row reorder buttons fully keyboard-
 *           accessible (no drag-only).
 *   T7    — no any.
 *   T8    — submit guarded by useDoubleSubmitLock + per-row Zod-style
 *           validation.
 *   T11   — wrapped in route ErrorBoundary.
 *   T13   — no sensitive data here.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useDoubleSubmitLock } from "@/features/imports/hooks/useDoubleSubmitLock";
import { useSetApprovalMatrix } from "@/features/approvals/hooks/useApprovals";
import type {
  ApprovalMatrix,
  ApprovalMatrixRuleInput,
} from "@/types/entities/approval.types";
import { cn } from "@/lib/utils";

/**
 * Editable in-memory step row — superset of ApprovalMatrixRuleInput plus
 * UI fields (id key for React diffing, isParallel toggle).
 */
interface EditableStep {
  /** React-only key (uuid-like). */
  uiKey: string;
  approverRole: string;
  isParallel: boolean;
  isRequired: boolean;
  escalationRole: string;
  escalationAfterHours: string;
}

interface Props {
  /** Existing rule rows for this (contractType, valueMin, valueMax) — null = create. */
  existingRule: {
    contractType: string;
    valueMin: number;
    valueMax: number | null;
    rules: readonly ApprovalMatrix[];
  } | null;
  /** Default contract type when creating. */
  defaultContractType?: string;
  /** Available contract types for the picker. */
  contractTypes: readonly string[];
  /** Available roles (from backend; FE caller fetches & passes). */
  approverRoles: readonly string[];
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function makeKey(): string {
  return `step-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function fromExisting(rule: Props["existingRule"]): EditableStep[] {
  if (!rule || rule.rules.length === 0) {
    return [defaultRow()];
  }
  return [...rule.rules]
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((r) => ({
      uiKey: makeKey(),
      approverRole: r.approverRole,
      isParallel: r.parallelGroup !== null,
      isRequired: r.isRequired,
      escalationRole: r.escalationRole ?? "",
      escalationAfterHours:
        r.escalationAfterHours === null ? "" : String(r.escalationAfterHours),
    }));
}

function defaultRow(): EditableStep {
  return {
    uiKey: makeKey(),
    approverRole: "",
    isParallel: false,
    isRequired: true,
    escalationRole: "",
    escalationAfterHours: "",
  };
}

export function MatrixRuleEditor({
  existingRule,
  defaultContractType,
  contractTypes,
  approverRoles,
  open,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [contractType, setContractType] = useState<string>(
    existingRule?.contractType ?? defaultContractType ?? contractTypes[0] ?? "",
  );
  const [valueMin, setValueMin] = useState<string>(
    existingRule ? String(existingRule.valueMin) : "0",
  );
  const [valueMax, setValueMax] = useState<string>(
    existingRule?.valueMax === null
      ? ""
      : existingRule
        ? String(existingRule.valueMax)
        : "",
  );
  const [steps, setSteps] = useState<EditableStep[]>(fromExisting(existingRule));

  const lock = useDoubleSubmitLock();
  const mutation = useSetApprovalMatrix({
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
    onSettled: () => lock.release(),
  });

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    setContractType(
      existingRule?.contractType ?? defaultContractType ?? contractTypes[0] ?? "",
    );
    setValueMin(existingRule ? String(existingRule.valueMin) : "0");
    setValueMax(
      existingRule?.valueMax === null
        ? ""
        : existingRule
          ? String(existingRule.valueMax)
          : "",
    );
    setSteps(fromExisting(existingRule));
  }, [open, existingRule, defaultContractType, contractTypes]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !mutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mutation.isPending, onClose]);

  if (!open) return null;

  // ─── Validation ───────────────────────────────────────────────────────────
  const parsedMin = Number(valueMin);
  const parsedMax = valueMax === "" ? null : Number(valueMax);
  const minValid = Number.isFinite(parsedMin) && parsedMin >= 0;
  const maxValid =
    parsedMax === null || (Number.isFinite(parsedMax) && parsedMax >= parsedMin);
  const stepsValid =
    steps.length > 0 &&
    steps.every(
      (s) => s.approverRole && (!s.escalationAfterHours || Number(s.escalationAfterHours) > 0),
    );

  const canSubmit =
    !!contractType &&
    minValid &&
    maxValid &&
    stepsValid &&
    !mutation.isPending &&
    !lock.isLocked();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!lock.acquire()) return;

    // AC-S5-05 — parallelGroup, when set, MUST equal stepOrder.
    const rules: ApprovalMatrixRuleInput[] = steps.map((s, idx) => {
      const stepOrder = idx + 1;
      const rule: ApprovalMatrixRuleInput = {
        stepOrder,
        approverRole: s.approverRole,
        isRequired: s.isRequired,
      };
      if (s.isParallel) rule.parallelGroup = stepOrder;
      if (s.escalationRole) rule.escalationRole = s.escalationRole;
      if (s.escalationAfterHours) {
        rule.escalationAfterHours = Number(s.escalationAfterHours);
      }
      return rule;
    });

    mutation.mutate({
      contractType,
      valueMin: parsedMin,
      valueMax: parsedMax,
      rules,
    });
  };

  const move = (idx: number, delta: number) => {
    setSteps((prev) => {
      const next = [...prev];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const updateStep = (idx: number, patch: Partial<EditableStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

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
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {existingRule
              ? t("approval.matrix.editor.editTitle")
              : t("approval.matrix.editor.createTitle")}
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

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="matrix-ct"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("approval.matrix.editor.contractType")}
              </label>
              <select
                id="matrix-ct"
                value={contractType}
                onChange={(e) => setContractType(e.target.value)}
                disabled={mutation.isPending || !!existingRule}
                className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {contractTypes.map((ct) => (
                  <option key={ct} value={ct}>
                    {t(`contractTypes.${ct}`, { defaultValue: ct })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="matrix-min"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("approval.matrix.editor.valueMin")}
              </label>
              <input
                id="matrix-min"
                type="number"
                inputMode="decimal"
                min={0}
                value={valueMin}
                onChange={(e) => setValueMin(e.target.value)}
                disabled={mutation.isPending || !!existingRule}
                className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div>
              <label
                htmlFor="matrix-max"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("approval.matrix.editor.valueMax")}
              </label>
              <input
                id="matrix-max"
                type="number"
                inputMode="decimal"
                min={0}
                value={valueMax}
                onChange={(e) => setValueMax(e.target.value)}
                disabled={mutation.isPending || !!existingRule}
                placeholder={t("approval.matrix.editor.valueMaxPlaceholder")}
                className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          {!minValid && (
            <p className="text-[11px] text-destructive">
              {t("approval.matrix.editor.errors.valueMinInvalid")}
            </p>
          )}
          {!maxValid && (
            <p className="text-[11px] text-destructive">
              {t("approval.matrix.editor.errors.valueMaxInvalid")}
            </p>
          )}

          <section>
            <header className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                {t("approval.matrix.editor.stepsHeading")}
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSteps((prev) => [...prev, defaultRow()])}
                disabled={mutation.isPending}
              >
                <Plus className="me-1.5 h-3.5 w-3.5" />
                {t("approval.matrix.editor.addStep")}
              </Button>
            </header>
            <ol className="space-y-2">
              {steps.map((step, idx) => (
                <li
                  key={step.uiKey}
                  className="rounded-md border border-border bg-surface p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-background font-mono text-[11px] font-medium text-ink-muted">
                      {idx + 1}
                    </span>
                    <select
                      aria-label={t("approval.matrix.editor.approverRole")}
                      value={step.approverRole}
                      onChange={(e) =>
                        updateStep(idx, { approverRole: e.target.value })
                      }
                      disabled={mutation.isPending}
                      className={cn(
                        "h-9 flex-1 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                      )}
                    >
                      <option value="">
                        {t("approval.matrix.editor.selectRole")}
                      </option>
                      {approverRoles.map((r) => (
                        <option key={r} value={r}>
                          {t(`roles.${r}`, { defaultValue: r })}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("approval.matrix.editor.moveUp")}
                      onClick={() => move(idx, -1)}
                      disabled={mutation.isPending || idx === 0}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("approval.matrix.editor.moveDown")}
                      onClick={() => move(idx, 1)}
                      disabled={mutation.isPending || idx === steps.length - 1}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("approval.matrix.editor.removeStep")}
                      onClick={() =>
                        setSteps((prev) => prev.filter((_, i) => i !== idx))
                      }
                      disabled={mutation.isPending || steps.length <= 1}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-[11px] text-ink-muted">
                      <input
                        type="checkbox"
                        checked={step.isParallel}
                        onChange={(e) =>
                          updateStep(idx, { isParallel: e.target.checked })
                        }
                        disabled={mutation.isPending}
                      />
                      {t("approval.matrix.editor.parallel")}
                    </label>
                    <label className="flex items-center gap-2 text-[11px] text-ink-muted">
                      <input
                        type="checkbox"
                        checked={step.isRequired}
                        onChange={(e) =>
                          updateStep(idx, { isRequired: e.target.checked })
                        }
                        disabled={mutation.isPending}
                      />
                      {t("approval.matrix.editor.required")}
                    </label>
                    <div>
                      <label
                        htmlFor={`escalation-role-${step.uiKey}`}
                        className="block text-[11px] text-ink-muted"
                      >
                        {t("approval.matrix.editor.escalationRole")}
                      </label>
                      <select
                        id={`escalation-role-${step.uiKey}`}
                        value={step.escalationRole}
                        onChange={(e) =>
                          updateStep(idx, { escalationRole: e.target.value })
                        }
                        disabled={mutation.isPending}
                        className={cn(
                          "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm",
                          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                        )}
                      >
                        <option value="">
                          {t("approval.matrix.editor.escalationRoleNone")}
                        </option>
                        {approverRoles.map((r) => (
                          <option key={r} value={r}>
                            {t(`roles.${r}`, { defaultValue: r })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor={`escalation-hours-${step.uiKey}`}
                        className="block text-[11px] text-ink-muted"
                      >
                        {t("approval.matrix.editor.escalationAfterHours")}
                      </label>
                      <input
                        id={`escalation-hours-${step.uiKey}`}
                        type="number"
                        min={1}
                        value={step.escalationAfterHours}
                        onChange={(e) =>
                          updateStep(idx, { escalationAfterHours: e.target.value })
                        }
                        disabled={mutation.isPending}
                        className={cn(
                          "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm",
                          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                        )}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            {!stepsValid && (
              <p className="mt-2 text-[11px] text-destructive">
                {t("approval.matrix.editor.errors.stepsInvalid")}
              </p>
            )}
          </section>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {mutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MatrixRuleEditor;
