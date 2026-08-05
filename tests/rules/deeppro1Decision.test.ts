import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../../src/config.js";
import { buildIndicatorSnapshots } from "../../src/indicators/compute.js";
import {
  __deeppro1Testables,
  deeppro1SignalToTradeSignal,
  evaluateDeeppro1Day,
  evaluateDeeppro1Decision,
} from "../../src/rules/deeppro1Decision.js";
import type { Candle } from "../../src/types.js";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

const {
  isSmiBlackDownCrossRed,
  isSmiBlackUpCrossRed,
  simulateDeeppro1SquareOff,
  isBackToEntryPrice,
} = __deeppro1Testables;

describe("Deeppro1 config", () => {
  it("uses chart-aligned SMI (10,3,3), 0.45% target, 0.3% breakeven arm, and 13:30 entry deadline", () => {
    expect(config.deeppro1.squareOffPct).toBe(0.45);
    expect(config.deeppro1.breakevenArmPct).toBe(0.3);
    expect(config.deeppro1.entryDeadlineIst).toBe("13:30");
    expect(config.deeppro1.smi).toEqual({
      lengthK: 10,
      lengthD: 3,
      lengthEma: 3,
    });
    expect(config.deeppro1).not.toHaveProperty("tradingSymbol");
    expect(config.deeppro1.smi.lengthEma).not.toBe(config.deeppro.smi.lengthEma);
  });
});

describe("Deeppro1 entry deadline", () => {
  const { isAtOrBeforeEntryDeadline } = __deeppro1Testables;

  it("allows entries at or before 13:30 and blocks later candles", () => {
    expect(isAtOrBeforeEntryDeadline("13:30", "13:30")).toBe(true);
    expect(isAtOrBeforeEntryDeadline("13:15", "13:30")).toBe(true);
    expect(isAtOrBeforeEntryDeadline("13:45", "13:30")).toBe(false);
    expect(isAtOrBeforeEntryDeadline("14:00", "13:30")).toBe(false);
  });
});

