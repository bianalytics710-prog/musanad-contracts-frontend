/**
 * RegulatoryRadarChart — radar visualization (S6 sub-component).
 *
 * Mode: HARDEN — based on Lovable
 * `src/components/regulations/RegulatoryRadar.tsx` (543L). The Lovable
 * component is a pure SVG visualization with NO supabase coupling — it
 * accepts dots/categories as props. Hardening transformations applied:
 *
 *   T1 — n/a (no data layer; props-only API).
 *   T2 — n/a (no data fetching).
 *   T3 — every visible string already routed through `t()` (preserved).
 *   T4 — caller renders three states; this child renders the SVG only.
 *   T5 — semantic Tailwind tokens preserved verbatim.
 *   T6 — role="img", aria-label translated; reduced-motion respected.
 *   T7 — strict TS; no `any`.
 *   T11 — caller wraps in ErrorBoundary at the route level.
 *
 * Preserved Lovable behaviour:
 *   - Quadrant assignment by impact_category (or legacy regulator fallback).
 *   - Recency rings: today / week / month / quarter (publishedDate distance).
 *   - Severity → SVG dot radius map.
 *   - Sweep animation @ 360° per 20s when not interacting + not reduced-motion.
 *   - Pan (Shift+drag) / zoom (wheel).
 *   - Hover tooltip (regulator + publishedDate + impact count).
 *   - Connecting lines + outer-edge contract nodes when selected + impacts
 *     are passed (signature M5 reveal moment).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// ─── Types (props API) ────────────────────────────────────────────────────

export type RadarSeverity = "critical" | "high" | "medium" | "low";

export interface RadarCategory {
  id: string;
  key: string;
  nameEn: string;
  nameAr: string;
  /** Token name e.g. "gold","sage","terracotta","slate","amber". */
  colour: string;
}

export interface RadarDot {
  id: string;
  regulator: string;
  title: string;
  publishedDate: string;
  severity: RadarSeverity;
  impactCount: number;
  categoryId?: string | null;
}

interface PlottedDot extends RadarDot {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  ringIdx: number;
  quadrantIdx: number;
}

export interface ImpactedContract {
  id: string;
  contractNumber: string;
  alreadyAmended?: boolean;
}

interface Props {
  dots: RadarDot[];
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  /**
   * Active impact categories — drive quadrants + dot colors. Falls back to
   * legacy regulator quadrants if absent or empty.
   */
  categories?: RadarCategory[];
  impactedContracts?: ImpactedContract[];
  className?: string;
}

// ─── Quadrants + colour mapping ───────────────────────────────────────────

const LEGACY_QUADRANTS: Array<{
  key: "north" | "east" | "south" | "west";
  regulators: string[];
}> = [
  { key: "north", regulators: ["MoHRE"] },
  { key: "east", regulators: ["FTA", "Central Bank"] },
  { key: "south", regulators: ["DIFC", "ADGM"] },
  { key: "west", regulators: ["TDRA", "MoE", "MoJ"] },
];

const QUADRANT_KEYS = ["north", "east", "south", "west"] as const;
type QuadKey = (typeof QUADRANT_KEYS)[number];

const QUADRANT_CENTER_ANGLE: Record<QuadKey, number> = {
  north: -Math.PI / 2,
  east: 0,
  south: Math.PI / 2,
  west: Math.PI,
};

function legacyQuadrantForRegulator(reg: string): {
  idx: number;
  subIdx: number;
  count: number;
} {
  for (let i = 0; i < LEGACY_QUADRANTS.length; i++) {
    const q = LEGACY_QUADRANTS[i];
    const sub = q.regulators.indexOf(reg);
    if (sub >= 0) return { idx: i, subIdx: sub, count: q.regulators.length };
  }
  return { idx: 3, subIdx: 0, count: 1 };
}

const COLOUR_TO_VAR: Record<string, string> = {
  gold: "var(--gold)",
  sage: "var(--sage-ink)",
  terracotta: "var(--terracotta)",
  amber: "var(--amber)",
  slate: "var(--slate)",
  ink: "var(--ink)",
};

function colourForCategory(c: RadarCategory | undefined): string {
  if (!c) return "var(--slate)";
  return COLOUR_TO_VAR[c.colour] ?? "var(--slate)";
}

function ringIndex(publishedISO: string): number {
  const days =
    (Date.now() - new Date(publishedISO).getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 1) return 3;
  if (days <= 7) return 2;
  if (days <= 30) return 1;
  return 0;
}

const SEVERITY_RADIUS: Record<RadarSeverity, number> = {
  critical: 9,
  high: 8,
  medium: 6,
  low: 4,
};

const SEVERITY_COLOR: Record<RadarSeverity, string> = {
  critical: "var(--ink)",
  high: "var(--terracotta)",
  medium: "var(--amber)",
  low: "var(--slate)",
};

