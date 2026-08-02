import { describe, expect, it } from "vitest";
import { buildIndicatorSnapshots } from "../../src/indicators/compute.js";
import { evaluateDeepproSignals } from "../../src/rules/deepproDecision.js";
import type { Candle } from "../../src/types.js";

function istCandle(
  dateKey: string,
  hour: number,
  minute: number,
  open: number,
  high: number,
  low: number,
  close: number,
): Candle {
  const timestamp = new Date(
    `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`,
  );
  return {
    timestamp,
    open,
    high,
    low,
    close,
    volume: 10_000,
  };
}

function buildRisingThenDumpDay(dateKey: string): Candle[] {
  const candles: Candle[] = [];
  // Warmup days before analysis date
  for (let d = 0; d < 5; d++) {
    const day = `2026-07-${String(20 + d).padStart(2, "0")}`;
    for (let c = 0; c < 25; c++) {
      const minutes = 9 * 60 + 15 + c * 15;
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      if (hour > 15 || (hour === 15 && minute > 15)) {
        continue;
      }
      const base = 1900 + d * 5 + c * 0.4;
      candles.push(istCandle(day, hour, minute, base, base + 2, base - 1, base + 0.5));
    }
  }

  // Analysis day: grind into upper band, deep OB, then stall/dump
  const times = [
    [9, 15], [9, 30], [9, 45], [10, 0], [10, 15], [10, 30], [10, 45],
    [11, 0], [11, 15], [11, 30], [11, 45], [12, 0], [12, 15], [12, 30],
    [12, 45], [13, 0], [13, 15], [13, 30], [13, 45], [14, 0], [14, 15],
    [14, 30], [14, 45], [15, 0], [15, 15],
  ] as const;

  let price = 2000;
  for (let i = 0; i < times.length; i++) {
    const [hour, minute] = times[i];
    if (i <= 16) {
      // push higher into overbought / upper BB
      const open = price;
      const close = price + 3.5;
      candles.push(
        istCandle(dateKey, hour, minute, open, close + 1.5, open - 0.5, close),
      );
      price = close;
    } else if (i === 17) {
      // cross / rollover bar
      const open = price;
      const close = price - 1;
      candles.push(
        istCandle(dateKey, hour, minute, open, open + 1, close - 0.5, close),
      );
      price = close;
    } else if (i === 18 || i === 19) {
      // stall / doji near highs
      candles.push(
        istCandle(dateKey, hour, minute, price, price + 0.4, price - 1.2, price + 0.05),
      );
    } else {
      // dump
      const open = price;
      const close = price - 18;
      candles.push(
        istCandle(dateKey, hour, minute, open, open + 1, close - 5, close),
      );
      price = close;
    }
  }

  return candles;
}

describe("evaluateDeepproSignals", () => {
  it("detects a deeppro SELL on Stch Mtm bearish cross from deep overbought", () => {
    const dateKey = "2026-07-25";
    const candles = buildRisingThenDumpDay(dateKey);
    const snapshots = buildIndicatorSnapshots(candles);
    const result = evaluateDeepproSignals(snapshots, dateKey);

    expect(result.rule).toBe("deeppro");
    expect(result.signals.length).toBeGreaterThanOrEqual(1);
    expect(result.signals[0].side).toBe("SELL");
    expect(result.signals[0].peakSmi).toBeGreaterThanOrEqual(70);
    expect(result.signals[0].timeIst).toMatch(/^\d{2}:\d{2}$/);
  });

  it("returns no signals on a quiet sideways day", () => {
    const dateKey = "2026-07-25";
    const candles: Candle[] = [];
    for (let d = 0; d < 6; d++) {
      const day = d < 5 ? `2026-07-${String(20 + d).padStart(2, "0")}` : dateKey;
      for (let c = 0; c < 20; c++) {
        const minutes = 9 * 60 + 15 + c * 15;
        const hour = Math.floor(minutes / 60);
        const minute = minutes % 60;
        const base = 1950 + Math.sin(c / 2) * 0.4;
        candles.push(istCandle(day, hour, minute, base, base + 0.3, base - 0.3, base));
      }
    }

    const snapshots = buildIndicatorSnapshots(candles);
    const result = evaluateDeepproSignals(snapshots, dateKey);
    expect(result.signals).toHaveLength(0);
  });
});
