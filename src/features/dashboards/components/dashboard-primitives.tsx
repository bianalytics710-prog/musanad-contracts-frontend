/**
 * Shared dashboard UI primitives — used by every operational + insights
 * dashboard so the harden / regenerate components stay focused on layout
 * + composition rather than re-implementing the standard tile / state
 * shells.
 *
 * Patterns:
 *   - KpiTile  — single number tile with translated label + optional
 *                helper. Renders disabled state when `disabled` prop is
 *                set (used for PlaceholderKpi tiles per DASH-OI-A).
 *   - PlaceholderKpiTile — wraps KpiTile for a PlaceholderKpi value with
 *                'feature pending' tooltip text.
 *   - TimeRangeSelector — pills for last_7d / last_30d / last_90d / custom.
 *                Custom shows two date inputs (we still translate them to
 *                windowDays at the caller because the BE only accepts
 *                windowDays per DN-A in db-design.md).
 *   - DashboardLoadingSkeleton — three-states pattern (T4).
 *   - DashboardErrorState
 *   - DashboardEmptyState
 *
 * All strings via t(). All dates via formatDateTime. Tailwind semantic
 * tokens only. T11 wrapping happens at the route file (route -> ErrorBoundary).
 */

import { useState, useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import type { TFunction } from "i18next";
import { Button } from "@/components/ui/button";
import { translateApiError } from "@/lib/translate-api-error";
import { cn } from "@/lib/utils";
import type { ApiError } from "@/lib/api-client";
import type {
  DashboardRangeKey,
  DashboardWindowQuery,
} from "@/types/entities/dashboards.types";

// ─── KpiTile ────────────────────────────────────────────────────────────────

export interface KpiTileProps {
  label: string;
  /** Pre-formatted display value (string already localised). */
  value: string;
  helper?: string;
  /** Renders disabled tile (greyed out, with title tooltip). */
  disabled?: boolean;
  /** Tooltip / title text — surfaced on disabled placeholder tiles. */
  hint?: string;
  /** Visual accent — left border colour-codes the tile. */
  variant?: "default" | "risk" | "warning" | "success";
  className?: string;
}

export function KpiTile({
  label,
  value,
  helper,
  disabled,
  hint,
  variant = "default",
  className,
}: KpiTileProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 transition-colors",
        variant === "risk" && "border-l-2 border-l-terracotta",
        variant === "warning" && "border-l-2 border-l-amber",
        variant === "success" && "border-l-2 border-l-sage",
        disabled && "border-dashed bg-muted/40 text-ink-muted",
        className,
      )}
      title={hint}
      aria-disabled={disabled || undefined}
    >
      <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-2xl font-semibold tracking-tight tabular-nums",
          disabled ? "text-ink-subtle" : "text-ink",
        )}
      >
        {value}
      </div>
      {helper && (
        <p className="mt-1 font-mono text-[11px] text-ink-subtle">{helper}</p>
      )}
    </div>
  );
}

// ─── PlaceholderKpiTile (DASH-OI-A) ─────────────────────────────────────────

export interface PlaceholderKpiTileProps {
  label: string;
  /** Hint text — e.g. "Templates module coming in M7". */
  hint: string;
  className?: string;
}

export function PlaceholderKpiTile({
  label,
  hint,
  className,
}: PlaceholderKpiTileProps) {
  const { t } = useTranslation();
  return (
    <KpiTile
      label={label}
      value="—"
      helper={t("dashboards.common.featurePending")}
      disabled
      hint={hint}
      className={className}
    />
  );
}

// ─── TimeRangeSelector ──────────────────────────────────────────────────────

export interface TimeRangeSelectorProps {
  range: DashboardRangeKey;
  windowDays: number;
  onChange: (next: { range: DashboardRangeKey; windowDays: number }) => void;
  /** Optional caps for the selector (e.g. AI cost summary clamps to 1..90). */
  maxWindowDays?: number;
  /** Optional minimum (defaults to 1). */
  minWindowDays?: number;
}

const RANGE_PRESETS: ReadonlyArray<{ key: DashboardRangeKey; days: number | null }> = [
  { key: "last_7d", days: 7 },
  { key: "last_30d", days: 30 },
  { key: "last_90d", days: 90 },
  { key: "custom", days: null },
];

