import { config, resolveDashboardSymbol } from "../config.js";
import { fetchPnbCandles, getLatestClosedCandle } from "../data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../indicators/compute.js";
import {
  evaluateDeepak2Decision,
  evaluateDeepakDecision,
} from "../rules/deepakDecision.js";
import {
  SECTOR_WATCHLIST,
  type SectorWatchlistEntry,
} from "../symbols/sectorWatchlist.js";
import { buildSectorRandomizedWatchlist } from "../symbols/sectorWatchlistOrder.js";
import type { DeepakDecisionResult } from "../types.js";
import { formatUnknownError } from "../utils/formatError.js";
import { formatIstTime, getIstTimeParts } from "../utils/marketTime.js";

const CONCURRENCY = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface SamcoSymbolScanResult {
  tradingSymbol: string;
  sector: string;
  exchange: string;
  latestClosedAt?: Date;
  latestCandleTimeIst: string;
  deepak: DeepakDecisionResult | null;
  deepak2: DeepakDecisionResult | null;
  error?: string;
}

export interface SamcoDayScanCycleResult {
  dateKey: string;
  symbols: SamcoSymbolScanResult[];
  errors: Array<{ tradingSymbol: string; sector: string; error: string }>;
}

async function scanSymbol(
  entry: SectorWatchlistEntry,
  dateKey: string,
): Promise<SamcoSymbolScanResult> {
  const base = {
    tradingSymbol: entry.tradingSymbol,
    sector: entry.sector,
    exchange: config.exchange,
  };

  try {
    const dashboardSymbol = resolveDashboardSymbol(entry.tradingSymbol);
    const candles = await fetchPnbCandles({
      symbol: dashboardSymbol.tradingSymbol,
      exchange: dashboardSymbol.exchange,
      segment: dashboardSymbol.segment,
      fromDate: dateKey,
      toDate: dateKey,
    });

    const latestClosed = getLatestClosedCandle(candles);
    if (!latestClosed) {
      return {
        ...base,
        exchange: dashboardSymbol.exchange,
        latestCandleTimeIst: "",
        deepak: null,
        deepak2: null,
      };
    }

    const closedCandles = candles.filter(
      (candle) => candle.timestamp.getTime() <= latestClosed.timestamp.getTime(),
    );
    const snapshots = buildIndicatorSnapshots(closedCandles);
    const deepak = evaluateDeepakDecision(snapshots, dateKey);
    const deepak2 = evaluateDeepak2Decision(snapshots, dateKey);

    return {
      ...base,
      exchange: dashboardSymbol.exchange,
      latestClosedAt: latestClosed.timestamp,
      latestCandleTimeIst: formatIstTime(latestClosed.timestamp),
      deepak,
      deepak2,
    };
  } catch (error) {
    return {
      ...base,
      latestCandleTimeIst: "",
      deepak: null,
      deepak2: null,
      error: formatUnknownError(error),
    };
  }
}

export async function runSamcoDayScanCycle(
  dateKey?: string,
): Promise<SamcoDayScanCycleResult> {
  const resolvedDateKey = dateKey ?? getIstTimeParts(new Date()).dateKey;
  const symbols: SamcoSymbolScanResult[] = [];
  const errors: SamcoDayScanCycleResult["errors"] = [];
  const scanOrder = buildSectorRandomizedWatchlist();

  for (let index = 0; index < scanOrder.length; index += CONCURRENCY) {
    const batch = scanOrder.slice(index, index + CONCURRENCY);
    const results = await Promise.all(
      batch.map((entry) => scanSymbol(entry, resolvedDateKey)),
    );

    for (const result of results) {
      symbols.push(result);
      if (result.error) {
        errors.push({
          tradingSymbol: result.tradingSymbol,
          sector: result.sector,
          error: result.error,
        });
      }
    }

    if (index + CONCURRENCY < scanOrder.length) {
      await delay(config.symbolBatchDelayMs);
    }
  }

  return { dateKey: resolvedDateKey, symbols, errors };
}
