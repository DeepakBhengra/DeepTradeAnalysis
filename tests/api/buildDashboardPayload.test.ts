import { describe, expect, it } from "vitest";
import { buildDashboardPayloadFromData } from "../../src/api/buildDashboardPayload.js";
import type { Candle } from "../../src/types.js";

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

describe("buildDashboardPayload", () => {
  it("serializes historical dashboard payload for analysis date", () => {
    const sessionCloses = Array.from({ length: 15 }, (_, i) => 109 + i * 0.01);
    const candles = makeCandles(sessionCloses);
    const payload = buildDashboardPayloadFromData({
      candles,
      analysisDate: "2026-06-19",
      latestClosedAt: candles[candles.length - 1].timestamp,
    });

    expect(payload.symbol).toBe("NSE:PNB");
    expect(payload.interval).toBe("15m");
    expect(payload.mode).toBe("historical");
    expect(payload.analysisDate).toBe("2026-06-19");
    expect(payload.series.length).toBeGreaterThan(0);
    expect(payload.series[0].time).toBeTypeOf("number");
    expect(["BUY", "SELL", "HOLD"]).toContain(payload.decision);
    expect(payload.sidewaysTrend).not.toBeNull();
    expect(payload.sidewaysTrend?.sessionDate).toBe("2026-06-19");
    expect(payload.sidewaysTrend?.bbTopRange).toBeTypeOf("number");
    expect(payload.sidewaysTrend?.parameters).not.toBeNull();
    expect(payload.sidewaysDebug).not.toBeNull();
    expect(payload.sidewaysDebug?.targetDateKey).toBe("2026-06-19");
    expect(payload.sidewaysDebug?.usableSessionCount).toBeGreaterThanOrEqual(3);
    expect(payload.confidence).not.toBeNull();
    expect(payload.volumeFlags).not.toBeNull();
    expect(payload.depth).toBeNull();
    expect(payload.series[0].relVolume).toBeTypeOf("number");
  });

  it("serializes historical dashboard payload for June 18 backtest", () => {
    const sessionCloses = Array.from({ length: 15 }, (_, i) => 109 + i * 0.01);
    const candles = makeCandles(sessionCloses, "2026-06-18");
    const payload = buildDashboardPayloadFromData({
      candles,
      analysisDate: "2026-06-18",
      latestClosedAt: candles[candles.length - 1].timestamp,
    });

    expect(payload.mode).toBe("historical");
    expect(payload.analysisDate).toBe("2026-06-18");
    expect(payload.sidewaysTrend).not.toBeNull();
    expect(payload.sidewaysTrend?.sessionDate).toBe("2026-06-18");
    expect(payload.sidewaysDebug?.targetDateKey).toBe("2026-06-18");
    expect(payload.sidewaysDebug?.usableSessionCount).toBeGreaterThanOrEqual(3);
  });

  it("returns empty payload for no candles", () => {
    const payload = buildDashboardPayloadFromData({ candles: [] });

    expect(payload.series).toHaveLength(0);
    expect(payload.decision).toBe("HOLD");
    expect(payload.close).toBeNull();
    expect(payload.sidewaysTrend).toBeNull();
    expect(payload.sidewaysDebug).toBeNull();
    expect(payload.confidence).toBeNull();
    expect(payload.volumeFlags).toBeNull();
    expect(payload.depth).toBeNull();
  });

  it("serializes historical dashboard payload for NIFTY Bank", () => {
    const sessionCloses = Array.from({ length: 15 }, (_, i) => 52000 + i * 10);
    const candles = makeCandles(sessionCloses);
    const payload = buildDashboardPayloadFromData({
      candles,
      analysisDate: "2026-06-19",
      latestClosedAt: candles[candles.length - 1].timestamp,
      dashboardId: "niftyBank",
    });

    expect(payload.symbol).toBe("NSE:NIFTY BANK");
    expect(payload.mode).toBe("historical");
    expect(payload.analysisDate).toBe("2026-06-19");
    expect(payload.series.length).toBeGreaterThan(0);
  });

  it("serializes historical dashboard payload for dynamic equity symbol", () => {
    const sessionCloses = Array.from({ length: 15 }, (_, i) => 2500 + i * 2);
    const candles = makeCandles(sessionCloses);
    const payload = buildDashboardPayloadFromData({
      candles,
      analysisDate: "2026-06-19",
      latestClosedAt: candles[candles.length - 1].timestamp,
      dashboardSymbol: {
        id: "RELIANCE",
        symbol: "NSE:RELIANCE",
        tradingSymbol: "RELIANCE",
        exchange: "NSE",
        segment: "NSE",
      },
    });

    expect(payload.symbol).toBe("NSE:RELIANCE");
    expect(payload.mode).toBe("historical");
    expect(payload.series.length).toBeGreaterThan(0);
  });
});
