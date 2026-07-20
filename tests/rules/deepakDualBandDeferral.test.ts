import { describe, expect, it } from "vitest";
import { config } from "../../src/config.js";
import {
  applyDualBandDeferral,
  createDeepakScenarios,
  findConsecutiveExclusiveResolveAfter,
  findDualBandDeferralEnd,
  buildTradeScenarioMap,
  type DeepakStrategyVariant,
} from "../../src/rules/deepakCore.js";
import { evaluateDeepakDecision } from "../../src/rules/deepakDecision.js";
import type { IndicatorSnapshot } from "../../src/types.js";

const DATE = "2026-07-14";

function istTimestamp(hour: number, minute: number): Date {
  return new Date(
    `${DATE}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`,
  );
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
  } = {},
): IndicatorSnapshot {
  const close = opts.close ?? 100;
  const open = opts.open ?? close - 0.05;
  const upper = opts.upper ?? close + 20;
  const middle = opts.middle ?? close;
  const lower = opts.lower ?? close - 20;
  const high = opts.high ?? Math.max(open, close) + 0.2;
  const low = opts.low ?? Math.min(open, close) - 0.05;

  return {
    timestamp: istTimestamp(hour, minute),
    open,
    high,
    low,
    close,
    bollinger: { upper, middle, lower },
    rsi: 50,
    macd: { macdLine: 0.1, signalLine: 0.05, histogram: 0.05 },
  };
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

function upperOnlySnapshot(hour: number, minute: number, close = 100): IndicatorSnapshot {
  return makeSnapshot(hour, minute, {
    close,
    high: close + 0.05,
    low: close - 0.1,
    upper: close,
    lower: close - 5,
  });
}

function lowerOnlySnapshot(hour: number, minute: number, close = 100): IndicatorSnapshot {
  return makeSnapshot(hour, minute, {
    close,
    high: close + 0.1,
    low: close - 0.05,
    upper: close + 5,
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

const DEEPAK_VARIANT: DeepakStrategyVariant = {
  id: "deepak",
  namePrefix: "deepak",
  config: config.deepakDecision,
};

describe("dual-band deferral helpers", () => {
  it("finds the end of the first consecutive both-band run", () => {
    const candles = [
      bothBandsSnapshot(9, 15),
      bothBandsSnapshot(9, 30),
      upperOnlySnapshot(9, 45),
    ];
    expect(findDualBandDeferralEnd(candles, 2)).toBe(1);
    expect(findDualBandDeferralEnd(candles, 3)).toBeNull();
  });

  it("tips SELL on the 3rd consecutive lower-only candle after 10:15", () => {
    const candles = [
      bothBandsSnapshot(9, 15),
      bothBandsSnapshot(9, 30),
      upperOnlySnapshot(9, 45),
      upperOnlySnapshot(10, 0),
      upperOnlySnapshot(10, 15),
      bothBandsSnapshot(10, 30),
      bothBandsSnapshot(10, 45),
      bothBandsSnapshot(11, 0),
      lowerOnlySnapshot(11, 15),
      lowerOnlySnapshot(11, 30),
      lowerOnlySnapshot(11, 45),
    ];

    const tip = findConsecutiveExclusiveResolveAfter(candles, "10:15", 3);
    expect(tip?.side).toBe("SELL");
    expect(tip?.candle.timestamp.getTime()).toBe(istTimestamp(11, 45).getTime());
  });

  it("ignores exclusive candles at or before 10:15 when resolving", () => {
    const candles = [
      bothBandsSnapshot(9, 15),
      bothBandsSnapshot(9, 30),
      upperOnlySnapshot(9, 45),
      upperOnlySnapshot(10, 0),
      upperOnlySnapshot(10, 15),
      upperOnlySnapshot(10, 30),
      upperOnlySnapshot(10, 45),
      upperOnlySnapshot(11, 0),
    ];

    const tip = findConsecutiveExclusiveResolveAfter(candles, "10:15", 3);
    expect(tip?.side).toBe("BUY");
    expect(tip?.candle.timestamp.getTime()).toBe(istTimestamp(11, 0).getTime());
  });

  it("resets exclusive streak when a both-band candle appears", () => {
    const candles = [
      bothBandsSnapshot(9, 15),
      bothBandsSnapshot(9, 30),
      upperOnlySnapshot(10, 30),
      upperOnlySnapshot(10, 45),
      bothBandsSnapshot(11, 0),
      upperOnlySnapshot(11, 15),
      upperOnlySnapshot(11, 30),
      upperOnlySnapshot(11, 45),
    ];

    const tip = findConsecutiveExclusiveResolveAfter(candles, "10:15", 3);
    expect(tip?.side).toBe("BUY");
    expect(tip?.candle.timestamp.getTime()).toBe(istTimestamp(11, 45).getTime());
  });
});

describe("applyDualBandDeferral", () => {
  it("suppresses continue-2 signals and emits deferred SELL at 3rd lower-only", () => {
    const scenarios = createDeepakScenarios("deepak");
    const tradeScenarioMap = buildTradeScenarioMap(scenarios);
    const candles = [
      bothBandsSnapshot(9, 15),
      bothBandsSnapshot(9, 30),
      upperOnlySnapshot(9, 45),
      upperOnlySnapshot(10, 0),
      upperOnlySnapshot(10, 15),
      bothBandsSnapshot(10, 30),
      bothBandsSnapshot(10, 45),
      bothBandsSnapshot(11, 0),
      lowerOnlySnapshot(11, 15),
      lowerOnlySnapshot(11, 30),
      lowerOnlySnapshot(11, 45),
    ];

    const result = applyDualBandDeferral({
      candles,
      scenarios,
      tradeScenarioMap,
      variant: DEEPAK_VARIANT,
      signals: [
        {
          side: "BUY",
          scenarioKey: scenarios.CONTINUE_UP_2,
          scenarioNumber: 4,
          timeIst: "10:15",
          price: 100,
          bbMatchType: "close",
          profitTarget: 0.7,
          exit: null,
        },
      ],
      trail: [
        {
          scenarioKey: scenarios.CONTINUE_UP_2,
          timeIst: "10:15",
          bbMatchType: "close",
        },
      ],
    });

    expect(result.deferred).toBe(true);
    expect(result.signals.some((signal) => signal.scenarioKey === scenarios.CONTINUE_UP_2)).toBe(
      false,
    );
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]?.side).toBe("SELL");
    expect(result.signals[0]?.scenarioNumber).toBe(6);
    expect(result.signals[0]?.timeIst).toBe("11:45");
    expect(result.signals[0]?.scenarioKey).toBe(scenarios.DEFERRED_LOWER_RESOLVE_3);
  });
});

describe("evaluateDeepakDecision dual-band deferral", () => {
  it("LUPIN-like day: deferred SELL on 11:45 after both-band early and post-10:15 resets", () => {
    const snapshots = [
      bothBandsSnapshot(9, 15),
      bothBandsSnapshot(9, 30),
      upperOnlySnapshot(9, 45),
      upperOnlySnapshot(10, 0),
      upperOnlySnapshot(10, 15),
      bothBandsSnapshot(10, 30),
      bothBandsSnapshot(10, 45),
      bothBandsSnapshot(11, 0),
      lowerOnlySnapshot(11, 15),
      lowerOnlySnapshot(11, 30),
      lowerOnlySnapshot(11, 45),
      neutralSnapshot(12, 0),
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);
    expect(result).not.toBeNull();
    const deferred = result!.signals.filter((signal) =>
      signal.scenarioKey.includes("deferred lower resolve"),
    );
    expect(deferred).toHaveLength(1);
    expect(deferred[0]?.side).toBe("SELL");
    expect(deferred[0]?.timeIst).toBe("11:45");
    expect(
      result!.signals.some((signal) => signal.scenarioKey.includes("continue upward direction - 2")),
    ).toBe(false);
  });

  it("emits deferred BUY on 3 consecutive upper-only after 10:15", () => {
    const snapshots = [
      bothBandsSnapshot(9, 15),
      bothBandsSnapshot(9, 30),
      neutralSnapshot(9, 45),
      neutralSnapshot(10, 0),
      neutralSnapshot(10, 15),
      upperOnlySnapshot(10, 30),
      upperOnlySnapshot(10, 45),
      upperOnlySnapshot(11, 0),
      neutralSnapshot(11, 15),
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);
    expect(result).not.toBeNull();
    const deferred = result!.signals.filter((signal) =>
      signal.scenarioKey.includes("deferred upper resolve"),
    );
    expect(deferred).toHaveLength(1);
    expect(deferred[0]?.side).toBe("BUY");
    expect(deferred[0]?.timeIst).toBe("11:00");
  });

  it("leaves CONTINUE_2 intact when there is no dual-band deferral", () => {
    const snapshots = [
      upperOnlySnapshot(9, 15),
      upperOnlySnapshot(9, 30),
      upperOnlySnapshot(9, 45),
      upperOnlySnapshot(10, 0),
      upperOnlySnapshot(10, 15),
      neutralSnapshot(10, 30),
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);
    expect(result).not.toBeNull();
    expect(
      result!.signals.some((signal) => signal.scenarioKey.includes("continue upward direction - 2")),
    ).toBe(true);
    expect(result!.signals.some((signal) => signal.scenarioKey.includes("deferred"))).toBe(false);
  });
});
