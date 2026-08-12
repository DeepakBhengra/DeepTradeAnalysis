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
  it("uses chart-aligned SMI (10,3,3), 0.45% target, 0.3% breakeven arm, 11:45 entry cutoff, 15:00 force exit", () => {
    expect(config.deeppro1.squareOffPct).toBe(0.45);
    expect(config.deeppro1.breakevenArmPct).toBe(0.3);
    expect(config.deeppro1.entryDeadlineIst).toBe("11:45");
    expect(config.deeppro1.forceExitIst).toBe("15:00");
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
  const { isAtOrBeforeEntryDeadline, isAtOrAfterForceExit } = __deeppro1Testables;

  it("allows entries at or before 11:45 and blocks later candles", () => {
    expect(isAtOrBeforeEntryDeadline("11:45", "11:45")).toBe(true);
    expect(isAtOrBeforeEntryDeadline("11:30", "11:45")).toBe(true);
    expect(isAtOrBeforeEntryDeadline("12:00", "11:45")).toBe(false);
    expect(isAtOrBeforeEntryDeadline("13:30", "11:45")).toBe(false);
  });

  it("treats 15:00 and later as force-exit window", () => {
    expect(isAtOrAfterForceExit("14:45", "15:00")).toBe(false);
    expect(isAtOrAfterForceExit("15:00", "15:00")).toBe(true);
    expect(isAtOrAfterForceExit("15:15", "15:00")).toBe(true);
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
    expect(day.signals.every((signal) => signal.timeIst <= "11:45")).toBe(true);
    expect(day.signals.every((signal) => signal.exit != null)).toBe(true);
  });
});

