import { describe, expect, it } from "vitest";
import { config } from "../../src/config.js";
import {
  applyRsiExtremeContinueDeferral,
  buildTradeScenarioMap,
  createDeepakScenarios,
  findRsiExtremeRecoveryTip,
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
    rsi?: number;
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
    rsi: opts.rsi ?? 50,
    macd: { macdLine: 0.1, signalLine: 0.05, histogram: 0.05 },
  };
}

function lowerOnly(
  hour: number,
  minute: number,
  close: number,
  rsi: number,
): IndicatorSnapshot {
  return makeSnapshot(hour, minute, {
    open: close + 0.2,
    close,
    high: close + 0.3,
    low: close - 0.1,
    upper: close + 5,
    middle: close + 2,
    lower: close,
    rsi,
  });
}

function upperOnly(
  hour: number,
  minute: number,
  close: number,
  rsi: number,
): IndicatorSnapshot {
  return makeSnapshot(hour, minute, {
    open: close - 0.2,
    close,
    high: close + 0.1,
    low: close - 0.3,
    upper: close,
    middle: close - 2,
    lower: close - 5,
    rsi,
  });
}

function risingRecovery(
  hour: number,
  minute: number,
  close: number,
  rsi: number,
): IndicatorSnapshot {
  return makeSnapshot(hour, minute, {
    open: close - 0.1,
    close,
    high: close + 0.2,
    low: close - 0.2,
    upper: close + 5,
    middle: close,
    lower: close - 5,
    rsi,
  });
}

function fallingRecovery(
  hour: number,
  minute: number,
  close: number,
  rsi: number,
): IndicatorSnapshot {
  return makeSnapshot(hour, minute, {
    open: close + 0.1,
    close,
    high: close + 0.2,
    low: close - 0.2,
    upper: close + 5,
    middle: close,
    lower: close - 5,
    rsi,
  });
}

const DEEPAK_VARIANT: DeepakStrategyVariant = {
  id: "deepak",
  namePrefix: "deepak",
  config: config.deepakDecision,
};

describe("findRsiExtremeRecoveryTip", () => {
  it("tips BUY on the 3rd rising candle by 11:00", () => {
    const candles = [
      lowerOnly(10, 15, 100, 30),
      risingRecovery(10, 30, 101, 41),
      risingRecovery(10, 45, 102, 43),
      risingRecovery(11, 0, 103, 45),
    ];
    const tip = findRsiExtremeRecoveryTip(candles, 0, "buy", 3, "12:00", 40);
    expect(tip?.candle.timestamp.getTime()).toBe(istTimestamp(11, 0).getTime());
  });

  it("ignores tips after the deadline", () => {
    const candles = [
      lowerOnly(10, 15, 100, 30),
      risingRecovery(11, 30, 101, 41),
      risingRecovery(11, 45, 102, 43),
      risingRecovery(12, 15, 103, 45),
    ];
    const tip = findRsiExtremeRecoveryTip(candles, 0, "buy", 3, "12:00", 40);
    expect(tip).toBeNull();
  });

  it("resets when the rising streak breaks", () => {
    const candles = [
      lowerOnly(10, 15, 100, 30),
      risingRecovery(10, 30, 101, 41),
      risingRecovery(10, 45, 102, 43),
      risingRecovery(11, 0, 101, 42),
      risingRecovery(11, 15, 102, 44),
      risingRecovery(11, 30, 103, 46),
      risingRecovery(11, 45, 104, 48),
    ];
    const tip = findRsiExtremeRecoveryTip(candles, 0, "buy", 3, "12:00", 40);
    expect(tip?.candle.timestamp.getTime()).toBe(istTimestamp(11, 45).getTime());
  });
});

