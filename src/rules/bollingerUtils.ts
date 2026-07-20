import { config } from "../config.js";
import type { IndicatorSnapshot } from "../types.js";

export function pctDistance(a: number, b: number, close: number): number {
  return (Math.abs(a - b) / close) * 100;
}

export function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function sessionPriceExtremes(snapshots: IndicatorSnapshot[]): {
  sessionHigh: number;
  sessionLow: number;
  highCandle: IndicatorSnapshot;
  lowCandle: IndicatorSnapshot;
} {
  const [first] = snapshots;
  let highCandle = first;
  let lowCandle = first;

  for (const snapshot of snapshots) {
    if (snapshot.high > highCandle.high) {
      highCandle = snapshot;
    }
    if (snapshot.low < lowCandle.low) {
      lowCandle = snapshot;
    }
  }

  return {
    sessionHigh: highCandle.high,
    sessionLow: lowCandle.low,
    highCandle,
    lowCandle,
  };
}

export function isBbNearPrice(
  bbLevel: number,
  price: number,
  referenceClose: number,
): boolean {
  return (
    pctDistance(bbLevel, price, referenceClose) <=
    config.thresholds.bbClosePctThreshold
  );
}

export type BbTopMatchType = "crossed" | "close";

export type BbBottomMatchType = "crossed" | "close";

export function bbMatchGapPct(
  matchType: "crossed" | "close",
  kind: "top" | "bottom",
  bbLevel: number,
  price: number,
  referenceClose: number,
): number {
  if (matchType === "crossed") {
    return kind === "top"
      ? ((price - bbLevel) / referenceClose) * 100
      : ((bbLevel - price) / referenceClose) * 100;
  }
  return pctDistance(bbLevel, price, referenceClose);
}

export function classifyBbTopMatch(
  upper: number,
  high: number,
  close: number,
): BbTopMatchType | null {
  if (high >= upper) {
    return "crossed";
  }
  if (isBbNearPrice(upper, high, close)) {
    return "close";
  }
  return null;
}

export function classifyBbBottomMatch(
  lower: number,
  low: number,
  close: number,
): BbBottomMatchType | null {
  if (low <= lower) {
    return "crossed";
  }
  if (isBbNearPrice(lower, low, close)) {
    return "close";
  }
  return null;
}