export function TimeRangeSelector({
  range,
  windowDays,
  onChange,
  maxWindowDays = 365,
  minWindowDays = 1,
}: TimeRangeSelectorProps) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t("dashboards.common.timeRangeLabel")}
      className="flex flex-wrap items-center gap-2"
    >
      {RANGE_PRESETS.map((preset) => {
        const active = preset.key === range;
        const label = t(`dashboards.common.range.${preset.key}`);
        return (
          <button
            key={preset.key}
            type="button"
            onClick={() => {
              const nextDays =
                preset.days != null
                  ? clamp(preset.days, minWindowDays, maxWindowDays)
                  : windowDays;
              onChange({ range: preset.key, windowDays: nextDays });
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              active
                ? "border-gold bg-gold/10 text-ink"
                : "border-border bg-card text-ink-muted hover:border-gold/60 hover:text-ink",
            )}
            aria-pressed={active}
          >
            {label}
          </button>
        );
      })}

      {range === "custom" && (
        <label className="flex items-center gap-1 text-xs text-ink-muted">
          <span className="font-mono uppercase tracking-wider">
            {t("dashboards.common.range.customDaysLabel")}
          </span>
          <input
            type="number"
            min={minWindowDays}
            max={maxWindowDays}
            value={windowDays}
            onChange={(e) => {
              const next = clamp(
                Number.parseInt(e.target.value, 10) || minWindowDays,
                minWindowDays,
                maxWindowDays,
              );
              onChange({ range: "custom", windowDays: next });
            }}
            className="w-20 rounded-md border border-border bg-card px-2 py-1 text-sm text-ink focus-visible:border-gold focus-visible:outline-none"
            aria-label={t("dashboards.common.range.customDaysLabel")}
          />
        </label>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/** Helper: derive the initial DashboardRangeKey from a windowDays integer. */
export function rangeFromWindowDays(days: number): DashboardRangeKey {
  if (days === 7) return "last_7d";
  if (days === 30) return "last_30d";
  if (days === 90) return "last_90d";
  return "custom";
}

/** Helper: extract a typed DashboardWindowQuery from current state. */
export function asWindowQuery(windowDays: number): DashboardWindowQuery {
  return { windowDays };
}

// ─── Three-states primitives (T4) ───────────────────────────────────────────

export function DashboardLoadingSkeleton({
  rows = 3,
}: {
  rows?: number;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="space-y-3"
      aria-busy="true"
      aria-label={t("common.loading", { defaultValue: "Loading" })}
    >
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: rows * 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-md border border-border bg-card"
          />
        ))}
      </div>
    </div>
  );
}

export interface DashboardErrorStateProps {
  error: ApiError | Error | null;
  onRetry?: () => void;
  /** Override the localized fallback key — default `errors.generic`. */
  fallbackKey?: string;
}

