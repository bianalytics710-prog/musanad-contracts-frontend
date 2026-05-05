/**
 * ImpactCategoryPicker (S14 — picker variant) — small reusable select for
 * impact_category, used by RegulatoryUpdateFormFields and any future
 * surface that needs to pin a regulatory_update to a category.
 *
 * AC-S14-05 — all authenticated roles can list (no permission gate beyond
 * JWT). The list endpoint returns the full payload to all callers
 * (BE-OI-D); we simply expose the lightweight (id, key, nameEn) view here.
 */
import { useTranslation } from "react-i18next";
import { useImpactCategoryList } from "@/features/regulatory/hooks/useRegulatory";

interface Props {
  value: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function ImpactCategoryPicker({
  value,
  onChange,
  disabled,
  required,
  className,
  ariaLabel,
}: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = useImpactCategoryList();

  const categories = data?.data ?? [];

  return (
    <select
      aria-label={ariaLabel ?? t("regulatory.impactCategory.picker.ariaLabel")}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
      disabled={disabled || isLoading}
      required={required}
      className={
        className ??
        "rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      }
    >
      <option value="">
        {required
          ? t("regulatory.impactCategory.picker.placeholderRequired")
          : t("regulatory.impactCategory.picker.placeholderOptional")}
      </option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nameEn}
        </option>
      ))}
    </select>
  );
}
