/**
 * Unit test — F-FE-M1 (24h TTL eviction) + FE-R2-001 (legacy bare-state
 * eviction) for `readComposeDraft`.
 *
 * F-FE-M1: drafts wrapped in the `{ state, _savedAt }` envelope are evicted
 * when older than 24h to bound T13 sensitive-body retention. Fresh drafts
 * (within the TTL window) are restored normally.
 *
 * FE-R2-001 (residual): legacy bare-state drafts (written before the
 * F-FE-M1 envelope patch) carry no `_savedAt` and therefore cannot be
 * TTL-bounded. Restoring them would re-leak the very sensitive body text
 * the F-FE-M1 patch was designed to bound. Mitigation: encountering a
 * legacy bare-state draft evicts the key immediately and returns null —
 * a one-time migration, deliberately destructive for the small population
 * of pre-patch abandoned drafts.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { composeDraftKey, readComposeDraft } from "@/features/contracts/wizard/useComposeDraft";
import type { ComposeWizardState } from "@/types/entities/payment-schedule.types";

const HOUR_MS = 60 * 60 * 1000;

function sampleState(composeDraftId: string): ComposeWizardState {
  return {
    step1: {
      contractType: "employment",
      language: "en",
      ourPartyName: null,
      counterpartyName: null,
      templateId: null,
    },
    step2: {
      titleEn: "TTL test",
      titleAr: null,
      valueAed: null,
      currency: "AED",
      startDate: null,
      endDate: null,
      expiryNoticeDays: 30,
      emirate: null,
      governingLaw: null,
      jurisdictionCourt: null,
      parentContractId: null,
      relationshipType: null,
      paymentSchedule: [],
    },
    step3: { bodyEn: "Sensitive body — must not leak", bodyAr: null },
    currentStep: 1,
    composeDraftId,
  };
}

describe("readComposeDraft — F-FE-M1 TTL + FE-R2-001 legacy eviction", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("F-FE-M1: envelope draft with _savedAt 25 hours ago is evicted on read", () => {
    const userId = 1;
    const composeDraftId = "cdraft-stale-001";
    const key = composeDraftKey(userId, composeDraftId);
    const state = sampleState(composeDraftId);

    // Fix "now" then write a draft whose _savedAt is 25 hours in the past.
    const now = Date.UTC(2026, 4, 3, 12, 0, 0); // 2026-05-03T12:00:00Z
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));

    const stale = { state, _savedAt: now - 25 * HOUR_MS };
    localStorage.setItem(key, JSON.stringify(stale));

    const restored = readComposeDraft(userId, composeDraftId);
    expect(restored).toBeNull();
    // Eviction MUST have removed the key — the next read must observe a
    // clean slate, regardless of clock movement.
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("F-FE-M1: envelope draft with _savedAt 1 hour ago is restored", () => {
    const userId = 1;
    const composeDraftId = "cdraft-fresh-001";
    const key = composeDraftKey(userId, composeDraftId);
    const state = sampleState(composeDraftId);

    const now = Date.UTC(2026, 4, 3, 12, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));

    const fresh = { state, _savedAt: now - 1 * HOUR_MS };
    localStorage.setItem(key, JSON.stringify(fresh));

    const restored = readComposeDraft(userId, composeDraftId);
    expect(restored).not.toBeNull();
    expect(restored?.composeDraftId).toBe(composeDraftId);
    expect(restored?.step2.titleEn).toBe("TTL test");
    // Key should still exist — fresh drafts are not touched by the read.
    expect(localStorage.getItem(key)).not.toBeNull();
  });

  it("FE-R2-001: legacy bare-state draft (no envelope, no _savedAt) is evicted, NOT restored", () => {
    const userId = 1;
    const composeDraftId = "cdraft-legacy-001";
    const key = composeDraftKey(userId, composeDraftId);
    const state = sampleState(composeDraftId);

    // Pre-patch shape: wizard state stored directly, no `_savedAt` envelope.
    localStorage.setItem(key, JSON.stringify(state));

    const restored = readComposeDraft(userId, composeDraftId);
    expect(restored).toBeNull();
    // Key MUST be evicted — sensitive body cannot linger past the migration.
    expect(localStorage.getItem(key)).toBeNull();
  });
});
