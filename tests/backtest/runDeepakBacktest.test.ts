import { describe, expect, it } from "vitest";
import {
  collectTradingDates,
  runDeepakBacktest,
} from "../../src/backtest/runDeepakBacktest.js";
import { DEEPAK_SCENARIOS } from "../../src/rules/deepakDecision.js";
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
    lowerOnlySnapshot(date, 9, 15),
    lowerOnlySnapshot(date, 9, 30),
    lowerOnlySnapshot(date, 9, 45),
    lowerOnlySnapshot(date, 10, 0),
    lowerOnlySnapshot(date, 10, 15, 99),
  ];
}

describe("runDeepakBacktest", () => {
  it("collects unique sorted session trading dates", () => {
    const snapshots = [
      ...buildContinueDown2Day(DATE_A),
      ...buildContinueDown2Day(DATE_B),
    ];

    expect(collectTradingDates(snapshots)).toEqual([DATE_A, DATE_B]);
  });

  it("filters trading days to the requested date range", () => {
    const snapshots = [
      ...buildContinueDown2Day(DATE_A),
      ...buildContinueDown2Day(DATE_B),
    ];

    const result = runDeepakBacktest(snapshots, DATE_B, DATE_B);

    expect(result.summary.tradingDaysScanned).toBe(1);
    expect(result.summary.dateRange).toEqual({ from: DATE_B, to: DATE_B });
    expect(result.trades.every((trade) => trade.date === DATE_B)).toBe(true);
  });

  it("aggregates BUY/SELL signals and summary counts across days", () => {
    const snapshots = [
      ...buildContinueDown2Day(DATE_A),
      ...buildContinueDown2Day(DATE_B),
    ];

    const result = runDeepakBacktest(snapshots, DATE_A, DATE_B);

    expect(result.summary.tradingDaysScanned).toBe(2);
    expect(result.summary.totalSignals).toBe(2);
    expect(result.summary.buyCount).toBe(0);
    expect(result.summary.sellCount).toBe(2);
    expect(result.trades[0].scenarioKey).toBe(DEEPAK_SCENARIOS.CONTINUE_DOWN_2);
    expect(result.trades[1].scenarioKey).toBe(DEEPAK_SCENARIOS.CONTINUE_DOWN_2);
  });

  it("returns empty trades when no signals fire in range", () => {
    const snapshots = [
      {
        timestamp: istTimestamp(DATE_A, 9, 15),
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        bollinger: { upper: 105, middle: 100, lower: 95 },
        rsi: 50,
        macd: { macdLine: 0, signalLine: 0, histogram: 0 },
      },
    ];

    const result = runDeepakBacktest(snapshots, DATE_A, DATE_A);

    expect(result.trades).toHaveLength(0);
    expect(result.summary.totalSignals).toBe(0);
    expect(result.summary.avgProfit).toBeNull();
  });

  it("maps profitTarget onto backtest trades", () => {
    const snapshots = buildContinueDown2Day(DATE_A);
    const result = runDeepakBacktest(snapshots, DATE_A, DATE_A);

    expect(result.trades[0].profitTarget).toBe(0.7);
  });
});
