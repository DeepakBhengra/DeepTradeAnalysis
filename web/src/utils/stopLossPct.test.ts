import { describe, expect, it } from "vitest";

import {
  adverseMovePct,
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
});
