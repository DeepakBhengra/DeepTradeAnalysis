import { describe, expect, it } from "vitest";
import {
  DEFAULT_OVERBOUGHT_BUY_CASCADE,
  DEFAULT_OVERBOUGHT_SELL_GUARDS,
  DEFAULT_OVERSOLD_BUY_GUARDS,
  DEFAULT_OVERSOLD_SELL_CASCADE,
  evaluateOverboughtBuyCascade,
  evaluateOverboughtSellGuards,
  evaluateOversoldBuyGuards,
  evaluateOversoldSellCascade,
  findNextSameDayIndex,
} from "../../src/rules/oversoldCascade.js";

describe("oversoldCascade shared helpers", () => {
  const fallingKnife = {
    smi: -54,
    prevSmi: -34,
    macdHist: -1.33,
    prevMacdHist: -0.75,
    setupMid: 1675.7,
    dayOpenMid: 1691.75,
    nextMid: 1673.3,
  };

  const turnUp = {
    smi: -40,
    prevSmi: -50,
    macdHist: -0.5,
    prevMacdHist: -1.0,
    setupMid: 100,
    dayOpenMid: 100.5,
    nextMid: 100.4,
  };

  const risingKnife = {
    smi: 54,
    prevSmi: 34,
    macdHist: 1.33,
    prevMacdHist: 0.75,
    setupMid: 1708.3,
    dayOpenMid: 1691.75,
    nextMid: 1710.7,
  };

  const turnDown = {
    smi: 40,
    prevSmi: 50,
    macdHist: 0.5,
    prevMacdHist: 1.0,
    setupMid: 100,
    dayOpenMid: 99.5,
    nextMid: 99.6,
  };

  it("exports the ICICIGI-proven defaults", () => {
    expect(DEFAULT_OVERSOLD_BUY_GUARDS.maxOpenDrawdownPct).toBe(0.8);
    expect(DEFAULT_OVERSOLD_SELL_CASCADE.enabled).toBe(true);
    expect(DEFAULT_OVERBOUGHT_SELL_GUARDS.maxOpenRallyPct).toBe(0.8);
    expect(DEFAULT_OVERBOUGHT_BUY_CASCADE.enabled).toBe(true);
  });

  it("blocks falling-knife BUY and accepts SELL cascade", () => {
    expect(evaluateOversoldBuyGuards(DEFAULT_OVERSOLD_BUY_GUARDS, fallingKnife).ok).toBe(
      false,
    );
    const cascade = evaluateOversoldSellCascade(
      DEFAULT_OVERSOLD_SELL_CASCADE,
      fallingKnife,
    );
    expect(cascade.ok).toBe(true);
    expect(cascade.confirmedOnNextBar).toBe(true);
  });

  it("accepts turn-up BUY with next-bar confirmation", () => {
    const result = evaluateOversoldBuyGuards(DEFAULT_OVERSOLD_BUY_GUARDS, turnUp);
    expect(result.ok).toBe(true);
    expect(result.confirmedOnNextBar).toBe(true);
  });

  it("blocks rising-knife SELL and accepts BUY cascade", () => {
    expect(
      evaluateOverboughtSellGuards(DEFAULT_OVERBOUGHT_SELL_GUARDS, risingKnife).ok,
    ).toBe(false);
    const cascade = evaluateOverboughtBuyCascade(
      DEFAULT_OVERBOUGHT_BUY_CASCADE,
      risingKnife,
    );
    expect(cascade.ok).toBe(true);
    expect(cascade.confirmedOnNextBar).toBe(true);
  });

  it("accepts turn-down SELL with next-bar confirmation", () => {
    const result = evaluateOverboughtSellGuards(
      DEFAULT_OVERBOUGHT_SELL_GUARDS,
      turnDown,
    );
    expect(result.ok).toBe(true);
    expect(result.confirmedOnNextBar).toBe(true);
  });

  it("findNextSameDayIndex returns the next bar", () => {
    expect(findNextSameDayIndex([10, 11, 12], 11)).toBe(12);
    expect(findNextSameDayIndex([10, 11, 12], 12)).toBeNull();
  });
});
