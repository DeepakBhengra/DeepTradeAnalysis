import { config, resolveDashboardSymbol } from "../config.js";
import { fetchPnbCandles } from "../data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../indicators/compute.js";
import {
  deepproSignalToTradeSignal,
  evaluateDeepproDay,
} from "../rules/deepproDecision.js";
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
import { withOpenTradeMarkPrices } from "../utils/sessionMarkPrice.js";
import { validateDayScanDate } from "./buildDeepakDayScanPayload.js";
import { runBatchedSectorScan, withDayScanSymbolTimeout } from "./runBatchedSectorScan.js";

function buildSummary(
  trades: DeepakDayScanTrade[],
  errors: DeepakDayScanError[],
  stocksScanned: number,
): DeepakDayScanSummary {
  const stocksWithSignals = new Set(trades.map((trade) => trade.tradingSymbol)).size;

  return {
    stocksScanned,
    stocksWithSignals,
    totalSignals: trades.length,
    buyCount: trades.filter((trade) => trade.side === "BUY").length,
    sellCount: trades.filter((trade) => trade.side === "SELL").length,
    targetsHit: 0,
    targetsMissed: trades.length,
    avgProfit: null,
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
    );
    const snapshots = buildIndicatorSnapshots(candles);
    const day = evaluateDeepproDay(snapshots, date);

    return {
      trades: withOpenTradeMarkPrices(
        day.signals.map((signal) => {
          const tradeSignal = deepproSignalToTradeSignal(signal);
          return {
            date,
            side: tradeSignal.side,
            scenarioNumber: tradeSignal.scenarioNumber,
            scenarioKey: tradeSignal.scenarioKey,
            entryTimeIst: tradeSignal.timeIst,
            entryPrice: tradeSignal.price,
            exitTimeIst: null,
            exitPrice: null,
            targetHit: false,
            profit: null,
            profitTarget: tradeSignal.profitTarget,
            bbMatchType: tradeSignal.bbMatchType,
            symbol: dashboardSymbol.symbol,
            tradingSymbol: dashboardSymbol.tradingSymbol,
            sector: entry.sector,
          };
        }),
        snapshots,
        date,
      ),
      error: null,
    };
  } catch (error) {
    return {
      trades: [],
      error: {
        tradingSymbol: entry.tradingSymbol,
        sector: entry.sector,
        error: formatUnknownError(error),
      },
    };
  }
}

export async function buildDeepproDayScanPayload(input: {
  date: string;
}): Promise<DeepakDayScanPayload> {
  const dateError = validateDayScanDate(input.date);
  if (dateError) {
    throw new Error(dateError);
  }

  const trades: DeepakDayScanTrade[] = [];
  const errors: DeepakDayScanError[] = [];

  const { results, skippedEntries, abortReason } = await runBatchedSectorScan({
    entries: SECTOR_WATCHLIST,
    label: "deeppro-day-scan",
    scan: (entry) => scanSymbol(entry, input.date),
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

  const sortedTrades = sortTrades(trades);

  return {
    date: input.date,
    trades: sortedTrades,
    errors,
    summary: buildSummary(sortedTrades, errors, SECTOR_WATCHLIST.length),
    runAt: new Date().toISOString(),
  };
}
