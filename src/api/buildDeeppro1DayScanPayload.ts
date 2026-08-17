import { config, resolveDashboardSymbol } from "../config.js";
import { fetchPnbCandles } from "../data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../indicators/compute.js";
import {
  deeppro1SignalToTradeSignal,
  evaluateDeeppro1Day,
} from "../rules/deeppro1Decision.js";
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
import {
  applyStopLossExitsToTrades,
  sessionMarkBarsFromSnapshots,
} from "../utils/dayScanStopLoss.js";
import { withOpenTradeMarkPrices } from "../utils/sessionMarkPrice.js";
import { getSamcoStopLossPct } from "../samco/samcoRuntimeSettings.js";
import { validateDayScanDate } from "./buildDeepakDayScanPayload.js";
import { runBatchedSectorScan, withDayScanSymbolTimeout } from "./runBatchedSectorScan.js";

function buildSummary(
  trades: DeepakDayScanTrade[],
  errors: DeepakDayScanError[],
  stocksScanned: number,
): DeepakDayScanSummary {
  const stocksWithSignals = new Set(trades.map((trade) => trade.tradingSymbol)).size;
  const profits = trades
    .map((trade) => trade.profit)
    .filter((profit): profit is number => profit != null);
  const targetsHit = trades.filter((trade) => trade.targetHit).length;

  return {
    stocksScanned,
    stocksWithSignals,
    totalSignals: trades.length,
    buyCount: trades.filter((trade) => trade.side === "BUY").length,
    sellCount: trades.filter((trade) => trade.side === "SELL").length,
    targetsHit,
    targetsMissed: trades.length - targetsHit,
    avgProfit:
      profits.length > 0
        ? profits.reduce((sum, value) => sum + value, 0) / profits.length
        : null,
    errorCount: errors.length,
    stopsHit: trades.filter(
      (trade) => trade.stopLossHit || trade.exitReason === "stop_loss",
    ).length,
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
    const day = evaluateDeeppro1Day(snapshots, date);

    return {
      trades: applyStopLossExitsToTrades(
        withOpenTradeMarkPrices(
          day.signals.map((signal) => {
            const tradeSignal = deeppro1SignalToTradeSignal(signal);
            return {
              date,
              side: tradeSignal.side,
              scenarioNumber: tradeSignal.scenarioNumber,
              scenarioKey: tradeSignal.scenarioKey,
              entryTimeIst: tradeSignal.timeIst,
              entryPrice: tradeSignal.price,
              exitTimeIst: tradeSignal.exit?.timeIst ?? null,
              exitPrice: tradeSignal.exit?.price ?? null,
              targetHit: tradeSignal.exit?.targetHit ?? false,
              profit: tradeSignal.exit?.profit ?? null,
              profitTarget: tradeSignal.profitTarget,
              bbMatchType: tradeSignal.bbMatchType,
              exitReason: tradeSignal.exit?.exitReason ?? null,
              symbol: dashboardSymbol.symbol,
              tradingSymbol: dashboardSymbol.tradingSymbol,
              sector: entry.sector,
            };
          }),
          snapshots,
          date,
        ),
        sessionMarkBarsFromSnapshots(snapshots, date),
        getSamcoStopLossPct(),
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

/**
 * Day Scan for Deeppro1 — evaluates the full sector watchlist.
 * SMI black↔red cross + same-day exits (0.45% target, 0.3%→breakeven, opposite flip, 15:00 force).
 */
export async function buildDeeppro1DayScanPayload(input: {
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
    label: "deeppro1-day-scan",
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
