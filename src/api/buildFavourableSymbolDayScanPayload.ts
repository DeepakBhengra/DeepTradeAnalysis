import { resolveDashboardSymbol } from "../config.js";
import { fetchPnbCandles } from "../data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../indicators/compute.js";
import {
  evaluateFavourableSymbolDay,
  favourableSymbolSignalToTradeSignal,
  getFavourableSymbolRuleConfig,
} from "../rules/favourableSymbolRule.js";
import type {
  DeepakDayScanError,
  DeepakDayScanPayload,
  DeepakDayScanSummary,
  DeepakDayScanTrade,
  FavourableSymbolRuleId,
} from "../types.js";
import { formatUnknownError } from "../utils/formatError.js";
import { config } from "../config.js";
import { validateDayScanDate } from "./buildDeepakDayScanPayload.js";
import { withDayScanSymbolTimeout } from "./runBatchedSectorScan.js";

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

async function scanSymbol(
  ruleId: FavourableSymbolRuleId,
  date: string,
): Promise<{ trades: DeepakDayScanTrade[]; error: DeepakDayScanError | null }> {
  const rule = getFavourableSymbolRuleConfig(ruleId);
  try {
    const dashboardSymbol = resolveDashboardSymbol(rule.tradingSymbol);
    const candles = await withDayScanSymbolTimeout(
      fetchPnbCandles({
        symbol: dashboardSymbol.tradingSymbol,
        exchange: dashboardSymbol.exchange,
        segment: dashboardSymbol.segment,
        fromDate: date,
        toDate: date,
        kiteRetries: config.dayScanKiteRetries,
      }),
      rule.tradingSymbol,
    );
    const snapshots = buildIndicatorSnapshots(candles);
    const day = evaluateFavourableSymbolDay(ruleId, snapshots, date);

    return {
      trades: day.signals.map((signal) => {
        const tradeSignal = favourableSymbolSignalToTradeSignal(ruleId, signal);
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
          sector: rule.sector,
        };
      }),
      error: null,
    };
  } catch (error) {
    return {
      trades: [],
      error: {
        tradingSymbol: rule.tradingSymbol,
        sector: rule.sector,
        error: formatUnknownError(error),
      },
    };
  }
}

/** Day Scan for a single-symbol favourable rule — never scans the watchlist. */
export async function buildFavourableSymbolDayScanPayload(input: {
  ruleId: FavourableSymbolRuleId;
  date: string;
}): Promise<DeepakDayScanPayload> {
  const dateError = validateDayScanDate(input.date);
  if (dateError) {
    throw new Error(dateError);
  }

  const { trades, error } = await scanSymbol(input.ruleId, input.date);
  const errors: DeepakDayScanError[] = error ? [error] : [];

  return {
    date: input.date,
    trades,
    errors,
    summary: buildSummary(trades, errors, 1),
    runAt: new Date().toISOString(),
  };
}
