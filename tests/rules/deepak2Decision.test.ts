import { describe, expect, it } from "vitest";
import {
  candleMidPrice,
  DEEPAK2_SCENARIOS,
  evaluateDeepak2Decision,
} from "../../src/rules/deepakDecision.js";
import type { IndicatorSnapshot } from "../../src/types.js";

const DATE = "2026-06-09";

function istTimestamp(hour: number, minute: number): Date {
  return new Date(
    `${DATE}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`,
  );
}

function makeSnapshot(
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
    timestamp: istTimestamp(hour, minute),
    open: close - 0.05,
    high,
    low,
    close,
    bollinger: { upper, middle: close, lower },
    rsi: 50,
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

describe("deepak2Decision", () => {
  it("detects downward direction 1 from four BB-lower candles starting 10:15", () => {
    const snapshots = [
      lowerOnlySnapshot(10, 15),
      lowerOnlySnapshot(10, 30),
      lowerOnlySnapshot(10, 45),
      lowerOnlySnapshot(11, 0),
      neutralSnapshot(11, 15),
    ];

    const result = evaluateDeepak2Decision(snapshots, DATE);

    expect(
      result?.scenarioTrail.some((e) => e.scenarioKey === DEEPAK2_SCENARIOS.DOWNWARD_1),
    ).toBe(true);
  });

  it("does not anchor when 10:15 candle lacks BB lower", () => {
    const snapshots = [
      neutralSnapshot(10, 15),
      lowerOnlySnapshot(10, 30),
      lowerOnlySnapshot(10, 45),
      lowerOnlySnapshot(11, 0),
      lowerOnlySnapshot(11, 15),
    ];

    const result = evaluateDeepak2Decision(snapshots, DATE);

    expect(
      result?.scenarioTrail.some((e) => e.scenarioKey === DEEPAK2_SCENARIOS.DOWNWARD_1),
    ).toBe(false);
  });

  it("ignores pre-10:15 candles for session filtering", () => {
    const snapshots = [
      lowerOnlySnapshot(9, 15),
      lowerOnlySnapshot(9, 30),
      lowerOnlySnapshot(9, 45),
      lowerOnlySnapshot(10, 0),
      lowerOnlySnapshot(10, 15),
      lowerOnlySnapshot(10, 30),
      lowerOnlySnapshot(10, 45),
      lowerOnlySnapshot(11, 0),
      lowerOnlySnapshot(11, 15, 99),
    ];

    const result = evaluateDeepak2Decision(snapshots, DATE);
    const sell4 = result?.signals.find((s) => s.scenarioNumber === 4 && s.side === "SELL");

    expect(sell4?.scenarioKey).toBe(DEEPAK2_SCENARIOS.CONTINUE_DOWN_2);
    expect(sell4?.timeIst).toBe("11:15");
    expect(sell4?.price).toBe(candleMidPrice(snapshots[8]));
  });

  it("uses deepak-2 scenario key prefix", () => {
    const snapshots = [
      lowerOnlySnapshot(10, 15),
      lowerOnlySnapshot(10, 30),
      lowerOnlySnapshot(10, 45),
      lowerOnlySnapshot(11, 0),
      lowerOnlySnapshot(11, 15, 99),
    ];

    const result = evaluateDeepak2Decision(snapshots, DATE);
    const sell4 = result?.signals.find((s) => s.scenarioNumber === 4 && s.side === "SELL");

    expect(sell4?.scenarioKey).toBe("deepak-2 continue downward direction - 2");
  });

  it("emits dual BUY signals on strong and continue-up-3 from switch-up path", () => {
    const snapshots = [
      lowerOnlySnapshot(10, 15),
      lowerOnlySnapshot(10, 30),
      lowerOnlySnapshot(10, 45),
      lowerOnlySnapshot(11, 0),
      bothBandsSnapshot(11, 15),
      upperOnlySnapshot(11, 30, 101),
    ];

    const result = evaluateDeepak2Decision(snapshots, DATE);
    const buySignals = result?.signals.filter((s) => s.side === "BUY") ?? [];

    expect(buySignals).toHaveLength(2);
    expect(buySignals.map((s) => s.scenarioNumber).sort()).toEqual([1, 2]);
    expect(buySignals[0].timeIst).toBe("11:30");
  });
});
