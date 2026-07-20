import { describe, expect, it } from "vitest";
import { runDeepakWatchPartyBacktest } from "../../src/backtest/runDeepakWatchPartyBacktest.js";
import {
  candleMidPrice,
  DEEPAK2_SCENARIOS,
  DEEPAK_SCENARIOS,
} from "../../src/rules/deepakDecision.js";
import {
  evaluateDeepakWatchPartyDecision,
  mergeWatchPartyExits,
} from "../../src/rules/deepakWatchParty.js";
import type { DeepakExitSignal, DeepakTradeSignal, IndicatorSnapshot } from "../../src/types.js";

const DATE = "2026-06-09";
const DATE2 = "2026-06-10";

function istTimestamp(date: string, hour: number, minute: number): Date {
  return new Date(
    `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`,
  );
}

function makeSnapshot(
  date: string,
  hour: number,
  minute: number,
  opts: {
    close?: number;
    high?: number;
    low?: number;
    upper?: number;
    lower?: number;
  } = {},
): IndicatorSnapshot {
  const close = opts.close ?? 100;
  const upper = opts.upper ?? close + 1;
  const lower = opts.lower ?? close - 1;
  const high = opts.high ?? close + 0.2;
  const low = opts.low ?? close - 0.2;

  return {
    timestamp: istTimestamp(date, hour, minute),
    open: close - 0.05,
    high,
    low,
    close,
    bollinger: { upper, middle: close, lower },
    rsi: 50,
    macd: { macdLine: 0.1, signalLine: 0.05, histogram: 0.05 },
  };
}

function lowerOnlySnapshot(date: string, hour: number, minute: number, close = 100) {
  const lower = close;
  return makeSnapshot(date, hour, minute, {
    close,
    high: close + 0.1,
    low: close - 0.05,
    upper: close + 5,
    lower,
  });
}

function upperOnlySnapshot(date: string, hour: number, minute: number, close = 100) {
  const upper = close;
  return makeSnapshot(date, hour, minute, {
    close,
    high: close + 0.05,
    low: close - 0.1,
    upper,
    lower: close - 5,
  });
}

function bothBandsSnapshot(date: string, hour: number, minute: number, close = 100) {
  return makeSnapshot(date, hour, minute, {
    close,
    high: close + 0.05,
    low: close - 0.05,
    upper: close,
    lower: close,
  });
}

function neutralSnapshot(date: string, hour: number, minute: number, close = 100) {
  return makeSnapshot(date, hour, minute, {
    close,
    high: close + 0.2,
    low: close - 0.2,
    upper: close + 5,
    lower: close - 5,
  });
}

function deepakBuyAt1015BaseSnapshots(date = DATE): IndicatorSnapshot[] {
  return [
    upperOnlySnapshot(date, 9, 15),
    upperOnlySnapshot(date, 9, 30),
    upperOnlySnapshot(date, 9, 45),
    upperOnlySnapshot(date, 10, 0),
    upperOnlySnapshot(date, 10, 15, 102),
  ];
}

function deepakSellAt1015BaseSnapshots(date = DATE): IndicatorSnapshot[] {
  return [
    lowerOnlySnapshot(date, 9, 15),
    lowerOnlySnapshot(date, 9, 30),
    lowerOnlySnapshot(date, 9, 45),
    lowerOnlySnapshot(date, 10, 0),
    lowerOnlySnapshot(date, 10, 15, 99),
  ];
}

