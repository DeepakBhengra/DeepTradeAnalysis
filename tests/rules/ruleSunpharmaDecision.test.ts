import { describe, expect, it } from "vitest";
import { buildIndicatorSnapshots } from "../../src/indicators/compute.js";
import {
  __ruleSunpharmaTestables,
  assertRuleSunpharmaSymbol,
  evaluateRuleSunpharmaDay,
  isRuleSunpharmaSymbol,
  ruleSunpharmaSignalToTradeSignal,
} from "../../src/rules/ruleSunpharmaDecision.js";
import type { Candle } from "../../src/types.js";

const { matchesBuyQuality, matchesSellQuality, matchesBuyExtended } =
  __ruleSunpharmaTestables;

describe("RuleSUNPHARMA SUNPHARMA-only symbol guard", () => {
  it("accepts only SUNPHARMA", () => {
    expect(isRuleSunpharmaSymbol("SUNPHARMA")).toBe(true);
    expect(isRuleSunpharmaSymbol("NSE:SUNPHARMA")).toBe(true);
    expect(isRuleSunpharmaSymbol("sunpharma")).toBe(true);
    expect(isRuleSunpharmaSymbol("PNB")).toBe(false);
    expect(isRuleSunpharmaSymbol("TCS")).toBe(false);
  });

  it("rejects non-SUNPHARMA symbols with a clear error", () => {
    expect(() => assertRuleSunpharmaSymbol("PNB")).toThrow(/SUNPHARMA-only/);
  });
});

function istCandle(
  dateKey: string,
  hour: number,
  minute: number,
  open: number,
  high: number,
  low: number,
  close: number,
): Candle {
  const timestamp = new Date(
    `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`,
  );
  return {
    timestamp,
    open,
    high,
    low,
    close,
    volume: 10_000,
  };
}

describe("RuleSUNPHARMA quality matchers", () => {
  it("accepts BUY quality when RSI 33–56, SMI ≤ −40, and near BB lower", () => {
    expect(
      matchesBuyQuality(39, -45, {
        gapPct: 0.4,
        signedGapPct: -0.4,
        matchType: null,
        price: 1870,
        bbLevel: 1862,
      }),
    ).toBe(true);
  });

  it("rejects BUY quality when SMI is above −40", () => {
    expect(
      matchesBuyQuality(39, -20, {
        gapPct: 0.3,
        signedGapPct: -0.3,
        matchType: "crossed",
        price: 1870,
        bbLevel: 1875,
      }),
    ).toBe(false);
  });

  it("accepts BUY extended with mid-zone SMI and tight BB lower gap", () => {
    expect(
      matchesBuyExtended(16, {
        gapPct: 0.4,
        signedGapPct: -0.4,
        matchType: null,
        price: 1870,
        bbLevel: 1862,
      }),
    ).toBe(true);
  });

  it("rejects BUY extended when SMI is overbought (> 40)", () => {
    expect(
      matchesBuyExtended(45, {
        gapPct: 0.3,
        signedGapPct: -0.3,
        matchType: "close",
        price: 1870,
        bbLevel: 1865,
      }),
    ).toBe(false);
  });

  it("accepts SELL quality when RSI 56–72, SMI ≥ 40, and tight BB upper", () => {
    expect(
      matchesSellQuality(64, 56, {
        gapPct: 0.2,
        signedGapPct: -0.2,
        matchType: null,
        price: 1900,
        bbLevel: 1904,
      }),
    ).toBe(true);
  });

  it("rejects SELL quality when RSI is below 56", () => {
    expect(
      matchesSellQuality(50, 55, {
        gapPct: 0.2,
        signedGapPct: -0.2,
        matchType: "close",
        price: 1900,
        bbLevel: 1904,
      }),
    ).toBe(false);
  });

  it("rejects SELL quality when BB upper gap is too wide", () => {
    expect(
      matchesSellQuality(64, 56, {
        gapPct: 0.5,
        signedGapPct: -0.5,
        matchType: null,
        price: 1900,
        bbLevel: 1910,
      }),
    ).toBe(false);
  });
});

describe("evaluateRuleSunpharmaDay", () => {
  it("maps BUY quality signals to shared trade-signal shape", () => {
    const trade = ruleSunpharmaSignalToTradeSignal({
      side: "BUY",
      rule: "ruleSunpharma",
      dateKey: "2026-07-03",
      timeIst: "09:15",
      scenarioKey: "buy_quality",
      price: 1878.35,
      smi: -45,
      rsi: 39,
      bbUpperProximity: {
        gapPct: 2,
        signedGapPct: -2,
        matchType: null,
        price: 1900,
        bbLevel: 1940,
      },
      bbLowerProximity: {
        gapPct: 0.3,
        signedGapPct: 0.3,
        matchType: "crossed",
        price: 1870,
        bbLevel: 1875,
      },
      reasons: ["test"],
    });

    expect(trade.scenarioKey).toBe("ruleSunpharma buy quality");
    expect(trade.scenarioNumber).toBe(1);
    expect(trade.bbMatchType).toBe("crossed");
    expect(trade.profitTarget).toBe(0);
  });

  it("returns empty signals on a flat quiet day", () => {
    const dateKey = "2026-07-03";
    const candles: Candle[] = [];
    let price = 1900;
    for (let i = 0; i < 30; i++) {
      const totalMinutes = 9 * 60 + 15 + i * 15;
      const hour = Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      candles.push(
        istCandle(dateKey, hour, minute, price, price + 0.2, price - 0.2, price),
      );
      price += 0.05;
    }

    const snapshots = buildIndicatorSnapshots(candles);
    const day = evaluateRuleSunpharmaDay(snapshots, dateKey);
    expect(day.rule).toBe("ruleSunpharma");
    expect(day.signals).toEqual([]);
  });
});
