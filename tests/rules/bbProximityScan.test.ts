import { describe, expect, it } from "vitest";
import {
  buildBbProximityReasons,
  scanBbProximity,
} from "../../src/rules/bbProximityScan.js";
import type { IndicatorSnapshot } from "../../src/types.js";

function istTimestamp(hour: number, minute: number): Date {
  return new Date(`2026-06-18T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`);
}

function snapshot(
  hour: number,
  minute: number,
  close: number,
  high: number,
  low: number,
  upper: number,
  lower: number,
  open?: number,
): IndicatorSnapshot {
  return {
    timestamp: istTimestamp(hour, minute),
    open: open ?? close - 0.1,
    high,
    low,
    close,
    bollinger: { upper, middle: close, lower },
    rsi: 50,
    macd: { macdLine: 0, signalLine: 0, histogram: 0 },
  };
}

describe("scanBbProximity", () => {
  it("finds candles where BB upper is near candle high and BB lower near candle low", () => {
    const snapshots = [
      snapshot(9, 15, 109, 109.05, 108.95, 109.05, 108.95),
      snapshot(10, 30, 109.02, 109.04, 108.9, 109.04, 108.91),
      snapshot(11, 15, 109.03, 108.91, 108.85, 109.0, 108.86),
      snapshot(14, 0, 109.5, 109.8, 109.2, 110, 109),
    ];

    const report = scanBbProximity(snapshots, "2026-06-18");

    expect(report).not.toBeNull();
    expect(report?.topMatches.map((match) => match.timeIst)).toEqual([
      "09:15",
      "10:30",
      "11:15",
      "14:00",
    ]);
    expect(report?.topMatches[0].matchType).toBe("crossed");
    expect(report?.bottomMatches.find((match) => match.timeIst === "11:15")?.price).toBeCloseTo(
      108.85,
      2,
    );
  });

  it("detects BB upper crossed by candle high even when not within close threshold", () => {
    const snapshots = [
      snapshot(11, 0, 108.68, 108.74, 108.5, 108.47, 108.2),
    ];

    const report = scanBbProximity(snapshots, "2026-06-18");
    const match = report?.topMatches[0];

    expect(match?.timeIst).toBe("11:00");
    expect(match?.matchType).toBe("crossed");
    expect(match?.price).toBeCloseTo(108.74, 2);
    expect(match?.bbLevel).toBeCloseTo(108.47, 2);
  });

  it("detects BB lower crossed by candle low", () => {
    const snapshots = [
      snapshot(10, 0, 109, 109.5, 108.0, 109.5, 108.2),
    ];

    const report = scanBbProximity(snapshots, "2026-06-18");
    const match = report?.bottomMatches[0];

    expect(match?.matchType).toBe("crossed");
    expect(match?.price).toBeCloseTo(108.0, 2);
  });

  it("marks session extreme candles", () => {
    const snapshots = [
      snapshot(9, 15, 109, 109.05, 108.95, 109.05, 108.95),
      snapshot(10, 0, 109.2, 109.6, 109.0, 109.58, 109.02),
    ];

    const report = scanBbProximity(snapshots, "2026-06-18");

    expect(report?.topMatches.find((match) => match.timeIst === "10:00")?.isSessionExtreme).toBe(
      true,
    );
    expect(report?.topMatches.find((match) => match.timeIst === "10:00")?.matchType).toBe(
      "crossed",
    );
  });

  it("builds human-readable reasons for close and crossed matches", () => {
    const report = scanBbProximity(
      [
        snapshot(10, 30, 109.02, 109.0, 108.9, 109.04, 108.91),
        snapshot(11, 0, 108.68, 108.74, 108.5, 108.47, 108.2),
      ],
      "2026-06-18",
    );
    const reasons = buildBbProximityReasons(report);

    expect(reasons.some((reason) => reason.includes("close to candle high"))).toBe(true);
    expect(reasons.some((reason) => reason.includes("crossed"))).toBe(true);
    expect(reasons.every((reason) => reason.includes("candle ·"))).toBe(true);
  });

  it("includes candle color and explicit BB fields on each match", () => {
    const snapshots = [
      snapshot(9, 15, 109, 109.05, 108.95, 109.05, 108.95, 108.5),
      snapshot(10, 0, 109, 109.5, 108.0, 109.5, 108.2, 109.5),
    ];

    const report = scanBbProximity(snapshots, "2026-06-18");
    const bullish = report?.topMatches.find((match) => match.timeIst === "09:15");
    const bearish = report?.bottomMatches.find((match) => match.timeIst === "10:00");

    expect(bullish?.candleColor).toBe("green");
    expect(bullish?.high).toBeCloseTo(109.05, 2);
    expect(bullish?.low).toBeCloseTo(108.95, 2);
    expect(bullish?.bbUpper).toBeCloseTo(109.05, 2);
    expect(bullish?.bbLower).toBeCloseTo(108.95, 2);

    expect(bearish?.candleColor).toBe("red");
    expect(bearish?.high).toBeCloseTo(109.5, 2);
    expect(bearish?.low).toBeCloseTo(108.0, 2);
    expect(bearish?.bbUpper).toBeCloseTo(109.5, 2);
    expect(bearish?.bbLower).toBeCloseTo(108.2, 2);
  });
});
