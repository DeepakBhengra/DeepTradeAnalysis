import { describe, expect, it } from "vitest";
import { evaluateDeepakDecision } from "../../src/rules/deepakDecision.js";
import {
  DEEPAK3_SCENARIOS,
  DEEPAK3_VARIANT,
  evaluateDeepak3Decision,
  scanDeepak3Decisions,
} from "../../src/rules/deepak3Decision.js";
import { candleMidPrice } from "../../src/rules/deepakCore.js";
import type { IndicatorSnapshot } from "../../src/types.js";

const DATE = "2026-03-12";

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

function crossedLowerSnapshot(
  date: string,
  hour: number,
  minute: number,
  close = 100,
): IndicatorSnapshot {
  const lower = close;
  return makeSnapshot(date, hour, minute, {
    close,
    high: close + 0.1,
    low: close - 0.05,
    upper: close + 5,
    lower,
  });
}

function closeToLowerSnapshot(
  date: string,
  hour: number,
  minute: number,
  close = 100,
): IndicatorSnapshot {
  const lower = close - 0.5;
  return makeSnapshot(date, hour, minute, {
    close,
    high: close + 0.2,
    low: close - 0.29,
    upper: close + 5,
    lower,
  });
}

function crossedUpperSnapshot(
  date: string,
  hour: number,
  minute: number,
  close = 100,
): IndicatorSnapshot {
  const upper = close;
  return makeSnapshot(date, hour, minute, {
    close,
    high: close + 0.05,
    low: close - 0.1,
    upper,
    lower: close - 5,
  });
}

function bothBandsSnapshot(
  date: string,
  hour: number,
  minute: number,
  close = 100,
): IndicatorSnapshot {
  return makeSnapshot(date, hour, minute, {
    close,
    high: close + 0.05,
    low: close - 0.05,
    upper: close,
    lower: close,
  });
}

function wideCrossedLowerEntry(
  date: string,
  hour: number,
  minute: number,
  close = 99,
): IndicatorSnapshot {
  const lower = close;
  return makeSnapshot(date, hour, minute, {
    close,
    high: close + 1.0,
    low: close - 0.05,
    upper: close + 5,
    lower,
  });
}

function narrowCrossedLowerEntry(
  date: string,
  hour: number,
  minute: number,
  close = 99,
): IndicatorSnapshot {
  const lower = close;
  return makeSnapshot(date, hour, minute, {
    close,
    high: close + 0.05,
    low: close - 0.05,
    upper: close + 5,
    lower,
  });
}

function buildBearishContinueDown2Day(date: string): IndicatorSnapshot[] {
  return [
    crossedLowerSnapshot(date, 9, 15),
    crossedLowerSnapshot(date, 9, 30),
    crossedLowerSnapshot(date, 9, 45),
    crossedLowerSnapshot(date, 10, 0),
    wideCrossedLowerEntry(date, 10, 15),
  ];
}