describe("deepakWatchParty", () => {
  it("stops out Deepak BUY at 10:15 when Deepak-2 signals SELL first", () => {
    const snapshots = [
      ...deepakBuyAt1015BaseSnapshots(),
      upperOnlySnapshot(DATE, 10, 30),
      upperOnlySnapshot(DATE, 10, 45),
      upperOnlySnapshot(DATE, 11, 0),
      bothBandsSnapshot(DATE, 11, 15),
      lowerOnlySnapshot(DATE, 11, 30, 98),
    ];

    const result = evaluateDeepakWatchPartyDecision(snapshots, DATE);
    const buy = result?.signals.find((signal) => signal.side === "BUY");

    expect(buy?.timeIst).toBe("10:15");
    expect(buy?.scenarioKey).toBe(DEEPAK_SCENARIOS.CONTINUE_UP_2);
    expect(buy?.exit?.exitReason).toBe("deepak2_stop");
    expect(buy?.exit?.stopLossHit).toBe(true);
    expect(buy?.exit?.timeIst).toBe("11:30");
    expect(buy?.exit?.price).toBe(candleMidPrice(snapshots[9]));
    expect([
      DEEPAK2_SCENARIOS.STRONG_SWITCH_DOWN,
      DEEPAK2_SCENARIOS.CONTINUE_DOWN_3,
    ]).toContain(buy?.exit?.deepak2StopScenarioKey);
    expect(buy?.exit?.profit).toBeLessThan(0);
  });

  it("keeps Deepak BUY on course when Deepak-2 confirms BUY and target is hit", () => {
    const entry = upperOnlySnapshot(DATE, 10, 15, 102);
    const entryMid = candleMidPrice(entry);
    const exitCandle = makeSnapshot(DATE, 12, 0, {
      close: entryMid + 0.75,
      high: entryMid + 0.8,
      low: entryMid + 0.7,
      upper: entryMid + 5,
      lower: entryMid - 5,
    });

    const snapshots = [
      upperOnlySnapshot(DATE, 9, 15),
      upperOnlySnapshot(DATE, 9, 30),
      upperOnlySnapshot(DATE, 9, 45),
      upperOnlySnapshot(DATE, 10, 0),
      entry,
      upperOnlySnapshot(DATE, 10, 30),
      upperOnlySnapshot(DATE, 10, 45),
      upperOnlySnapshot(DATE, 11, 0),
      neutralSnapshot(DATE, 11, 15, 102.2),
      exitCandle,
    ];

    const result = evaluateDeepakWatchPartyDecision(snapshots, DATE);
    const buy = result?.signals.find((signal) => signal.side === "BUY");

    expect(buy?.exit?.exitReason).toBe("target");
    expect(buy?.exit?.targetHit).toBe(true);
    expect(buy?.exit?.timeIst).toBe("12:00");
    expect(buy?.exit?.profit).toBeGreaterThanOrEqual(buy!.profitTarget - 1e-9);
  });

  it("stops out Deepak SELL at 10:15 when Deepak-2 signals BUY", () => {
    const snapshots = [
      ...deepakSellAt1015BaseSnapshots(),
      lowerOnlySnapshot(DATE, 10, 30),
      lowerOnlySnapshot(DATE, 10, 45),
      lowerOnlySnapshot(DATE, 11, 0),
      bothBandsSnapshot(DATE, 11, 15),
      upperOnlySnapshot(DATE, 11, 30, 101),
    ];

    const result = evaluateDeepakWatchPartyDecision(snapshots, DATE);
    const sell = result?.signals.find((signal) => signal.side === "SELL");

    expect(sell?.timeIst).toBe("10:15");
    expect(sell?.exit?.exitReason).toBe("deepak2_stop");
    expect(sell?.exit?.timeIst).toBe("11:30");
    expect([
      DEEPAK2_SCENARIOS.STRONG_SWITCH_UP,
      DEEPAK2_SCENARIOS.CONTINUE_UP_3,
    ]).toContain(sell?.exit?.deepak2StopScenarioKey);
  });

  it("excludes Deepak entries that are not at 10:15", () => {
    const snapshots = [
      lowerOnlySnapshot(DATE, 9, 15),
      lowerOnlySnapshot(DATE, 9, 30),
      lowerOnlySnapshot(DATE, 9, 45),
      lowerOnlySnapshot(DATE, 10, 0),
      bothBandsSnapshot(DATE, 10, 15),
      upperOnlySnapshot(DATE, 10, 30, 101),
    ];

    const result = evaluateDeepakWatchPartyDecision(snapshots, DATE);

    expect(result).toBeNull();
  });

  it("prefers target exit when it occurs before the opposite Deepak-2 signal", () => {
    const entry = upperOnlySnapshot(DATE, 10, 15, 102);
    const entryMid = candleMidPrice(entry);
    const targetCandle = makeSnapshot(DATE, 10, 45, {
      close: entryMid + 0.75,
      high: entryMid + 0.8,
      low: entryMid + 0.7,
      upper: entryMid + 5,
      lower: entryMid - 5,
    });

    const snapshots = [
      upperOnlySnapshot(DATE, 9, 15),
      upperOnlySnapshot(DATE, 9, 30),
      upperOnlySnapshot(DATE, 9, 45),
      upperOnlySnapshot(DATE, 10, 0),
      entry,
      upperOnlySnapshot(DATE, 10, 30),
      targetCandle,
      upperOnlySnapshot(DATE, 11, 0),
      bothBandsSnapshot(DATE, 11, 15),
      lowerOnlySnapshot(DATE, 11, 30, 98),
    ];

    const result = evaluateDeepakWatchPartyDecision(snapshots, DATE);
    const buy = result?.signals.find((signal) => signal.side === "BUY");

    expect(buy?.exit?.exitReason).toBe("target");
    expect(buy?.exit?.timeIst).toBe("10:45");
  });

  it("prefers Deepak-2 stop on the same candle as target hit", () => {
    const entry = upperOnlySnapshot(DATE, 10, 15, 102);
    const entryMid = candleMidPrice(entry);
    const sharedCandle = lowerOnlySnapshot(DATE, 11, 30, 102.7);

    const snapshots = [
      upperOnlySnapshot(DATE, 9, 15),
      upperOnlySnapshot(DATE, 9, 30),
      upperOnlySnapshot(DATE, 9, 45),
      upperOnlySnapshot(DATE, 10, 0),
      entry,
      upperOnlySnapshot(DATE, 10, 30),
      upperOnlySnapshot(DATE, 10, 45),
      upperOnlySnapshot(DATE, 11, 0),
      bothBandsSnapshot(DATE, 11, 15),
      sharedCandle,
    ];

    const result = evaluateDeepakWatchPartyDecision(snapshots, DATE);
    const buy = result?.signals.find((signal) => signal.side === "BUY");

    expect(candleMidPrice(sharedCandle)).toBeGreaterThanOrEqual(entryMid + 0.7);
    expect(buy?.exit?.exitReason).toBe("deepak2_stop");
    expect(buy?.exit?.timeIst).toBe("11:30");
  });

  it("leaves exit null when neither target nor opposite Deepak-2 signal occurs", () => {
    const snapshots = [
      ...deepakBuyAt1015BaseSnapshots(),
      upperOnlySnapshot(DATE, 10, 30),
      upperOnlySnapshot(DATE, 10, 45),
      upperOnlySnapshot(DATE, 11, 0),
      bothBandsSnapshot(DATE, 11, 15),
      upperOnlySnapshot(DATE, 11, 30, 102.1),
      neutralSnapshot(DATE, 11, 45),
      neutralSnapshot(DATE, 12, 0),
    ];

    const result = evaluateDeepakWatchPartyDecision(snapshots, DATE);
    const buy = result?.signals.find((signal) => signal.side === "BUY");

    expect(buy?.exit).toBeNull();
  });

  it("mergeWatchPartyExits gives stop precedence on equal timestamps", () => {
    const targetExit: DeepakExitSignal = {
      timeIst: "11:30",
      price: 103,
      targetHit: true,
      profit: 1,
      profitTarget: 0.7,
    };
    const stopSignal: DeepakTradeSignal = {
      side: "SELL",
      scenarioKey: DEEPAK2_SCENARIOS.CONTINUE_DOWN_4,
      scenarioNumber: 3,
      timeIst: "11:30",
      price: 98,
      bbMatchType: "close",
      profitTarget: 0.7,
      exit: null,
    };

    const merged = mergeWatchPartyExits("BUY", 100, 0.7, targetExit, stopSignal);

    expect(merged?.exitReason).toBe("deepak2_stop");
    expect(merged?.timeIst).toBe("11:30");
  });
});