describe("applyRsiExtremeContinueDeferral", () => {
  it("suppresses oversold CONTINUE_DOWN_2 and emits recovery BUY", () => {
    const scenarios = createDeepakScenarios("deepak");
    const tradeScenarioMap = buildTradeScenarioMap(scenarios);
    const candles = [
      lowerOnly(10, 15, 100, 30),
      risingRecovery(10, 30, 101, 41),
      risingRecovery(10, 45, 102, 43),
      risingRecovery(11, 0, 103, 45),
    ];

    const result = applyRsiExtremeContinueDeferral({
      candles,
      scenarios,
      tradeScenarioMap,
      variant: DEEPAK_VARIANT,
      signals: [
        {
          side: "SELL",
          scenarioKey: scenarios.CONTINUE_DOWN_2,
          scenarioNumber: 4,
          timeIst: "10:15",
          price: 100,
          bbMatchType: "crossed",
          profitTarget: 0.7,
          exit: null,
        },
      ],
      trail: [
        {
          scenarioKey: scenarios.CONTINUE_DOWN_2,
          timeIst: "10:15",
          bbMatchType: "crossed",
        },
      ],
    });

    expect(result.signals.some((s) => s.scenarioKey === scenarios.CONTINUE_DOWN_2)).toBe(
      false,
    );
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]?.side).toBe("BUY");
    expect(result.signals[0]?.scenarioNumber).toBe(7);
    expect(result.signals[0]?.timeIst).toBe("11:00");
    expect(result.signals[0]?.scenarioKey).toBe(scenarios.OVERSOLD_RECOVERY_BUY);
  });

  it("suppresses overbought CONTINUE_UP_2 and emits recovery SELL", () => {
    const scenarios = createDeepakScenarios("deepak");
    const tradeScenarioMap = buildTradeScenarioMap(scenarios);
    const candles = [
      upperOnly(10, 15, 110, 70),
      fallingRecovery(10, 30, 109, 58),
      fallingRecovery(10, 45, 108, 56),
      fallingRecovery(11, 0, 107, 54),
    ];

    const result = applyRsiExtremeContinueDeferral({
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
          price: 110,
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

    expect(result.signals.some((s) => s.scenarioKey === scenarios.CONTINUE_UP_2)).toBe(false);
    expect(result.signals[0]?.side).toBe("SELL");
    expect(result.signals[0]?.timeIst).toBe("11:00");
    expect(result.signals[0]?.scenarioKey).toBe(scenarios.OVERBOUGHT_RECOVERY_SELL);
  });

  it("keeps CONTINUE_DOWN_2 when RSI is not oversold", () => {
    const scenarios = createDeepakScenarios("deepak");
    const tradeScenarioMap = buildTradeScenarioMap(scenarios);
    const candles = [lowerOnly(10, 15, 100, 45), risingRecovery(10, 30, 101, 46)];

    const result = applyRsiExtremeContinueDeferral({
      candles,
      scenarios,
      tradeScenarioMap,
      variant: DEEPAK_VARIANT,
      signals: [
        {
          side: "SELL",
          scenarioKey: scenarios.CONTINUE_DOWN_2,
          scenarioNumber: 4,
          timeIst: "10:15",
          price: 100,
          bbMatchType: "crossed",
          profitTarget: 0.7,
          exit: null,
        },
      ],
      trail: [],
    });

    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]?.scenarioKey).toBe(scenarios.CONTINUE_DOWN_2);
    expect(result.suppressionNotes).toHaveLength(0);
  });
});

describe("evaluateDeepakDecision RSI extreme continue deferral", () => {
  it("screenshot-like: oversold continue-down-2 becomes recovery BUY at 11:00", () => {
    const snapshots = [
      lowerOnly(9, 15, 104, 28),
      lowerOnly(9, 30, 103, 27),
      lowerOnly(9, 45, 102, 26),
      lowerOnly(10, 0, 101, 28),
      lowerOnly(10, 15, 100, 30),
      risingRecovery(10, 30, 101, 41),
      risingRecovery(10, 45, 102, 43),
      risingRecovery(11, 0, 103, 45),
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);
    expect(result).not.toBeNull();
    expect(
      result!.signals.some((s) => s.scenarioKey.includes("continue downward direction - 2")),
    ).toBe(false);
    const recovery = result!.signals.filter((s) =>
      s.scenarioKey.includes("oversold recovery buy"),
    );
    expect(recovery).toHaveLength(1);
    expect(recovery[0]?.side).toBe("BUY");
    expect(recovery[0]?.timeIst).toBe("11:00");
  });

  it("mirror: overbought continue-up-2 becomes recovery SELL at 11:00", () => {
    const snapshots = [
      upperOnly(9, 15, 106, 68),
      upperOnly(9, 30, 107, 69),
      upperOnly(9, 45, 108, 70),
      upperOnly(10, 0, 109, 71),
      upperOnly(10, 15, 110, 72),
      fallingRecovery(10, 30, 109, 58),
      fallingRecovery(10, 45, 108, 56),
      fallingRecovery(11, 0, 107, 54),
    ];

    const result = evaluateDeepakDecision(snapshots, DATE);
    expect(result).not.toBeNull();
    expect(
      result!.signals.some((s) => s.scenarioKey.includes("continue upward direction - 2")),
    ).toBe(false);
    const recovery = result!.signals.filter((s) =>
      s.scenarioKey.includes("overbought recovery sell"),
    );
    expect(recovery).toHaveLength(1);
    expect(recovery[0]?.side).toBe("SELL");
    expect(recovery[0]?.timeIst).toBe("11:00");
  });
});
