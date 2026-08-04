import {
  config,
  DAY_SCAN_SIMULATION,
  resolveDashboardSymbol,
  type DashboardSymbolConfig,
} from "../config.js";
import { fetchPnbCandles } from "../data/pnbFeed.js";
import {
  SECTOR_WATCHLIST,
  type SectorWatchlistEntry,
} from "../symbols/sectorWatchlist.js";
import { formatUnknownError } from "../utils/formatError.js";
import type { Candle, DayScanSimulationPayload } from "../types.js";
import { isWithinAnalysisDayDisplay } from "../utils/marketTime.js";

const CONCURRENCY = config.dayScanConcurrency;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function frameKey(date: string, variant: string, sessionIndex: number): string {
  return `${date}:${variant}:${sessionIndex}`;
}

export function getDayScanSessionCandles(
  candles: Candle[],
  analysisDate: string,
): Candle[] {
  return candles.filter((candle) =>
    isWithinAnalysisDayDisplay(
      candle.timestamp,
      analysisDate,
      DAY_SCAN_SIMULATION.sessionStart,
      DAY_SCAN_SIMULATION.sessionEnd,
    ),
  );
}

export function truncateDayScanCandlesForIndex(
  candles: Candle[],
  analysisDate: string,
  sessionIndex: number,
  sessionCandles?: Candle[],
): Candle[] {
  const resolvedSession =
    sessionCandles ?? getDayScanSessionCandles(candles, analysisDate);
  const warmupCandles = candles.filter(
    (candle) => !isWithinAnalysisDayDisplay(candle.timestamp, analysisDate),
  );
  const visibleSession = resolvedSession.slice(0, sessionIndex + 1);
  return [...warmupCandles, ...visibleSession];
}

export class DayScanSimulationCache {
  private candlesByDate = new Map<string, Map<string, Candle[]>>();
  private sessionCandlesByDate = new Map<string, Map<string, Candle[]>>();
  private resolvedSymbolsByDate = new Map<string, Map<string, DashboardSymbolConfig>>();
  private errorsByDate = new Map<string, Map<string, string>>();
  /** Frames keyed by date → variant → sessionIndex */
  private framesByDate = new Map<
    string,
    Map<string, Map<number, DayScanSimulationPayload>>
  >();
  private computingFrames = new Map<string, Promise<DayScanSimulationPayload>>();
  private prefetchingDates = new Set<string>();

  async prefetch(date: string): Promise<void> {
    if (this.candlesByDate.has(date) && this.getSessionCandleCount(date) > 0) {
      return;
    }

    if (this.prefetchingDates.has(date)) {
      await this.waitForPrefetch(date);
      return this.prefetch(date);
    }

    if (this.candlesByDate.has(date)) {
      this.clearDate(date);
    }

    this.prefetchingDates.add(date);
    const symbolCandles = new Map<string, Candle[]>();
    const sessionCandlesMemo = new Map<string, Candle[]>();
    const resolvedSymbolsMemo = new Map<string, DashboardSymbolConfig>();
    const symbolErrors = new Map<string, string>();

    try {
      for (let index = 0; index < SECTOR_WATCHLIST.length; index += CONCURRENCY) {
        const batch = SECTOR_WATCHLIST.slice(index, index + CONCURRENCY);
        const results = await Promise.all(
          batch.map((entry) => this.fetchSymbol(entry, date)),
        );

        for (const result of results) {
          if (result.error) {
            symbolErrors.set(result.tradingSymbol, result.error);
          } else {
            symbolCandles.set(result.tradingSymbol, result.candles);
            sessionCandlesMemo.set(
              result.tradingSymbol,
              getDayScanSessionCandles(result.candles, date),
            );
            resolvedSymbolsMemo.set(
              result.tradingSymbol,
              resolveDashboardSymbol(result.tradingSymbol),
            );
          }
        }

        if (index + CONCURRENCY < SECTOR_WATCHLIST.length) {
          await delay(config.symbolBatchDelayMs);
        }
      }

      this.candlesByDate.set(date, symbolCandles);
      this.sessionCandlesByDate.set(date, sessionCandlesMemo);
      this.resolvedSymbolsByDate.set(date, resolvedSymbolsMemo);
      this.errorsByDate.set(date, symbolErrors);
    } finally {
      this.prefetchingDates.delete(date);
    }
  }

  getFrame(
    date: string,
    variant: string,
    sessionIndex: number,
  ): DayScanSimulationPayload | undefined {
    return this.framesByDate.get(date)?.get(variant)?.get(sessionIndex);
  }

  setFrame(
    date: string,
    variant: string,
    sessionIndex: number,
    payload: DayScanSimulationPayload,
  ): void {
    if (!this.framesByDate.has(date)) {
      this.framesByDate.set(date, new Map());
    }
    const byVariant = this.framesByDate.get(date)!;
    if (!byVariant.has(variant)) {
      byVariant.set(variant, new Map());
    }
    byVariant.get(variant)!.set(sessionIndex, payload);
  }

  async getOrBuildFrame(
    date: string,
    variant: string,
    sessionIndex: number,
    build: () => Promise<DayScanSimulationPayload>,
  ): Promise<DayScanSimulationPayload> {
    const cached = this.getFrame(date, variant, sessionIndex);
    if (cached) {
      return cached;
    }

    const key = frameKey(date, variant, sessionIndex);
    const inFlight = this.computingFrames.get(key);
    if (inFlight) {
      return inFlight;
    }

    const promise = build()
      .then((payload) => {
        this.setFrame(date, variant, sessionIndex, payload);
        this.computingFrames.delete(key);
        return payload;
      })
      .catch((error) => {
        this.computingFrames.delete(key);
        throw error;
      });

    this.computingFrames.set(key, promise);
    return promise;
  }

