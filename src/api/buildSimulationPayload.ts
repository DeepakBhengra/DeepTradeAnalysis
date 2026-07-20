import type { DashboardSymbolConfig } from "../config.js";
import type { Candle } from "../types.js";
import {
  formatIstTime,
  isWithinAnalysisDayDisplay,
} from "../utils/marketTime.js";
import {
  buildDashboardPayloadFromData,
  type DashboardPayload,
} from "./buildDashboardPayload.js";

export interface SimulationMeta {
  sessionIndex: number;
  sessionCandleCount: number;
  simulatedTimeIst: string;
}

export type SimulationDashboardPayload = DashboardPayload & {
  mode: "simulation";
  simulation: SimulationMeta;
};

export function getSessionCandles(
  candles: Candle[],
  analysisDate: string,
): Candle[] {
  return candles.filter((candle) =>
    isWithinAnalysisDayDisplay(candle.timestamp, analysisDate),
  );
}

export function truncateCandlesForSessionIndex(
  candles: Candle[],
  analysisDate: string,
  sessionIndex: number,
): Candle[] {
  const sessionCandles = getSessionCandles(candles, analysisDate);
  const warmupCandles = candles.filter(
    (candle) => !isWithinAnalysisDayDisplay(candle.timestamp, analysisDate),
  );
  const visibleSession = sessionCandles.slice(0, sessionIndex + 1);
  return [...warmupCandles, ...visibleSession];
}

export function buildSimulationPayloadFromCandles(input: {
  candles: Candle[];
  analysisDate: string;
  sessionIndex: number;
  dashboardSymbol: DashboardSymbolConfig;
}): SimulationDashboardPayload {
  const { candles, analysisDate, sessionIndex, dashboardSymbol } = input;
  const sessionCandles = getSessionCandles(candles, analysisDate);
  const truncated = truncateCandlesForSessionIndex(
    candles,
    analysisDate,
    sessionIndex,
  );
  const latestSessionCandle = sessionCandles[sessionIndex];

  const payload = buildDashboardPayloadFromData({
    candles: truncated,
    analysisDate,
    latestClosedAt: latestSessionCandle?.timestamp,
    dashboardSymbol,
  });

  return {
    ...payload,
    mode: "simulation",
    depth: null,
    simulation: {
      sessionIndex,
      sessionCandleCount: sessionCandles.length,
      simulatedTimeIst: latestSessionCandle
        ? formatIstTime(latestSessionCandle.timestamp)
        : "09:15",
    },
  };
}