describe("runDeepakWatchPartyBacktest", () => {
  it("aggregates watch-party trades across multiple days", () => {
    const dayOne = [
      ...deepakSellAt1015BaseSnapshots(),
      lowerOnlySnapshot(DATE, 10, 30),
      lowerOnlySnapshot(DATE, 10, 45),
      lowerOnlySnapshot(DATE, 11, 0),
      bothBandsSnapshot(DATE, 11, 15),
      upperOnlySnapshot(DATE, 11, 30, 101),
    ];
    const dayTwo = [
      ...deepakBuyAt1015BaseSnapshots(DATE2),
      upperOnlySnapshot(DATE2, 10, 30),
      upperOnlySnapshot(DATE2, 10, 45),
      upperOnlySnapshot(DATE2, 11, 0),
      bothBandsSnapshot(DATE2, 11, 15),
      lowerOnlySnapshot(DATE2, 11, 30, 98),
    ];

    const snapshots = [...dayOne, ...dayTwo];
    const { trades, summary } = runDeepakWatchPartyBacktest(snapshots, DATE, DATE2);

    expect(trades).toHaveLength(2);
    expect(summary.totalSignals).toBe(2);
    expect(summary.stopsHit).toBe(2);
    expect(summary.targetsHit).toBe(0);
    expect(trades.every((trade) => trade.entryTimeIst === "10:15")).toBe(true);
  });
});
