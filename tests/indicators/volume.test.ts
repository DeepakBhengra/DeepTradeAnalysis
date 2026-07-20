import { describe, expect, it } from "vitest";
import {
  computeRelativeVolume,
  computeVolumeDirection,
  computeVolumeSma,
} from "../../src/indicators/volume.js";
import type { Candle } from "../../src/types.js";

function makeCandle(
  index: number,
  close: number,
  open: number,
  volume: number,
): Candle {
  return {
    timestamp: new Date(`2026-06-19T10:${String(index).padStart(2, "0")}:00+05:30`),
    open,
    high: Math.max(open, close) + 0.5,
    low: Math.min(open, close) - 0.5,
    close,
    volume,
  };
}

describe("volume indicators", () => {
  it("computes volume SMA", () => {
    const volumes = Array.from({ length: 25 }, (_, index) => 1000 + index * 10);
    const sma = computeVolumeSma(volumes, 20);

    expect(sma.slice(0, 19).every((value) => Number.isNaN(value))).toBe(true);
    expect(sma[19]).toBeCloseTo(
      volumes.slice(0, 20).reduce((sum, value) => sum + value, 0) / 20,
    );
  });

  it("computes relative volume", () => {
    expect(computeRelativeVolume(1500, 1000)).toBe(1.5);
    expect(computeRelativeVolume(500, 1000)).toBe(0.5);
    expect(Number.isNaN(computeRelativeVolume(500, 0))).toBe(true);
  });

  it("detects bullish volume direction", () => {
    const candles = [
      makeCandle(0, 101, 100, 1000),
      makeCandle(1, 102, 101, 1200),
      makeCandle(2, 103, 102, 1500),
      makeCandle(3, 99, 103, 200),
      makeCandle(4, 104, 103, 1800),
    ];

    expect(computeVolumeDirection(candles, 5)).toBe("bullish");
  });

  it("detects bearish volume direction", () => {
    const candles = [
      makeCandle(0, 99, 100, 1500),
      makeCandle(1, 98, 99, 1600),
      makeCandle(2, 97, 98, 1700),
      makeCandle(3, 101, 100, 200),
      makeCandle(4, 96, 97, 1800),
    ];

    expect(computeVolumeDirection(candles, 5)).toBe("bearish");
  });
});
