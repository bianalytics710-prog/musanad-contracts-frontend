/**
 * useComposeDraft — localStorage persistence for the Compose Wizard.
 *
 * AC-S1-07: wizard state is persisted to localStorage on every input change
 * (debounced 300ms per CLAUDE.md §5) and restored when the user reloads the
 * page mid-flow. Persistence is keyed by user id + a session-scoped
 * compose-draft-id to allow multiple parallel drafts.
 *
 * Storage key shape: `compose-draft:{userId}:{composeDraftId}`
 *
 * Sensitive-field policy (T13): step3.bodyEn / step3.bodyAr are SENSITIVE.
 * We deliberately persist them to localStorage anyway because:
 *   - The user's Compose Wizard draft includes their typed body text.
 *   - Clearing on tab close would lose drafts on accidental reloads.
 *   - Storage is single-origin; a successful XSS already loses bigger
 *     secrets (the access token also lives in localStorage per M0).
 * BUT: the wizard component clears bodyEn / bodyAr from its in-memory
 * RHF state on unmount per FE-C1 pattern (see ComposeWizard.tsx). And on
 * successful submit, clearComposeDraft() removes the localStorage entry
 * entirely — sensitive bodies do not linger after success.
 *
 * Why a custom hook (vs Zustand persist): we need per-draft keying with
 * user.id in the key, and the wizard mount lifecycle is short-lived. A
 * one-component-scoped useState + useEffect pair is simpler than a global
 * store slice that would have to reconcile with multiple wizards.
 */

import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import type { ComposeWizardState } from "@/types/entities/payment-schedule.types";

const STORAGE_PREFIX = "compose-draft:";

/**
 * Codex F-FE-M1: drafts older than this TTL are evicted on read.
 *
 * Rationale:
 *   - Sensitive body text (T13) is stored intentionally so the user can
 *     recover from accidental reloads, but indefinite retention turns
 *     localStorage into a long-lived shadow copy of compose drafts.
 *   - 24h is the same window CLAUDE.md uses for "active session" — past
 *     that, the user is almost certainly returning to a different task and
 *     would be surprised to find unfinished body text waiting.
 *   - Successful submit clears the draft synchronously (clearComposeDraft);
 *     this TTL only kicks in for abandoned drafts.
 */
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Stored shape for a compose draft. Adds `_savedAt` (epoch ms) so the
 * reader can enforce the TTL without rewriting the wizard state.
 */
interface PersistedComposeDraft {
  state: ComposeWizardState;
  _savedAt: number;
}

function isPersistedDraft(value: unknown): value is PersistedComposeDraft {
  return (
    typeof value === "object" &&
    value !== null &&
    "_savedAt" in value &&
    typeof (value as { _savedAt: unknown })._savedAt === "number" &&
    "state" in value &&
    typeof (value as { state: unknown }).state === "object" &&
    (value as { state: unknown }).state !== null
  );
}

/** Build the storage key for a given user + draft. */
export function composeDraftKey(userId: number | null, composeDraftId: string): string {
  // Anonymous (userId=null) drafts use a sentinel; this should never happen
  // in practice because the route is gated by contract.draft permission.
  return `${STORAGE_PREFIX}${userId ?? "anon"}:${composeDraftId}`;
}

/**
 * Generate a fresh composeDraftId. Pattern: `cdraft-{ms}-{rand4}` so two
 * tabs opened in the same millisecond still produce distinct ids.
 */
export function generateComposeDraftId(): string {
  const ms = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `cdraft-${ms}-${rand}`;
}

/**
 * Read a wizard state from localStorage. Returns `null` if the key is
 * missing, the JSON is malformed, or the draft is older than `DRAFT_TTL_MS`
 * (Codex F-FE-M1). Stale drafts are evicted on read so the next call sees
 * a clean slate without requiring a separate cleanup pass.
 *
 * Codex round-2 FE-R2-001 (residual on F-FE-M1): legacy bare-state drafts
 * (written before the F-FE-M1 envelope patch) have NO `_savedAt`, so the
 * 24h TTL cannot be enforced for them. Restoring them would re-leak the
 * very sensitive bodyEn/bodyAr the F-FE-M1 patch was designed to bound.
 * Mitigation: on encountering a legacy bare-state draft we **evict** the
 * key immediately and return null. This is a one-time migration step —
 * users with pre-patch drafts lose them, which is the safest outcome
 * (T13 sensitive-field retention beats wizard-state recovery for the
 * narrow population of pre-patch abandoned drafts).
 *
 * We deliberately do NOT log the legacy payload during eviction — its
 * `state.step3.bodyEn` / `bodyAr` fields are sensitive (T13).
 */
