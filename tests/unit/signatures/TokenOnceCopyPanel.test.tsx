/**
 * TokenOnceCopyPanel — token-once UX tests.
 *
 * Verifies:
 *   - Copy-to-clipboard fires navigator.clipboard.writeText with the sign URL.
 *   - The plaintext token is initially obscured (• placeholders) and revealed
 *     via the toggle.
 *   - The component does not persist the token to localStorage / sessionStorage.
 */
import { describe, it, expect, beforeAll, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { initI18n } from "@/i18n";
import { TokenOnceCopyPanel } from "@/features/signatures/components/TokenOnceCopyPanel";

beforeAll(() => {
  initI18n();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const TOKEN = "abcdef1234567890abcdef1234567890abcdef1234"; // 42 chars

describe("TokenOnceCopyPanel — token-once invariant", () => {
  it("copy button writes the sign URL (origin + /sign/token) via navigator.clipboard.writeText", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(
      <TokenOnceCopyPanel
        invitationTokenPlaintext={TOKEN}
        signerEmail="signer@example.com"
        signerLabel="Signer name"
        buildSignUrl={(t) => `https://test.local/sign/${t}`}
      />,
    );
    const copyBtn = screen.getAllByRole("button").find((b) =>
      (b.getAttribute("aria-label") ?? "").toLowerCase().includes("copy"),
    );
    expect(copyBtn).toBeTruthy();
    fireEvent.click(copyBtn!);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(`https://test.local/sign/${TOKEN}`);
  });

  it("token is masked initially; reveal toggle exposes plaintext URL", () => {
    render(
      <TokenOnceCopyPanel
        invitationTokenPlaintext={TOKEN}
        buildSignUrl={(t) => `https://test.local/sign/${t}`}
      />,
    );
    const input = screen.getByDisplayValue(/\/sign\/.*/) as HTMLInputElement;
    // Initially obscured — should NOT contain the literal token
    expect(input.value).not.toContain(TOKEN);
    expect(input.value).toMatch(/•+/);

    // Click the visibility toggle (the eye-button — find by aria-label)
    const revealBtn = screen.getAllByRole("button").find((b) => {
      const al = b.getAttribute("aria-label") ?? "";
      return al.toLowerCase().includes("reveal") || al.toLowerCase().includes("show");
    });
    expect(revealBtn).toBeTruthy();
    fireEvent.click(revealBtn!);

    const inputAfter = screen.getByDisplayValue(/\/sign\/.*/) as HTMLInputElement;
    expect(inputAfter.value).toContain(TOKEN);
  });

  it("does NOT write the token to localStorage or sessionStorage on render or copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const lsSpy = vi.spyOn(Storage.prototype, "setItem");
    render(
      <TokenOnceCopyPanel
        invitationTokenPlaintext={TOKEN}
        buildSignUrl={(t) => `https://test.local/sign/${t}`}
      />,
    );
    const copyBtn = screen.getAllByRole("button").find((b) =>
      (b.getAttribute("aria-label") ?? "").toLowerCase().includes("copy"),
    )!;
    fireEvent.click(copyBtn);
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    // Assert no setItem call ever passed the token plaintext
    for (const call of lsSpy.mock.calls) {
      const [, value] = call;
      expect(String(value)).not.toContain(TOKEN);
    }
  });
});
