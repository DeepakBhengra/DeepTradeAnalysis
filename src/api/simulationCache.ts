import type { DashboardSymbolConfig } from "../config.js";
import { fetchPnbCandles } from "../data/pnbFeed.js";
import type { Candle } from "../types.js";
import {
  buildSimulationPayloadFromCandles,
  getSessionCandles,
  type SimulationDashboardPayload,
} from "./buildSimulationPayload.js";

function cacheKey(symbolId: string, analysisDate: string): string {
  return `${symbolId}:${analysisDate}`;
}

export class SimulationCache {
  private candles = new Map<string, Candle[]>();
  private fetchingKeys = new Set<string>();

  async getCandles(
    dashboardSymbol: DashboardSymbolConfig,
    analysisDate: string,
  ): Promise<Candle[]> {
    const key = cacheKey(dashboardSymbol.id, analysisDate);

    if (!this.candles.has(key)) {
      if (this.fetchingKeys.has(key)) {
        await this.waitForFetch(key);
        return this.candles.get(key) ?? [];
      }

      this.fetchingKeys.add(key);
      try {
        const fetched = await fetchPnbCandles({
          symbol: dashboardSymbol.tradingSymbol,
          exchange: dashboardSymbol.exchange,
          segment: dashboardSymbol.segment,
          analysisDate,
        });
        this.candles.set(key, fetched);
        return fetched;
      } finally {
        this.fetchingKeys.delete(key);
      }
    }

    return this.candles.get(key) ?? [];
  }

  async getPayload(
    dashboardSymbol: DashboardSymbolConfig,
    analysisDate: string,
    sessionIndex: number,
  ): Promise<SimulationDashboardPayload> {
    const candles = await this.getCandles(dashboardSymbol, analysisDate);
    const sessionCandles = getSessionCandles(candles, analysisDate);

    if (sessionCandles.length === 0) {
      throw new Error(`No session candles found for ${analysisDate}.`);
    }

    if (sessionIndex < 0 || sessionIndex >= sessionCandles.length) {
      throw new RangeError(
        `sessionIndex ${sessionIndex} out of range (0–${sessionCandles.length - 1}).`,
      );
    }

    return buildSimulationPayloadFromCandles({
      candles,
      analysisDate,
      sessionIndex,
      dashboardSymbol,
    });
  }

  getSessionCandleCount(
    dashboardSymbol: DashboardSymbolConfig,
    analysisDate: string,
  ): number | undefined {
    const key = cacheKey(dashboardSymbol.id, analysisDate);
    const candles = this.candles.get(key);
    if (!candles) {
      return undefined;
    }
    return getSessionCandles(candles, analysisDate).length;
  }

  clear(): void {
    this.candles.clear();
  }

  private waitForFetch(key: string): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (!this.fetchingKeys.has(key)) {
          resolve();
          return;
        }
        setTimeout(check, 50);
      };
      check();
    });
  }
}