describe("Deeppro1 position management", () => {
  function sessionBars(dateKey: string, closes: number[]): Candle[] {
    return closes.map((close, bar) => {
      const minute = 15 + bar * 15;
      const h = 9 + Math.floor(minute / 60);
      const m = minute % 60;
      return istCandle(dateKey, h, m, close, close + 0.2, close - 0.2, close);
    });
  }

  function risingWarmup(): Candle[] {
    const prior: Candle[] = [];
    for (let d = 1; d <= 8; d++) {
      const day = `2026-03-0${d}`;
      const closes = Array.from({ length: 25 }, (_, i) => 1000 + d * 20 + i * 3);
      prior.push(...sessionBars(day, closes));
    }
    return prior;
  }

  it("forces a 15:00 exit when still open without target/breakeven/flip", () => {
    // Rise into mid-morning, one pull that prints SELL, then freeze at entry mid
    // so neither 0.45% target nor an opposite flip fires before 15:00.
    const path: number[] = [];
    for (let i = 0; i < 9; i++) path.push(1240 + i * 2);
    path.push(1230); // 11:30 SELL
    for (let i = 0; i < 15; i++) path.push(1230);
    const day = evaluateDeeppro1Day(
      buildIndicatorSnapshots([...risingWarmup(), ...sessionBars("2026-03-10", path)]),
      "2026-03-10",
    );
    expect(day.signals.length).toBeGreaterThan(0);
    expect(day.signals.every((s) => s.timeIst <= "11:45")).toBe(true);
    const eodExits = day.signals.filter((s) => s.exit?.exitReason === "eod");
    expect(eodExits.length).toBeGreaterThan(0);
    expect(eodExits.every((s) => s.exit?.timeIst === "15:00")).toBe(true);
  });

  it("does not fake EOD on mid-day truncated candles (simulator parity)", () => {
    // Same open SELL as the 15:00 force-exit case, but stop the series before 15:00.
    // Day Scan Simulator truncates candles per session index; premature safety EOD
    // would lock Day Order Simulator into the wrong exit time/price vs full-day Day Scan.
    const path: number[] = [];
    for (let i = 0; i < 9; i++) path.push(1240 + i * 2);
    path.push(1230); // 11:30 SELL
    // Through 12:00 only (9:15 + 11*15m = 12:00) — still before forceExitIst.
    for (let i = 0; i < 1; i++) path.push(1230);
    const truncatedBars = sessionBars("2026-03-10", path);
    expect(truncatedBars[truncatedBars.length - 1]).toBeTruthy();

    const truncated = evaluateDeeppro1Day(
      buildIndicatorSnapshots([...risingWarmup(), ...truncatedBars]),
      "2026-03-10",
    );
    const openSignals = truncated.signals.filter((s) => s.exit == null);
    expect(openSignals.length).toBeGreaterThan(0);
    expect(
      truncated.signals.some(
        (s) => s.exit?.exitReason === "eod" && s.exit.timeIst < "15:00",
      ),
    ).toBe(false);

    // Extend through 15:00 — same entry should now get a real 15:00 EOD exit.
    while (path.length < 25) path.push(1230);
    const full = evaluateDeeppro1Day(
      buildIndicatorSnapshots([...risingWarmup(), ...sessionBars("2026-03-10", path)]),
      "2026-03-10",
    );
    const eod = full.signals.find((s) => s.exit?.exitReason === "eod");
    expect(eod?.exit?.timeIst).toBe("15:00");
    expect(openSignals[0]?.timeIst).toBe(eod?.timeIst);
    expect(openSignals[0]?.price).toBe(eod?.price);
  });

  it("keeps the later true exit when truncated mid-day then evaluated full-day", () => {
    // Entry mid-morning, then a delayed favourable move that hits 0.45% after noon.
    // Truncation before the target must not invent an early exit; full day must hit target.
    const path: number[] = [];
    for (let i = 0; i < 9; i++) path.push(1240 + i * 2);
    path.push(1230); // ~11:30 SELL entry mid 1230
    // Hold flat through late morning / early afternoon (no target yet).
    for (let i = 0; i < 6; i++) path.push(1230);
    const beforeTarget = [...path];
    // Drop enough for SELL target (≥0.45%): 1230 * 0.9955 ≈ 1224.465
    path.push(1220);

    const truncated = evaluateDeeppro1Day(
      buildIndicatorSnapshots([
        ...risingWarmup(),
        ...sessionBars("2026-03-10", beforeTarget),
      ]),
      "2026-03-10",
    );
    const stillOpen = truncated.signals.filter((s) => s.side === "SELL" && s.exit == null);
    expect(stillOpen.length).toBeGreaterThan(0);

    const full = evaluateDeeppro1Day(
      buildIndicatorSnapshots([...risingWarmup(), ...sessionBars("2026-03-10", path)]),
      "2026-03-10",
    );
    const sell = full.signals.find((s) => s.side === "SELL" && s.exit != null);
    expect(sell?.exit?.exitReason).toBe("target");
    expect(sell?.exit?.timeIst).toBeTruthy();
    expect(sell!.exit!.timeIst > "11:45").toBe(true);
    expect(stillOpen[0]?.timeIst).toBe(sell?.timeIst);
    expect(stillOpen[0]?.price).toBe(sell?.price);
  });

  it("flip-exits an open side on opposite cross and opens the new side before 11:45", () => {
    // Long downtrend → morning bounce prints BUY → freeze under 0.45% → reverse prints SELL flip.
    const prior: Candle[] = [];
    for (let d = 1; d <= 8; d++) {
      prior.push(
        ...sessionBars(
          `2026-03-0${d}`,
          Array.from({ length: 25 }, (_, i) => 1500 - d * 30 - i * 4),
        ),
      );
    }
    const path = [
      800, 810, 820, 820, 820, 820, 800, 780, 760, 740, 720, 720, 720, 720, 720,
      720, 720, 720, 720, 720, 720, 720, 720, 720, 720,
    ];
    const day = evaluateDeeppro1Day(
      buildIndicatorSnapshots([...prior, ...sessionBars("2026-03-10", path)]),
      "2026-03-10",
    );
    const flips = day.signals.filter((s) => s.exit?.exitReason === "flip");
    expect(flips.length).toBeGreaterThan(0);
    for (const cur of flips) {
      expect(cur.exit?.timeIst).toBeTruthy();
      if (cur.exit!.timeIst <= "11:45") {
        const spawned = day.signals.find(
          (s) => s.timeIst === cur.exit!.timeIst && s.side !== cur.side,
        );
        expect(spawned).toBeTruthy();
        expect(spawned!.price).toBe(cur.exit!.price);
      } else {
        const spawned = day.signals.find(
          (s) => s.timeIst === cur.exit!.timeIst && s.side !== cur.side,
        );
        expect(spawned).toBeUndefined();
      }
    }
  });
});
