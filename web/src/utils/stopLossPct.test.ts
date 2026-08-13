import { describe, expect, it } from "vitest";

import {
  adverseMovePct,
  canOpenStopLossReverseEntry,
  isStopLossHit,
  normalizeStopLossPct,
  oppositeSide,
} from "./stopLossPct";

describe("stopLossPct (web)", () => {
  it("normalizes blank/zero and detects hits", () => {
    expect(normalizeStopLossPct(0)).toBeNull();
    expect(adverseMovePct("BUY", 200, 198)).toBeCloseTo(1);
    expect(isStopLossHit("BUY", 200, 198, 1)).toBe(true);
    expect(oppositeSide("SELL")).toBe("BUY");
  });

  it("allows reverse entry at or before 11:45 IST only", () => {
    expect(canOpenStopLossReverseEntry("11:45")).toBe(true);
    expect(canOpenStopLossReverseEntry("09:30")).toBe(true);
    expect(canOpenStopLossReverseEntry("11:46")).toBe(false);
    expect(canOpenStopLossReverseEntry("14:15")).toBe(false);
  });
});
