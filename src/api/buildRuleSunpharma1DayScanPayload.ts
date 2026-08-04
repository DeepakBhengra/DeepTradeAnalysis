import { config, resolveDashboardSymbol } from "../config.js";
import { fetchPnbCandles } from "../data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../indicators/compute.js";
import {
  evaluateRuleSunpharma1Day,
  ruleSunpharma1SignalToTradeSignal,
} from "../rules/ruleSunpharma1Decision.js";
import type {
  DeepakDayScanError,
  DeepakDayScanPayload,
  DeepakDayScanSummary,
  DeepakDayScanTrade,
} from "../types.js";
import { formatUnknownError } from "../utils/formatError.js";
import { validateDayScanDate } from "./buildDeepakDayScanPayload.js";
import { withDayScanSymbolTimeout } from "./runBatchedSectorScan.js";

/** RuleSUNPHARMA1 is SUNPHARMA-only — never mixed with the sector watchlist. */
const RULE_SUNPHARMA1_ENTRY = {
  tradingSymbol: config.ruleSunpharma1.tradingSymbol,
  sector: "Health",
} as const;

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
  };
}

async function scanSunpharma1(
  date: string,
): Promise<{ trades: DeepakDayScanTrade[]; error: DeepakDayScanError | null }> {
  try {
    const dashboardSymbol = resolveDashboardSymbol(RULE_SUNPHARMA1_ENTRY.tradingSymbol);
    const candles = await withDayScanSymbolTimeout(
      fetchPnbCandles({
        symbol: dashboardSymbol.tradingSymbol,
        exchange: dashboardSymbol.exchange,
        segment: dashboardSymbol.segment,
        fromDate: date,
        toDate: date,
        kiteRetries: config.dayScanKiteRetries,
      }),
      RULE_SUNPHARMA1_ENTRY.tradingSymbol,
    );
    const snapshots = buildIndicatorSnapshots(candles);
    const day = evaluateRuleSunpharma1Day(snapshots, date);

    return {
      trades: day.signals.map((signal) => {
        const tradeSignal = ruleSunpharma1SignalToTradeSignal(signal);
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
          symbol: dashboardSymbol.symbol,
          tradingSymbol: dashboardSymbol.tradingSymbol,
          sector: RULE_SUNPHARMA1_ENTRY.sector,
        };
      }),
      error: null,
    };
  } catch (error) {
    return {
      trades: [],
      error: {
        tradingSymbol: RULE_SUNPHARMA1_ENTRY.tradingSymbol,
        sector: RULE_SUNPHARMA1_ENTRY.sector,
        error: formatUnknownError(error),
      },
    };
  }
}

/**
 * Day Scan for RuleSUNPHARMA1 — evaluates **SUNPHARMA only**.
 * API-only for now (no Day Scan / Post-Mortem widget wiring).
 * Does not share Deepak / Deeppro / RulePNB / RuleSUNPHARMA logic.
 */
export async function buildRuleSunpharma1DayScanPayload(input: {
  date: string;
}): Promise<DeepakDayScanPayload> {
  const dateError = validateDayScanDate(input.date);
  if (dateError) {
    throw new Error(dateError);
  }

  const { trades, error } = await scanSunpharma1(input.date);
  const errors: DeepakDayScanError[] = error ? [error] : [];

  return {
    date: input.date,
    trades,
    errors,
    summary: buildSummary(trades, errors, 1),
    runAt: new Date().toISOString(),
  };
}