// Geometry constants
const VB = 600;
const CENTER = VB / 2;
const RADIUS = 260;
const RING_RADII = [80, 140, 200, 260];
const RING_LABEL_KEYS = ["quarter", "month", "week", "today"] as const;

// ─── Component ────────────────────────────────────────────────────────────

export function RegulatoryRadarChart({
  dots,
  selectedId,
  onSelect,
  categories,
  impactedContracts,
  className,
}: Props) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language?.startsWith("ar") ? "ar" : "en";
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverId, setHoverId] = useState<string | undefined>(undefined);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    id: string;
  } | null>(null);
  const [interacting, setInteracting] = useState(false);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sweepAngle, setSweepAngle] = useState(0);
  const [revealTick, setRevealTick] = useState(0);

  useEffect(() => {
    setRevealTick((n) => n + 1);
  }, [selectedId, impactedContracts?.length]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reducedMotion || interacting) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setSweepAngle((a) => (a + (dt * 360) / 20000) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, interacting]);

  const quadrantCategories = useMemo<RadarCategory[] | null>(() => {
    if (!categories || categories.length === 0) return null;
    return categories.slice(0, 4);
  }, [categories]);

  const quadrantLabels = useMemo<Record<QuadKey, string>>(() => {
    if (!quadrantCategories) {
      return {
        north: t("regulatory.radar.quadrants.north"),
        east: t("regulatory.radar.quadrants.east"),
        south: t("regulatory.radar.quadrants.south"),
        west: t("regulatory.radar.quadrants.west"),
      };
    }
    const out: Record<QuadKey, string> = {
      north: "—",
      east: "—",
      south: "—",
      west: "—",
    };
    quadrantCategories.forEach((c, i) => {
      out[QUADRANT_KEYS[i]] = lng === "ar" ? c.nameAr : c.nameEn;
    });
    return out;
  }, [quadrantCategories, lng, t]);

  function categoryQuadrantIdx(catId: string | null | undefined): number {
    if (!quadrantCategories || !catId) return 3;
    const idx = quadrantCategories.findIndex((c) => c.id === catId);
    return idx >= 0 ? idx : 3;
  }

  const plotted: PlottedDot[] = useMemo(() => {
    const buckets = new Map<string, RadarDot[]>();
    for (const d of dots) {
      const ring = ringIndex(d.publishedDate);
      const qIdx = quadrantCategories
        ? categoryQuadrantIdx(d.categoryId)
        : legacyQuadrantForRegulator(d.regulator).idx;
      const key = `${qIdx}:${ring}`;
      const arr = buckets.get(key) ?? [];
      arr.push(d);
      buckets.set(key, arr);
    }
    const ARC = (Math.PI / 2) * 0.78;
    const out: PlottedDot[] = [];
    for (const [key, arr] of buckets.entries()) {
      const [qIdxStr, ringStr] = key.split(":");
      const qIdx = parseInt(qIdxStr, 10);
      const ring = parseInt(ringStr, 10);
      const quadKey = QUADRANT_KEYS[Math.max(0, Math.min(3, qIdx))];
      const centerAng = QUADRANT_CENTER_ANGLE[quadKey];
      const r = RING_RADII[ring];
      arr.forEach((d, i) => {
        const tt = arr.length === 1 ? 0 : i / (arr.length - 1) - 0.5;
        const ang = centerAng + tt * ARC;
        const jitter = ((i % 3) - 1) * 6;
        const rr = r + jitter;
        let fill = SEVERITY_COLOR[d.severity];
        if (quadrantCategories && d.categoryId) {
          const cat =
            quadrantCategories.find((c) => c.id === d.categoryId) ??
            categories?.find((c) => c.id === d.categoryId);
          if (cat) fill = colourForCategory(cat);
        }
        out.push({
          ...d,
          cx: CENTER + Math.cos(ang) * rr,
          cy: CENTER + Math.sin(ang) * rr,
          r: SEVERITY_RADIUS[d.severity],
          fill,
          ringIdx: ring,
          quadrantIdx: qIdx,
        });
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dots, quadrantCategories, categories]);

  function onWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    setInteracting(true);
    setView((v) => {
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const next = Math.max(0.5, Math.min(3, v.scale * factor));
      return { ...v, scale: next };
    });
    window.clearTimeout((onWheel as unknown as { _t?: number })._t);
    (onWheel as unknown as { _t?: number })._t = window.setTimeout(
      () => setInteracting(false),
      800,
    );
  }

  const dragRef = useRef<{
    x: number;
    y: number;
    tx: number;
    ty: number;
  } | null>(null);

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!e.shiftKey) return;
    setInteracting(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setView((v) => ({
      ...v,
      tx: dragRef.current!.tx + dx,
      ty: dragRef.current!.ty + dy,
    }));
  }

  function onPointerUp() {
    dragRef.current = null;
    window.setTimeout(() => setInteracting(false), 200);
  }

  function handleEnter(d: PlottedDot, e: React.PointerEvent) {
    setHoverId(d.id);
    setInteracting(true);
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        id: d.id,
      });
    }
  }

  function handleLeave() {
    setHoverId(undefined);
    setTooltip(null);
    window.setTimeout(() => setInteracting(false), 300);
  }

  const hovered = plotted.find((d) => d.id === (hoverId ?? selectedId));

  return (
    <div className={`relative h-full w-full select-none ${className ?? ""}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB} ${VB}`}
        className="h-full w-full touch-none"
        role="img"
        aria-label={t("regulatory.radar.title")}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <radialGradient id="radar-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--gold-tint)" stopOpacity="0.4" />
            <stop offset="60%" stopColor="var(--background)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--background)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sweep-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--ink)" stopOpacity="0" />
            <stop offset="80%" stopColor="var(--ink)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--ink)" stopOpacity="0.18" />
          </radialGradient>
          <filter id="gold-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g
          transform={`translate(${view.tx} ${view.ty}) scale(${view.scale}) translate(${((1 - view.scale) * CENTER) / view.scale} ${((1 - view.scale) * CENTER) / view.scale})`}
        >
          <circle cx={CENTER} cy={CENTER} r={RADIUS + 10} fill="url(#radar-bg)" />

          {RING_RADII.map((r, i) => (
            <circle
              key={i}
              cx={CENTER}
              cy={CENTER}
              r={r}
              fill="none"
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray={i === RING_RADII.length - 1 ? "" : "2 4"}
              opacity={0.7}
            />
          ))}

          <line
            x1={CENTER}
            y1={CENTER - RADIUS}
            x2={CENTER}
            y2={CENTER + RADIUS}
            stroke="var(--border)"
            strokeWidth={1}
            opacity={0.5}
          />
          <line
            x1={CENTER - RADIUS}
            y1={CENTER}
            x2={CENTER + RADIUS}
            y2={CENTER}
            stroke="var(--border)"
            strokeWidth={1}
            opacity={0.5}
          />

          {!reducedMotion && (
            <g
              transform={`rotate(${sweepAngle} ${CENTER} ${CENTER})`}
              pointerEvents="none"
            >
              <path
                d={`M ${CENTER} ${CENTER} L ${CENTER + RADIUS} ${CENTER} A ${RADIUS} ${RADIUS} 0 0 1 ${CENTER + Math.cos(Math.PI / 6) * RADIUS} ${CENTER + Math.sin(Math.PI / 6) * RADIUS} Z`}
                fill="url(#sweep-grad)"
                opacity={0.55}
              />
            </g>
          )}

          {RING_RADII.map((r, i) => (
            <text
              key={`lbl-${i}`}
              x={CENTER + 6}
              y={CENTER - r + 12}
              fontSize={10}
              fill="var(--ink-subtle)"
              fontFamily="JetBrains Mono, monospace"
            >
              {t(`regulatory.radar.rings.${RING_LABEL_KEYS[i]}`)}
            </text>
          ))}

          <text
            x={CENTER}
            y={CENTER - RADIUS - 16}
            fontSize={13}
            fontWeight={600}
            textAnchor="middle"
            fill="var(--ink)"
          >
            {quadrantLabels.north}
          </text>
          <text
            x={CENTER + RADIUS + 12}
            y={CENTER + 4}
            fontSize={13}
            fontWeight={600}
            textAnchor="start"
            fill="var(--ink)"
          >
            {quadrantLabels.east}
          </text>
          <text
            x={CENTER}
            y={CENTER + RADIUS + 24}
            fontSize={13}
            fontWeight={600}
            textAnchor="middle"
            fill="var(--ink)"
          >
            {quadrantLabels.south}
          </text>
          <text
            x={CENTER - RADIUS - 12}
            y={CENTER + 4}
            fontSize={13}
            fontWeight={600}
            textAnchor="end"
            fill="var(--ink)"
          >
            {quadrantLabels.west}
          </text>

          <circle cx={CENTER} cy={CENTER} r={6} fill="var(--ink)" />
          <text
            x={CENTER}
            y={CENTER + 22}
            fontSize={11}
            textAnchor="middle"
            fill="var(--ink-muted)"
          >
            {t("regulatory.radar.centerLabel")}
          </text>

          {selectedId &&
            impactedContracts &&
            impactedContracts.length > 0 &&
            (() => {
              const sourceDot = plotted.find((d) => d.id === selectedId);
              if (!sourceDot) return null;
              const NODE_RADIUS = RADIUS + 18;
              const sourceAngle = Math.atan2(
                sourceDot.cy - CENTER,
                sourceDot.cx - CENTER,
              );
              const ARC = (300 * Math.PI) / 180;
              const n = impactedContracts.length;
              const lineDuration = 320;
              const stagger = 40;
              return (
                <g key={`conn-${revealTick}`} pointerEvents="none">
                  {impactedContracts.map((c, i) => {
                    const tt = n === 1 ? 0 : i / (n - 1) - 0.5;
                    const ang = sourceAngle + tt * ARC;
                    const nx = CENTER + Math.cos(ang) * NODE_RADIUS;
                    const ny = CENTER + Math.sin(ang) * NODE_RADIUS;
                    const dx = nx - sourceDot.cx;
                    const dy = ny - sourceDot.cy;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const delay = i * stagger;
                    const animStyle: React.CSSProperties = reducedMotion
                      ? {}
                      : {
                          strokeDasharray: len,
                          strokeDashoffset: len,
                          animation: `radar-draw ${lineDuration}ms ease-out ${delay}ms forwards`,
                        };
                    const nodeAnim: React.CSSProperties = reducedMotion
                      ? {}
                      : {
                          transformOrigin: `${nx}px ${ny}px`,
                          animation: `radar-node-pop 600ms ease-out ${delay + lineDuration - 80}ms both`,
                        };
                    return (
                      <g key={c.id}>
                        <line
                          x1={sourceDot.cx}
                          y1={sourceDot.cy}
                          x2={nx}
                          y2={ny}
                          stroke="var(--gold)"
                          strokeWidth={4}
                          strokeLinecap="round"
                          opacity={0.35}
                          filter="url(#gold-glow)"
                          style={animStyle}
                        />
                        <line
                          x1={sourceDot.cx}
                          y1={sourceDot.cy}
                          x2={nx}
                          y2={ny}
                          stroke="var(--gold)"
                          strokeWidth={2}
                          strokeLinecap="round"
                          opacity={0.95}
                          style={animStyle}
                        />
                        <g style={nodeAnim}>
                          <circle
                            cx={nx}
                            cy={ny}
                            r={c.alreadyAmended ? 6 : 5}
                            fill={
                              c.alreadyAmended
                                ? "var(--sage-tint)"
                                : "var(--background)"
                            }
                            stroke="var(--gold)"
                            strokeWidth={2}
                          />
                          {c.alreadyAmended && (
                            <circle
                              cx={nx}
                              cy={ny}
                              r={2}
                              fill="var(--sage-ink)"
                            />
                          )}
                        </g>
                        <title>{c.contractNumber}</title>
                      </g>
                    );
                  })}
                </g>
              );
            })()}

          {plotted.map((d) => {
            const isHover = hoverId === d.id;
            const isSelected = selectedId === d.id;
            const emphasized = isHover || isSelected;
            return (
              <g key={d.id}>
                {emphasized && (
                  <circle
                    cx={d.cx}
                    cy={d.cy}
                    r={d.r + 8}
                    fill={d.fill}
                    opacity={0.18}
                    className={reducedMotion ? "" : "animate-ping"}
                    style={{ animationDuration: "1600ms" }}
                  />
                )}
                <circle
                  cx={d.cx}
                  cy={d.cy}
                  r={emphasized ? d.r + 2 : d.r}
                  fill={d.fill}
                  stroke={emphasized ? "var(--gold)" : "var(--background)"}
                  strokeWidth={emphasized ? 2 : 1.5}
                  className="cursor-pointer transition-all"
                  onPointerEnter={(e) => handleEnter(d, e)}
                  onPointerLeave={handleLeave}
                  onClick={() =>
                    onSelect(d.id === selectedId ? undefined : d.id)
                  }
                />
              </g>
            );
          })}
        </g>
      </svg>

      {tooltip && hovered && (
        <div
          className="pointer-events-none absolute z-10 max-w-[260px] rounded-md border bg-popover px-3 py-2 text-xs shadow-md"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <div className="mb-1 font-medium text-ink line-clamp-2">
            {hovered.title}
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-ink-muted">
            <span>{t("regulatory.radar.tooltip.regulator")}:</span>
            <span className="text-ink">{hovered.regulator}</span>
            <span>{t("regulatory.radar.tooltip.published")}:</span>
            <span className="font-mono">{hovered.publishedDate}</span>
          </div>
          <div className="mt-1 text-gold">
            {t("regulatory.radar.tooltip.impacts", {
              count: hovered.impactCount,
            })}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-2 end-2 font-mono text-[10px] text-ink-subtle">
        {t("regulatory.radar.controls.panHint")}
      </div>
    </div>
  );
}
