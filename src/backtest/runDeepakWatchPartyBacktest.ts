import { DEEPAK_VARIANT } from "../rules/deepakDecision.js";
import {
  evaluateDeepakWatchPartyDecision,
  signalToWatchPartyTrade,
} from "../rules/deepakWatchParty.js";
import type {
  DeepakWatchPartyBacktestResult,
  DeepakWatchPartyBacktestSummary,
  DeepakWatchPartyBacktestTrade,
  IndicatorSnapshot,
} from "../types.js";
import { collectTradingDates } from "./runDeepakBacktest.js";

function buildSummary(
  targetDates: string[],
  trades: DeepakWatchPartyBacktestTrade[],
): DeepakWatchPartyBacktestSummary {
  let buyCount = 0;
  let sellCount = 0;
  let targetsHit = 0;
  let stopsHit = 0;
  let targetsMissed = 0;

  for (const trade of trades) {
    if (trade.side === "BUY") {
      buyCount++;
    } else {
      sellCount++;
    }
    if (trade.targetHit) {
      targetsHit++;
    } else if (trade.stopLossHit) {
      stopsHit++;
    } else {
      targetsMissed++;
    }
  }

  const profits = trades
    .map((trade) => trade.profit)
    .filter((profit): profit is number => profit != null);

  const avgProfit =
    profits.length > 0
      ? profits.reduce((sum, value) => sum + value, 0) / profits.length
      : null;

  return {
    tradingDaysScanned: targetDates.length,
    dateRange: {
      from: targetDates[0] ?? null,
      to: targetDates[targetDates.length - 1] ?? null,
    },
    totalSignals: trades.length,
    buyCount,
    sellCount,
    targetsHit,
    stopsHit,
    targetsMissed,
    avgProfit,
  };
}

export function runDeepakWatchPartyBacktest(
  snapshots: IndicatorSnapshot[],
  fromDate: string,
  toDate: string,
): DeepakWatchPartyBacktestResult {
  const tradingDates = collectTradingDates(snapshots, DEEPAK_VARIANT);
  const targetDates = tradingDates.filter(
    (dateKey) => dateKey >= fromDate && dateKey <= toDate,
  );

  const trades: DeepakWatchPartyBacktestTrade[] = [];

  for (const dateKey of targetDates) {
    const result = evaluateDeepakWatchPartyDecision(snapshots, dateKey);
    if (!result || result.signals.length === 0) {
      continue;
    }

    for (const signal of result.signals) {
      trades.push(signalToWatchPartyTrade(dateKey, signal));
    }
  }

  return {
    trades,
    summary: buildSummary(targetDates, trades),
  };
}
