import { describe, expect, it } from "vitest";
import {
  __favourableSymbolRuleTestables,
  assertFavourableSymbolRuleSymbol,
  evaluateBuyGuards,
  evaluateSellCascade,
  favourableSymbolRuleIdForTradingSymbol,
  getFavourableSymbolRuleConfig,
  isFavourableSymbolRuleSymbol,
  type FavourableSymbolRuleConfig,
} from "../../src/rules/favourableSymbolRule.js";

const {
  matchesBuyQuality,
  matchesSellQuality,
  matchesBuyExtended,
  matchesSellCascadeLevels,
} = __favourableSymbolRuleTestables;

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

  it("enables buyGuards only on RuleICICIGI", () => {
    expect(getFavourableSymbolRuleConfig("ruleIcicigi").buyGuards).toEqual({
      requireSmiRising: true,
      requireMacdHistRising: true,
      requireNextBarConfirmation: true,
      maxOpenDrawdownPct: 0.8,
    });
    expect(getFavourableSymbolRuleConfig("ruleLtm").buyGuards).toBeUndefined();
  });

  it("enables sellCascade only on RuleICICIGI", () => {
    expect(getFavourableSymbolRuleConfig("ruleIcicigi").sellCascade).toEqual({
      enabled: true,
      requireSmiFalling: true,
      requireMacdHistFalling: true,
      requireNextBarLower: true,
      minOpenDrawdownPct: null,
    });
    expect(getFavourableSymbolRuleConfig("ruleLtm").sellCascade).toBeUndefined();
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

describe("RuleICICIGI buyGuards", () => {
  const rule = getFavourableSymbolRuleConfig("ruleIcicigi");

  const passingCtx = {
    smi: -42,
    prevSmi: -50,
    macdHist: -1.0,
    prevMacdHist: -1.5,
    setupMid: 1680,
    dayOpenMid: 1690,
    nextMid: 1685,
  };

  it("passes when SMI+MACD rising, confirm up, and open drawdown within cap", () => {
    const result = evaluateBuyGuards(rule, passingCtx);
    expect(result.ok).toBe(true);
    expect(result.confirmedOnNextBar).toBe(true);
    expect(result.reasons.some((r) => r.includes("SMI rising"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("MACD hist rising"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("next-bar confirm"))).toBe(true);
  });

  it("rejects falling SMI (29 Jul style cascade)", () => {
    expect(
      evaluateBuyGuards(rule, { ...passingCtx, smi: -47, prevSmi: -25 }).ok,
    ).toBe(false);
  });

  it("rejects falling MACD histogram", () => {
    expect(
      evaluateBuyGuards(rule, {
        ...passingCtx,
        macdHist: -1.7,
        prevMacdHist: -1.4,
      }).ok,
    ).toBe(false);
  });

  it("rejects next-bar confirmation failure", () => {
    expect(
      evaluateBuyGuards(rule, { ...passingCtx, nextMid: 1673 }).ok,
    ).toBe(false);
  });

  it("rejects open drawdown beyond 0.8%", () => {
    // 1691.75 → 1675.70 ≈ -0.95% (29 Jul)
    expect(
      evaluateBuyGuards(rule, {
        ...passingCtx,
        dayOpenMid: 1691.75,
        setupMid: 1675.7,
      }).ok,
    ).toBe(false);
  });

  it("allows disabling open-drawdown cap via null", () => {
    const relaxed: FavourableSymbolRuleConfig = {
      ...rule,
      buyGuards: {
        ...rule.buyGuards!,
        maxOpenDrawdownPct: null,
      },
    };
    expect(
      evaluateBuyGuards(relaxed, {
        ...passingCtx,
        dayOpenMid: 1691.75,
        setupMid: 1675.7,
      }).ok,
    ).toBe(true);
  });

  it("no-ops when buyGuards are absent", () => {
    const bare: FavourableSymbolRuleConfig = { ...rule, buyGuards: undefined };
    expect(
      evaluateBuyGuards(bare, {
        smi: -10,
        prevSmi: 0,
        macdHist: -5,
        prevMacdHist: -1,
        setupMid: 100,
        dayOpenMid: 120,
        nextMid: 90,
      }),
    ).toEqual({ ok: true, reasons: [], confirmedOnNextBar: false });
  });
});

describe("RuleICICIGI sellCascade", () => {
  const rule = getFavourableSymbolRuleConfig("ruleIcicigi");

  const cascadeCtx = {
    smi: -54,
    prevSmi: -34,
    macdHist: -1.33,
    prevMacdHist: -0.75,
    setupMid: 1675.7,
    dayOpenMid: 1691.75,
    nextMid: 1673.3,
  };

  it("accepts oversold levels that match BUY quality band", () => {
    expect(
      matchesSellCascadeLevels(rule, 33.7, -54, {
        gapPct: 0.3,
        signedGapPct: -0.3,
        matchType: null,
        price: 1671,
        bbLevel: 1666,
      }),
    ).toBe(true);
  });

  it("passes 29 Jul–style falling knife as SELL cascade", () => {
    const result = evaluateSellCascade(rule, cascadeCtx);
    expect(result.ok).toBe(true);
    expect(result.confirmedOnNextBar).toBe(true);
    expect(result.reasons.some((r) => r.includes("SMI falling"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("MACD hist falling"))).toBe(
      true,
    );
    expect(result.reasons.some((r) => r.includes("next-bar cascade"))).toBe(
      true,
    );
  });

  it("rejects when SMI is rising (would be a BUY turn instead)", () => {
    expect(
      evaluateSellCascade(rule, {
        ...cascadeCtx,
        smi: -40,
        prevSmi: -50,
      }).ok,
    ).toBe(false);
  });

  it("rejects when next bar is higher", () => {
    expect(
      evaluateSellCascade(rule, { ...cascadeCtx, nextMid: 1680 }).ok,
    ).toBe(false);
  });
});
