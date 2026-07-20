import { describe, expect, it } from "vitest";
import {
  buildSimulationPayloadFromCandles,
  getSessionCandles,
  truncateCandlesForSessionIndex,
} from "../../src/api/buildSimulationPayload.js";
import type { Candle } from "../../src/types.js";

const RELIANCE_SYMBOL = {
  id: "RELIANCE",
  symbol: "NSE:RELIANCE",
  tradingSymbol: "RELIANCE",
  exchange: "NSE",
  segment: "NSE",
} as const;

function makeCandles(closes: number[], sessionDate = "2026-06-19"): Candle[] {
  const warmup = Array.from({ length: 55 }, (_, index) => {
    const totalMinutes = 9 * 60 + 15 + index * 15;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const close = 100 + index * 0.05;

    return {
      timestamp: new Date(
        `2026-06-17T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`,
      ),
      open: close - 0.2,
      high: close + 0.5,
      low: close - 0.5,
      close,
      volume: 1000 + index,
    };
  });

  const sessionDay = closes.map((close, index) => {
    const totalMinutes = 9 * 60 + 15 + index * 15;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

    return {
      timestamp: new Date(
        `${sessionDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`,
      ),
      open: close - 0.2,
      high: close + 0.5,
      low: close - 0.5,
      close,
      volume: 2000 + index,
    };
  });

  return [...warmup, ...sessionDay];
}

describe("buildSimulationPayload", () => {
  const sessionCloses = Array.from({ length: 15 }, (_, i) => 109 + i * 0.01);
  const candles = makeCandles(sessionCloses);
  const analysisDate = "2026-06-19";

  it("sessionIndex=0 exposes one visible session candle at 09:15", () => {
    const payload = buildSimulationPayloadFromCandles({
      candles,
      analysisDate,
      sessionIndex: 0,
      dashboardSymbol: RELIANCE_SYMBOL,
    });

    expect(payload.mode).toBe("simulation");
    expect(payload.candleCount).toBe(1);
    expect(payload.series).toHaveLength(1);
    expect(payload.simulation.sessionIndex).toBe(0);
    expect(payload.simulation.simulatedTimeIst).toBe("09:15");
    expect(payload.simulation.sessionCandleCount).toBe(15);
    expect(payload.depth).toBeNull();
  });

  it("sessionIndex=2 exposes three visible session candles", () => {
    const payload = buildSimulationPayloadFromCandles({
      candles,
      analysisDate,
      sessionIndex: 2,
      dashboardSymbol: RELIANCE_SYMBOL,
    });

    expect(payload.candleCount).toBe(3);
    expect(payload.series).toHaveLength(3);
    expect(payload.simulation.sessionIndex).toBe(2);
    expect(payload.simulation.simulatedTimeIst).toBe("09:45");
  });

  it("recomputes close as session advances", () => {
    const atStart = buildSimulationPayloadFromCandles({
      candles,
      analysisDate,
      sessionIndex: 0,
      dashboardSymbol: RELIANCE_SYMBOL,
    });
    const atThird = buildSimulationPayloadFromCandles({
      candles,
      analysisDate,
      sessionIndex: 2,
      dashboardSymbol: RELIANCE_SYMBOL,
    });

    expect(atStart.close).not.toBe(atThird.close);
    expect(atStart.close).toBeCloseTo(109, 2);
    expect(atThird.close).toBeCloseTo(109.02, 2);
  });

  it("truncateCandlesForSessionIndex keeps warmup plus visible session slice", () => {
    const sessionCandles = getSessionCandles(candles, analysisDate);
    const truncated = truncateCandlesForSessionIndex(candles, analysisDate, 1);

    expect(sessionCandles).toHaveLength(15);
    expect(truncated.length).toBe(candles.length - sessionCandles.length + 2);
  });
});
