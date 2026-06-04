/**
 * Step5Review — Compose Wizard Step 5 (Read-only Review).
 *
 * AC-S1-05: side-by-side summary of all entered data — contract head,
 * body, payment-schedule rows. Submit button + Back button live in the
 * wizard parent's chrome (not here) so the layout stays consistent.
 *
 * Step 4 (Attachments) is SKIPPED in M1b — wizard advances directly from
 * Step 3 to Step 5 (AC-S1-01). A small banner in the parent reminds the
 * user that attachments are coming with the Attachments module.
 *
 * T13: bodies are SENSITIVE. We render them in a <pre> block (not <input>
 * which could be inadvertently autocompleted) and escape-via-React handles
 * any HTML injection.
 */
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/utils/datetime";
import type { ComposeWizardState } from "@/types/entities/payment-schedule.types";

interface Step5ReviewProps {
  state: ComposeWizardState;
  /**
   * Compose-revamp 2026-06-03 — drafter's typed placeholder values from
   * Step 2. The Body section substitutes {{token}} → value when present.
   */
  placeholderValues?: Record<string, string>;
}

export function Step5Review({ state, placeholderValues = {} }: Step5ReviewProps) {
  const { t } = useTranslation();
  const { step1, step2, step3 } = state;

  return (
    <div className="space-y-4">
      {/* Setup summary */}
      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-base font-semibold text-ink">
            {t("contracts.compose.steps.step5.setupSection")}
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Item label={t("contracts.fields.contractType")} value={step1.contractType || "—"} />
            <Item
              label={t("contracts.fields.language")}
              value={t(`contracts.languageOptions.${step1.language}`, {
                defaultValue: step1.language,
              })}
            />
            <Item
              label={t("contracts.compose.fields.ourPartyName")}
              value={step1.ourPartyName || t("contracts.compose.fields.partyDeferredValue")}
            />
            <Item
              label={t("contracts.compose.fields.counterpartyName")}
              value={step1.counterpartyName || t("contracts.compose.fields.partyDeferredValue")}
            />
          </dl>
        </CardContent>
      </Card>

      {/* Key terms */}
      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-base font-semibold text-ink">
            {t("contracts.compose.steps.step5.keyTermsSection")}
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Item label={t("contracts.fields.titleEn")} value={step2.titleEn || "—"} />
            <Item label={t("contracts.fields.titleAr")} value={step2.titleAr || "—"} />
            <Item
              label={t("contracts.fields.valueAed")}
              value={
                step2.valueAed === null || step2.valueAed === undefined
                  ? "—"
                  : `${step2.currency ?? "AED"} ${step2.valueAed.toLocaleString()}`
              }
            />
            <Item
              label={t("contracts.fields.startDate")}
              value={formatDate(step2.startDate ?? null)}
            />
            <Item label={t("contracts.fields.endDate")} value={formatDate(step2.endDate ?? null)} />
            <Item
              label={t("contracts.fields.expiryNoticeDays")}
              value={String(step2.expiryNoticeDays ?? 30)}
            />
            <Item label={t("contracts.fields.emirate")} value={step2.emirate ?? "—"} />
            <Item
              label={t("contracts.fields.governingLaw")}
              value={
                step2.governingLaw
                  ? t(`contracts.governingLawOptions.${step2.governingLaw}`, {
                      defaultValue: step2.governingLaw,
                    })
                  : "—"
              }
            />
            <Item
              label={t("contracts.fields.jurisdictionCourt")}
              value={step2.jurisdictionCourt ?? "—"}
            />
          </dl>
        </CardContent>
      </Card>

      {/* Payment schedule */}
      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-base font-semibold text-ink">
            {t("contracts.paymentSchedule.title")}
          </h2>
          {step2.paymentSchedule.length === 0 ? (
            <p className="text-xs text-ink-muted">
              {t("contracts.compose.steps.step5.paymentScheduleEmpty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-border bg-surface/60 text-ink-muted">
                  <tr className="text-left">
                    <th scope="col" className="px-3 py-2 font-medium">
                      #
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t("contracts.paymentSchedule.fields.milestoneLabelEn")}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t("contracts.paymentSchedule.fields.amountAed")}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t("contracts.paymentSchedule.fields.dueDate")}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t("contracts.paymentSchedule.fields.status")}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t("contracts.paymentSchedule.fields.recurrence")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {step2.paymentSchedule.map((row, index) => (
                    <tr key={index} className="border-b border-border/40">
                      <td className="px-3 py-2 text-ink-subtle">{index + 1}</td>
                      <td className="px-3 py-2 text-ink">{row.milestoneLabelEn}</td>
                      <td className="px-3 py-2 text-ink-muted">
                        {(row.amountAed ?? 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-ink-muted">
                        {row.dueDate ? formatDate(row.dueDate) : "—"}
                      </td>
                      <td className="px-3 py-2 text-ink-muted">
                        {row.status
                          ? t(`contracts.paymentSchedule.statusOptions.${row.status}`, {
                              defaultValue: row.status,
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-ink-muted">
                        {row.recurrence
                          ? t(`contracts.paymentSchedule.recurrenceOptions.${row.recurrence}`, {
                              defaultValue: row.recurrence,
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Body — placeholder-substituted, single-language view per Step 3
          revamp. Pick EN by default; AR appears only if bodyAr exists. */}
      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-base font-semibold text-ink">
            {t("contracts.compose.steps.step5.bodySection")}
          </h2>
          {step3.bodyEn && (
            <BodyBlock
              label={t("contracts.fields.bodyEn")}
              body={substitutePlaceholders(step3.bodyEn, placeholderValues)}
            />
          )}
          {step3.bodyAr && (
            <BodyBlock
              label={t("contracts.fields.bodyAr")}
              body={substitutePlaceholders(step3.bodyAr, placeholderValues)}
              rtl
            />
          )}
          {!step3.bodyEn && !step3.bodyAr && (
            <p className="text-xs text-ink-muted">
              {t("contracts.compose.steps.step5.bodyEmpty", {
                defaultValue: "No body content. Go back to Step 3 to add clauses.",
              })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* D29 — "Attachments will appear here once the Attachments module
          is enabled" stub removed. The Attachments tab on the contract
          detail page is fully wired; the drafter can upload files there
          after the draft is created. */}
    </div>
  );
}

interface ItemProps {
  label: string;
  value: string;
}

function Item({ label, value }: ItemProps) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

interface BodyBlockProps {
  label: string;
  body: string | null;
  rtl?: boolean;
}

function BodyBlock({ label, body, rtl }: BodyBlockProps) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">{label}</p>
      <pre
        className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-surface p-3 text-sm text-ink"
        dir={rtl ? "rtl" : "ltr"}
      >
        {body || "—"}
      </pre>
    </div>
  );
}

/**
 * Replace `{{token}}` occurrences with the matching value from the supplied
 * dictionary. Tokens without a corresponding entry stay as-is so the
 * drafter can spot any gaps.
 */
function substitutePlaceholders(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (raw, key) => {
    const v = values?.[key];
    return typeof v === "string" && v.trim() !== "" ? v : raw;
  });
}

export default Step5Review;
