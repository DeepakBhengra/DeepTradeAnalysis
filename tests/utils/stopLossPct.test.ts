import { describe, expect, it } from "vitest";

import {
  adverseMovePct,
  isStopLossHit,
  normalizeStopLossPct,
  oppositeSide,
  stopLossReverseSignalKey,
} from "../../src/utils/stopLossPct.js";

describe("stopLossPct", () => {
  it("treats blank/zero/negative as disabled", () => {
    expect(normalizeStopLossPct(null)).toBeNull();
    expect(normalizeStopLossPct(0)).toBeNull();
    expect(normalizeStopLossPct(-1)).toBeNull();
    expect(normalizeStopLossPct(Number.NaN)).toBeNull();
    expect(normalizeStopLossPct(0.5)).toBe(0.5);
  });

  it("computes adverse move and stop hit for BUY/SELL", () => {
    expect(adverseMovePct("BUY", 100, 99)).toBeCloseTo(1);
    expect(adverseMovePct("SELL", 100, 101)).toBeCloseTo(1);
    expect(isStopLossHit("BUY", 100, 99, 1)).toBe(true);
    expect(isStopLossHit("BUY", 100, 99.5, 1)).toBe(false);
    expect(isStopLossHit("SELL", 100, 101, 1)).toBe(true);
    expect(isStopLossHit("BUY", 100, 90, null)).toBe(false);
    expect(isStopLossHit("BUY", 100, 90, 0)).toBe(false);
  });

  it("builds reverse signal keys and opposite side", () => {
    expect(oppositeSide("BUY")).toBe("SELL");
    expect(stopLossReverseSignalKey("deeppro1-TCS-10:00-1")).toBe(
      "deeppro1-TCS-10:00-1-sl-rev",
    );
  });
});
