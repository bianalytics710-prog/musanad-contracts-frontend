/**
 * GeographyFilterEditor — comma-separated list editor for the GeographyFilter
 * JSONB shape (countryIn, themeIn, actorIn). Kept simple: 3 text-areas with
 * comma-delimited input. The dialog/page calls submit-time normalisation
 * to split + trim entries and drop blanks before sending the payload.
 */
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GeographyFilter } from "@/types/entities/osint.types";

interface GeographyFilterEditorProps {
  idPrefix: string;
  value: GeographyFilter | null;
  onChange: (next: GeographyFilter | null) => void;
  disabled?: boolean;
}

function joinList(arr: string[] | undefined): string {
  return (arr ?? []).join(", ");
}

function splitList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function GeographyFilterEditor({
  idPrefix,
  value,
  onChange,
  disabled,
}: GeographyFilterEditorProps) {
  const { t } = useTranslation();
  const v: GeographyFilter = value ?? {};

  const update = (patch: Partial<GeographyFilter>) => {
    onChange({ ...v, ...patch });
  };

  return (
    <fieldset className="grid gap-3 rounded-md border border-border bg-surface/30 p-3">
      <legend className="px-1 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
        {t("admin.sources.form.geographyFilter.label", {
          defaultValue: "Geography filter",
        })}
      </legend>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-countryIn`} className="text-xs">
          {t("admin.sources.form.geographyFilter.countryIn", {
            defaultValue: "Country codes (comma-separated)",
          })}
        </Label>
        <Input
          id={`${idPrefix}-countryIn`}
          value={joinList(v.countryIn)}
          onChange={(e) =>
            update({ countryIn: splitList(e.target.value).map((s) => s.toUpperCase()) })
          }
          placeholder="AE, SA, OM, QA"
          disabled={disabled}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-themeIn`} className="text-xs">
          {t("admin.sources.form.geographyFilter.themeIn", {
            defaultValue: "Themes (comma-separated)",
          })}
        </Label>
        <Input
          id={`${idPrefix}-themeIn`}
          value={joinList(v.themeIn)}
          onChange={(e) => update({ themeIn: splitList(e.target.value) })}
          placeholder="ENERGY, MARITIME, SANCTIONS"
          disabled={disabled}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-actorIn`} className="text-xs">
          {t("admin.sources.form.geographyFilter.actorIn", {
            defaultValue: "Actors (comma-separated)",
          })}
        </Label>
        <Input
          id={`${idPrefix}-actorIn`}
          value={joinList(v.actorIn)}
          onChange={(e) => update({ actorIn: splitList(e.target.value) })}
          disabled={disabled}
        />
      </div>
    </fieldset>
  );
}
