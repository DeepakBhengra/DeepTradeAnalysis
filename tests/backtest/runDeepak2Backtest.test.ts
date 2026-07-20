import { describe, expect, it } from "vitest";
import {
  collectTradingDates,
  runDeepak2Backtest,
} from "../../src/backtest/runDeepakBacktest.js";
import { DEEPAK2_SCENARIOS, DEEPAK2_VARIANT } from "../../src/rules/deepakDecision.js";
import type { IndicatorSnapshot } from "../../src/types.js";

const DATE_A = "2026-06-09";
const DATE_B = "2026-06-10";

function istTimestamp(date: string, hour: number, minute: number): Date {
  return new Date(
    `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`,
  );
}

function lowerOnlySnapshot(
  date: string,
  hour: number,
  minute: number,
  close = 100,
): IndicatorSnapshot {
  const lower = close;
  return {
    timestamp: istTimestamp(date, hour, minute),
    open: close - 0.05,
    high: close + 0.1,
    low: close - 0.05,
    close,
    bollinger: { upper: close + 5, middle: close, lower },
    rsi: 50,
    macd: { macdLine: 0.1, signalLine: 0.05, histogram: 0.05 },
  };
}

function buildContinueDown2Day(date: string): IndicatorSnapshot[] {
  return [
    lowerOnlySnapshot(date, 10, 15),
    lowerOnlySnapshot(date, 10, 30),
    lowerOnlySnapshot(date, 10, 45),
    lowerOnlySnapshot(date, 11, 0),
    lowerOnlySnapshot(date, 11, 15, 99),
  ];
}

describe("runDeepak2Backtest", () => {
  it("collects trading dates from 10:15 session window", () => {
    const snapshots = [
      ...buildContinueDown2Day(DATE_A),
      ...buildContinueDown2Day(DATE_B),
    ];

    expect(collectTradingDates(snapshots, DEEPAK2_VARIANT)).toEqual([DATE_A, DATE_B]);
  });

  it("aggregates signals with deepak-2 scenario keys", () => {
    const snapshots = [
      ...buildContinueDown2Day(DATE_A),
      ...buildContinueDown2Day(DATE_B),
    ];

    const result = runDeepak2Backtest(snapshots, DATE_A, DATE_B);

    expect(result.summary.totalSignals).toBe(2);
    expect(result.trades[0].scenarioKey).toBe(DEEPAK2_SCENARIOS.CONTINUE_DOWN_2);
    expect(result.trades[0].entryTimeIst).toBe("11:15");
  });
});
