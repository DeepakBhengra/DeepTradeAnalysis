import { describe, expect, it } from "vitest";
import { config } from "../../src/config.js";
import { buildIndicatorSnapshots } from "../../src/indicators/compute.js";
import {
  __rulePnbTestables,
  assertRulePnbSymbol,
  evaluateRulePnbDay,
  isRulePnbSymbol,
  rulePnbSignalToTradeSignal,
} from "../../src/rules/rulePnbDecision.js";
import type { Candle } from "../../src/types.js";

const { matchesBuyQuality, matchesSellQuality, matchesBuyExtended } =
  __rulePnbTestables;

describe("RulePNB PNB-only symbol guard", () => {
  it("accepts only PNB", () => {
    expect(isRulePnbSymbol("PNB")).toBe(true);
    expect(isRulePnbSymbol("NSE:PNB")).toBe(true);
    expect(isRulePnbSymbol("pnb")).toBe(true);
    expect(isRulePnbSymbol("TCS")).toBe(false);
    expect(isRulePnbSymbol("SBIN")).toBe(false);
  });

  it("rejects non-PNB symbols with a clear error", () => {
    expect(() => assertRulePnbSymbol("TCS")).toThrow(/PNB-only/);
  });

  it("enables buyGuards + sellCascade (same pattern as RuleICICIGI)", () => {
    expect(config.rulePnb.buyGuards).toEqual({
      requireSmiRising: true,
      requireMacdHistRising: true,
      requireNextBarConfirmation: true,
      maxOpenDrawdownPct: 0.8,
    });
    expect(config.rulePnb.sellCascade).toEqual({
      enabled: true,
      requireSmiFalling: true,
      requireMacdHistFalling: true,
      requireNextBarLower: true,
      minOpenDrawdownPct: null,
    });
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

describe("RulePNB quality matchers", () => {
  it("accepts BUY quality when RSI 25–50, SMI ≤ −40, and near BB lower", () => {
    expect(
      matchesBuyQuality(33, -45, {
        gapPct: 0.5,
        signedGapPct: -0.5,
        matchType: null,
        price: 99,
        bbLevel: 98.5,
      }),
    ).toBe(true);
  });

  it("rejects BUY quality when SMI is above −40", () => {
    expect(
      matchesBuyQuality(33, -20, {
        gapPct: 0.3,
        signedGapPct: -0.3,
        matchType: "crossed",
        price: 99,
        bbLevel: 99.2,
      }),
    ).toBe(false);
  });

  it("accepts BUY extended with negative SMI and wider BB lower gap", () => {
    expect(
      matchesBuyExtended(-15, {
        gapPct: 1.2,
        signedGapPct: -1.2,
        matchType: null,
        price: 99,
        bbLevel: 97.8,
      }),
    ).toBe(true);
  });

  it("accepts SELL quality when RSI 50–70, SMI ≥ 40, and near BB upper", () => {
    expect(
      matchesSellQuality(58, 42, {
        gapPct: 0.6,
        signedGapPct: -0.6,
        matchType: null,
        price: 101,
        bbLevel: 101.6,
      }),
    ).toBe(true);
  });

  it("rejects SELL quality when RSI is below 50", () => {
    expect(
      matchesSellQuality(45, 50, {
        gapPct: 0.4,
        signedGapPct: -0.4,
        matchType: "close",
        price: 101,
        bbLevel: 101.4,
      }),
    ).toBe(false);
  });
});

describe("evaluateRulePnbDay", () => {
  it("maps BUY quality signals to shared trade-signal shape", () => {
    const trade = rulePnbSignalToTradeSignal({
      side: "BUY",
      rule: "rulePnb",
      dateKey: "2026-06-29",
      timeIst: "10:15",
      scenarioKey: "buy_quality",
      price: 100.5,
      smi: -45,
      rsi: 33,
      bbUpperProximity: {
        gapPct: 2,
        signedGapPct: -2,
        matchType: null,
        price: 102,
        bbLevel: 104,
      },
      bbLowerProximity: {
        gapPct: 0.4,
        signedGapPct: 0.4,
        matchType: "crossed",
        price: 99.5,
        bbLevel: 99.9,
      },
      reasons: ["test"],
    });

    expect(trade.scenarioKey).toBe("rulePnb buy quality");
    expect(trade.scenarioNumber).toBe(1);
    expect(trade.bbMatchType).toBe("crossed");
    expect(trade.profitTarget).toBe(0);
  });

  it("returns empty signals on a flat quiet day", () => {
    const dateKey = "2026-06-29";
    const candles: Candle[] = [];
    let price = 100;
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
    const day = evaluateRulePnbDay(snapshots, dateKey);
    expect(day.rule).toBe("rulePnb");
    expect(day.signals).toEqual([]);
  });
});