describe("deepak3Decision", () => {
  it("emits SELL continue-down-2 when all gates pass", () => {
    const snapshots = buildBearishContinueDown2Day(DATE);
    const result = evaluateDeepak3Decision(snapshots, DATE);
    const sell4 = result?.signals.find(
      (signal) => signal.scenarioNumber === 4 && signal.side === "SELL",
    );

    expect(sell4?.scenarioKey).toBe(DEEPAK3_SCENARIOS.CONTINUE_DOWN_2);
    expect(sell4?.confidenceFactors).toContain("G1: crossed anchor");
    expect(sell4?.confidenceFactors).toContain("G2: continue direction - 2 only");
    expect(sell4?.confidenceFactors).toContain("G3: entry candle range >= profit target");
  });

  it("rejects signals when anchor candles are close-to but not crossed", () => {
    const snapshots = [
      closeToLowerSnapshot(DATE, 9, 15),
      closeToLowerSnapshot(DATE, 9, 30),
      closeToLowerSnapshot(DATE, 9, 45),
      closeToLowerSnapshot(DATE, 10, 0),
      wideCrossedLowerEntry(DATE, 10, 15),
    ];

    const deepak = evaluateDeepakDecision(snapshots, DATE);
    const deepak3 = evaluateDeepak3Decision(snapshots, DATE);

    expect(deepak?.signals.some((s) => s.side === "SELL")).toBe(true);
    expect(deepak3?.signals).toHaveLength(0);
  });

  it("filters out switch-branch signals (scenarios 1-3)", () => {
    const snapshots = [
      crossedLowerSnapshot(DATE, 9, 15),
      crossedLowerSnapshot(DATE, 9, 30),
      crossedLowerSnapshot(DATE, 9, 45),
      crossedLowerSnapshot(DATE, 10, 0),
      bothBandsSnapshot(DATE, 10, 15),
      crossedUpperSnapshot(DATE, 10, 30, 101),
    ];

    const deepak = evaluateDeepakDecision(snapshots, DATE);
    const deepak3 = evaluateDeepak3Decision(snapshots, DATE);

    expect(deepak?.signals.some((s) => s.scenarioNumber <= 3)).toBe(true);
    expect(deepak3?.signals).toHaveLength(0);
  });

  it("filters out entries when candle range is below profit target", () => {
    const snapshots = [
      crossedLowerSnapshot(DATE, 9, 15),
      crossedLowerSnapshot(DATE, 9, 30),
      crossedLowerSnapshot(DATE, 9, 45),
      crossedLowerSnapshot(DATE, 10, 0),
      narrowCrossedLowerEntry(DATE, 10, 15),
    ];

    const result = evaluateDeepak3Decision(snapshots, DATE);

    expect(result?.signals).toHaveLength(0);
  });

  it("emits BUY continue-up-2 on bullish crossed anchor day", () => {
    const snapshots = [
      crossedUpperSnapshot(DATE, 9, 15),
      crossedUpperSnapshot(DATE, 9, 30),
      crossedUpperSnapshot(DATE, 9, 45),
      crossedUpperSnapshot(DATE, 10, 0),
      makeSnapshot(DATE, 10, 15, {
        close: 102,
        high: 102.8,
        low: 101.9,
        upper: 102,
        lower: 95,
      }),
    ];

    const result = evaluateDeepak3Decision(snapshots, DATE);
    const buy4 = result?.signals.find(
      (signal) => signal.scenarioNumber === 4 && signal.side === "BUY",
    );

    expect(buy4?.scenarioKey).toBe(DEEPAK3_SCENARIOS.CONTINUE_UP_2);
  });

  it("applies sector breadth gate in batch scan", () => {
    const sellDay = buildBearishContinueDown2Day(DATE);

    const scan = scanDeepak3Decisions(
      [
        { tradingSymbol: "MARUTI", sector: "Automobile", snapshots: sellDay },
        { tradingSymbol: "M&M", sector: "Automobile", snapshots: sellDay },
        { tradingSymbol: "TVSMOTOR", sector: "Automobile", snapshots: sellDay },
        { tradingSymbol: "TCS", sector: "IT", snapshots: sellDay },
      ],
      DATE,
    );

    const autoResults = scan.results.filter((result) =>
      result.signals.some((signal) =>
        signal.confidenceFactors.some((factor) => factor.includes("Automobile")),
      ),
    );

    expect(autoResults).toHaveLength(3);
    for (const result of autoResults) {
      for (const signal of result.signals) {
        expect(signal.confidenceFactors.some((factor) => factor.startsWith("G4:"))).toBe(
          true,
        );
      }
    }

    const itResults = scan.results.filter((result) =>
      result.signals.some((signal) =>
        signal.confidenceFactors.some((factor) => factor.includes("IT")),
      ),
    );
    expect(itResults).toHaveLength(0);
  });

  it("produces fewer signals than Deepak on synthetic 2026-03-12 bearish day", () => {
    const snapshots = buildBearishContinueDown2Day("2026-03-12");
    const deepak = evaluateDeepakDecision(snapshots, "2026-03-12");
    const deepak3 = evaluateDeepak3Decision(snapshots, "2026-03-12");

    expect(deepak3?.signals.length ?? 0).toBeLessThanOrEqual(deepak?.signals.length ?? 0);
    expect(deepak3?.signals.length ?? 0).toBeGreaterThan(0);
  });

  it("simulates exit when target is reachable on continue-down-2", () => {
    const entry = wideCrossedLowerEntry(DATE, 10, 15, 99);
    const entryMid = candleMidPrice(entry);
    const exitCandle = makeSnapshot(DATE, 10, 30, {
      close: entryMid - 0.75,
      high: entryMid - 0.65,
      low: entryMid - 0.8,
      upper: entryMid + 5,
      lower: entryMid - 5,
    });

    const snapshots = [
      crossedLowerSnapshot(DATE, 9, 15),
      crossedLowerSnapshot(DATE, 9, 30),
      crossedLowerSnapshot(DATE, 9, 45),
      crossedLowerSnapshot(DATE, 10, 0),
      entry,
      exitCandle,
    ];

    const result = evaluateDeepak3Decision(snapshots, DATE);
    const sell4 = result?.signals.find((signal) => signal.scenarioNumber === 4);

    expect(sell4?.exit?.targetHit).toBe(true);
    expect(sell4?.exit?.profit).toBeGreaterThan(0);
  });

  it("uses deepak-3 scenario prefix", () => {
    const snapshots = buildBearishContinueDown2Day(DATE);
    const result = evaluateDeepak3Decision(snapshots, DATE);

    expect(result?.signals[0]?.scenarioKey.startsWith("deepak-3")).toBe(true);
  });

  it("exposes gate configuration on variant", () => {
    expect(DEEPAK3_VARIANT.config.requireCrossedAnchor).toBe(true);
    expect(DEEPAK3_VARIANT.config.continueScenariosOnly).toBe(true);
    expect(DEEPAK3_VARIANT.config.requireEntryRangeGteTarget).toBe(true);
    expect(DEEPAK3_VARIANT.config.minSectorBreadth).toBe(3);
  });

  describe("analysis date patterns", () => {
    it("2026-05-12 mixed day: continue-2 BUY path passes gates", () => {
      const date = "2026-05-12";
      const snapshots = [
        crossedUpperSnapshot(date, 9, 15),
        crossedUpperSnapshot(date, 9, 30),
        crossedUpperSnapshot(date, 9, 45),
        crossedUpperSnapshot(date, 10, 0),
        makeSnapshot(date, 10, 15, {
          close: 102,
          high: 102.9,
          low: 101.95,
          upper: 102,
          lower: 95,
        }),
      ];

      const result = evaluateDeepak3Decision(snapshots, date);
      expect(result?.signals.some((s) => s.side === "BUY")).toBe(true);
    });

    it("2026-06-11 choppy day: switch-only path does not emit Deepak-3 signals", () => {
      const date = "2026-06-11";
      const snapshots = [
        crossedUpperSnapshot(date, 9, 15),
        crossedUpperSnapshot(date, 9, 30),
        crossedUpperSnapshot(date, 9, 45),
        crossedUpperSnapshot(date, 10, 0),
        bothBandsSnapshot(date, 10, 15),
        crossedLowerSnapshot(date, 10, 30, 99),
      ];

      const result = evaluateDeepak3Decision(snapshots, date);
      expect(result?.signals).toHaveLength(0);
    });
  });
});