export function DashboardErrorState({
  error,
  onRetry,
  fallbackKey = "errors.generic",
}: DashboardErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4"
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-destructive" aria-hidden />
        <p className="text-sm text-destructive">
          {translateApiError(error, t as TFunction, fallbackKey)}
        </p>
      </div>
      {onRetry && (
        <Button type="button" size="sm" variant="ghost" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

export function DashboardEmptyState({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-dashed border-border bg-card p-6 text-center">
      <p className="text-sm font-medium text-ink">
        {title ?? t("common.noData")}
      </p>
      {description && (
        <p className="mt-1 text-xs text-ink-muted">{description}</p>
      )}
    </div>
  );
}

// ─── Section (titled card list) ─────────────────────────────────────────────

export interface DashboardSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DashboardSection({
  title,
  description,
  action,
  children,
  className,
}: DashboardSectionProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-5 transition hover:border-gold/30",
        className,
      )}
    >
      <div className="mb-3 flex flex-row items-start justify-between gap-2 border-b border-border pb-3">
        <div>
          <div className="text-sm font-semibold text-ink">{title}</div>
          {description && (
            <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

// ─── Currency / number formatters ──────────────────────────────────────────

export function formatAed(value: number | null, locale: string = "en-AE"): string {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "AED",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `AED ${value.toFixed(0)}`;
  }
}

/**
 * R-EX0 — compact AED formatter. AED 146,300,000 -> "AED 146.3M".
 * Matches the Lovable executive dashboard convention so KPI tiles stay
 * single-line at desktop widths.
 */
export function formatAedCompact(
  value: number | null,
  locale: string = "en-AE",
): string {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "AED",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    // Manual fallback if Intl rejects "compact" (older runtimes).
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1_000_000_000) return `${sign}AED ${(abs / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${sign}AED ${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}AED ${(abs / 1_000).toFixed(1)}K`;
    return `${sign}AED ${abs.toFixed(0)}`;
  }
}

/**
 * E7 fix — chart tick formatter for AED axis values. Returns short
 * unit-suffixed strings ("AED 30B", "AED 12M", "AED 4K") so a y-axis
 * showing tens-of-billions doesn't render as "30000.0M".
 */
export function formatAedAxis(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}AED ${(abs / 1_000_000_000).toFixed(abs >= 100_000_000_000 ? 0 : 1)}B`;
  if (abs >= 1_000_000) return `${sign}AED ${(abs / 1_000_000).toFixed(abs >= 100_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}AED ${Math.round(abs / 1_000)}K`;
  return `${sign}AED ${abs.toFixed(0)}`;
}

/**
 * E5/E15/E16/E20/E23/E26/E30/E41 fix — turn snake_case / lowercase enum
 * slugs into human title-case labels for chart axes, table cells, badges.
 *   "abu_dhabi"        → "Abu Dhabi"
 *   "gas_spa"          → "Gas SPA"  (preserves common UAE acronyms)
 *   "MARKET_FINANCIAL" → "Market & Financial"
 *   "fx_usd_aed"       → "FX USD/AED"
 *   "icv_in_country_value" → "ICV (In-Country Value)"
 * Strings that already contain a mixed-case alpha word are returned
 * untouched so already-formatted names ("Mubadala Investment Company")
 * pass through.
 */
const HUMANIZE_OVERRIDES: Record<string, string> = {
  abu_dhabi: "Abu Dhabi",
  dubai: "Dubai",
  sharjah: "Sharjah",
  ajman: "Ajman",
  fujairah: "Fujairah",
  ras_al_khaimah: "Ras Al Khaimah",
  umm_al_quwain: "Umm Al Quwain",
  gas_spa: "Gas SPA",
  epc: "EPC",
  msa: "MSA",
  nda: "NDA",
  difc: "DIFC",
  adgm: "ADGM",
  uae_federal: "UAE Federal",
  market_financial: "Market & Financial",
  supply_chain: "Supply Chain",
  geopolitical: "Geopolitical",
  regulatory: "Regulatory",
  informational: "Informational",
  fx_usd_aed: "FX USD/AED",
  // K26 fix — humanise Impact Watch source slugs.
  fx_feed: "FX Feed",
  commodity_feed: "Commodity Feed",
  uk_hmt: "UK HMT",
  un_security_council: "UN Security Council",
  ofac: "OFAC",
  mock_social_x: "Social Monitoring (X/Twitter)",
  murban_osp: "Murban OSP",
  brent: "Brent",
  dubai_crude: "Dubai Crude",
  west_african_x: "West African (WAF)",
  icv_in_country_value: "ICV (In-Country Value)",
  key_personnel: "Key Personnel",
  strike_lockout: "Strike & Lockout",
  cure_period: "Cure Period",
  liquidated_damages: "Liquidated Damages",
  payment_terms: "Payment Terms",
  termination: "Termination",
  force_majeure: "Force Majeure",
  // Status labels
  active: "Active",
  draft: "Draft",
  expired: "Expired",
  terminated: "Terminated",
  in_approval: "In approval",
  fully_signed: "Fully signed",
  expiring_soon: "Expiring soon",
  awaiting_counterparty: "Awaiting counterparty",
  // Risk-kind buckets
  sanctions: "Sanctions",
  hormuz: "Hormuz",
  weather: "Weather",
  esg: "ESG",
  epc_sla: "EPC SLA",
  // Sides
  sell: "Sell",
  buy: "Buy",
  // Roles
  legal_review: "Legal review",
  approval_chain: "Approval chain",
  counterparty_signature: "Counterparty signature",
  drafting: "Drafting",
  // Persona / role labels (F66 — Procurement & Supplier Risk)
  procurement_supplier_risk: "Procurement & Supplier Risk",
  finance_treasury: "Finance & Treasury",
  legal_counsel: "Legal Counsel",
  compliance_esg: "Compliance & ESG",
  operations: "Operations",
  platform_admin: "Platform Admin",
  super_admin: "Super Admin",
  contract_drafter: "Contract Drafter",
  contract_approver: "Contract Approver",
  contract_recipient: "Contract Recipient",
  executive: "Executive",
  // Severity badges (F9 / F76 — humanise + drop uppercase)
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  // Trade-margin grades (F42 / F56 — real grade names instead of "Other")
  basra_light: "Basra Light",
  basra_heavy: "Basra Heavy",
  permian_light: "Permian Light",
  urals: "Urals",
  kebco: "KEBCO",
  bonny_light: "Bonny Light",
  forcados: "Forcados",
  // Triggers / sources (F50 / F75)
  price_change: "Price change",
  manual_recompute: "Manual recompute",
  scheduled_recompute: "Scheduled recompute",
  demo_reset: "Demo reset",
  price_review: "Price review",
  // A4 (Aisha audit) — collapse the "Internal:harness" osint source slug
  // to a clean label so the demo doesn't reveal test-fixture naming.
  "internal:harness": "Demo fixture",
  // Approval-action vocabulary (A11 / A13 / A41 — single canonical strings
  // used across row icons, modal segmented control, modal title,
  // decision-mix donut legend, and audit log labels).
  approve: "Approved",
  reject: "Rejected",
  requestresubmission: "Resubmission requested",
  request_resubmission: "Resubmission requested",
  request_changes: "Changes requested",
  resubmit: "Resubmission requested",
  delegate: "Delegated",
  skipped: "Skipped",
  // A7 — Priority enum surfaces (chips in /app/approvals).
  high_value: "High Value",
  urgent: "Urgent",
  routine: "Routine",
  // A30 — Tags (lowercase in seed).
  energy: "Energy",
  // A35 — Activity feed event_type slugs.
  ai_risk_score_updated: "AI risk score updated",
  submitted_for_approval: "Submitted for approval",
  approval_decision_recorded: "Approval decision recorded",
  comment_added: "Comment added",
  attachment_added: "Attachment added",
  signature_recorded: "Signature recorded",
  version_created: "Version created",
};

// Acronyms that should be UPPERCASED after the title-case pass so multi-word
// slugs like "compliance_esg" → "Compliance ESG" not "Compliance Esg".
const ACRONYMS = new Set([
  "esg", "epc", "spa", "uae", "adnoc", "msa", "nda", "icv", "kpi",
  "ai", "api", "fm", "fx", "osp", "sla", "ld", "vat", "id", "url",
  "difc", "adgm", "uk", "us", "eu", "un", "waf",
]);

export function humanizeLabel(slug: string | null | undefined): string {
  if (!slug) return "";
  const lower = slug.toLowerCase().trim();
  const override = HUMANIZE_OVERRIDES[lower];
  if (override) return override;
  // If the string contains spaces already AND mixed case (not a slug), return as-is.
  if (/[a-z][A-Z]/.test(slug)) return slug;
  // Snake / kebab → title-case words, then upper-case any acronyms.
  return lower
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

// K22 fix — locale-aware overrides so emirate names (and other commonly
// chart-axis-displayed slugs) appear in Arabic when the actor's UI is AR.
// Falls back to humanizeLabel for slugs without an AR translation.
const HUMANIZE_OVERRIDES_AR: Record<string, string> = {
  abu_dhabi: "أبوظبي",
  dubai: "دبي",
  sharjah: "الشارقة",
  ajman: "عجمان",
  fujairah: "الفجيرة",
  ras_al_khaimah: "رأس الخيمة",
  umm_al_quwain: "أم القيوين",
  unknown: "غير معروف",
};

export function humanizeLabelLocalized(
  slug: string | null | undefined,
  locale: string | undefined,
): string {
  if (!slug) return "";
  const isAr = !!locale && locale.toLowerCase().startsWith("ar");
  if (isAr) {
    const arOverride = HUMANIZE_OVERRIDES_AR[slug.toLowerCase().trim()];
    if (arOverride) return arOverride;
  }
  return humanizeLabel(slug);
}

export function formatUsd(value: number | null, locale: string = "en-US"): string {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

export function formatPercent(value: number | null, locale: string = "en-US"): string {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${(value * 100).toFixed(1)}%`;
  }
}

