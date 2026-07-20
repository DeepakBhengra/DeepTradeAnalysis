import { describe, expect, it } from "vitest";
import {
  collectPriorTradingDayRanges,
  computeDailyRange,
  computeProfitTarget,
} from "../../src/rules/deepakTarget.js";
import type { IndicatorSnapshot } from "../../src/types.js";

const ENTRY_DATE = "2026-06-09";

function istTimestamp(date: string, hour: number, minute: number): Date {
  return new Date(
    `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`,
  );
}

function makeSnapshot(
  date: string,
  hour: number,
  minute: number,
  high: number,
  low: number,
  close = (high + low) / 2,
): IndicatorSnapshot {
  return {
    timestamp: istTimestamp(date, hour, minute),
    open: close,
    high,
    low,
    close,
    bollinger: { upper: close + 5, middle: close, lower: close - 5 },
    rsi: 50,
    macd: { macdLine: 0.1, signalLine: 0.05, histogram: 0.05 },
  };
}

function makeDaySnapshots(
  date: string,
  dailyRange: number,
  close = 100,
): IndicatorSnapshot[] {
  const half = dailyRange / 2;
  return [
    makeSnapshot(date, 9, 15, close + half, close - half * 0.5, close),
    makeSnapshot(date, 10, 0, close + half * 0.8, close - half, close),
    makeSnapshot(date, 11, 0, close + half, close - half * 0.9, close),
  ];
}

function offsetDate(date: string, dayOffset: number): string {
  const parsed = new Date(`${date}T00:00:00+05:30`);
  parsed.setDate(parsed.getDate() + dayOffset);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

describe("computeDailyRange", () => {
  it("returns max high minus min low across all candles on a date", () => {
    const snapshots = [
      makeSnapshot("2026-06-08", 9, 15, 102, 99),
      makeSnapshot("2026-06-08", 10, 0, 105, 98),
      makeSnapshot("2026-06-08", 11, 0, 104, 97),
    ];

    expect(computeDailyRange(snapshots, "2026-06-08")).toBe(8);
  });
});

describe("collectPriorTradingDayRanges", () => {
  it("collects ranges from the last N trading days before entry date", () => {
    const snapshots = [
      ...makeDaySnapshots("2026-06-07", 4),
      ...makeDaySnapshots("2026-06-08", 6),
      ...makeDaySnapshots(ENTRY_DATE, 2),
    ];

    expect(collectPriorTradingDayRanges(snapshots, ENTRY_DATE, 2)).toEqual([4, 6]);
  });
});

describe("computeProfitTarget", () => {
  it("averages daily ranges from the last 20 prior trading days", () => {
    const priorSnapshots = Array.from({ length: 20 }, (_, index) => {
      const date = offsetDate(ENTRY_DATE, index - 20);
      const dailyRange = index === 0 ? 2 : 4;
      return makeDaySnapshots(date, dailyRange);
    }).flat();

    const entry = makeSnapshot(ENTRY_DATE, 10, 30, 101, 99);
    const snapshots = [...priorSnapshots, entry];

    // 19 days at 4 + 1 day at 2 = 78 / 20 = 3.9
    expect(computeProfitTarget(entry, snapshots)).toBe(3.9);
  });

  it("does not cap the target at a maximum", () => {
    const priorSnapshots = Array.from({ length: 20 }, (_, index) => {
      const date = offsetDate(ENTRY_DATE, index - 20);
      const dailyRange = index === 19 ? 40 : 2;
      return makeDaySnapshots(date, dailyRange);
    }).flat();

    const entry = makeSnapshot(ENTRY_DATE, 10, 30, 101, 99);
    const snapshots = [...priorSnapshots, entry];

    // (19 * 2 + 40) / 20 = 3.9
    expect(computeProfitTarget(entry, snapshots)).toBe(3.9);
  });

  it("does not apply a minimum floor when daily ranges are narrow", () => {
    const priorSnapshots = Array.from({ length: 20 }, (_, index) => {
      const date = offsetDate(ENTRY_DATE, index - 20);
      return makeDaySnapshots(date, 0.2);
    }).flat();

    const entry = makeSnapshot(ENTRY_DATE, 10, 30, 100.1, 99.9);
    const snapshots = [...priorSnapshots, entry];

    expect(computeProfitTarget(entry, snapshots)).toBeCloseTo(0.2, 5);
  });

  it("falls back to fixed profitTarget when no prior history exists", () => {
    const entry = makeSnapshot(ENTRY_DATE, 9, 15, 100.1, 99.9);

    expect(computeProfitTarget(entry, [entry])).toBe(0.7);
  });

  it("falls back to fixed profitTarget when fewer than 20 prior trading days exist", () => {
    const priorSnapshots = Array.from({ length: 10 }, (_, index) => {
      const date = offsetDate(ENTRY_DATE, index - 10);
      return makeDaySnapshots(date, 4);
    }).flat();

    const entry = makeSnapshot(ENTRY_DATE, 10, 30, 101, 99);
    const snapshots = [...priorSnapshots, entry];

    expect(computeProfitTarget(entry, snapshots)).toBe(0.7);
  });
});
