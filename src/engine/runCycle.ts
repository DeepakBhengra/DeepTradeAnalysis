import { fetchPnbCandles, getLatestClosedCandle } from "../data/pnbFeed.js";
import {
  buildIndicatorSnapshots,
  getUsableSnapshots,
} from "../indicators/compute.js";
import { evaluateDeepakDecision, evaluateDeepak2Decision } from "../rules/deepakDecision.js";
import type { DecisionResult } from "../types.js";
import { getIstTimeParts } from "../utils/marketTime.js";

export interface CycleResult {
  candleCount: number;
  usableSnapshotCount: number;
  latestClosedAt?: Date;
  result: DecisionResult | null;
}

export async function runCycle(): Promise<CycleResult> {
  const candles = await fetchPnbCandles();
  const latestClosed = getLatestClosedCandle(candles);

  if (!latestClosed) {
    return {
      candleCount: candles.length,
      usableSnapshotCount: 0,
      result: null,
    };
  }

  const closedCandles = candles.filter(
    (candle) => candle.timestamp.getTime() <= latestClosed.timestamp.getTime(),
  );

  const snapshots = buildIndicatorSnapshots(closedCandles);
  const usable = getUsableSnapshots(snapshots);
  const dateKey = getIstTimeParts(latestClosed.timestamp).dateKey;
  const deepak = evaluateDeepakDecision(snapshots, dateKey);
  const deepak2 = evaluateDeepak2Decision(snapshots, dateKey);

  if (!deepak) {
    return {
      candleCount: closedCandles.length,
      usableSnapshotCount: usable.length,
      latestClosedAt: latestClosed.timestamp,
      result: null,
    };
  }

  return {
    candleCount: closedCandles.length,
    usableSnapshotCount: usable.length,
    latestClosedAt: latestClosed.timestamp,
    result: {
      decision: deepak.decision,
      reasons: deepak.reasons,
      snapshot: deepak.snapshot,
      deepak,
      deepak2,
    },
  };
}
