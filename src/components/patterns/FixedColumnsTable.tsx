/**
 * FixedColumnsTable — utilities for keeping a split header / virtualized body
 * pair of `<table>` elements column-aligned.
 *
 * Why this exists:
 *   When you render a sticky header table separately from a virtualized body
 *   (a common TanStack pattern), the body container has a vertical scrollbar
 *   that subtracts ~17px from its inner width. The header container has the
 *   full width. Even with `table-fixed` and matching per-cell widths, the two
 *   tables distribute their columns over DIFFERENT totals → cells drift
 *   4-13px per column → the table reads as misaligned to users.
 *
 * Fix (two pieces, must be used together):
 *   1. PercentColgroup — render <colgroup> with the SAME percentages in BOTH
 *      head and body tables. Percentages distribute proportionally over
 *      whatever the available width happens to be, so the per-column
 *      proportions stay identical even when totals differ.
 *
 *   2. ScrollbarReservedHeader — wraps the header table with right padding
 *      equal to the scrollbar width (default 17px) so head and body tables
 *      get exactly the same available content width. The body container
 *      must use `overflow-y-scroll` (not `auto`) so the scrollbar is always
 *      reserved.
 *
 * Usage:
 *   <ScrollbarReservedHeader>
 *     <table className="w-full table-fixed text-sm">
 *       <PercentColgroup widths={[24,13,10,10,9,12,12,10]} />
 *       <thead>...</thead>
 *     </table>
 *   </ScrollbarReservedHeader>
 *   <div className="overflow-y-scroll h-[600px]" ref={parentRef}>
 *     ... per-row <table> with the SAME <PercentColgroup widths={...} /> ...
 *   </div>
 *
 * The widths array must sum to 100.
 */
import type { ReactNode } from "react";

/** Default scrollbar gutter (px). Most desktop browsers reserve 15-17px. */
export const DEFAULT_SCROLLBAR_GUTTER_PX = 17;

interface ScrollbarReservedHeaderProps {
  children: ReactNode;
  /** Background tone for the header strip; defaults to the surface token. */
  className?: string;
  /** Override scrollbar gutter in px (rare). */
  gutterPx?: number;
}

/**
 * Wrap a sticky header table so it reserves space for the scrollbar that
 * appears on the sibling virtualized body container. Without this the head
 * cells render 17px wider than the body cells.
 */
export function ScrollbarReservedHeader({
  children,
  className = "bg-surface",
  gutterPx = DEFAULT_SCROLLBAR_GUTTER_PX,
}: ScrollbarReservedHeaderProps) {
  return (
    <div style={{ paddingRight: gutterPx }} className={className}>
      {children}
    </div>
  );
}

interface PercentColgroupProps {
  /** Per-column widths in percent. MUST sum to 100. */
  widths: readonly number[];
}

/**
 * Render a `<colgroup>` with percentage widths. Use the SAME widths array in
 * both the head table and every per-row body table so the columns stay in
 * lockstep.
 */
export function PercentColgroup({ widths }: PercentColgroupProps) {
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: `${w}%` }} />
      ))}
    </colgroup>
  );
}
