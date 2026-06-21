/**
 * StageCheckboxFilter — a multi-select checkbox popover used by the My Work
 * inboxes in place of the old single-select "All stages" dropdown.
 *
 * Multiple stages/statuses can be active at once, so by default the inbox shows
 * everything that is still ON the task list (all options except the terminal
 * "completed"/"done" one) — the owning component seeds `selected` that way.
 * Generic over the option value type so it serves both the drafter Stage filter
 * and the unified-inbox PersonalWorkStatus filter.
 */
import { useTranslation } from "react-i18next";
import { ChevronDown, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface StageFilterOption<T extends string> {
  value: T;
  label: string;
}

interface StageCheckboxFilterProps<T extends string> {
  options: ReadonlyArray<StageFilterOption<T>>;
  selected: Set<T>;
  onChange: (next: Set<T>) => void;
  /** Trigger label, e.g. "Stages" / "Statuses". */
  label: string;
  ariaLabel: string;
}

export function StageCheckboxFilter<T extends string>({
  options,
  selected,
  onChange,
  label,
  ariaLabel,
}: StageCheckboxFilterProps<T>) {
  const { t } = useTranslation();
  const allChecked = options.every((o) => selected.has(o.value));
  const count = options.filter((o) => selected.has(o.value)).length;

  const toggle = (v: T): void => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  };
  const setAll = (on: boolean): void => {
    onChange(on ? new Set(options.map((o) => o.value)) : new Set<T>());
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={ariaLabel}
          className="h-9 gap-1.5 font-normal"
        >
          <ListFilter className="h-3.5 w-3.5 opacity-70" />
          <span>{label}</span>
          <span className="rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums text-muted-foreground">
            {allChecked
              ? t("myWork.filters.countAll", { defaultValue: "All" })
              : count}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setAll(!allChecked)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setAll(!allChecked);
            }
          }}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
        >
          <Checkbox checked={allChecked} className="pointer-events-none" />
          <span className="font-medium">
            {allChecked
              ? t("myWork.filters.clearAll", { defaultValue: "Clear all" })
              : t("myWork.filters.selectAll", { defaultValue: "Select all" })}
          </span>
        </div>
        <div className="my-1 h-px bg-border" />
        <div className="space-y-0.5">
          {options.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Checkbox
                checked={selected.has(o.value)}
                onCheckedChange={() => toggle(o.value)}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
