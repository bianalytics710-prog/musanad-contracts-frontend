/**
 * ContractSignaturesTab — Cancel button visibility tests.
 *
 * Specifically validates the patch from migration 038 + INTEG-FAIL-1:
 *   - Cancel button is HIDDEN when party.currentInvitationId === null.
 *   - Cancel button is VISIBLE when party.currentInvitationId is populated
 *     AND status is pending or viewed.
 *
 * Mocks the useSignatureListForContract hook + useAuthStore permission lookups
 * so we can drive the component with synthetic state.
 */
import { describe, it, expect, beforeAll, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { initI18n } from "@/i18n";

// Mock the hook BEFORE importing the component
vi.mock("@/features/signatures/hooks/useSignatures", () => ({
  useSignatureListForContract: vi.fn(),
}));
// Mock the auth store + permission selector so canCancel/canSend always true
vi.mock("@/store/auth.store", () => ({
  useAuthStore: () => true, // every selectHasPermission call returns true
  selectHasPermission: () => () => true,
}));
// Mock the dialog children so they don't render real modals during the test
vi.mock("@/features/signatures/components/ContractSignersConfigDialog", () => ({
  ContractSignersConfigDialog: () => null,
}));
vi.mock("@/features/signatures/components/SendForSignatureConfirmDialog", () => ({
  SendForSignatureConfirmDialog: () => null,
}));
vi.mock("@/features/signatures/components/ResendInvitationConfirm", () => ({
  ResendInvitationConfirm: () => null,
}));
vi.mock("@/features/signatures/components/CancelInvitationConfirm", () => ({
  CancelInvitationConfirm: () => null,
}));

import { useSignatureListForContract } from "@/features/signatures/hooks/useSignatures";
import { ContractSignaturesTab } from "@/features/signatures/components/ContractSignaturesTab";

beforeAll(() => {
  initI18n();
});

const baseHookReturn = {
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
};

const buildParty = (overrides: Record<string, unknown>) => ({
  id: 1,
  contractId: 1,
  signerSide: "employer" as const,
  signerNameEn: "Test Signer",
  signerNameAr: null,
  signerEmail: "test@example.com",
  signerUserId: null,
  signerPhone: null,
  signerPartyId: null,
  stepOrder: 1,
  isRequired: true,
  currentInvitationId: null,
  currentInvitationStatus: null,
  invitationSentAt: null,
  signedAt: null,
  declinedAt: null,
  lastEventType: null,
  signatureMethod: null,
  uaePassVerificationLevel: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ContractSignaturesTab — Cancel button visibility (migration 038)", () => {
  it("HIDES cancel button when party.currentInvitationId === null (e.g. no invitation issued yet)", () => {
    (useSignatureListForContract as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...baseHookReturn,
      data: {
        success: true,
        data: {
          contractId: 1,
          currentStatus: "approved",
          signers: [
            buildParty({
              currentInvitationId: null,
              currentInvitationStatus: null,
            }),
          ],
          stepProgress: [],
        },
      },
    });

    render(<ContractSignaturesTab contractId={1} />);
    const buttons = screen.queryAllByRole("button");
    const cancelButton = buttons.find((b) => {
      const al = b.getAttribute("aria-label") ?? "";
      return al.toLowerCase().includes("cancel");
    });
    expect(cancelButton).toBeUndefined();
  });

  it("SHOWS cancel button when party.currentInvitationId is populated AND status is 'pending'", () => {
    (useSignatureListForContract as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...baseHookReturn,
      data: {
        success: true,
        data: {
          contractId: 1,
          currentStatus: "awaiting_signature_employer",
          signers: [
            buildParty({
              currentInvitationId: 42,
              currentInvitationStatus: "pending",
            }),
          ],
          stepProgress: [],
        },
      },
    });

    render(<ContractSignaturesTab contractId={1} />);
    const buttons = screen.queryAllByRole("button");
    const cancelButton = buttons.find((b) => {
      const al = b.getAttribute("aria-label") ?? "";
      return al.toLowerCase().includes("cancel");
    });
    expect(cancelButton).toBeDefined();
  });

  it("HIDES cancel button when status is 'signed' even with an invitation id", () => {
    (useSignatureListForContract as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...baseHookReturn,
      data: {
        success: true,
        data: {
          contractId: 1,
          currentStatus: "fully_signed",
          signers: [
            buildParty({
              currentInvitationId: 42,
              currentInvitationStatus: "signed",
            }),
          ],
          stepProgress: [],
        },
      },
    });

    render(<ContractSignaturesTab contractId={1} />);
    const buttons = screen.queryAllByRole("button");
    const cancelButton = buttons.find((b) => {
      const al = b.getAttribute("aria-label") ?? "";
      return al.toLowerCase().includes("cancel");
    });
    expect(cancelButton).toBeUndefined();
  });
});
