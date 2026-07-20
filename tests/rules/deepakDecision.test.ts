import { describe, expect, it } from "vitest";
import {
  candleMidPrice,
  DEEPAK_SCENARIOS,
  evaluateDeepakDecision,
} from "../../src/rules/deepakDecision.js";
import type { IndicatorSnapshot } from "../../src/types.js";

const DATE = "2026-06-09";

function offsetDate(date: string, dayOffset: number): string {
  const parsed = new Date(`${date}T00:00:00+05:30`);
  parsed.setDate(parsed.getDate() + dayOffset);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function istTimestampForDate(date: string, hour: number, minute: number): Date {
  return new Date(
    `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`,
  );
}

function istTimestamp(hour: number, minute: number): Date {
  return istTimestampForDate(DATE, hour, minute);
}

function makeSnapshot(
  hour: number,
  minute: number,
  opts: {
    open?: number;
    close?: number;
    high?: number;
    low?: number;
    upper?: number;
    middle?: number;
    lower?: number;
    rsi?: number;
  } = {},
): IndicatorSnapshot {
  const close = opts.close ?? 100;
  const open = opts.open ?? close - 0.05;
  const upper = opts.upper ?? close + 20;
  const middle = opts.middle ?? close + 15;
  const lower = opts.lower ?? close;
  const high = opts.high ?? Math.max(open, close) + 0.2;
  const low = opts.low ?? Math.min(open, close) - 0.05;

  return {
    timestamp: istTimestamp(hour, minute),
    open,
    high,
    low,
    close,
    bollinger: { upper, middle, lower },
    rsi: opts.rsi ?? 50,
    macd: { macdLine: 0.1, signalLine: 0.05, histogram: 0.05 },
  };
}

function lowerOnlySnapshot(hour: number, minute: number, close = 100): IndicatorSnapshot {
  const lower = close;
  return makeSnapshot(hour, minute, {
    close,
    high: close + 0.1,
    low: close - 0.05,
    upper: close + 5,
    lower,
  });
}

function lowerOnlyWithRsi(
  hour: number,
  minute: number,
  close: number,
  rsi: number,
  upper: number,
): IndicatorSnapshot {
  const lower = close;
  return {
    ...makeSnapshot(hour, minute, {
      close,
      high: close + 0.1,
      low: close - 0.05,
      upper,
      lower,
    }),
    rsi,
  };
}

function upperOnlySnapshot(hour: number, minute: number, close = 100): IndicatorSnapshot {
  const upper = close;
  return makeSnapshot(hour, minute, {
    close,
    high: close + 0.05,
    low: close - 0.1,
    upper,
    lower: close - 5,
  });
}

function bothBandsSnapshot(hour: number, minute: number, close = 100): IndicatorSnapshot {
  return makeSnapshot(hour, minute, {
    close,
    high: close + 0.05,
    low: close - 0.05,
    upper: close,
    lower: close,
  });
}

function neutralSnapshot(hour: number, minute: number, close = 100): IndicatorSnapshot {
  return makeSnapshot(hour, minute, {
    close,
    high: close + 0.2,
    low: close - 0.2,
    upper: close + 5,
    lower: close - 5,
  });
}

describe("deepakDecision", () => {
  it("detects downward direction 1 from four BB-lower candles starting 09:15", () => {
    const snapshots = [
      lowerOnlySnapshot(9, 15),
      lowerOnlySnapshot(9, 30),
      lowerOnlySnapshot(9, 45),
      lowerOnlySnapshot(10, 0),
      neutralSnapshot(10, 15),
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);

    expect(result?.scenarioTrail.some((e) => e.scenarioKey === DEEPAK_SCENARIOS.DOWNWARD_1)).toBe(
      true,
    );
  });

  it("detects upward direction 1 from four BB-upper candles starting 09:15", () => {
    const snapshots = [
      upperOnlySnapshot(9, 15),
      upperOnlySnapshot(9, 30),
      upperOnlySnapshot(9, 45),
      upperOnlySnapshot(10, 0),
      neutralSnapshot(10, 15),
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);

    expect(result?.scenarioTrail.some((e) => e.scenarioKey === DEEPAK_SCENARIOS.UPWARD_1)).toBe(
      true,
    );
  });

  it("does not anchor downward-1 when 09:15 candle lacks BB lower", () => {
    const snapshots = [
      neutralSnapshot(9, 15),
      lowerOnlySnapshot(9, 30),
      lowerOnlySnapshot(9, 45),
      lowerOnlySnapshot(10, 0),
      lowerOnlySnapshot(10, 15),
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);

    expect(result?.scenarioTrail.some((e) => e.scenarioKey === DEEPAK_SCENARIOS.DOWNWARD_1)).toBe(
      false,
    );
  });

  it("emits SELL scenario 4 on continue downward direction 2", () => {
    const snapshots = [
      lowerOnlySnapshot(9, 15),
      lowerOnlySnapshot(9, 30),
      lowerOnlySnapshot(9, 45),
      lowerOnlySnapshot(10, 0),
      lowerOnlySnapshot(10, 15, 99),
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);
    const sell4 = result?.signals.find((s) => s.scenarioNumber === 4 && s.side === "SELL");

    expect(sell4?.scenarioKey).toBe(DEEPAK_SCENARIOS.CONTINUE_DOWN_2);
    expect(sell4?.price).toBe(candleMidPrice(snapshots[4]));
  });

  it("emits dual BUY signals on strong and continue-up-3 from switch-up path", () => {
    const snapshots = [
      lowerOnlySnapshot(9, 15),
      lowerOnlySnapshot(9, 30),
      lowerOnlySnapshot(9, 45),
      lowerOnlySnapshot(10, 0),
      bothBandsSnapshot(10, 15),
      upperOnlySnapshot(10, 30, 101),
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);
    const buySignals = result?.signals.filter((s) => s.side === "BUY") ?? [];

    expect(buySignals).toHaveLength(2);
    expect(buySignals.map((s) => s.scenarioNumber).sort()).toEqual([1, 2]);
    expect(buySignals[0].timeIst).toBe(buySignals[1].timeIst);
    expect(buySignals[0].price).toBe(buySignals[1].price);
  });

  it("emits SELL scenario 3 on continue downward direction 4", () => {
    const snapshots = [
      lowerOnlySnapshot(9, 15),
      lowerOnlySnapshot(9, 30),
      lowerOnlySnapshot(9, 45),
      lowerOnlySnapshot(10, 0),
      bothBandsSnapshot(10, 15),
      lowerOnlySnapshot(10, 30, 98),
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);
    const sell3 = result?.signals.find((s) => s.scenarioNumber === 3 && s.side === "SELL");

    expect(sell3?.scenarioKey).toBe(DEEPAK_SCENARIOS.CONTINUE_DOWN_4);
  });

  it("emits dual SELL signals on strong and continue-down-3 from switch-down path", () => {
    const snapshots = [
      upperOnlySnapshot(9, 15),
      upperOnlySnapshot(9, 30),
      upperOnlySnapshot(9, 45),
      upperOnlySnapshot(10, 0),
      bothBandsSnapshot(10, 15),
      lowerOnlySnapshot(10, 30, 99),
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);
    const sellSignals = result?.signals.filter((s) => s.side === "SELL") ?? [];

    expect(sellSignals).toHaveLength(2);
    expect(sellSignals.map((s) => s.scenarioNumber).sort()).toEqual([1, 2]);
  });

  it("emits BUY scenario 4 on continue upward direction 2", () => {
    const snapshots = [
      upperOnlySnapshot(9, 15),
      upperOnlySnapshot(9, 30),
      upperOnlySnapshot(9, 45),
      upperOnlySnapshot(10, 0),
      upperOnlySnapshot(10, 15, 102),
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);
    const buy4 = result?.signals.find((s) => s.scenarioNumber === 4 && s.side === "BUY");

    expect(buy4?.scenarioKey).toBe(DEEPAK_SCENARIOS.CONTINUE_UP_2);
  });

  it("emits BUY scenario 3 on continue upward direction 4", () => {
    const snapshots = [
      upperOnlySnapshot(9, 15),
      upperOnlySnapshot(9, 30),
      upperOnlySnapshot(9, 45),
      upperOnlySnapshot(10, 0),
      bothBandsSnapshot(10, 15),
      upperOnlySnapshot(10, 30, 103),
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);
    const buy3 = result?.signals.find((s) => s.scenarioNumber === 3 && s.side === "BUY");

    expect(buy3?.scenarioKey).toBe(DEEPAK_SCENARIOS.CONTINUE_UP_4);
  });

  it("simulates exit at candle mid price when 0.7 target is hit", () => {
    const entryClose = 100;
    const entry = upperOnlySnapshot(10, 30, entryClose);
    const entryMid = candleMidPrice(entry);

    const exitCandle = makeSnapshot(10, 45, {
      close: entryMid + 0.75,
      high: entryMid + 0.8,
      low: entryMid + 0.7,
      upper: entryMid + 5,
      lower: entryMid - 5,
    });

    const snapshots = [
      lowerOnlySnapshot(9, 15),
      lowerOnlySnapshot(9, 30),
      lowerOnlySnapshot(9, 45),
      lowerOnlySnapshot(10, 0),
      bothBandsSnapshot(10, 15),
      entry,
      exitCandle,
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);
    const buy1 = result?.signals.find((s) => s.scenarioNumber === 1 && s.side === "BUY");

    expect(buy1?.exit?.targetHit).toBe(true);
    expect(buy1?.exit?.price).toBe(candleMidPrice(exitCandle));
    expect(buy1?.exit?.profit).toBeCloseTo(candleMidPrice(exitCandle) - entryMid, 5);
    expect(buy1?.exit?.profit).toBeGreaterThanOrEqual(buy1!.profitTarget - 1e-9);
  });

  it("does not exit when wick touches target but mid has not reached it", () => {
    const entryClose = 100;
    const entry = upperOnlySnapshot(10, 30, entryClose);
    const entryMid = candleMidPrice(entry);

    const exitCandle = makeSnapshot(10, 45, {
      close: entryMid + 0.2,
      high: entryMid + 0.9,
      low: entryMid - 0.5,
      upper: entryMid + 5,
      lower: entryMid - 5,
    });

    const snapshots = [
      lowerOnlySnapshot(9, 15),
      lowerOnlySnapshot(9, 30),
      lowerOnlySnapshot(9, 45),
      lowerOnlySnapshot(10, 0),
      bothBandsSnapshot(10, 15),
      entry,
      exitCandle,
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);
    const buy1 = result?.signals.find((s) => s.scenarioNumber === 1 && s.side === "BUY");

    expect(exitCandle.high).toBeGreaterThanOrEqual(entryMid + 0.7);
    expect(candleMidPrice(exitCandle)).toBeLessThan(entryMid + 0.7);
    expect(buy1?.exit).toBeNull();
  });

  it("uses adaptive profit target from average prior daily ranges", () => {
    const wideRange = 12;
    const entryClose = 99;

    function wideLowerSnapshot(
      date: string,
      hour: number,
      minute: number,
      close = entryClose,
    ) {
      return {
        timestamp: istTimestampForDate(date, hour, minute),
        open: close - 0.05,
        high: close + wideRange / 2,
        low: close - 0.05,
        close,
        bollinger: { upper: close + 20, middle: close, lower: close },
        rsi: 50,
        macd: { macdLine: 0.1, signalLine: 0.05, histogram: 0.05 },
      } satisfies IndicatorSnapshot;
    }

    const priorSnapshots = Array.from({ length: 20 }, (_, index) => {
      const date = offsetDate(DATE, index - 20);
      return [
        wideLowerSnapshot(date, 9, 15),
        wideLowerSnapshot(date, 10, 0),
        wideLowerSnapshot(date, 11, 0),
      ];
    }).flat();

    const snapshots = [
      ...priorSnapshots,
      wideLowerSnapshot(DATE, 9, 15),
      wideLowerSnapshot(DATE, 9, 30),
      wideLowerSnapshot(DATE, 9, 45),
      wideLowerSnapshot(DATE, 10, 0),
      wideLowerSnapshot(DATE, 10, 15),
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);
    const sell4 = result?.signals.find((s) => s.scenarioNumber === 4 && s.side === "SELL");

    expect(sell4?.profitTarget).toBeGreaterThan(0.7);
    expect(sell4?.profitTarget).toBeCloseTo(6.05, 2);
  });

  it("suppresses legacy SELL when morning BUY qualifies on the same day", () => {
    const snapshots = [
      makeSnapshot(9, 15, {
        open: 1319,
        close: 1320,
        high: 1323.8,
        low: 1312.6,
        upper: 1343.47,
        middle: 1335,
        lower: 1322.03,
        rsi: 32,
      }),
      makeSnapshot(9, 30, {
        open: 1322,
        close: 1321,
        high: 1326.6,
        low: 1320.9,
        upper: 1342.84,
        middle: 1334,
        lower: 1320.89,
        rsi: 34,
      }),
      makeSnapshot(9, 45, {
        open: 1322.5,
        close: 1321.8,
        high: 1323.8,
        low: 1321.8,
        upper: 1342.19,
        middle: 1333,
        lower: 1319.86,
        rsi: 36,
      }),
      makeSnapshot(10, 0, {
        open: 1320,
        close: 1322,
        high: 1323.8,
        low: 1320.1,
        upper: 1341.55,
        middle: 1332,
        lower: 1319.11,
        rsi: 40,
      }),
      makeSnapshot(10, 15, {
        open: 1322,
        close: 1324,
        high: 1325.2,
        low: 1322,
        upper: 1340.95,
        middle: 1331,
        lower: 1318.63,
        rsi: 45,
      }),
      makeSnapshot(10, 30, {
        open: 1335,
        close: 1345,
        high: 1348,
        low: 1334,
        upper: 1355,
        middle: 1340,
        lower: 1325,
        rsi: 52,
      }),
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);

    expect(
      result?.signals.some((signal) => signal.scenarioKey === DEEPAK_SCENARIOS.CONTINUE_DOWN_2),
    ).toBe(false);
    expect(
      result?.signals.some((signal) => signal.scenarioKey === DEEPAK_SCENARIOS.MORNING_BUY),
    ).toBe(true);
    expect(result?.reasons.some((reason) => reason.includes("legacy SELL suppressed"))).toBe(true);
  });

  it("suppresses legacy BUY when morning SELL qualifies on the same day", () => {
    const snapshots = [
      makeSnapshot(9, 15, {
        open: 1338,
        close: 1340,
        high: 1344,
        low: 1335.9,
        upper: 1340.44,
        middle: 1333.63,
        lower: 1331.1,
        rsi: 60,
      }),
      makeSnapshot(9, 30, {
        open: 1339,
        close: 1341,
        high: 1342.5,
        low: 1335.1,
        upper: 1341.4,
        middle: 1333.5,
        lower: 1330.67,
        rsi: 62,
      }),
      makeSnapshot(9, 45, {
        open: 1341.5,
        close: 1339.5,
        high: 1342.3,
        low: 1338.6,
        upper: 1341.59,
        middle: 1333.4,
        lower: 1330.65,
        rsi: 59,
      }),
      makeSnapshot(10, 0, {
        open: 1339,
        close: 1341.5,
        high: 1342.9,
        low: 1338.5,
        upper: 1342.17,
        middle: 1333.3,
        lower: 1330.36,
        rsi: 68,
      }),
      makeSnapshot(10, 15, {
        open: 1341,
        close: 1338.5,
        high: 1343,
        low: 1337.6,
        upper: 1342.14,
        middle: 1333.2,
        lower: 1330.37,
        rsi: 59,
      }),
      makeSnapshot(10, 30, {
        open: 1335,
        close: 1330,
        high: 1336,
        low: 1329,
        upper: 1342,
        middle: 1333,
        lower: 1330,
        rsi: 58,
      }),
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);

    expect(
      result?.signals.some((signal) => signal.scenarioKey === DEEPAK_SCENARIOS.CONTINUE_UP_2),
    ).toBe(false);
    expect(
      result?.signals.some((signal) => signal.scenarioKey === DEEPAK_SCENARIOS.MORNING_SELL),
    ).toBe(true);
    expect(result?.reasons.some((reason) => reason.includes("legacy BUY suppressed"))).toBe(true);
  });

  it("never reports negative profit when targetHit is true", () => {
    const entryClose = 100;
    const entry = upperOnlySnapshot(10, 30, entryClose);
    const entryMid = candleMidPrice(entry);

    const exitCandle = makeSnapshot(10, 45, {
      close: entryMid + 0.75,
      high: entryMid + 0.8,
      low: entryMid + 0.7,
      upper: entryMid + 5,
      lower: entryMid - 5,
    });

    const snapshots = [
      lowerOnlySnapshot(9, 15),
      lowerOnlySnapshot(9, 30),
      lowerOnlySnapshot(9, 45),
      lowerOnlySnapshot(10, 0),
      bothBandsSnapshot(10, 15),
      entry,
      exitCandle,
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);

    for (const signal of result?.signals ?? []) {
      if (signal.exit?.targetHit) {
        expect(signal.exit.profit).toBeGreaterThanOrEqual(signal.profitTarget - 1e-9);
        expect(signal.exit.profit).toBeGreaterThan(0);
      }
    }
  });
});
