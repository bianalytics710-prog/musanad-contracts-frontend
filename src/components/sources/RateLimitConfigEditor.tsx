/**
 * RateLimitConfigEditor — number-input editor for RateLimitConfig JSONB.
 * Used by SourceFormDialog and SourceDetailEditPage. Returns null when
 * every field is empty so callers can omit the field on submit.
 */
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { RateLimitConfig } from "@/types/entities/osint.types";

interface RateLimitConfigEditorProps {
  idPrefix: string;
  value: RateLimitConfig | null;
  onChange: (next: RateLimitConfig | null) => void;
  disabled?: boolean;
}

export function RateLimitConfigEditor({
  idPrefix,
  value,
  onChange,
  disabled,
}: RateLimitConfigEditorProps) {
  const { t } = useTranslation();
  const v: RateLimitConfig = value ?? {
    callsPerMinute: 0,
    burst: 0,
    minIntervalMs: 0,
    respectRetryAfter: true,
  };

  const update = (patch: Partial<RateLimitConfig>) => {
    onChange({ ...v, ...patch });
  };

  const num = (raw: string): number => {
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  };

  return (
    <fieldset className="grid gap-3 rounded-md border border-border bg-surface/30 p-3">
      <legend className="px-1 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
        {t("admin.sources.form.rateLimit.label", { defaultValue: "Rate limit" })}
      </legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-callsPerMinute`} className="text-xs">
            {t("admin.sources.form.rateLimit.callsPerMinute", {
              defaultValue: "Calls / minute",
            })}
          </Label>
          <Input
            id={`${idPrefix}-callsPerMinute`}
            type="number"
            inputMode="numeric"
            min={0}
            value={v.callsPerMinute}
            onChange={(e) => update({ callsPerMinute: num(e.target.value) })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-burst`} className="text-xs">
            {t("admin.sources.form.rateLimit.burst", { defaultValue: "Burst" })}
          </Label>
          <Input
            id={`${idPrefix}-burst`}
            type="number"
            inputMode="numeric"
            min={0}
            value={v.burst}
            onChange={(e) => update({ burst: num(e.target.value) })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-minIntervalMs`} className="text-xs">
            {t("admin.sources.form.rateLimit.minIntervalMs", {
              defaultValue: "Min interval (ms)",
            })}
          </Label>
          <Input
            id={`${idPrefix}-minIntervalMs`}
            type="number"
            inputMode="numeric"
            min={0}
            value={v.minIntervalMs}
            onChange={(e) => update({ minIntervalMs: num(e.target.value) })}
            disabled={disabled}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink-muted">
        <Switch
          id={`${idPrefix}-respectRetryAfter`}
          checked={v.respectRetryAfter}
          onCheckedChange={(checked) =>
            update({ respectRetryAfter: Boolean(checked) })
          }
          disabled={disabled}
        />
        <span>
          {t("admin.sources.form.rateLimit.respectRetryAfter", {
            defaultValue: "Respect Retry-After headers",
          })}
        </span>
      </label>
    </fieldset>
  );
}
