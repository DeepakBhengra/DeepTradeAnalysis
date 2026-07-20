import { config } from "../config.js";
import type { DeepakDecisionConfig } from "../config.js";
import type { IndicatorSnapshot } from "../types.js";
import { getIstTimeParts } from "../utils/marketTime.js";

function isUsableSnapshot(snapshot: IndicatorSnapshot): boolean {
  return (
    Number.isFinite(snapshot.high) &&
    Number.isFinite(snapshot.low) &&
    Number.isFinite(snapshot.bollinger.upper) &&
    Number.isFinite(snapshot.bollinger.lower)
  );
}

export function computeDailyRange(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): number | null {
  const dayCandles = snapshots.filter(
    (snapshot) =>
      isUsableSnapshot(snapshot) &&
      getIstTimeParts(snapshot.timestamp).dateKey === dateKey,
  );

  if (dayCandles.length === 0) {
    return null;
  }

  const high = Math.max(...dayCandles.map((snapshot) => snapshot.high));
  const low = Math.min(...dayCandles.map((snapshot) => snapshot.low));
  const range = high - low;

  return range > 0 ? range : null;
}

export function collectPriorTradingDayRanges(
  snapshots: IndicatorSnapshot[],
  entryDateKey: string,
  lookback: number,
): number[] {
  const priorDateKeys = [
    ...new Set(
      snapshots
        .filter((snapshot) => isUsableSnapshot(snapshot))
        .map((snapshot) => getIstTimeParts(snapshot.timestamp).dateKey)
        .filter((dateKey) => dateKey < entryDateKey),
    ),
  ].sort();

  const selectedDateKeys = priorDateKeys.slice(-lookback);
  const dailyRanges: number[] = [];

  for (const dateKey of selectedDateKeys) {
    const range = computeDailyRange(snapshots, dateKey);
    if (range != null) {
      dailyRanges.push(range);
    }
  }

  return dailyRanges;
}

export function computeProfitTarget(
  entrySnapshot: IndicatorSnapshot,
  snapshots: IndicatorSnapshot[],
  decisionConfig: DeepakDecisionConfig = config.deepakDecision,
): number {
  const { profitTarget, adaptiveTarget } = decisionConfig;

  if (!adaptiveTarget.enabled) {
    return profitTarget;
  }

  const entryDateKey = getIstTimeParts(entrySnapshot.timestamp).dateKey;
  const dailyRanges = collectPriorTradingDayRanges(
    snapshots,
    entryDateKey,
    adaptiveTarget.lookback,
  );

  if (dailyRanges.length < adaptiveTarget.lookback) {
    return profitTarget;
  }

  return dailyRanges.reduce((sum, range) => sum + range, 0) / dailyRanges.length;
}
