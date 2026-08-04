import { describe, expect, it } from "vitest";
import { config } from "../../src/config.js";
import { buildIndicatorSnapshots } from "../../src/indicators/compute.js";
import {
  __ruleSunpharma1Testables,
  assertRuleSunpharma1Symbol,
  evaluateRuleSunpharma1Day,
  isRuleSunpharma1Symbol,
  ruleSunpharma1SignalToTradeSignal,
} from "../../src/rules/ruleSunpharma1Decision.js";
import type { Candle } from "../../src/types.js";

const { isSmiBlackDownCrossRed, isSmiBlackUpCrossRed, simulateRuleSunpharma1SquareOff } =
  __ruleSunpharma1Testables;

describe("RuleSUNPHARMA1 SUNPHARMA-only symbol guard", () => {
  it("accepts only SUNPHARMA", () => {
    expect(isRuleSunpharma1Symbol("SUNPHARMA")).toBe(true);
    expect(isRuleSunpharma1Symbol("NSE:SUNPHARMA")).toBe(true);
    expect(isRuleSunpharma1Symbol("sunpharma")).toBe(true);
    expect(isRuleSunpharma1Symbol("PNB")).toBe(false);
    expect(isRuleSunpharma1Symbol("TCS")).toBe(false);
  });

  it("rejects non-SUNPHARMA symbols with a clear error", () => {
    expect(() => assertRuleSunpharma1Symbol("PNB")).toThrow(/SUNPHARMA-only/);
  });

  it("keeps square-off at 0.45% and chart-aligned SMI (10,3,3)", () => {
    expect(config.ruleSunpharma1.squareOffPct).toBe(0.45);
    expect(config.ruleSunpharma1.smi).toEqual({
      lengthK: 10,
      lengthD: 3,
      lengthEma: 3,
    });
    expect(config.ruleSunpharma1.tradingSymbol).toBe("SUNPHARMA");
  });

  it("does not share config with RuleSUNPHARMA", () => {
    expect(config.ruleSunpharma1).not.toBe(config.ruleSunpharma);
    expect(config.ruleSunpharma1.smi.lengthEma).not.toBe(
      config.ruleSunpharma.smi.lengthEma,
    );
  });
});

