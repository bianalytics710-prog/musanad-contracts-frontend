import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatTime } from "@/utils/datetime";

const SAMPLE_UTC = "2026-05-02T10:30:00.000Z";

describe("formatDateTime", () => {
  it("returns em dash for null/undefined/empty input", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime("")).toBe("—");
  });

  it("returns em dash for invalid date strings", () => {
    expect(formatDateTime("not-a-date")).toBe("—");
  });

  it("formats a UTC ISO string in the configured timezone (Asia/Dubai +04:00)", () => {
    // 10:30 UTC → 14:30 Asia/Dubai. We don't pin the exact locale-rendered
    // string (varies per Node ICU) but we assert the time component shifted.
    const out = formatDateTime(SAMPLE_UTC, { locale: "en-AE" });
    expect(out).toMatch(/14:30/);
  });

  it("can omit the time component", () => {
    const out = formatDate(SAMPLE_UTC, "en-AE");
    expect(out).not.toMatch(/14:30/);
    expect(out).toMatch(/2026/);
  });

  it("can omit the date component", () => {
    const out = formatTime(SAMPLE_UTC, { locale: "en-AE" });
    expect(out).toMatch(/14:30/);
    expect(out).not.toMatch(/2026/);
  });

  it("supports an alternate timezone override", () => {
    const out = formatDateTime(SAMPLE_UTC, {
      locale: "en-GB",
      timezone: "UTC",
    });
    expect(out).toMatch(/10:30/);
  });
});
