/**
 * Unit test — F-FE-002: useComposeSubmit().submit() synchronous double-submit
 * guard.
 *
 * Before the F-FE-001 round-1 patch, `submit()` derived its in-flight signal
 * from a React state-bound `phase` value. React state updates are batched and
 * asynchronous, so two clicks fired in the same tick both observed
 * `isSubmitting === false` and BOTH fired POST /api/v1/contracts — creating
 * two duplicate contract rows on the BE.
 *
 * The fix added a `submittingRef = useRef(false)` flipped synchronously
 * before the first await; the second concurrent submit short-circuits and
 * returns null without touching the network.
 *
 * This test verifies the post-fix contract:
 *   - Two rapid `submit()` calls (without awaiting between them) → only ONE
 *     `contractsService.create` call hits the wire.
 *   - The second call returns null (silently ignored).
 *   - The full happy path completes (drains the in-flight contract create
 *     and the payment-schedule put).
 *
 * Strategy: mock the contracts + payment-schedule services with an artificial
 * delay so the second submit() lands while the first is still mid-flight.
 * The hook is exercised via `renderHook` from @testing-library/react.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import "@/i18n";

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("@/services/api/contracts.service", () => {
  const stub = {
    create: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    setStatus: vi.fn(),
    setTags: vi.fn(),
    listVersions: vi.fn(),
    createVersion: vi.fn(),
    listActivity: vi.fn(),
    getTree: vi.fn(),
  };
  return { contractsService: stub, default: stub };
});

vi.mock("@/services/api/payment-schedule.service", () => {
  const stub = {
    list: vi.fn(),
    bulkReplace: vi.fn(),
  };
  return { paymentScheduleService: stub, default: stub };
});

import { useComposeSubmit } from "@/features/contracts/wizard/useComposeSubmit";
import { contractsService } from "@/services/api/contracts.service";
import { paymentScheduleService } from "@/services/api/payment-schedule.service";
import type { ComposeWizardState } from "@/types/entities/payment-schedule.types";

function makeWizardState(): ComposeWizardState {
  return {
    step1: {
      contractType: "employment",
      language: "en",
      ourPartyName: "Acme FZ-LLC",
      counterpartyName: "John Doe",
      templateId: null,
    },
    step2: {
      titleEn: "Test Contract",
      titleAr: null,
      valueAed: 100_000,
      currency: "AED",
      startDate: "2026-06-01",
      endDate: "2026-12-31",
      expiryNoticeDays: 30,
      emirate: "DXB",
      governingLaw: "uae_federal",
      jurisdictionCourt: null,
      parentContractId: null,
      relationshipType: null,
      paymentSchedule: [
        {
          milestoneLabelEn: "Initial",
          milestoneLabelAr: null,
          milestoneNameEn: null,
          milestoneNameAr: null,
          amountAed: 50_000,
          dueDate: "2026-07-01",
          paidAt: null,
          status: "pending",
          recurrence: null,
          invoiceRef: null,
        },
      ],
    },
    step3: { bodyEn: "Body text", bodyAr: null },
    currentStep: 5,
    composeDraftId: "cdraft-test-001",
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useComposeSubmit — F-FE-002 submittingRef synchronous guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("two rapid submit() calls only fire one POST /contracts; the second resolves to null", async () => {
    // Artificial delay on contract create — long enough that a second call
    // can land inside the same tick before the first resolves.
    let resolveCreate: (v: unknown) => void = () => {};
    const createPromise = new Promise((res) => {
      resolveCreate = res;
    });
    vi.mocked(contractsService.create).mockImplementationOnce(
      () =>
        createPromise.then(() => ({
          id: 42,
          contractNumber: "CT-2026-000042",
        })) as ReturnType<typeof contractsService.create>,
    );

    let resolveBulk: (v: unknown) => void = () => {};
    const bulkPromise = new Promise((res) => {
      resolveBulk = res;
    });
    vi.mocked(paymentScheduleService.bulkReplace).mockImplementationOnce(
      () =>
        bulkPromise.then(() => ({
          inserted: 1,
          softDeleted: 0,
        })) as ReturnType<typeof paymentScheduleService.bulkReplace>,
    );

    const { result } = renderHook(() => useComposeSubmit(), { wrapper });

    const state = makeWizardState();

    // Fire two submits in the same tick (before awaiting either).
    let firstResult: unknown;
    let secondResult: unknown;
    await act(async () => {
      const p1 = result.current.submit(state, 1);
      const p2 = result.current.submit(state, 1);
      // The second promise must resolve immediately to null (the ref guard
      // short-circuits before any await).
      secondResult = await p2;
      // Now drain the first.
      resolveCreate({ id: 42, contractNumber: "CT-2026-000042" });
      resolveBulk({ inserted: 1, softDeleted: 0 });
      firstResult = await p1;
    });

    // Exactly ONE create call — the F-FE-002 contract.
    expect(vi.mocked(contractsService.create)).toHaveBeenCalledTimes(1);
    // The second call short-circuited.
    expect(secondResult).toBeNull();
    // The first call delivered the success tuple.
    expect(firstResult).toMatchObject({ contractId: 42, contractNumber: "CT-2026-000042" });
    // Schedule put fired exactly once for the first submission.
    expect(vi.mocked(paymentScheduleService.bulkReplace)).toHaveBeenCalledTimes(1);
  });
});
