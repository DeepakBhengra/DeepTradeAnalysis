import { config } from "../config.js";
import {
  DEEPAK_VARIANT,
  evaluateDeepak2Decision,
  evaluateDeepakDecision,
} from "./deepakDecision.js";
import {
  filterSessionCandlesForVariant,
  resolveDateKey,
  simulateExit,
} from "./deepakCore.js";
import { computeProfitTarget } from "./deepakTarget.js";
import type {
  DeepakExitSignal,
  DeepakTradeSignal,
  DeepakWatchPartyBacktestTrade,
  IndicatorSnapshot,
} from "../types.js";
import { formatIstTime } from "../utils/marketTime.js";

export interface DeepakWatchPartyDecisionResult {
  dateKey: string;
  signals: DeepakTradeSignal[];
}

function findFirstOppositeDeepak2Signal(
  entrySide: "BUY" | "SELL",
  entryTimeIst: string,
  deepak2Signals: DeepakTradeSignal[],
): DeepakTradeSignal | null {
  const candidates = deepak2Signals
    .filter(
      (signal) =>
        signal.side !== entrySide && signal.timeIst.localeCompare(entryTimeIst) > 0,
    )
    .sort((left, right) => left.timeIst.localeCompare(right.timeIst));

  return candidates[0] ?? null;
}

function buildStopExit(
  entrySide: "BUY" | "SELL",
  entryPrice: number,
  profitTarget: number,
  stopSignal: DeepakTradeSignal,
): DeepakExitSignal {
  const profit =
    entrySide === "BUY"
      ? stopSignal.price - entryPrice
      : entryPrice - stopSignal.price;

  return {
    timeIst: stopSignal.timeIst,
    price: stopSignal.price,
    targetHit: false,
    profit,
    profitTarget,
    exitReason: "deepak2_stop",
    stopLossHit: true,
    deepak2StopScenarioKey: stopSignal.scenarioKey,
  };
}

export function mergeWatchPartyExits(
  entrySide: "BUY" | "SELL",
  entryPrice: number,
  profitTarget: number,
  targetExit: DeepakExitSignal | null,
  stopSignal: DeepakTradeSignal | null,
): DeepakExitSignal | null {
  if (!stopSignal && !targetExit) {
    return null;
  }

  if (!stopSignal && targetExit) {
    return {
      ...targetExit,
      exitReason: "target",
      stopLossHit: false,
    };
  }

  if (stopSignal && !targetExit) {
    return buildStopExit(entrySide, entryPrice, profitTarget, stopSignal);
  }

  if (stopSignal && targetExit) {
    if (stopSignal.timeIst.localeCompare(targetExit.timeIst) <= 0) {
      return buildStopExit(entrySide, entryPrice, profitTarget, stopSignal);
    }
    return {
      ...targetExit,
      exitReason: "target",
      stopLossHit: false,
    };
  }

  return null;
}

export function simulateWatchPartyExit(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  entryCandle: IndicatorSnapshot,
  signal: DeepakTradeSignal,
  deepak2Signals: DeepakTradeSignal[],
): DeepakExitSignal | null {
  const profitTarget = computeProfitTarget(
    entryCandle,
    snapshots,
    DEEPAK_VARIANT.config,
  );
  const targetExit = simulateExit(
    snapshots,
    dateKey,
    entryCandle,
    signal.side,
    signal.price,
    profitTarget,
    DEEPAK_VARIANT,
  );
  const stopSignal = findFirstOppositeDeepak2Signal(
    signal.side,
    signal.timeIst,
    deepak2Signals,
  );

  return mergeWatchPartyExits(
    signal.side,
    signal.price,
    profitTarget,
    targetExit,
    stopSignal,
  );
}

export function isWatchPartyEligibleEntry(timeIst: string): boolean {
  return timeIst === config.deepakWatchParty.entryTimeIst;
}

export function evaluateDeepakWatchPartyDecision(
  snapshots: IndicatorSnapshot[],
  dateKey?: string,
): DeepakWatchPartyDecisionResult | null {
  const resolvedDateKey = resolveDateKey(snapshots, dateKey);
  if (!resolvedDateKey) {
    return null;
  }

  const deepakResult = evaluateDeepakDecision(snapshots, resolvedDateKey);
  if (!deepakResult) {
    return null;
  }

  const deepak2Result = evaluateDeepak2Decision(snapshots, resolvedDateKey);
  const deepak2Signals = deepak2Result?.signals ?? [];
  const candles = filterSessionCandlesForVariant(
    snapshots,
    resolvedDateKey,
    DEEPAK_VARIANT,
  );
  const candleByTime = new Map(
    candles.map((candle) => [formatIstTime(candle.timestamp), candle]),
  );

  const signals: DeepakTradeSignal[] = [];

  for (const signal of deepakResult.signals) {
    if (!isWatchPartyEligibleEntry(signal.timeIst)) {
      continue;
    }

    const entryCandle = candleByTime.get(signal.timeIst);
    if (!entryCandle) {
      continue;
    }

    const profitTarget = computeProfitTarget(
      entryCandle,
      snapshots,
      DEEPAK_VARIANT.config,
    );
    const exit = simulateWatchPartyExit(
      snapshots,
      resolvedDateKey,
      entryCandle,
      signal,
      deepak2Signals,
    );

    signals.push({
      ...signal,
      profitTarget,
      exit,
    });
  }

  if (signals.length === 0) {
    return null;
  }

  return {
    dateKey: resolvedDateKey,
    signals,
  };
}

export function signalToWatchPartyTrade(
  date: string,
  signal: DeepakTradeSignal,
): DeepakWatchPartyBacktestTrade {
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
    exitReason: signal.exit?.exitReason ?? null,
    stopLossHit: signal.exit?.stopLossHit ?? false,
    deepak2StopScenarioKey: signal.exit?.deepak2StopScenarioKey ?? null,
    deepak2StopTimeIst:
      signal.exit?.exitReason === "deepak2_stop" ? signal.exit.timeIst : null,
  };
}
