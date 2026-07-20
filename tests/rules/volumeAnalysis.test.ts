import { describe, expect, it } from "vitest";
import { evaluateVolumeAnalysis } from "../../src/rules/volumeAnalysis.js";
import type { Candle } from "../../src/types.js";

function makeCandles(volumes: number[], closes?: number[]): Candle[] {
  return volumes.map((volume, index) => {
    const close = closes?.[index] ?? 100 + index * 0.1;
    const open = close - 0.2;
    return {
      timestamp: new Date(`2026-06-17T${String(9 + Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}:00+05:30`),
      open,
      high: close + 0.5,
      low: close - 0.5,
      close,
      volume,
    };
  });
}

describe("evaluateVolumeAnalysis", () => {
  it("flags high relative volume on bullish candle", () => {
    const baseVolumes = Array.from({ length: 19 }, () => 1000);
    const candles = makeCandles(
      [...baseVolumes, 2000],
      [...Array.from({ length: 19 }, (_, i) => 100 + i * 0.1), 110],
    );
    candles[candles.length - 1].open = 109;
    candles[candles.length - 1].close = 110;

    const result = evaluateVolumeAnalysis(candles);

    expect(result).not.toBeNull();
    expect(result?.flags.highRvol).toBe(true);
    expect(result?.flags.volumeConfirmsBuy).toBe(true);
    expect(result?.reasons.some((reason) => reason.includes("elevated"))).toBe(true);
  });

  it("flags volume dry-up", () => {
    const baseVolumes = Array.from({ length: 19 }, () => 2000);
    const candles = makeCandles([...baseVolumes, 500]);

    const result = evaluateVolumeAnalysis(candles);

    expect(result).not.toBeNull();
    expect(result?.flags.volumeDryUp).toBe(true);
    expect(result?.flags.lowRvol).toBe(true);
  });

  it("returns null when insufficient candles", () => {
    const candles = makeCandles(Array.from({ length: 10 }, () => 1000));
    expect(evaluateVolumeAnalysis(candles)).toBeNull();
  });
});