describe("Deeppro1 SMI cross detectors", () => {
  it("detects black↓red only when black was strictly above red, then at-or-below", () => {
    expect(isSmiBlackDownCrossRed(10, 8, 7, 9)).toBe(true);
    expect(isSmiBlackDownCrossRed(10, 8, 8, 8)).toBe(true); // touch counts
    // Equal/tangled prior bar is not a visual cross (HINDUNILVR 10:15-style).
    expect(isSmiBlackDownCrossRed(8, 8, 7, 9)).toBe(false);
    expect(isSmiBlackDownCrossRed(10, 8, 9, 8)).toBe(false);
    expect(isSmiBlackDownCrossRed(5, 8, 4, 9)).toBe(false);
  });

  it("detects black↑red only when black was strictly below red, then at-or-above", () => {
    expect(isSmiBlackUpCrossRed(5, 8, 10, 9)).toBe(true);
    expect(isSmiBlackUpCrossRed(5, 8, 8, 8)).toBe(true); // touch counts
    // Equal/tangled prior bar is not a visual cross (HINDUNILVR 11:00-style).
    expect(isSmiBlackUpCrossRed(8, 8, 10, 9)).toBe(false);
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

describe("Deeppro1 square-off simulation", () => {
  it("squares off a SELL when mid drops ≥ 0.45%", () => {
    const dateKey = "2026-03-10";
    const entry = 2000;
    const candles: Candle[] = [
      istCandle(dateKey, 10, 0, entry, entry + 2, entry - 2, entry),
      istCandle(dateKey, 10, 15, 1995, 1996, 1994, 1995),
      istCandle(dateKey, 10, 30, 1990, 1991, 1989, 1990),
    ];
    const snapshots = buildIndicatorSnapshots(candles);
    const exit = simulateDeeppro1SquareOff(
      snapshots,
      dateKey,
      0,
      "SELL",
      entry,
      0.45,
    );
    expect(exit).not.toBeNull();
    expect(exit!.targetHit).toBe(true);
    expect(exit!.exitReason).toBe("target");
    expect(exit!.timeIst).toBe("10:30");
    expect(exit!.profitPct).toBeGreaterThanOrEqual(0.45);
  });

  it("squares off a BUY when mid rises ≥ 0.45%", () => {
    const dateKey = "2026-03-10";
    const entry = 2000;
    const candles: Candle[] = [
      istCandle(dateKey, 11, 0, entry, entry + 2, entry - 2, entry),
      istCandle(dateKey, 11, 15, 2004, 2005, 2003, 2004),
      istCandle(dateKey, 11, 30, 2010, 2011, 2009, 2010),
    ];
    const snapshots = buildIndicatorSnapshots(candles);
    const exit = simulateDeeppro1SquareOff(
      snapshots,
      dateKey,
      0,
      "BUY",
      entry,
      0.45,
    );
    expect(exit).not.toBeNull();
    expect(exit!.targetHit).toBe(true);
    expect(exit!.exitReason).toBe("target");
    expect(exit!.timeIst).toBe("11:30");
  });

  it("BUY: after 0.3% profit, exits at breakeven when mid returns to entry", () => {
    const dateKey = "2026-03-10";
    const entry = 2000;
    // +0.3% mid = 2006; then back to entry mid = 2000
    const candles: Candle[] = [
      istCandle(dateKey, 10, 0, entry, entry + 2, entry - 2, entry),
      istCandle(dateKey, 10, 15, 2006, 2007, 2005, 2006),
      istCandle(dateKey, 10, 30, 2003, 2004, 2002, 2003),
      istCandle(dateKey, 10, 45, entry, entry + 1, entry - 1, entry),
    ];
    const snapshots = buildIndicatorSnapshots(candles);
    const exit = simulateDeeppro1SquareOff(
      snapshots,
      dateKey,
      0,
      "BUY",
      entry,
      0.45,
      0.3,
    );
    expect(exit).not.toBeNull();
    expect(exit!.exitReason).toBe("breakeven");
    expect(exit!.targetHit).toBe(false);
    expect(exit!.timeIst).toBe("10:45");
    expect(exit!.price).toBe(entry);
    expect(exit!.profitPct).toBeCloseTo(0, 5);
  });

  it("SELL: after 0.3% profit, exits at breakeven when mid returns to entry", () => {
    const dateKey = "2026-03-10";
    const entry = 2000;
    // −0.3% mid = 1994; then back to entry mid = 2000
    const candles: Candle[] = [
      istCandle(dateKey, 11, 0, entry, entry + 2, entry - 2, entry),
      istCandle(dateKey, 11, 15, 1994, 1995, 1993, 1994),
      istCandle(dateKey, 11, 30, 1997, 1998, 1996, 1997),
      istCandle(dateKey, 11, 45, entry, entry + 1, entry - 1, entry),
    ];
    const snapshots = buildIndicatorSnapshots(candles);
    const exit = simulateDeeppro1SquareOff(
      snapshots,
      dateKey,
      0,
      "SELL",
      entry,
      0.45,
      0.3,
    );
    expect(exit).not.toBeNull();
    expect(exit!.exitReason).toBe("breakeven");
    expect(exit!.targetHit).toBe(false);
    expect(exit!.timeIst).toBe("11:45");
    expect(exit!.price).toBe(entry);
  });

  it("does not breakeven-exit if 0.3% was never reached", () => {
    const dateKey = "2026-03-10";
    const entry = 2000;
    const candles: Candle[] = [
      istCandle(dateKey, 10, 0, entry, entry + 2, entry - 2, entry),
      // +0.2% only — below arm
      istCandle(dateKey, 10, 15, 2004, 2005, 2003, 2004),
      istCandle(dateKey, 10, 30, entry, entry + 1, entry - 1, entry),
    ];
    const snapshots = buildIndicatorSnapshots(candles);
    const exit = simulateDeeppro1SquareOff(
      snapshots,
      dateKey,
      0,
      "BUY",
      entry,
      0.45,
      0.3,
    );
    expect(exit).toBeNull();
  });

  it("prefers 0.45% target over breakeven when both would apply", () => {
    const dateKey = "2026-03-10";
    const entry = 2000;
    const candles: Candle[] = [
      istCandle(dateKey, 10, 0, entry, entry + 2, entry - 2, entry),
      istCandle(dateKey, 10, 15, 2006, 2007, 2005, 2006), // arms 0.3%
      istCandle(dateKey, 10, 30, 2010, 2011, 2009, 2010), // +0.5% target
    ];
    const snapshots = buildIndicatorSnapshots(candles);
    const exit = simulateDeeppro1SquareOff(
      snapshots,
      dateKey,
      0,
      "BUY",
      entry,
      0.45,
      0.3,
    );
    expect(exit!.exitReason).toBe("target");
    expect(exit!.targetHit).toBe(true);
  });
});

describe("Deeppro1 breakeven helpers", () => {
  it("detects return to entry for BUY and SELL", () => {
    expect(isBackToEntryPrice("BUY", 100, 100)).toBe(true);
    expect(isBackToEntryPrice("BUY", 100, 99.5)).toBe(true);
    expect(isBackToEntryPrice("BUY", 100, 100.1)).toBe(false);
    expect(isBackToEntryPrice("SELL", 100, 100)).toBe(true);
    expect(isBackToEntryPrice("SELL", 100, 100.5)).toBe(true);
    expect(isBackToEntryPrice("SELL", 100, 99.9)).toBe(false);
  });
});

describe("Deeppro1 trade signal mapping", () => {
  it("maps exit profit as % and keeps profitTarget = squareOffPct", () => {
    const signal = {
      side: "SELL" as const,
      rule: "deeppro1" as const,
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
        exitReason: "target" as const,
      },
      reasons: ["test"],
    };
    const trade = deeppro1SignalToTradeSignal(signal);
    expect(trade.side).toBe("SELL");
    expect(trade.scenarioKey).toBe("deeppro1 sell SMI down-cross");
    expect(trade.profitTarget).toBe(0.45);
    expect(trade.exit?.targetHit).toBe(true);
    expect(trade.exit?.profit).toBe(0.5);
    expect(trade.exit?.exitReason).toBe("target");
  });

  it("maps breakeven exitReason through to the trade signal", () => {
    const signal = {
      side: "BUY" as const,
      rule: "deeppro1" as const,
      dateKey: "2026-03-10",
      timeIst: "10:00",
      scenarioKey: "buy_smi_up_cross" as const,
      price: 2000,
      smi: -10,
      signal: -12,
      prevSmi: -14,
      prevSignal: -12,
      rsi: 40,
      squareOffPct: 0.45,
      exit: {
        timeIst: "11:00",
        price: 2000,
        targetHit: false,
        profitPct: 0,
        squareOffPct: 0.45,
        exitReason: "breakeven" as const,
        breakevenArmPct: 0.3,
      },
      reasons: ["test"],
    };
    const trade = deeppro1SignalToTradeSignal(signal);
    expect(trade.exit?.exitReason).toBe("breakeven");
    expect(trade.exit?.targetHit).toBe(false);
  });
});

describe("Deeppro1 day evaluation smoke", () => {
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
    const day = evaluateDeeppro1Day(snapshots, dateKey);
    expect(day.rule).toBe("deeppro1");
    expect(day.signals).toEqual([]);
    expect(evaluateDeeppro1Decision(snapshots, dateKey)).toBeNull();
  });
});

describe("Deeppro1 HINDUNILVR 2026-08-05 chart alignment", () => {
  it("keeps only the visible 11:45 SMI down-cross (not false 10:15 / 11:00)", () => {
    const raw = JSON.parse(
      readFileSync(
        resolve(
          fixtureDir,
          "../fixtures/hindunilvr-15m-2026-07-20_2026-08-05.json",
        ),
        "utf8",
      ),
    ) as Array<[string, number, number, number, number, number]>;

    const candles: Candle[] = raw.map((row) => ({
      timestamp: new Date(row[0]),
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
      volume: row[5],
    }));
    const snapshots = buildIndicatorSnapshots(candles);
    const day = evaluateDeeppro1Day(snapshots, "2026-08-05");
    const times = day.signals.map((signal) => `${signal.timeIst}:${signal.side}`);

    expect(times).not.toContain("10:15:SELL");
    expect(times).not.toContain("11:00:BUY");
    expect(times).toContain("11:45:SELL");
  });
});