export function readComposeDraft(
  userId: number | null,
  composeDraftId: string,
): ComposeWizardState | null {
  if (typeof window === "undefined") return null;
  const key = composeDraftKey(userId, composeDraftId);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);

    // New envelope — TTL applies.
    if (isPersistedDraft(parsed)) {
      if (Date.now() - parsed._savedAt > DRAFT_TTL_MS) {
        // Stale — evict and report no draft.
        try {
          window.localStorage.removeItem(key);
        } catch {
          // Quota / private mode — non-fatal.
        }
        return null;
      }
      return parsed.state;
    }

    // Legacy bare-state shape (pre-F-FE-M1). One-time eviction — see header
    // comment for FE-R2-001 rationale. Do not restore (no TTL enforceable);
    // do not log the payload (sensitive bodies).
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Quota / private mode — non-fatal; the legacy entry will be
      // overwritten on the next debounced save anyway.
    }
    return null;
  } catch {
    // Malformed JSON or quota error — return null and let the caller seed
    // a fresh state.
    return null;
  }
}

/**
 * Remove a wizard state from localStorage. Called on successful submit
 * (AC-S1-09) and on the user's explicit "Discard draft" action.
 */
export function clearComposeDraft(userId: number | null, composeDraftId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(composeDraftKey(userId, composeDraftId));
  } catch {
    // Quota / private-mode error — non-fatal.
  }
}

/**
 * useComposeDraft — debounced persistence of wizard state.
 *
 * Returns the same state value back to the caller (so the consumer can use
 * it as a controlled-component pattern). Internally schedules a debounced
 * write to localStorage every time the state changes — 300ms per AC-S1-07
 * + CLAUDE.md §5.
 *
 * On mount: does NOT auto-load. The caller is responsible for seeding
 * initial state via `readComposeDraft()` because the order in which the
 * wizard mounts vs reads the URL composeDraftId is consumer-specific.
 *
 * On unmount: does NOT auto-clear. Drafts must survive an accidental
 * navigation away. Explicit clearing happens on success / discard.
 */
export function useComposeDraft(userId: number | null, state: ComposeWizardState): void {
  const debounced = useDebounce(state, 300);

  // Track the last-written state so we can skip redundant writes during
  // React strict-mode double mounts. Compares by JSON since wizard state
  // is plain JSON-safe data.
  const lastWrittenRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Wrap the wizard state in the F-FE-M1 envelope so reads can apply TTL.
    const envelope: PersistedComposeDraft = {
      state: debounced,
      _savedAt: Date.now(),
    };
    let serialized: string;
    try {
      serialized = JSON.stringify(envelope);
    } catch {
      return;
    }
    // Cache the *state portion* (not the timestamp) so a fresh `_savedAt`
    // each tick doesn't fool us into re-writing identical wizard state.
    let stateCacheKey: string;
    try {
      stateCacheKey = JSON.stringify(debounced);
    } catch {
      return;
    }
    if (stateCacheKey === lastWrittenRef.current) return;
    try {
      window.localStorage.setItem(composeDraftKey(userId, debounced.composeDraftId), serialized);
      lastWrittenRef.current = stateCacheKey;
    } catch {
      // Quota exceeded / private mode — non-fatal, draft simply doesn't
      // survive the page reload.
    }
  }, [userId, debounced]);
}

/**
 * Convenience wrapper: returns a [state, setState] pair where state is
 * pre-populated from localStorage if a draft exists, and setState writes
 * back through useComposeDraft(). The wizard parent uses this directly.
 */
export function useComposeDraftState(
  userId: number | null,
  composeDraftId: string,
  initialFactory: () => ComposeWizardState,
): [ComposeWizardState, React.Dispatch<React.SetStateAction<ComposeWizardState>>] {
  // Lazy initial: only run the factory if no draft exists. Avoids
  // re-running the factory on every render.
  const [state, setState] = useState<ComposeWizardState>(() => {
    const existing = readComposeDraft(userId, composeDraftId);
    return existing ?? initialFactory();
  });

  useComposeDraft(userId, state);
  return [state, setState];
}
