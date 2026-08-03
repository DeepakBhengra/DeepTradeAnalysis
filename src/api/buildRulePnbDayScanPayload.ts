import { config, resolveDashboardSymbol } from "../config.js";
import { fetchPnbCandles } from "../data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../indicators/compute.js";
import {
  evaluateRulePnbDay,
  rulePnbSignalToTradeSignal,
} from "../rules/rulePnbDecision.js";
import type {
  DeepakDayScanError,
  DeepakDayScanPayload,
  DeepakDayScanSummary,
  DeepakDayScanTrade,
} from "../types.js";
import { formatUnknownError } from "../utils/formatError.js";
import { validateDayScanDate } from "./buildDeepakDayScanPayload.js";
import { withDayScanSymbolTimeout } from "./runBatchedSectorScan.js";

/** RulePNB is PNB-only — never mixed with the sector watchlist. */
const RULE_PNB_ENTRY = {
  tradingSymbol: config.rulePnb.tradingSymbol,
  sector: "Bank",
} as const;

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

async function scanPnb(
  date: string,
): Promise<{ trades: DeepakDayScanTrade[]; error: DeepakDayScanError | null }> {
  try {
    const dashboardSymbol = resolveDashboardSymbol(RULE_PNB_ENTRY.tradingSymbol);
    const candles = await withDayScanSymbolTimeout(
      fetchPnbCandles({
        symbol: dashboardSymbol.tradingSymbol,
        exchange: dashboardSymbol.exchange,
        segment: dashboardSymbol.segment,
        fromDate: date,
        toDate: date,
        kiteRetries: config.dayScanKiteRetries,
      }),
      RULE_PNB_ENTRY.tradingSymbol,
    );
    const snapshots = buildIndicatorSnapshots(candles);
    const day = evaluateRulePnbDay(snapshots, date);

    return {
      trades: day.signals.map((signal) => {
        const tradeSignal = rulePnbSignalToTradeSignal(signal);
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
          sector: RULE_PNB_ENTRY.sector,
        };
      }),
      error: null,
    };
  } catch (error) {
    return {
      trades: [],
      error: {
        tradingSymbol: RULE_PNB_ENTRY.tradingSymbol,
        sector: RULE_PNB_ENTRY.sector,
        error: formatUnknownError(error),
      },
    };
  }
}

/**
 * Day Scan for RulePNB — evaluates **PNB only**.
 * Does not scan the sector watchlist and does not share Deepak/Deeppro logic.
 */
export async function buildRulePnbDayScanPayload(input: {
  date: string;
}): Promise<DeepakDayScanPayload> {
  const dateError = validateDayScanDate(input.date);
  if (dateError) {
    throw new Error(dateError);
  }

  const { trades, error } = await scanPnb(input.date);
  const errors: DeepakDayScanError[] = error ? [error] : [];

  return {
    date: input.date,
    trades,
    errors,
    summary: buildSummary(trades, errors, 1),
    runAt: new Date().toISOString(),
  };
}
