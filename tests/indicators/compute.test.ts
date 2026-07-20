import { describe, expect, it } from "vitest";
import {
  buildIndicatorSnapshots,
  computeBollingerBands,
  computeMacd,
  computeRsi,
  linearSlope,
} from "../../src/indicators/compute.js";
import type { Candle } from "../../src/types.js";

function makeCandles(closes: number[]): Candle[] {
  return closes.map((close, index) => ({
    timestamp: new Date(Date.UTC(2026, 0, 1, 9, 15 * index)),
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000 + index,
  }));
}

describe("compute indicators", () => {
  it("computes bollinger bands with SMA(20) and stdev 2", () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i * 0.1);
    const bands = computeBollingerBands(closes);

    expect(Number.isFinite(bands[24].middle)).toBe(true);
    expect(bands[24].upper).toBeGreaterThan(bands[24].middle);
    expect(bands[24].lower).toBeLessThan(bands[24].middle);
  });

  it("computes RSI in valid range", () => {
    const closes = [44, 44.5, 45, 44.8, 45.2, 45.5, 45.1, 45.8, 46, 45.9, 46.2, 46.5, 46.1, 46.8, 47];
    const rsi = computeRsi(closes);
    const latest = rsi[rsi.length - 1];

    expect(latest).toBeGreaterThan(0);
    expect(latest).toBeLessThan(100);
  });

  it("computes MACD line, signal, and histogram", () => {
    const closes = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 3));
    const macd = computeMacd(closes);
    const latest = macd[macd.length - 1];

    expect(Number.isFinite(latest.macdLine)).toBe(true);
    expect(Number.isFinite(latest.signalLine)).toBe(true);
    expect(latest.histogram).toBeCloseTo(latest.macdLine - latest.signalLine, 5);
  });

  it("builds indicator snapshots from candles", () => {
    const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 90 + i * 0.2));
    const snapshots = buildIndicatorSnapshots(candles);

    expect(snapshots).toHaveLength(60);
    expect(snapshots[59].high).toBe(candles[59].high);
    expect(snapshots[59].low).toBe(candles[59].low);
    expect(Number.isFinite(snapshots[59].rsi)).toBe(true);
  });

  it("calculates linear slope", () => {
    const slope = linearSlope([10, 11, 12, 13, 14], 5);
    expect(slope).toBeCloseTo(1, 5);
  });
});
