import type { DeepakBacktestTrade } from "../types/backtest";

export interface SignalDayOption {
  date: string;
  signalCount: number;
  buyCount: number;
  sellCount: number;
}

/** Unique trading days that produced at least one Deepak trade, newest first. */
export function signalDaysFromTrades(trades: DeepakBacktestTrade[]): SignalDayOption[] {
  const byDate = new Map<string, SignalDayOption>();

  for (const trade of trades) {
    const existing = byDate.get(trade.date);
    if (existing) {
      existing.signalCount += 1;
      if (trade.side === "BUY") {
        existing.buyCount += 1;
      } else {
        existing.sellCount += 1;
      }
      continue;
    }
    byDate.set(trade.date, {
      date: trade.date,
      signalCount: 1,
      buyCount: trade.side === "BUY" ? 1 : 0,
      sellCount: trade.side === "SELL" ? 1 : 0,
    });
  }

  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}
