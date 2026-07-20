import { runDeepakBacktest } from "../backtest/runDeepakBacktest.js";
import { config, resolveDashboardSymbol } from "../config.js";
import { fetchPnbCandles } from "../data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../indicators/compute.js";
import {
  getSectorRank,
  SECTOR_WATCHLIST,
  type SectorName,
  type SectorWatchlistEntry,
} from "../symbols/sectorWatchlist.js";
import type {
  DeepakDayScanError,
  DeepakDayScanPayload,
  DeepakDayScanSummary,
  DeepakDayScanTrade,
} from "../types.js";
import { formatUnknownError } from "../utils/formatError.js";
import { isValidAnalysisDate } from "../utils/marketTime.js";
import { runBatchedSectorScan, withDayScanSymbolTimeout } from "./runBatchedSectorScan.js";

export function validateDayScanDate(date: string): string | null {
  if (!isValidAnalysisDate(date)) {
    return "Invalid date format. Use YYYY-MM-DD.";
  }
  return null;
}

function buildSummary(
  trades: DeepakDayScanTrade[],
  errors: DeepakDayScanError[],
  stocksScanned: number,
): DeepakDayScanSummary {
  const stocksWithSignals = new Set(trades.map((trade) => trade.tradingSymbol)).size;
  const exitedTrades = trades.filter((trade) => trade.targetHit);
  const profits = exitedTrades
    .map((trade) => trade.profit)
    .filter((profit): profit is number => profit != null && Number.isFinite(profit));

  return {
    stocksScanned,
    stocksWithSignals,
    totalSignals: trades.length,
    buyCount: trades.filter((trade) => trade.side === "BUY").length,
    sellCount: trades.filter((trade) => trade.side === "SELL").length,
    targetsHit: exitedTrades.length,
    targetsMissed: trades.length - exitedTrades.length,
    avgProfit:
      profits.length > 0
        ? profits.reduce((sum, profit) => sum + profit, 0) / profits.length
        : null,
    errorCount: errors.length,
  };
}

function sortTrades(trades: DeepakDayScanTrade[]): DeepakDayScanTrade[] {
  return [...trades].sort((left, right) => {
    const sectorDiff =
      getSectorRank(left.sector as SectorName) - getSectorRank(right.sector as SectorName);
    if (sectorDiff !== 0) {
      return sectorDiff;
    }
    const symbolDiff = left.tradingSymbol.localeCompare(right.tradingSymbol);
    if (symbolDiff !== 0) {
      return symbolDiff;
    }
    return left.entryTimeIst.localeCompare(right.entryTimeIst);
  });
}

async function scanSymbol(
  entry: SectorWatchlistEntry,
  date: string,
): Promise<{ trades: DeepakDayScanTrade[]; error: DeepakDayScanError | null }> {
  try {
    const dashboardSymbol = resolveDashboardSymbol(entry.tradingSymbol);
    const candles = await withDayScanSymbolTimeout(
      fetchPnbCandles({
        symbol: dashboardSymbol.tradingSymbol,
        exchange: dashboardSymbol.exchange,
        segment: dashboardSymbol.segment,
        fromDate: date,
        toDate: date,
        kiteRetries: config.dayScanKiteRetries,
      }),
      entry.tradingSymbol,
    );    const snapshots = buildIndicatorSnapshots(candles);
    const { trades } = runDeepakBacktest(snapshots, date, date);

    return {
      trades: trades.map((trade) => ({
        ...trade,
        symbol: dashboardSymbol.symbol,
        tradingSymbol: dashboardSymbol.tradingSymbol,
        sector: entry.sector,
      })),
      error: null,
    };
  } catch (error) {
    const message = formatUnknownError(error);
    return {
      trades: [],
      error: {
        tradingSymbol: entry.tradingSymbol,
        sector: entry.sector,
        error: message,
      },
    };
  }
}

async function runBatchedScan(
  entries: SectorWatchlistEntry[],
  date: string,
): Promise<{ trades: DeepakDayScanTrade[]; errors: DeepakDayScanError[] }> {
  const trades: DeepakDayScanTrade[] = [];
  const errors: DeepakDayScanError[] = [];

  const { results, skippedEntries, abortReason } = await runBatchedSectorScan({
    entries,
    label: "deepak-day-scan",
    scan: (entry) => scanSymbol(entry, date),
    resolveError: (result) => result.error?.error ?? null,
  });

  for (const result of results) {
    trades.push(...result.trades);
    if (result.error) {
      errors.push(result.error);
    }
  }

  if (skippedEntries.length > 0 && abortReason) {
    for (const entry of skippedEntries) {
      errors.push({
        tradingSymbol: entry.tradingSymbol,
        sector: entry.sector,
        error: `${abortReason} (scan stopped early)`,
      });
    }
  }

  return { trades, errors };
}

export async function buildDeepakDayScanPayload(input: {
  date: string;
}): Promise<DeepakDayScanPayload> {
  const dateError = validateDayScanDate(input.date);
  if (dateError) {
    throw new Error(dateError);
  }

  const { trades, errors } = await runBatchedScan(SECTOR_WATCHLIST, input.date);
  const sortedTrades = sortTrades(trades);

  return {
    date: input.date,
    trades: sortedTrades,
    errors,
    summary: buildSummary(sortedTrades, errors, SECTOR_WATCHLIST.length),
    runAt: new Date().toISOString(),
  };
}
