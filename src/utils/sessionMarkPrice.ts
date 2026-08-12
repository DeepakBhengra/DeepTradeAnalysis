import type { Candle, IndicatorSnapshot } from "../types.js";
import {
  formatIstTime,
  getIstTimeParts,
  isWithinIstSessionWindow,
} from "./marketTime.js";

/** Deeppro1 / Day Scan mark price: candle mid (high+low)/2. */
export function candleMidPrice(candle: Pick<Candle, "high" | "low">): number {
  return (candle.high + candle.low) / 2;
}

/**
 * Last same-day session bar mid for unrealized / open-position marking.
 * Returns null when no in-session bar exists for the date.
 */
export function lastSameDaySessionMark(
  snapshots: Array<Pick<IndicatorSnapshot, "timestamp" | "high" | "low">>,
  dateKey: string,
  sessionStart = "09:15",
  sessionEnd = "15:30",
): { price: number; timeIst: string } | null {
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const snap = snapshots[i];
    if (!isWithinIstSessionWindow(snap.timestamp, sessionStart, sessionEnd)) {
      continue;
    }
    if (getIstTimeParts(snap.timestamp).dateKey !== dateKey) {
      continue;
    }
    return {
      price: candleMidPrice(snap),
      timeIst: formatIstTime(snap.timestamp),
    };
  }
  return null;
}

/** Attach last session mid to still-open Day Scan trades (unrealized P&L). */
export function withOpenTradeMarkPrices<
  T extends { exitTimeIst: string | null },
>(
  trades: T[],
  snapshots: Array<Pick<IndicatorSnapshot, "timestamp" | "high" | "low">>,
  dateKey: string,
): Array<T & { markPrice: number | null }> {
  const openMark = lastSameDaySessionMark(snapshots, dateKey);
  return trades.map((trade) => ({
    ...trade,
    markPrice:
      trade.exitTimeIst == null ? openMark?.price ?? null : null,
  }));
}
