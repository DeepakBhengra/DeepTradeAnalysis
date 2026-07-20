import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isEodSquareOffDue } from "../../src/samco/tradeExecutor.js";

describe("isEodSquareOffDue", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SAMCO_EOD_SQUARE_OFF_START = "15:00";
    process.env.SAMCO_EOD_SQUARE_OFF_END = "15:15";
  });

  afterEach(() => {
    delete process.env.SAMCO_EOD_SQUARE_OFF_START;
    delete process.env.SAMCO_EOD_SQUARE_OFF_END;
  });

  it("is false at exactly 15:00 IST", async () => {
    vi.resetModules();
    const { isEodSquareOffDue: check } = await import("../../src/samco/tradeExecutor.js");
    const at1500 = new Date("2026-06-29T09:30:00.000Z");
    expect(check(at1500)).toBe(false);
  });

  it("is true between 15:01 and 15:15 IST", async () => {
    vi.resetModules();
    const { isEodSquareOffDue: check } = await import("../../src/samco/tradeExecutor.js");
    const at1501 = new Date("2026-06-29T09:31:00.000Z");
    const at1515 = new Date("2026-06-29T09:45:00.000Z");
    expect(check(at1501)).toBe(true);
    expect(check(at1515)).toBe(true);
  });

  it("is false after 15:15 IST", async () => {
    vi.resetModules();
    const { isEodSquareOffDue: check } = await import("../../src/samco/tradeExecutor.js");
    const at1516 = new Date("2026-06-29T09:46:00.000Z");
    expect(check(at1516)).toBe(false);
  });
});

describe("isEodSquareOffDue default import", () => {
  it("uses default window from loaded config", () => {
    const at1501 = new Date("2026-06-29T09:31:00.000Z");
    expect(isEodSquareOffDue(at1501)).toBe(true);
  });
});
