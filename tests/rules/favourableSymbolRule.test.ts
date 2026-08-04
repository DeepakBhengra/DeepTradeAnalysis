import { describe, expect, it } from "vitest";
import {
  __favourableSymbolRuleTestables,
  assertFavourableSymbolRuleSymbol,
  favourableSymbolRuleIdForTradingSymbol,
  getFavourableSymbolRuleConfig,
  isFavourableSymbolRuleSymbol,
} from "../../src/rules/favourableSymbolRule.js";

const { matchesBuyQuality, matchesSellQuality, matchesBuyExtended } =
  __favourableSymbolRuleTestables;

describe("favourable symbol rule registry", () => {
  it("locks each rule to its exclusive symbol", () => {
    expect(isFavourableSymbolRuleSymbol("ruleLtm", "LTM")).toBe(true);
    expect(isFavourableSymbolRuleSymbol("ruleLtm", "TECHM")).toBe(false);
    expect(isFavourableSymbolRuleSymbol("ruleIcicigi", "ICICIGI")).toBe(true);
    expect(isFavourableSymbolRuleSymbol("ruleTechm", "TECHM")).toBe(true);
    expect(isFavourableSymbolRuleSymbol("ruleTvsmotor", "TVSMOTOR")).toBe(true);
    expect(isFavourableSymbolRuleSymbol("rulePolicybzr", "POLICYBZR")).toBe(true);
    expect(favourableSymbolRuleIdForTradingSymbol("LTM")).toBe("ruleLtm");
    expect(favourableSymbolRuleIdForTradingSymbol("PNB")).toBeNull();
  });

  it("rejects cross-symbol use with a clear error", () => {
    expect(() => assertFavourableSymbolRuleSymbol("ruleLtm", "TECHM")).toThrow(
      /LTM-only/,
    );
  });
});

describe("RuleLTM quality matchers", () => {
  const rule = getFavourableSymbolRuleConfig("ruleLtm");

  it("accepts BUY quality in the LTM oversold band", () => {
    expect(
      matchesBuyQuality(rule, 40, -45, {
        gapPct: 0.5,
        signedGapPct: -0.5,
        matchType: null,
        price: 4400,
        bbLevel: 4380,
      }),
    ).toBe(true);
  });

  it("accepts BUY extended with mid-zone SMI and wider BB gap", () => {
    expect(
      matchesBuyExtended(rule, 20, {
        gapPct: 1.2,
        signedGapPct: -1.2,
        matchType: null,
        price: 4400,
        bbLevel: 4340,
      }),
    ).toBe(true);
  });

  it("accepts SELL quality in elevated RSI / SMI band", () => {
    expect(
      matchesSellQuality(rule, 65, 45, {
        gapPct: 0.5,
        signedGapPct: -0.5,
        matchType: null,
        price: 4500,
        bbLevel: 4520,
      }),
    ).toBe(true);
  });
});

describe("RuleTECHM / RulePOLICYBZR distinctive gates", () => {
  it("RuleTECHM BUY quality prefers deeper oversold RSI", () => {
    const rule = getFavourableSymbolRuleConfig("ruleTechm");
    expect(
      matchesBuyQuality(rule, 32, -50, {
        gapPct: 0.4,
        signedGapPct: -0.4,
        matchType: "crossed",
        price: 1450,
        bbLevel: 1455,
      }),
    ).toBe(true);
    expect(
      matchesBuyQuality(rule, 50, -50, {
        gapPct: 0.4,
        signedGapPct: -0.4,
        matchType: "crossed",
        price: 1450,
        bbLevel: 1455,
      }),
    ).toBe(false);
  });

  it("RulePOLICYBZR SELL quality wants strong SMI (≥60) near BB upper", () => {
    const rule = getFavourableSymbolRuleConfig("rulePolicybzr");
    expect(
      matchesSellQuality(rule, 68, 65, {
        gapPct: 0.3,
        signedGapPct: -0.3,
        matchType: null,
        price: 1700,
        bbLevel: 1705,
      }),
    ).toBe(true);
    // SMI 55 is below the Q4-tuned floor of 60
    expect(
      matchesSellQuality(rule, 68, 55, {
        gapPct: 0.3,
        signedGapPct: -0.3,
        matchType: null,
        price: 1700,
        bbLevel: 1705,
      }),
    ).toBe(false);
    expect(
      matchesSellQuality(rule, 68, 65, {
        gapPct: 0.9,
        signedGapPct: -0.9,
        matchType: null,
        price: 1700,
        bbLevel: 1714,
      }),
    ).toBe(false);
  });
});
