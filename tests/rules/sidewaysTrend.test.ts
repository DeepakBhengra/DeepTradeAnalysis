import { describe, expect, it } from "vitest";
import { config } from "../../src/config.js";
import {
  buildSidewaysDebug,
  buildSidewaysReasons,
  evaluateSidewaysTrend,
} from "../../src/rules/sidewaysTrend.js";
import type { IndicatorSnapshot } from "../../src/types.js";

function istTimestamp(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  return new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`,
  );
}

function snapshot(
  overrides: Partial<IndicatorSnapshot> & Pick<IndicatorSnapshot, "timestamp" | "close">,
): IndicatorSnapshot {
  const close = overrides.close;
  return {
    open: close - 0.05,
    high: close + 0.05,
    low: close - 0.05,
    bollinger: {
      upper: close + 0.05,
      middle: close,
      lower: close - 0.05,
    },
    rsi: 50,
    macd: {
      macdLine: 0.05,
      signalLine: 0.04,
      histogram: 0.01,
    },
    ...overrides,
  };
}

function sessionWindow(
  day: number,
  baseClose: number,
  times: Array<[number, number]>,
): IndicatorSnapshot[] {
  return times.map(([hour, minute], index) => {
    const close = baseClose + index * 0.01;
    const upper = close + 0.05;
    const lower = close - 0.05;
    return snapshot({
      timestamp: istTimestamp(2026, 6, day, hour, minute),
      close,
      high: upper,
      low: lower,
      bollinger: {
        upper,
        middle: close,
        lower,
      },
      rsi: 52,
      macd: {
        macdLine: 0.05,
        signalLine: 0.04,
        histogram: 0.01,
      },
    });
  });
}

describe("evaluateSidewaysTrend", () => {
  it("returns null when fewer than 3 session candles exist", () => {
    const snapshots = sessionWindow(19, 109, [
      [9, 15],
      [9, 30],
    ]);
    expect(evaluateSidewaysTrend(snapshots, { targetDateKey: "2026-06-19" })).toBeNull();
  });

  it("selects June 18 session when targetDateKey is 2026-06-18 among mixed days", () => {
    const june18 = sessionWindow(18, 100, [
      [9, 15],
      [9, 30],
      [10, 0],
      [10, 30],
    ]);
    const june19 = sessionWindow(19, 109, [
      [9, 15],
      [9, 30],
      [10, 0],
    ]);

    const result = evaluateSidewaysTrend([...june18, ...june19], {
      targetDateKey: "2026-06-18",
    });

    expect(result).not.toBeNull();
    expect(result?.sessionDate).toBe("2026-06-18");
    expect(result?.parameters?.candleCountInWindow).toBe(4);
  });

  it("buildSidewaysDebug reports raw and usable session counts", () => {
    const june18 = sessionWindow(18, 100, [
      [9, 15],
      [9, 30],
      [10, 0],
    ]);
    const june19 = sessionWindow(19, 109, [
      [9, 15],
      [9, 30],
      [10, 0],
      [10, 30],
    ]);

    const debug = buildSidewaysDebug([...june18, ...june19], {
      targetDateKey: "2026-06-18",
    });

    expect(debug.targetDateKey).toBe("2026-06-18");
    expect(debug.rawSessionCount).toBe(3);
    expect(debug.usableSessionCount).toBe(3);
  });

  it("uses explicit target date and includes 9:15 candle", () => {
    const olderDay = sessionWindow(18, 100, [
      [9, 15],
      [10, 0],
      [10, 30],
    ]);
    const june19 = sessionWindow(19, 109, [
      [9, 15],
      [9, 30],
      [10, 0],
      [10, 30],
    ]);
    const afterSession = [
      snapshot({
        timestamp: istTimestamp(2026, 6, 19, 13, 0),
        close: 110,
        high: 115,
        low: 105,
        bollinger: { upper: 115, middle: 110, lower: 105 },
      }),
    ];

    const result = evaluateSidewaysTrend([...olderDay, ...june19, ...afterSession], {
      targetDateKey: "2026-06-19",
    });

    expect(result).not.toBeNull();
    expect(result?.sessionDate).toBe("2026-06-19");
    expect(result?.parameters?.candleCountInWindow).toBe(4);
    expect(result?.bbTopRange).toBeCloseTo(109.065, 2);
    expect(result?.bbBottomRange).toBeCloseTo(108.965, 2);
  });

  it("detects sideways trend when session BB parameters align", () => {
    const snapshots = sessionWindow(19, 109, [
      [9, 15],
      [9, 30],
      [10, 0],
      [10, 30],
    ]);

    const result = evaluateSidewaysTrend(snapshots, { targetDateKey: "2026-06-19" });

    expect(result?.isSidewaysTrend).toBe(true);
    expect(
      result?.parameters?.checks.some(
        (check) => check.id === "bbTopCloseToSessionHigh" && check.passed,
      ),
    ).toBe(true);
    expect(
      result?.parameters?.checks.some(
        (check) => check.id === "bbBottomCloseToSessionLow" && check.passed,
      ),
    ).toBe(true);
  });

  it("passes BB top as crossed when session high exceeds avg BB top", () => {
    const snapshots = sessionWindow(19, 109, [
      [9, 15],
      [9, 30],
      [10, 0],
      [10, 30],
    ]);
    snapshots[2] = snapshot({
      timestamp: istTimestamp(2026, 6, 19, 10, 0),
      close: 109.3,
      high: 120,
      low: 109.15,
      bollinger: {
        upper: 109.25,
        middle: 109.2,
        lower: 109.15,
      },
    });

    const result = evaluateSidewaysTrend(snapshots, { targetDateKey: "2026-06-19" });
    const topCheck = result?.parameters?.checks.find(
      (check) => check.id === "bbTopCloseToSessionHigh",
    );

    expect(result?.isSidewaysTrend).toBe(false);
    expect(topCheck?.passed).toBe(true);
    expect(topCheck?.matchType).toBe("crossed");
    expect(topCheck?.value).toContain("crossed · by");
    expect(topCheck?.gapPct).toBeGreaterThan(config.thresholds.bbClosePctThreshold);
    expect(
      result?.parameters?.checks.find((check) => check.id === "bbBottomCloseToSessionLow")?.passed,
    ).toBe(true);
  });

  it("includes the session high and low 15m candles on BB proximity checks", () => {
    const snapshots = sessionWindow(19, 109, [
      [9, 15],
      [9, 30],
      [10, 0],
      [10, 30],
    ]);
    snapshots[2] = snapshot({
      timestamp: istTimestamp(2026, 6, 19, 10, 0),
      close: 109.2,
      high: 120,
      low: 109.15,
      bollinger: {
        upper: 109.25,
        middle: 109.2,
        lower: 109.15,
      },
    });

    const result = evaluateSidewaysTrend(snapshots, { targetDateKey: "2026-06-19" });
    const topCheck = result?.parameters?.checks.find(
      (check) => check.id === "bbTopCloseToSessionHigh",
    );
    const bottomCheck = result?.parameters?.checks.find(
      (check) => check.id === "bbBottomCloseToSessionLow",
    );

    expect(topCheck?.candleRef).toEqual({
      timeIst: "10:00",
      intervalLabel: "15m candle 10:00 IST",
      high: 120,
      low: 109.15,
      close: 109.2,
      candleColor: "green",
    });
    expect(bottomCheck?.candleRef?.timeIst).toBe("09:15");
    expect(bottomCheck?.candleRef?.intervalLabel).toBe("15m candle 09:15 IST");
    expect(bottomCheck?.candleRef?.candleColor).toBe("green");
  });

  it("marks session extreme candle as red when close is below open", () => {
    const snapshots = sessionWindow(19, 109, [
      [9, 15],
      [9, 30],
      [10, 0],
      [10, 30],
    ]);
    snapshots[2] = snapshot({
      timestamp: istTimestamp(2026, 6, 19, 10, 0),
      open: 120,
      close: 109.2,
      high: 120,
      low: 109.15,
      bollinger: {
        upper: 109.25,
        middle: 109.2,
        lower: 109.15,
      },
    });

    const result = evaluateSidewaysTrend(snapshots, { targetDateKey: "2026-06-19" });
    const topCheck = result?.parameters?.checks.find(
      (check) => check.id === "bbTopCloseToSessionHigh",
    );

    expect(topCheck?.candleRef?.candleColor).toBe("red");
  });

  it("passes BB top as close when session high is within threshold below avg BB top", () => {
    const upper = 110.0;
    const snapshots = [
      snapshot({
        timestamp: istTimestamp(2026, 6, 19, 9, 15),
        close: 109.85,
        high: 109.87,
        low: 109.8,
        bollinger: { upper, middle: 109.85, lower: 109.7 },
      }),
      snapshot({
        timestamp: istTimestamp(2026, 6, 19, 9, 30),
        close: 109.86,
        high: 109.86,
        low: 109.81,
        bollinger: { upper, middle: 109.86, lower: 109.71 },
      }),
      snapshot({
        timestamp: istTimestamp(2026, 6, 19, 10, 0),
        close: 109.88,
        high: 109.88,
        low: 109.82,
        bollinger: { upper, middle: 109.88, lower: 109.72 },
      }),
    ];

    const result = evaluateSidewaysTrend(snapshots, { targetDateKey: "2026-06-19" });
    const topCheck = result?.parameters?.checks.find(
      (check) => check.id === "bbTopCloseToSessionHigh",
    );

    expect(topCheck?.passed).toBe(true);
    expect(topCheck?.matchType).toBe("close");
    expect(topCheck?.value).toContain("close · gap");
  });

  it("fails BB bottom when session low is neither close nor crossed", () => {
    const lower = 100.0;
    const snapshots = [
      snapshot({
        timestamp: istTimestamp(2026, 6, 19, 9, 15),
        close: 101.2,
        high: 101.5,
        low: 101.0,
        bollinger: { upper: 101.5, middle: 101.2, lower },
      }),
      snapshot({
        timestamp: istTimestamp(2026, 6, 19, 9, 30),
        close: 101.25,
        high: 101.55,
        low: 101.05,
        bollinger: { upper: 101.55, middle: 101.25, lower },
      }),
      snapshot({
        timestamp: istTimestamp(2026, 6, 19, 10, 0),
        close: 101.3,
        high: 101.6,
        low: 101.1,
        bollinger: { upper: 101.6, middle: 101.3, lower },
      }),
    ];

    const result = evaluateSidewaysTrend(snapshots, { targetDateKey: "2026-06-19" });
    const bottomCheck = result?.parameters?.checks.find(
      (check) => check.id === "bbBottomCloseToSessionLow",
    );

    expect(bottomCheck?.passed).toBe(false);
    expect(bottomCheck?.matchType).toBeUndefined();
    expect(bottomCheck?.value).toContain("gap");
  });

  it("fires nearBbTopRange when sideways and session-end close is near top range", () => {
    const snapshots = sessionWindow(19, 109, [
      [9, 15],
      [9, 30],
      [10, 0],
    ]);
    const lastSession = snapshots[snapshots.length - 1];
    lastSession.close = lastSession.bollinger.upper;

    snapshots.push(
      snapshot({
        timestamp: istTimestamp(2026, 6, 19, 14, 0),
        close: 105,
        high: 115,
        low: 105,
        bollinger: { upper: 115, middle: 110, lower: 105 },
      }),
    );

    const result = evaluateSidewaysTrend(snapshots, { targetDateKey: "2026-06-19" });

    expect(result?.isSidewaysTrend).toBe(true);
    expect(result?.nearBbTopRange).toBe(true);
  });

  it("documents RSI and MACD session parameters", () => {
    const snapshots = sessionWindow(19, 109, [
      [9, 15],
      [9, 30],
      [10, 0],
    ]);

    const result = evaluateSidewaysTrend(snapshots, { targetDateKey: "2026-06-19" });

    expect(result?.parameters?.avgRsi).toBeCloseTo(52, 0);
    expect(result?.parameters?.checks.some((check) => check.id === "rsiNeutral")).toBe(true);
    expect(result?.parameters?.checks.some((check) => check.id === "macdFlat")).toBe(true);
  });
});

describe("buildSidewaysReasons", () => {
  it("builds human-readable sideways reasons", () => {
    const reasons = buildSidewaysReasons({
      isSidewaysTrend: true,
      bbTopRange: 110.01,
      bbBottomRange: 108.94,
      nearBbTopRange: true,
      nearBbBottomRange: false,
      sessionDate: "2026-06-19",
      parameters: {
        bollinger: { length: 20, stdDev: 2, maType: "SMA", field: "close" },
        rsi: { period: 14 },
        macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        sessionWindow: { start: "09:15", end: "12:00", timezone: "Asia/Kolkata" },
        candleCountInWindow: 11,
        avgRsi: 57.3,
        avgMacdHistogram: 0.01,
        avgBandWidthPct: 0.9,
        checks: [
          {
            id: "bbTopCloseToSessionHigh",
            label: "BB(20,2) top close to session high",
            passed: true,
            value: "gap 0.046% (BB top 110.01 vs high 110.05)",
            threshold: "<= 0.3%",
          },
        ],
      },
    });

    expect(reasons).toContain("Sideways trend in 09:15–12:00 IST session");
    expect(reasons).toContain(
      "BB(20,2) top close to session high: gap 0.046% (BB top 110.01 vs high 110.05)",
    );
    expect(reasons).toContain("Price near BB top range");
  });
});
