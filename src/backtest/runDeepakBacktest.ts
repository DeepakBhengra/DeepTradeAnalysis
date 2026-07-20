import {
  DEEPAK2_VARIANT,
  DEEPAK_VARIANT,
  evaluateDeepak2Decision,
  evaluateDeepakDecision,
  type DeepakStrategyVariant,
} from "../rules/deepakDecision.js";
import type {
  DeepakBacktestResult,
  DeepakBacktestSummary,
  DeepakBacktestTrade,
  DeepakTradeSignal,
  IndicatorSnapshot,
} from "../types.js";
import { getIstTimeParts, isWithinIstSessionWindow } from "../utils/marketTime.js";

export function collectTradingDates(
  snapshots: IndicatorSnapshot[],
  variant: DeepakStrategyVariant = DEEPAK_VARIANT,
): string[] {
  const { sessionStart, sessionEnd } = variant.config;
  const dates = new Set<string>();

  for (const snapshot of snapshots) {
    const ist = getIstTimeParts(snapshot.timestamp);
    if (isWithinIstSessionWindow(snapshot.timestamp, sessionStart, sessionEnd)) {
      dates.add(ist.dateKey);
    }
  }

  return [...dates].sort();
}

function signalToTrade(date: string, signal: DeepakTradeSignal): DeepakBacktestTrade {
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
  };
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

export function runDeepakVariantBacktest(
  snapshots: IndicatorSnapshot[],
  fromDate: string,
  toDate: string,
  variant: DeepakStrategyVariant,
  evaluate: (
    snapshots: IndicatorSnapshot[],
    dateKey: string,
  ) => ReturnType<typeof evaluateDeepakDecision>,
): DeepakBacktestResult {
  const tradingDates = collectTradingDates(snapshots, variant);
  const targetDates = tradingDates.filter(
    (dateKey) => dateKey >= fromDate && dateKey <= toDate,
  );

  const trades: DeepakBacktestTrade[] = [];

  for (const dateKey of targetDates) {
    const result = evaluate(snapshots, dateKey);
    if (!result || result.signals.length === 0) {
      continue;
    }

    for (const signal of result.signals) {
      trades.push(signalToTrade(dateKey, signal));
    }
  }

  return {
    trades,
    summary: buildSummary(targetDates, trades),
  };
}

export function runDeepakBacktest(
  snapshots: IndicatorSnapshot[],
  fromDate: string,
  toDate: string,
): DeepakBacktestResult {
  return runDeepakVariantBacktest(
    snapshots,
    fromDate,
    toDate,
    DEEPAK_VARIANT,
    evaluateDeepakDecision,
  );
}

export function runDeepak2Backtest(
  snapshots: IndicatorSnapshot[],
  fromDate: string,
  toDate: string,
): DeepakBacktestResult {
  return runDeepakVariantBacktest(
    snapshots,
    fromDate,
    toDate,
    DEEPAK2_VARIANT,
    evaluateDeepak2Decision,
  );
}
