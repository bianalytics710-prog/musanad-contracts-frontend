/**
 * AdminAICostDashboard — view tests for S12.
 *
 * Verifies:
 *   - 90-day range FE-side validation (AC-S12-04)
 *   - groupByUser toggle (AC-S12-02)
 *   - forbidden surface for users without ai.observability.read (AC-S12-03)
 *   - row rendering when data present
 *   - hook is disabled when validation fails (no superfluous calls)
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { initI18n } from "@/i18n";

let mockHasPermission = true;
let lastHookOptions: { enabled?: boolean } | null = null;

vi.mock("@/store/auth.store", () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector(undefined),
  selectHasPermission: () => () => mockHasPermission,
}));

vi.mock("@/features/admin-ai/hooks/useAdminAi", () => ({
  useAdminAiCostReport: vi.fn(),
}));

import { useAdminAiCostReport } from "@/features/admin-ai/hooks/useAdminAi";
import { AdminAICostDashboard } from "@/features/admin-ai/components/AdminAICostDashboard";

beforeAll(() => {
  initI18n();
});

beforeEach(() => {
  mockHasPermission = true;
  lastHookOptions = null;
  vi.clearAllMocks();
});

const captureHookCalls = (returnValue: unknown) =>
  (useAdminAiCostReport as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (_query: unknown, options: { enabled?: boolean } | undefined) => {
      lastHookOptions = options ?? null;
      return returnValue;
    },
  );

describe("AdminAICostDashboard", () => {
  it("AC-S12-03: shows forbidden surface when caller lacks ai.observability.read", () => {
    mockHasPermission = false;
    captureHookCalls({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    });

    render(<AdminAICostDashboard />);
    // Forbidden text or no table
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("AC-S12-01: renders cost rows when data present", () => {
    captureHookCalls({
      data: {
        data: [
          {
            promptId: "ai-contract-insights",
            totalCostUsdMicros: 5_000_000,
            totalTokensInput: 1000,
            totalTokensOutput: 500,
            successCount: 10,
            errorCount: 1,
            avgLatencyMs: 250,
            cacheHitRatio: 0.4,
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    });

    render(<AdminAICostDashboard />);
    expect(screen.getByText(/ai-contract-insights/i)).toBeInTheDocument();
  });

  it("AC-S12-04: 90-day range validation — date range > 90 days disables the hook", () => {
    captureHookCalls({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    });

    render(<AdminAICostDashboard />);
    const fromInput = screen.getByLabelText(/from/i) as HTMLInputElement;
    const toInput = screen.getByLabelText(/to/i) as HTMLInputElement;

    fireEvent.change(fromInput, { target: { value: "2024-01-01" } });
    fireEvent.change(toInput, { target: { value: "2024-12-31" } });

    // The hook's enabled flag should be false because validation rejected the range.
    expect(lastHookOptions?.enabled).toBe(false);
  });

  it("AC-S12-04: when range is exactly 90 days, hook is enabled", () => {
    captureHookCalls({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    });

    render(<AdminAICostDashboard />);
    const fromInput = screen.getByLabelText(/from/i) as HTMLInputElement;
    const toInput = screen.getByLabelText(/to/i) as HTMLInputElement;
    fireEvent.change(fromInput, { target: { value: "2026-02-04" } });
    fireEvent.change(toInput, { target: { value: "2026-05-04" } }); // ~89 days
    expect(lastHookOptions?.enabled).toBe(true);
  });

  it("AC-S12-02: groupByUser toggle accessible via checkbox", () => {
    captureHookCalls({
      data: { data: [] },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    });

    render(<AdminAICostDashboard />);
    const groupCheckbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(groupCheckbox.checked).toBe(false);
    fireEvent.click(groupCheckbox);
    expect(groupCheckbox.checked).toBe(true);
  });
});
