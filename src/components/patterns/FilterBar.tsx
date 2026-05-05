import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  search?: string;
  onSearchChange?: (v: string) => void;
  filters?: ReactNode;
  activeFilterCount?: number;
  onClear?: () => void;
  className?: string;
}

export function FilterBar({
  search,
  onSearchChange,
  filters,
  activeFilterCount = 0,
  onClear,
  className,
}: Props) {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      className={cn(
        "mb-4 flex items-center gap-2 border-b border-border py-3",
        className,
      )}
    >
      <div className="relative flex-1 md:max-w-[280px]">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        <Input
          value={search ?? ""}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={t("common.search", { defaultValue: "Search" })}
          className="ps-9"
        />
      </div>

      <div className="hidden flex-1 items-center gap-2 md:flex">{filters}</div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="md:hidden relative tap-target"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={t("filterBar.toggleFilters", { defaultValue: "Filters" })}
      >
        <SlidersHorizontal className="h-4 w-4" />
        {activeFilterCount > 0 && (
          <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 font-mono text-[10px] text-ink">
            {activeFilterCount}
          </span>
        )}
      </Button>

      {activeFilterCount > 0 && onClear && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="ms-auto text-ink-muted"
        >
          <X className="me-1 h-3.5 w-3.5" /> Clear
        </Button>
      )}

      {mobileOpen && (
        <div className="absolute inset-x-4 top-32 z-40 flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-md md:hidden">
          {filters}
        </div>
      )}
    </div>
  );
}
