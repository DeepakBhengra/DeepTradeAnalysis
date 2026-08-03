import { config } from "../config.js";
import {
  evaluateRulePnbDay,
  rulePnbSignalToTradeSignal,
} from "../rules/rulePnbDecision.js";
import type {
  DeepakBacktestResult,
  DeepakBacktestSummary,
  DeepakBacktestTrade,
  IndicatorSnapshot,
} from "../types.js";
import { getIstTimeParts, isWithinIstSessionWindow } from "../utils/marketTime.js";

export function collectRulePnbTradingDates(snapshots: IndicatorSnapshot[]): string[] {
  const { sessionStart, sessionEnd } = config.rulePnb;
  const dates = new Set<string>();

  for (const snapshot of snapshots) {
    if (isWithinIstSessionWindow(snapshot.timestamp, sessionStart, sessionEnd)) {
      dates.add(getIstTimeParts(snapshot.timestamp).dateKey);
    }
  }

  return [...dates].sort();
}

function buildSummary(
  targetDates: string[],
  trades: DeepakBacktestTrade[],
): DeepakBacktestSummary {
  let buyCount = 0;
  let sellCount = 0;
  let targetsHit = 0;
  let targetsMissed = 0;

  for (const trade of trades) {
    if (trade.side === "BUY") {
      buyCount++;
    } else {
      sellCount++;
    }
    if (trade.targetHit) {
      targetsHit++;
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
    targetsMissed,
    avgProfit,
  };
}

export function runRulePnbBacktest(
  snapshots: IndicatorSnapshot[],
  fromDate: string,
  toDate: string,
): DeepakBacktestResult {
  const allDates = collectRulePnbTradingDates(snapshots);
  const targetDates = allDates.filter((date) => date >= fromDate && date <= toDate);
  const trades: DeepakBacktestTrade[] = [];

  for (const date of targetDates) {
    const day = evaluateRulePnbDay(snapshots, date);
    for (const signal of day.signals) {
      const tradeSignal = rulePnbSignalToTradeSignal(signal);
      trades.push({
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
      });
    }
  }

  return {
    trades,
    summary: buildSummary(targetDates, trades),
  };
}
