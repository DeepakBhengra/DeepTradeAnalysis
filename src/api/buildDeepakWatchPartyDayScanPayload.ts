import { runDeepakWatchPartyBacktest } from "../backtest/runDeepakWatchPartyBacktest.js";
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
  DeepakWatchPartyDayScanPayload,
  DeepakWatchPartyDayScanSummary,
  DeepakWatchPartyDayScanTrade,
} from "../types.js";
import { formatUnknownError } from "../utils/formatError.js";
import { withOpenTradeMarkPrices } from "../utils/sessionMarkPrice.js";
import { validateDayScanDate } from "./buildDeepakDayScanPayload.js";
import { runBatchedSectorScan, withDayScanSymbolTimeout } from "./runBatchedSectorScan.js";

function buildSummary(
  trades: DeepakWatchPartyDayScanTrade[],
  errors: DeepakDayScanError[],
  stocksScanned: number,
): DeepakWatchPartyDayScanSummary {
  const stocksWithSignals = new Set(trades.map((trade) => trade.tradingSymbol)).size;
  const exitedTrades = trades.filter((trade) => trade.targetHit || trade.stopLossHit);
  const profits = exitedTrades
    .map((trade) => trade.profit)
    .filter((profit): profit is number => profit != null && Number.isFinite(profit));

  return {
    stocksScanned,
    stocksWithSignals,
    totalSignals: trades.length,
    buyCount: trades.filter((trade) => trade.side === "BUY").length,
    sellCount: trades.filter((trade) => trade.side === "SELL").length,
    targetsHit: trades.filter((trade) => trade.targetHit).length,
    stopsHit: trades.filter((trade) => trade.stopLossHit).length,
    targetsMissed: trades.filter((trade) => !trade.targetHit && !trade.stopLossHit).length,
    avgProfit:
      profits.length > 0
        ? profits.reduce((sum, profit) => sum + profit, 0) / profits.length
        : null,
    errorCount: errors.length,
  };
}

function sortTrades(
  trades: DeepakWatchPartyDayScanTrade[],
): DeepakWatchPartyDayScanTrade[] {
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
): Promise<{ trades: DeepakWatchPartyDayScanTrade[]; error: DeepakDayScanError | null }> {
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
    );
    const snapshots = buildIndicatorSnapshots(candles);
    const { trades } = runDeepakWatchPartyBacktest(snapshots, date, date);

    return {
      trades: withOpenTradeMarkPrices(
        trades.map((trade) => ({
          ...trade,
          symbol: dashboardSymbol.symbol,
          tradingSymbol: dashboardSymbol.tradingSymbol,
          sector: entry.sector,
          strategy: "deepak-watch-party" as const,
        })),
        snapshots,
        date,
      ),
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
): Promise<{ trades: DeepakWatchPartyDayScanTrade[]; errors: DeepakDayScanError[] }> {
  const trades: DeepakWatchPartyDayScanTrade[] = [];
  const errors: DeepakDayScanError[] = [];

  const { results, skippedEntries, abortReason } = await runBatchedSectorScan({
    entries,
    label: "deepak-watch-party-day-scan",
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

export async function buildDeepakWatchPartyDayScanPayload(input: {
  date: string;
}): Promise<DeepakWatchPartyDayScanPayload> {
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
