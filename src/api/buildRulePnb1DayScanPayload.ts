import { config, resolveDashboardSymbol } from "../config.js";
import { fetchPnbCandles } from "../data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../indicators/compute.js";
import {
  evaluateRulePnb1Day,
  rulePnb1SignalToTradeSignal,
} from "../rules/rulePnb1Decision.js";
import type {
  DeepakDayScanError,
  DeepakDayScanPayload,
  DeepakDayScanSummary,
  DeepakDayScanTrade,
} from "../types.js";
import { formatUnknownError } from "../utils/formatError.js";
import { validateDayScanDate } from "./buildDeepakDayScanPayload.js";
import { withDayScanSymbolTimeout } from "./runBatchedSectorScan.js";

/** RulePNB1 is PNB-only — never mixed with the sector watchlist. */
const RULE_PNB1_ENTRY = {
  tradingSymbol: config.rulePnb1.tradingSymbol,
  sector: "Bank",
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

async function scanPnb1(
  date: string,
): Promise<{ trades: DeepakDayScanTrade[]; error: DeepakDayScanError | null }> {
  try {
    const dashboardSymbol = resolveDashboardSymbol(RULE_PNB1_ENTRY.tradingSymbol);
    const candles = await withDayScanSymbolTimeout(
      fetchPnbCandles({
        symbol: dashboardSymbol.tradingSymbol,
        exchange: dashboardSymbol.exchange,
        segment: dashboardSymbol.segment,
        fromDate: date,
        toDate: date,
        kiteRetries: config.dayScanKiteRetries,
      }),
      RULE_PNB1_ENTRY.tradingSymbol,
    );
    const snapshots = buildIndicatorSnapshots(candles);
    const day = evaluateRulePnb1Day(snapshots, date);

    return {
      trades: day.signals.map((signal) => {
        const tradeSignal = rulePnb1SignalToTradeSignal(signal);
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
          sector: RULE_PNB1_ENTRY.sector,
        };
      }),
      error: null,
    };
  } catch (error) {
    return {
      trades: [],
      error: {
        tradingSymbol: RULE_PNB1_ENTRY.tradingSymbol,
        sector: RULE_PNB1_ENTRY.sector,
        error: formatUnknownError(error),
      },
    };
  }
}

/**
 * Day Scan for RulePNB1 — evaluates **PNB only**.
 * API-only for now (no Day Scan / Post-Mortem widget wiring).
 */
export async function buildRulePnb1DayScanPayload(input: {
  date: string;
}): Promise<DeepakDayScanPayload> {
  const dateError = validateDayScanDate(input.date);
  if (dateError) {
    throw new Error(dateError);
  }

  const { trades, error } = await scanPnb1(input.date);
  const errors: DeepakDayScanError[] = error ? [error] : [];

  return {
    date: input.date,
    trades,
    errors,
    summary: buildSummary(trades, errors, 1),
    runAt: new Date().toISOString(),
  };
}
