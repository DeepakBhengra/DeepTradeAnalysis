import type {
  DeepakDayScanPayload,
  DeepakDayScanSummary,
  DeepakDayScanTrade,
} from "../types/backtest";

export const DEFAULT_DAY_SCAN_ENTRY_PRICE_MIN = 0;
export const DEFAULT_DAY_SCAN_ENTRY_PRICE_MAX = 3900;

export function isDayScanEntryPriceInRange(
  entryPrice: number,
  min: number,
  max: number,
): boolean {
  if (!Number.isFinite(entryPrice) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return false;
  }
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return entryPrice >= low && entryPrice <= high;
}

export function filterDayScanTradesByEntryPrice<T extends DeepakDayScanTrade>(
  trades: T[],
  min: number,
  max: number,
): T[] {
  return trades.filter((trade) =>
    isDayScanEntryPriceInRange(trade.entryPrice, min, max),
  );
}

export function rebuildDayScanSummaryFromTrades(
  trades: DeepakDayScanTrade[],
  base: DeepakDayScanSummary,
): DeepakDayScanSummary {
  const profits = trades
    .map((trade) => trade.profit)
    .filter((profit): profit is number => typeof profit === "number");
  const stocksWithSignals = new Set(trades.map((trade) => trade.tradingSymbol))
    .size;
  const stopsHit = trades.reduce(
    (count, trade) => count + (trade.stopLossHit ? 1 : 0),
    0,
  );

  return {
    ...base,
    stocksWithSignals,
    totalSignals: trades.length,
    buyCount: trades.filter((trade) => trade.side === "BUY").length,
    sellCount: trades.filter((trade) => trade.side === "SELL").length,
    targetsHit: trades.filter((trade) => trade.targetHit).length,
    targetsMissed: trades.filter(
      (trade) => trade.exitTimeIst != null && !trade.targetHit,
    ).length,
    avgProfit:
      profits.length > 0
        ? profits.reduce((sum, profit) => sum + profit, 0) / profits.length
        : null,
    ...(base.stopsHit != null ? { stopsHit } : {}),
  };
}

export function filterDayScanPayloadByEntryPrice<T extends DeepakDayScanPayload>(
  payload: T,
  min: number,
  max: number,
): T {
  const trades = filterDayScanTradesByEntryPrice(payload.trades, min, max);
  if (trades.length === payload.trades.length) {
    return payload;
  }

  return {
    ...payload,
    trades,
    summary: rebuildDayScanSummaryFromTrades(trades, payload.summary),
  };
}

export function parseDayScanEntryPriceInput(
  value: string,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
