import { describe, expect, it } from "vitest";
import { config } from "../../src/config.js";
import {
  applyMorningConflictResolution,
  getSetupWindowCandles,
  passesBuySetupChecks,
  passesSellSetupChecks,
  shouldEnterMorningBuy,
  shouldEnterMorningSell,
} from "../../src/rules/deepakMorningRules.js";
import { bbLowerActive, bbUpperActive } from "../../src/rules/deepakCore.js";
import { formatIstTime } from "../../src/utils/marketTime.js";
import type { DeepakTradeSignal, IndicatorSnapshot } from "../../src/types.js";

const RULES = config.deepakDecision.morningRules!;
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

/** LBSR pattern modeled on screenshot: opening cross, base, RSI recovery, last 2 green. */
function buildLbsrBuySetupWindow(): IndicatorSnapshot[] {
  return [
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
  ];
}

function buildUbrrSellSetupWindow(): IndicatorSnapshot[] {
  return [
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
      rsi: 64,
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
      rsi: 65,
    }),
  ];
}

describe("deepakMorningRules", () => {
  it("passes LBSR buy setup from screenshot-style pattern", () => {
    const window = buildLbsrBuySetupWindow();
    expect(passesBuySetupChecks(window, RULES)).toBe(true);
    expect(window.every((candle) => bbLowerActive(candle))).toBe(true);
  });

  it("fails buy setup when opening candle does not cross lower band", () => {
    const window = buildLbsrBuySetupWindow();
    window[0] = makeSnapshot(9, 15, {
      open: 1320,
      close: 1321,
      high: 1323,
      low: 1321.5,
      upper: 1343.47,
      middle: 1335,
      lower: 1322.03,
      rsi: 32,
    });
    expect(passesBuySetupChecks(window, RULES)).toBe(false);
  });

  it("fails buy setup when a later candle makes a new low", () => {
    const window = buildLbsrBuySetupWindow();
    window[2] = { ...window[2], low: 1310 };
    expect(passesBuySetupChecks(window, RULES)).toBe(false);
  });

  it("fails buy setup when RSI at 10:15 has not recovered above open", () => {
    const window = buildLbsrBuySetupWindow();
    window[4] = { ...window[4], rsi: 30 };
    expect(passesBuySetupChecks(window, RULES)).toBe(false);
  });

  it("fails buy setup when last two candles are not green", () => {
    const window = buildLbsrBuySetupWindow();
    window[4] = makeSnapshot(10, 15, {
      open: 1324,
      close: 1322,
      high: 1325.2,
      low: 1322,
      upper: 1340.95,
      middle: 1331,
      lower: 1318.63,
      rsi: 45,
    });
    expect(passesBuySetupChecks(window, RULES)).toBe(false);
  });

  it("passes UBRR sell setup from screenshot-style pattern", () => {
    const window = buildUbrrSellSetupWindow();
    expect(passesSellSetupChecks(window, RULES)).toBe(true);
    expect(window.every((candle) => bbUpperActive(candle))).toBe(true);
  });

  it("fails sell setup when opening candle does not cross upper band", () => {
    const window = buildUbrrSellSetupWindow();
    window[0] = makeSnapshot(9, 15, {
      open: 1338,
      close: 1339,
      high: 1340,
      low: 1335.9,
      upper: 1340.44,
      middle: 1333.63,
      lower: 1331.1,
      rsi: 60,
    });
    expect(passesSellSetupChecks(window, RULES)).toBe(false);
  });

  it("fails sell setup when a later candle makes a new high", () => {
    const window = buildUbrrSellSetupWindow();
    window[3] = { ...window[3], high: 1345 };
    expect(passesSellSetupChecks(window, RULES)).toBe(false);
  });

  it("fails sell setup when 10:15 candle is not red", () => {
    const window = buildUbrrSellSetupWindow();
    window[4] = makeSnapshot(10, 15, {
      open: 1338,
      close: 1340,
      high: 1343,
      low: 1337.6,
      upper: 1342.14,
      middle: 1333.2,
      lower: 1330.37,
      rsi: 65,
    });
    expect(passesSellSetupChecks(window, RULES)).toBe(false);
  });

  it("fails sell setup when RSI does not roll over from peak", () => {
    const window = buildUbrrSellSetupWindow();
    window[4] = { ...window[4], rsi: 69 };
    expect(passesSellSetupChecks(window, RULES)).toBe(false);
  });

  it("enters morning buy at 10:30 on green breakout above BB middle", () => {
    const window = buildLbsrBuySetupWindow();
    const entry = makeSnapshot(10, 30, {
      open: 1335,
      close: 1345,
      high: 1348,
      low: 1334,
      upper: 1355,
      middle: 1340,
      lower: 1325,
      rsi: 52,
    });
    expect(shouldEnterMorningBuy(true, entry, window, RULES)).toBe(true);
  });

  it("rejects morning buy at 10:30 when close stays below BB middle", () => {
    const window = buildLbsrBuySetupWindow();
    const entry = makeSnapshot(10, 30, {
      open: 1325,
      close: 1330,
      high: 1332,
      low: 1324,
      upper: 1355,
      middle: 1340,
      lower: 1325,
      rsi: 48,
    });
    expect(shouldEnterMorningBuy(true, entry, window, RULES)).toBe(false);
  });

  it("enters morning sell at 10:30 on red breakdown below BB middle", () => {
    const window = buildUbrrSellSetupWindow();
    const entry = makeSnapshot(10, 30, {
      open: 1335,
      close: 1330,
      high: 1336,
      low: 1329,
      upper: 1342,
      middle: 1333,
      lower: 1330,
      rsi: 58,
    });
    expect(shouldEnterMorningSell(true, entry, window, RULES)).toBe(true);
  });

  it("rejects morning sell at 10:30 when close stays above BB middle", () => {
    const window = buildUbrrSellSetupWindow();
    const entry = makeSnapshot(10, 30, {
      open: 1334,
      close: 1334.5,
      high: 1336,
      low: 1333,
      upper: 1342,
      middle: 1333,
      lower: 1330,
      rsi: 58,
    });
    expect(shouldEnterMorningSell(true, entry, window, RULES)).toBe(false);
  });

  it("suppresses legacy SELL when morning BUY qualifies", () => {
    const legacy: DeepakTradeSignal[] = [
      {
        side: "SELL",
        scenarioKey: "deepak continue downward direction - 2",
        scenarioNumber: 4,
        timeIst: "10:15",
        price: 98,
        bbMatchType: "crossed",
        profitTarget: 0.7,
        exit: null,
      },
    ];
    const morning: DeepakTradeSignal[] = [
      {
        side: "BUY",
        scenarioKey: "deepak morning buy",
        scenarioNumber: 5,
        timeIst: "10:30",
        price: 1341,
        bbMatchType: "crossed",
        profitTarget: 0.7,
        exit: null,
      },
    ];

    const result = applyMorningConflictResolution(legacy, morning);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]?.side).toBe("BUY");
    expect(result.suppressionNotes).toHaveLength(1);
  });

  it("extracts setup window candles between 09:15 and 10:15", () => {
    const candles = [
      ...buildLbsrBuySetupWindow(),
      makeSnapshot(10, 30, { close: 1345, middle: 1340, lower: 1325 }),
    ];
    const window = getSetupWindowCandles(candles, "09:15", "10:15");
    expect(window).toHaveLength(5);
    expect(window.map((candle) => formatIstTime(candle.timestamp))).not.toContain("10:30");
  });
});