  ensureFrameCached(
    date: string,
    variant: string,
    sessionIndex: number,
    build: () => Promise<DayScanSimulationPayload>,
  ): void {
    if (sessionIndex < 0 || sessionIndex >= this.getSessionCandleCount(date)) {
      return;
    }

    if (this.getFrame(date, variant, sessionIndex) != null) {
      return;
    }

    const key = frameKey(date, variant, sessionIndex);
    if (this.computingFrames.has(key)) {
      return;
    }

    void this.getOrBuildFrame(date, variant, sessionIndex, build).catch(() => {
      // Precompute failures are non-fatal; the next request will retry.
    });
  }

  getCandles(date: string, tradingSymbol: string): Candle[] | undefined {
    return this.candlesByDate.get(date)?.get(tradingSymbol);
  }

  getSessionCandlesForSymbol(
    date: string,
    tradingSymbol: string,
  ): Candle[] | undefined {
    return this.sessionCandlesByDate.get(date)?.get(tradingSymbol);
  }

  getResolvedSymbol(
    date: string,
    tradingSymbol: string,
  ): DashboardSymbolConfig | undefined {
    return this.resolvedSymbolsByDate.get(date)?.get(tradingSymbol);
  }

  getSymbolError(date: string, tradingSymbol: string): string | undefined {
    return this.errorsByDate.get(date)?.get(tradingSymbol);
  }

  getPrefetchErrorSummary(date: string): string | null {
    const symbolErrors = this.errorsByDate.get(date);
    const symbolCandles = this.candlesByDate.get(date);

    if (!symbolErrors && !symbolCandles) {
      return null;
    }

    const errors = symbolErrors ? [...symbolErrors.values()] : [];
    const successCount = symbolCandles?.size ?? 0;
    const watchlistSize = SECTOR_WATCHLIST.length;

    if (errors.length === 0 && successCount === 0) {
      return `No market data returned for ${date}. Choose a past NSE trading session.`;
    }

    if (errors.length === 0) {
      return `No 09:15–15:00 IST session candles found for ${date}. The date may be a market holiday or missing intraday data.`;
    }

    const uniqueErrors = [...new Set(errors)];
    const leadError = uniqueErrors[0] ?? "Unknown fetch error.";

    if (errors.length === watchlistSize && uniqueErrors.length === 1) {
      return leadError;
    }

    const examples = uniqueErrors.slice(0, 2).join(" · ");
    return `No session candles found for ${date}. ${errors.length}/${watchlistSize} symbols failed (${successCount} loaded). ${examples}`;
  }

  getSessionCandleCount(date: string): number {
    const sessionCandlesBySymbol = this.sessionCandlesByDate.get(date);
    if (sessionCandlesBySymbol) {
      for (const sessionCandles of sessionCandlesBySymbol.values()) {
        if (sessionCandles.length > 0) {
          return sessionCandles.length;
        }
      }
    }

    const symbolCandles = this.candlesByDate.get(date);
    if (!symbolCandles) {
      return 0;
    }

    for (const candles of symbolCandles.values()) {
      const sessionCandles = getDayScanSessionCandles(candles, date);
      if (sessionCandles.length > 0) {
        return sessionCandles.length;
      }
    }

    return 0;
  }

  getWatchlist(): SectorWatchlistEntry[] {
    return SECTOR_WATCHLIST;
  }

  clearDate(date: string): void {
    this.candlesByDate.delete(date);
    this.sessionCandlesByDate.delete(date);
    this.resolvedSymbolsByDate.delete(date);
    this.errorsByDate.delete(date);
    this.framesByDate.delete(date);

    for (const key of [...this.computingFrames.keys()]) {
      if (key.startsWith(`${date}:`)) {
        this.computingFrames.delete(key);
      }
    }
  }

  clear(): void {
    this.candlesByDate.clear();
    this.sessionCandlesByDate.clear();
    this.resolvedSymbolsByDate.clear();
    this.errorsByDate.clear();
    this.framesByDate.clear();
    this.computingFrames.clear();
  }

  private async fetchSymbol(
    entry: SectorWatchlistEntry,
    date: string,
  ): Promise<{
    tradingSymbol: string;
    candles: Candle[];
    error: string | null;
  }> {
    try {
      const dashboardSymbol = resolveDashboardSymbol(entry.tradingSymbol);
      const candles = await fetchPnbCandles({
        symbol: dashboardSymbol.tradingSymbol,
        exchange: dashboardSymbol.exchange,
        segment: dashboardSymbol.segment,
        analysisDate: date,
      });

      return {
        tradingSymbol: entry.tradingSymbol,
        candles,
        error: null,
      };
    } catch (error) {
      const message = formatUnknownError(error);
      return {
        tradingSymbol: entry.tradingSymbol,
        candles: [],
        error: message,
      };
    }
  }

  private waitForPrefetch(date: string): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (!this.prefetchingDates.has(date)) {
          resolve();
          return;
        }
        setTimeout(check, 50);
      };
      check();
    });
  }
}