describe("RuleSUNPHARMA1 SMI cross detectors", () => {
  it("detects black↓red down-cross", () => {
    expect(isSmiBlackDownCrossRed(10, 8, 7, 9)).toBe(true);
    expect(isSmiBlackDownCrossRed(8, 8, 7, 9)).toBe(true); // was equal, then below
    expect(isSmiBlackDownCrossRed(10, 8, 9, 8)).toBe(false); // still above
    expect(isSmiBlackDownCrossRed(5, 8, 4, 9)).toBe(false); // already below
  });

  it("detects black↑red up-cross", () => {
    expect(isSmiBlackUpCrossRed(5, 8, 10, 9)).toBe(true);
    expect(isSmiBlackUpCrossRed(8, 8, 10, 9)).toBe(true);
    expect(isSmiBlackUpCrossRed(5, 8, 7, 9)).toBe(false);
    expect(isSmiBlackUpCrossRed(12, 8, 13, 9)).toBe(false);
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

describe("RuleSUNPHARMA1 square-off simulation", () => {
  it("squares off a SELL when mid drops ≥ 0.45%", () => {
    const dateKey = "2026-03-10";
    const entry = 2000;
    // Build a short series: entry bar + later bars
    const candles: Candle[] = [
      istCandle(dateKey, 10, 0, entry, entry + 2, entry - 2, entry),
      istCandle(dateKey, 10, 15, 1995, 1996, 1994, 1995), // ~0.25% drop — not enough
      istCandle(dateKey, 10, 30, 1990, 1991, 1989, 1990), // ~0.50% drop — hit
    ];
    const snapshots = buildIndicatorSnapshots(candles);
    const exit = simulateRuleSunpharma1SquareOff(
      snapshots,
      dateKey,
      0,
      "SELL",
      entry,
      0.45,
    );
    expect(exit).not.toBeNull();
    expect(exit!.targetHit).toBe(true);
    expect(exit!.timeIst).toBe("10:30");
    expect(exit!.profitPct).toBeGreaterThanOrEqual(0.45);
  });

  it("squares off a BUY when mid rises ≥ 0.45%", () => {
    const dateKey = "2026-03-10";
    const entry = 2000;
    const candles: Candle[] = [
      istCandle(dateKey, 11, 0, entry, entry + 2, entry - 2, entry),
      istCandle(dateKey, 11, 15, 2004, 2005, 2003, 2004), // 0.20%
      istCandle(dateKey, 11, 30, 2010, 2011, 2009, 2010), // 0.50%
    ];
    const snapshots = buildIndicatorSnapshots(candles);
    const exit = simulateRuleSunpharma1SquareOff(
      snapshots,
      dateKey,
      0,
      "BUY",
      entry,
      0.45,
    );
    expect(exit).not.toBeNull();
    expect(exit!.targetHit).toBe(true);
    expect(exit!.timeIst).toBe("11:30");
    expect(exit!.profitPct).toBeGreaterThanOrEqual(0.45);
  });

  it("returns null when target is never reached same day", () => {
    const dateKey = "2026-03-10";
    const entry = 2000;
    const candles: Candle[] = [
      istCandle(dateKey, 12, 0, entry, entry + 2, entry - 2, entry),
      istCandle(dateKey, 12, 15, 1998, 1999, 1997, 1998), // 0.10%
      istCandle(dateKey, 12, 30, 1996, 1997, 1995, 1996), // 0.20%
    ];
    const snapshots = buildIndicatorSnapshots(candles);
    const exit = simulateRuleSunpharma1SquareOff(
      snapshots,
      dateKey,
      0,
      "SELL",
      entry,
      0.45,
    );
    expect(exit).toBeNull();
  });
});

describe("RuleSUNPHARMA1 trade signal mapping", () => {
  it("maps exit profit as % and keeps profitTarget = squareOffPct", () => {
    const signal = {
      side: "SELL" as const,
      rule: "ruleSunpharma1" as const,
      dateKey: "2026-03-10",
      timeIst: "10:00",
      scenarioKey: "sell_smi_down_cross" as const,
      price: 2000,
      smi: 10,
      signal: 12,
      prevSmi: 14,
      prevSignal: 12,
      rsi: 60,
      squareOffPct: 0.45,
      exit: {
        timeIst: "10:30",
        price: 1990,
        targetHit: true,
        profitPct: 0.5,
        squareOffPct: 0.45,
      },
      reasons: ["test"],
    };
    const trade = ruleSunpharma1SignalToTradeSignal(signal);
    expect(trade.side).toBe("SELL");
    expect(trade.scenarioKey).toBe("ruleSunpharma1 sell SMI down-cross");
    expect(trade.profitTarget).toBe(0.45);
    expect(trade.exit?.targetHit).toBe(true);
    expect(trade.exit?.profit).toBe(0.5);
  });
});

describe("RuleSUNPHARMA1 day evaluation smoke", () => {
  it("returns empty signals on a flat day with insufficient SMI history", () => {
    const dateKey = "2026-03-10";
    const candles: Candle[] = [];
    for (let i = 0; i < 5; i++) {
      const minute = 15 + i * 15;
      const h = 9 + Math.floor(minute / 60);
      const m = minute % 60;
      candles.push(istCandle(dateKey, h, m, 1800, 1801, 1799, 1800));
    }
    const snapshots = buildIndicatorSnapshots(candles);
    const day = evaluateRuleSunpharma1Day(snapshots, dateKey);
    expect(day.rule).toBe("ruleSunpharma1");
    expect(day.signals).toEqual([]);
  });
});
