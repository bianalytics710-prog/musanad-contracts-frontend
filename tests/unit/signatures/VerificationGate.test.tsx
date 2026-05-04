/**
 * VerificationGate (S13) — FE-only identity gate tests.
 *
 * AC mapping:
 *   AC-S13-01 — case-insensitive trim compare on name + email vs masked email.
 *   AC-S13-02 — generic mismatch message (no expected values revealed).
 *   AC-S13-03 — 5 failed attempts session lock.
 *   AC-S13-06 — no backend verify endpoint to brute-force.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { initI18n } from "@/i18n";
import i18n from "i18next";
import { VerificationGate } from "@/features/signatures/components/VerificationGate";

beforeAll(() => {
  initI18n();
});

const submit = () => {
  const button = screen.getAllByRole("button").find((b) => b.getAttribute("type") === "submit");
  if (!button) throw new Error("submit button not found");
  fireEvent.click(button);
};

describe("VerificationGate — AC-S13-01..06", () => {
  it("AC-S13-01: success on matching name + email prefix/domain unlocks gate", () => {
    let verified = false;
    render(
      <VerificationGate
        expectedNameEn="Jane Doe"
        maskedEmail="j***@example.com"
        onVerified={() => {
          verified = true;
        }}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0]!, { target: { value: "  jane doe  " } }); // case-insensitive + trim
    fireEvent.change(screen.getByLabelText(i18n.t("sign.m3.gate.emailLabel") as string), {
      target: { value: "jane@example.com" },
    });
    submit();
    expect(verified).toBe(true);
  });

  it("AC-S13-02: mismatch shows generic error WITHOUT revealing expected values", () => {
    render(
      <VerificationGate
        expectedNameEn="Jane Doe"
        maskedEmail="j***@example.com"
        onVerified={() => {}}
      />,
    );
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0]!, { target: { value: "Wrong Name" } });
    fireEvent.change(screen.getByLabelText(i18n.t("sign.m3.gate.emailLabel") as string), {
      target: { value: "wrong@elsewhere.com" },
    });
    submit();

    const errorAlerts = screen.getAllByRole("alert");
    const errorText = errorAlerts.map((e) => e.textContent ?? "").join(" ");
    expect(errorText.toLowerCase()).not.toContain("jane");
    expect(errorText.toLowerCase()).not.toContain("doe");
    expect(errorText.toLowerCase()).not.toContain("example.com");
  });

  it("AC-S13-03: 5 failed attempts locks the gate", () => {
    let verified = false;
    render(
      <VerificationGate
        expectedNameEn="Jane Doe"
        maskedEmail="j***@example.com"
        onVerified={() => {
          verified = true;
        }}
      />,
    );
    const inputs = screen.getAllByRole("textbox");
    const emailInput = screen.getByLabelText(i18n.t("sign.m3.gate.emailLabel") as string);

    for (let i = 0; i < 5; i++) {
      fireEvent.change(inputs[0]!, { target: { value: `wrong${i}` } });
      fireEvent.change(emailInput, { target: { value: `wrong${i}@elsewhere.com` } });
      submit();
    }
    expect(verified).toBe(false);

    // Should now show the locked state (Lock icon + locked title)
    const locked = screen.getByText(i18n.t("sign.m3.gate.locked.title") as string);
    expect(locked).toBeTruthy();
    // Inputs should no longer be present (the form is replaced by the locked alert)
    expect(screen.queryAllByRole("textbox").length).toBe(0);
  });
});