export function formatNumber(
  value: number | null | undefined,
  locale?: string,
): string {
  if (value == null) return "—";
  // R43 (Rashid audit 2026-06-01) — when the document is in AR mode, render
  // counts with Arabic-Indic digits ("٥" not "5") so the KPI tile is
  // consistent with the Hijri date strip. Falls back to the caller's
  // override or browser default.
  const effectiveLocale = (() => {
    if (locale) return locale;
    if (typeof document !== "undefined") {
      const lang = document.documentElement.lang;
      if (lang === "ar") return "ar-AE-u-nu-arab";
      if (lang === "en") return "en-AE";
    }
    return "en-US";
  })();
  try {
    return new Intl.NumberFormat(effectiveLocale).format(value);
  } catch {
    return String(value);
  }
}

// ─── DashboardFreshness ─────────────────────────────────────────────────────

function fromNowText(asOf: string): string {
  const diffMs = Date.now() - new Date(asOf).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  return `${diffH}h ago`;
}

export interface DashboardFreshnessProps {
  asOf: string;
  className?: string;
}

/**
 * "Updated Xs ago" indicator. Re-renders every 30 s using setInterval.
 * Uses the asOf ISO string from the dashboard response envelope.
 */
export function DashboardFreshness({ asOf, className }: DashboardFreshnessProps) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(() => fromNowText(asOf));

  useEffect(() => {
    setLabel(fromNowText(asOf));
    const id = setInterval(() => setLabel(fromNowText(asOf)), 30_000);
    return () => clearInterval(id);
  }, [asOf]);

  const displayText =
    label === "just now"
      ? t("dashboards.common.freshness.updatedJustNow", { defaultValue: "Updated just now" })
      : t("dashboards.common.freshness.updatedAgo", { when: label, defaultValue: `Updated ${label}` });

  return (
    <p className={cn("text-[11px] text-ink-subtle tabular-nums", className)}>
      {displayText}
    </p>
  );
}
