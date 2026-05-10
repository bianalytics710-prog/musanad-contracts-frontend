// ============================================================
// M8 — Internal Signal Data Path (CR-A2) — TypeScript Type Definitions
// FRONTEND-ONLY SUBSET. Mirrors workspace types.ts (Agent 5 contract output)
// narrowed to what the FE actually consumes:
//   - InternalSignalKind catalogue (admin viewer @ /app/admin/internal-signal-kinds)
//   - InternalSignalParameterSchema (rendered as collapsible JSON)
//   - InternalSignalType / SignalResolutionKind / InternalSignalStatusFilter
//     (string unions kept in sync with DB CHECK enums + workspace types.ts)
//
// Derived from: workspace types.ts, db-design.md §5.3 (fn_internal_signal_kind_list
// JSONB output), api-contracts.json ep_internal_signal_kind_list elementShape.
//
// Naming conventions
//   - All keys camelCase verbatim per fn_ JSONB output.
//   - Severity is REUSED from osint.types.ts (M7) — NOT redefined.
//
// CR-A2 brief explicit: "No new dedicated FE in CR-A2." This file therefore
// intentionally drops the read/list/ingest/resolve interfaces from the
// workspace types.ts; they will land in a follow-up CR (CR-G dashboards / CR-E
// rule engine) when the corresponding UI surfaces are introduced.
// ============================================================

import type { Severity } from "./osint.types";

// ============================================================
// 1. String unions
// ============================================================

/**
 * The 8 SOT-sealed internal signal sub-types. Maps 1:1 to the
 * `internal_signal_kind.signal_type` CHECK enum (db-design.md §1.1).
 */
export type InternalSignalType =
  | "milestone_slippage"
  | "sla_breach"
  | "payment_delay"
  | "invoice_dispute"
  | "vendor_incident"
  | "ics_incident"
  | "icv_status_change"
  | "certificate_expiry";

/**
 * Resolution kind closed-list (db-design.md §5.2 step 5). Carried here for
 * future surfaces (signal resolve UI in CR-G / dashboards). Not used by the
 * CR-A2 admin catalogue viewer.
 */
export type SignalResolutionKind =
  | "cleared"
  | "superseded"
  | "mitigated"
  | "false_positive";

/**
 * Resolution-state filter for `GET /api/v1/internal-signals`. Carried here
 * for future surfaces. Not used by the CR-A2 admin catalogue viewer.
 */
export type InternalSignalStatusFilter = "open" | "resolved" | "all";

// ============================================================
// 2. Parameter schema (JSON-Schema-style spec on each catalogue row)
// ============================================================

/**
 * Shape of the `parameter_schema` JSONB column on `internal_signal_kind`.
 * `required[]` keys MUST be present on the ingest payload; `optional[]` is
 * documentary only. Rendered as a collapsible JSON preview in the admin
 * viewer.
 */
export interface InternalSignalParameterSchema {
  required: string[];
  optional: string[];
}

// ============================================================
// 3. InternalSignalKind (catalogue read shape — bare-array list)
// ============================================================

/**
 * Catalogue row as projected by `fn_internal_signal_kind_list` (db-design.md
 * §5.3 / api-contracts.json ep_internal_signal_kind_list.elementShape).
 *
 * Bare-array list shape — NO surrounding `{ data, pagination }` envelope per
 * S2-12 EXCEPTION-PASS (bounded set of 8 rows per tenant).
 */
export interface InternalSignalKind {
  id: number;
  signalType: InternalSignalType;
  displayName: string;
  displayNameAr: string;
  description: string | null;
  parameterSchema: InternalSignalParameterSchema;
  defaultSeverity: Severity;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Bare-array response for `GET /api/v1/admin/internal-signal-kinds`. Matches
 * the M7 `fn_source_health_list` precedent.
 */
export type InternalSignalKindListResponse = InternalSignalKind[];
