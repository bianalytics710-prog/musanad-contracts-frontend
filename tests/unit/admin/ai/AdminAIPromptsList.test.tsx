/**
 * AdminAIPromptsList — view tests for S13.
 *
 * Verifies:
 *   - Hides content + shows forbidden message when user lacks
 *     ai.observability.read permission (AC-S13-02).
 *   - Renders prompts when permission AND data present.
 *   - includeInactive checkbox toggles the underlying query (AC-S13-03).
 *
 * Mocks: useAdminAiPromptsList hook + useAuthStore permission selector.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { initI18n } from "@/i18n";

// Hoist mocks
let mockHasPermission = true;
let mockHookCalls: Array<unknown> = [];

vi.mock("@/store/auth.store", () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector(undefined),
  // selectHasPermission returns a curried function — return our lever
  selectHasPermission: () => () => mockHasPermission,
}));

vi.mock("@/features/admin-ai/hooks/useAdminAi", () => ({
  useAdminAiPromptsList: vi.fn(),
}));

import { useAdminAiPromptsList } from "@/features/admin-ai/hooks/useAdminAi";
import { AdminAIPromptsList } from "@/features/admin-ai/components/AdminAIPromptsList";

beforeAll(() => {
  initI18n();
});

beforeEach(() => {
  mockHookCalls = [];
  mockHasPermission = true;
  vi.clearAllMocks();
});

const samplePrompt = {
  promptId: "ai-contract-insights",
  descriptionEn: "Contract insights",
  descriptionAr: "رؤى العقد",
  defaultModel: "gpt-4o",
  defaultTemperature: 0.4,
  defaultMaxTokens: 2000,
  defaultTtlSeconds: 86400,
  supportsStreaming: true,
  supportsToolCall: true,
  publicEndpoint: false,
  promptFilePath: "prompts/ai-contract-insights.txt",
  rateLimitPerUserPerHour: 30,
  rateLimitPerUserPerDay: 200,
  isActive: true,
};

const captureHookCalls = (returnValue: unknown) =>
  (useAdminAiPromptsList as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (query: unknown) => {
      mockHookCalls.push(query);
      return returnValue;
    },
  );

describe("AdminAIPromptsList", () => {
  it("AC-S13-02: shows forbidden message when caller lacks ai.observability.read", () => {
    mockHasPermission = false;
    captureHookCalls({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    });

    render(<AdminAIPromptsList />);
    expect(screen.queryByRole("table")).toBeNull();
    // English copy: "You don't have permission to view AI prompts."
    expect(
      screen.getByText(/permission|forbidden|denied|not authori/i),
    ).toBeInTheDocument();
  });

  it("renders the prompt list when data is present", () => {
    captureHookCalls({
      data: {
        data: [samplePrompt],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    });

    render(<AdminAIPromptsList />);
    // Prompt id appears somewhere on screen
    expect(screen.getByText("ai-contract-insights")).toBeInTheDocument();
    expect(screen.getByText(/gpt-4o/i)).toBeInTheDocument();
  });

  it("AC-S13-03: includeInactive toggle changes the query", () => {
    captureHookCalls({
      data: {
        data: [samplePrompt],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    });

    render(<AdminAIPromptsList />);
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    // First call had includeInactive=false
    const firstCall = mockHookCalls[0] as { includeInactive: boolean };
    expect(firstCall.includeInactive).toBe(false);

    fireEvent.click(checkbox);
    // After re-render the hook is called with includeInactive=true.
    const lastCall = mockHookCalls[mockHookCalls.length - 1] as {
      includeInactive: boolean;
    };
    expect(lastCall.includeInactive).toBe(true);
  });

  it("renders loading state while fetching", () => {
    captureHookCalls({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: true,
    });
    const { container } = render(<AdminAIPromptsList />);
    // Some kind of loading indicator (skeleton, role=status, or aria-busy)
    expect(
      container.querySelector('[aria-busy="true"], [role="status"], .animate-pulse'),
    ).not.toBeNull();
  });

  it("renders error state when isError=true", () => {
    captureHookCalls({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { code: "NETWORK_ERROR", message: "Network error" },
      refetch: vi.fn(),
      isFetching: false,
    });
    render(<AdminAIPromptsList />);
    // Some error surface — alert role or error message text
    const errors = screen.queryAllByRole("alert");
    const errorByText = screen.queryAllByText(
      /error|failed|retry|try again/i,
    );
    expect(errors.length + errorByText.length).toBeGreaterThan(0);
  });
});
