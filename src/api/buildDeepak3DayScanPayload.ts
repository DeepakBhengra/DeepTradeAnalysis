import { config, resolveDashboardSymbol } from "../config.js";
import { fetchPnbCandles } from "../data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../indicators/compute.js";
import { scanDeepak3Decisions } from "../rules/deepak3Decision.js";
import {
  getSectorRank,
  SECTOR_WATCHLIST,
  type SectorName,
  type SectorWatchlistEntry,
} from "../symbols/sectorWatchlist.js";
import type {
  Deepak3TradeSignal,
  DeepakDayScanError,
  DeepakDayScanPayload,
  DeepakDayScanSummary,
  DeepakDayScanTrade,
  IndicatorSnapshot,
} from "../types.js";
import { formatUnknownError } from "../utils/formatError.js";
import { validateDayScanDate } from "./buildDeepakDayScanPayload.js";
import { runBatchedSectorScan, withDayScanSymbolTimeout } from "./runBatchedSectorScan.js";

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

function signalToTrade(
  date: string,
  signal: Deepak3TradeSignal,
  symbol: string,
  tradingSymbol: string,
  sector: string,
): DeepakDayScanTrade {
  return {
    date,
    side: signal.side,
    scenarioNumber: signal.scenarioNumber,
    scenarioKey: signal.scenarioKey,
    entryTimeIst: signal.timeIst,
    entryPrice: signal.price,
    exitTimeIst: signal.exit?.timeIst ?? null,
    exitPrice: signal.exit?.price ?? null,
    targetHit: signal.exit?.targetHit ?? false,
    profit: signal.exit?.profit ?? null,
    profitTarget: signal.profitTarget,
    bbMatchType: signal.bbMatchType,
    symbol,
    tradingSymbol,
    sector,
    confidenceFactors: signal.confidenceFactors,
  };
}

async function fetchSymbolSnapshots(
  entry: SectorWatchlistEntry,
  date: string,
): Promise<{
  tradingSymbol: string;
  sector: string;
  symbol: string;
  snapshots: IndicatorSnapshot[];
  error: DeepakDayScanError | null;
}> {
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

    return {
      tradingSymbol: dashboardSymbol.tradingSymbol,
      sector: entry.sector,
      symbol: dashboardSymbol.symbol,
      snapshots,
      error: null,
    };
  } catch (error) {
    const message = formatUnknownError(error);
    return {
      tradingSymbol: entry.tradingSymbol,
      sector: entry.sector,
      symbol: "",
      snapshots: [],
      error: {
        tradingSymbol: entry.tradingSymbol,
        sector: entry.sector,
        error: message,
      },
    };
  }
}

async function runBatchedFetch(
  entries: SectorWatchlistEntry[],
  date: string,
): Promise<{
  scanEntries: Array<{
    tradingSymbol: string;
    sector: string;
    snapshots: IndicatorSnapshot[];
  }>;
  symbolByTradingSymbol: Map<string, string>;
  errors: DeepakDayScanError[];
}> {
  const scanEntries: Array<{
    tradingSymbol: string;
    sector: string;
    snapshots: IndicatorSnapshot[];
  }> = [];
  const symbolByTradingSymbol = new Map<string, string>();
  const errors: DeepakDayScanError[] = [];

  const { results, skippedEntries, abortReason } = await runBatchedSectorScan({
    entries,
    label: "deepak3-day-scan",
    scan: (entry) => fetchSymbolSnapshots(entry, date),
    resolveError: (result) => result.error?.error ?? null,
  });

  for (const result of results) {
    if (result.error) {
      errors.push(result.error);
      continue;
    }
    symbolByTradingSymbol.set(result.tradingSymbol, result.symbol);
    scanEntries.push({
      tradingSymbol: result.tradingSymbol,
      sector: result.sector,
      snapshots: result.snapshots,
    });
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

  return { scanEntries, symbolByTradingSymbol, errors };
}

export async function buildDeepak3DayScanPayload(input: {
  date: string;
}): Promise<DeepakDayScanPayload> {
  const dateError = validateDayScanDate(input.date);
  if (dateError) {
    throw new Error(dateError);
  }

  const { scanEntries, symbolByTradingSymbol, errors } = await runBatchedFetch(
    SECTOR_WATCHLIST,
    input.date,
  );

  const scan = scanDeepak3Decisions(scanEntries, input.date);
  const trades: DeepakDayScanTrade[] = [];

  for (let index = 0; index < scan.results.length; index++) {
    const result = scan.results[index];
    const tradingSymbol = scan.tradingSymbols[index];
    const sector = scan.sectors[index];
    const symbol = symbolByTradingSymbol.get(tradingSymbol) ?? `NSE:${tradingSymbol}`;

    for (const signal of result.signals) {
      trades.push(signalToTrade(input.date, signal, symbol, tradingSymbol, sector));
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
