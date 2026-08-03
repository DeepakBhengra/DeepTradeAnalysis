import { describe, expect, it } from "vitest";
import { computeStochasticMomentum } from "../../src/indicators/stochasticMomentum.js";

describe("computeStochasticMomentum", () => {
  it("returns finite SMI/signal after warmup and keeps early bars NaN", () => {
    const closes = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 2) * 3 + i * 0.05);
    const highs = closes.map((close, i) => close + 1 + (i % 3) * 0.2);
    const lows = closes.map((close, i) => close - 1 - (i % 2) * 0.2);

    const values = computeStochasticMomentum(highs, lows, closes, 10, 3, 10);

    expect(values).toHaveLength(40);
    expect(Number.isNaN(values[0].smi)).toBe(true);
    expect(Number.isFinite(values[39].smi)).toBe(true);
    expect(Number.isFinite(values[39].signal)).toBe(true);
    expect(values[39].smi).toBeGreaterThanOrEqual(-100);
    expect(values[39].smi).toBeLessThanOrEqual(100);
  });

  it("turns lower after a sharp selloff from highs", () => {
    const closes = [
      ...Array.from({ length: 20 }, (_, i) => 100 + i),
      118, 115, 110, 105, 100, 96, 93, 90,
    ];
    const highs = closes.map((close) => close + 1);
    const lows = closes.map((close) => close - 1);
    const values = computeStochasticMomentum(highs, lows, closes, 10, 3, 10);

    const peakIdx = 20;
    const lateIdx = values.length - 1;
    expect(values[peakIdx].smi).toBeGreaterThan(values[lateIdx].smi);
  });
});
