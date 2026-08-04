import { describe, expect, it } from "vitest";
import { config } from "../../src/config.js";
import { buildIndicatorSnapshots } from "../../src/indicators/compute.js";
import {
  __rulePnb1Testables,
  assertRulePnb1Symbol,
  isRulePnb1Symbol,
  rulePnb1SignalToTradeSignal,
} from "../../src/rules/rulePnb1Decision.js";
import type { Candle } from "../../src/types.js";

const { isSmiBlackDownCrossRed, simulateRulePnb1SquareOff } = __rulePnb1Testables;

describe("RulePNB1 PNB-only symbol guard", () => {
  it("accepts only PNB", () => {
    expect(isRulePnb1Symbol("PNB")).toBe(true);
    expect(isRulePnb1Symbol("NSE:PNB")).toBe(true);
    expect(isRulePnb1Symbol("SUNPHARMA")).toBe(false);
  });

  it("rejects non-PNB symbols", () => {
    expect(() => assertRulePnb1Symbol("SUNPHARMA")).toThrow(/PNB-only/);
  });

  it("mirrors RuleSUNPHARMA1 square-off and SMI params", () => {
    expect(config.rulePnb1.squareOffPct).toBe(config.ruleSunpharma1.squareOffPct);
    expect(config.rulePnb1.smi).toEqual(config.ruleSunpharma1.smi);
    expect(config.rulePnb1.tradingSymbol).toBe("PNB");
  });
});

describe("RulePNB1 cross + square-off", () => {
  it("detects black↓red", () => {
    expect(isSmiBlackDownCrossRed(10, 8, 7, 9)).toBe(true);
  });

  it("squares off SELL at 0.45% drop", () => {
    const dateKey = "2026-03-10";
    const entry = 100;
    const candles: Candle[] = [
      {
        timestamp: new Date(`${dateKey}T10:00:00+05:30`),
        open: entry,
        high: entry + 0.2,
        low: entry - 0.2,
        close: entry,
        volume: 1000,
      },
      {
        timestamp: new Date(`${dateKey}T10:15:00+05:30`),
        open: 99.7,
        high: 99.8,
        low: 99.6,
        close: 99.7,
        volume: 1000,
      },
      {
        timestamp: new Date(`${dateKey}T10:30:00+05:30`),
        open: 99.4,
        high: 99.5,
        low: 99.3,
        close: 99.4,
        volume: 1000,
      },
    ];
    const snapshots = buildIndicatorSnapshots(candles);
    const exit = simulateRulePnb1SquareOff(snapshots, dateKey, 0, "SELL", entry, 0.45);
    expect(exit).not.toBeNull();
    expect(exit!.targetHit).toBe(true);
    expect(exit!.timeIst).toBe("10:30");
  });

  it("maps trade signal labels for RulePNB1", () => {
    const trade = rulePnb1SignalToTradeSignal({
      side: "BUY",
      rule: "rulePnb1",
      dateKey: "2026-03-10",
      timeIst: "11:00",
      scenarioKey: "buy_smi_up_cross",
      price: 100,
      smi: 5,
      signal: 4,
      prevSmi: 3,
      prevSignal: 4,
      rsi: 55,
      squareOffPct: 0.45,
      exit: null,
      reasons: [],
    });
    expect(trade.scenarioKey).toBe("rulePnb1 buy SMI up-cross");
    expect(trade.profitTarget).toBe(0.45);
  });
});
