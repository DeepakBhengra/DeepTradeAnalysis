import type { SamcoLedgerEntry } from "../api/samco";

export interface SamcoClosedTradePnL {
  signalKey: string;
  tradingSymbol: string;
  stockName: string;
  strategy: string;
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  entryTimeIst: string;
  exitTimeIst: string | null;
  exitReason?: string;
  /** Realized PnL in ₹ for this closed trade (qty applied). */
  realizedPnL: number;
}

export interface SamcoPnLSummary {
  closedTrades: SamcoClosedTradePnL[];
  closedTradeCount: number;
  openPositionCount: number;
  totalQuantity: number;
  totalRealizedPnL: number;
  winners: number;
  losers: number;
}

export function computeSamcoTradeRealizedPnL(
  side: "BUY" | "SELL",
  entryPrice: number,
  exitPrice: number,
  quantity: number,
): number {
  if (
    !Number.isFinite(entryPrice) ||
    !Number.isFinite(exitPrice) ||
    !Number.isFinite(quantity)
  ) {
    return 0;
  }
  if (side === "BUY") {
    return (exitPrice - entryPrice) * quantity;
  }
  return (entryPrice - exitPrice) * quantity;
}

function resolveExitPrice(entry: SamcoLedgerEntry): number | null {
  const candidates = [entry.exitPrice, entry.exitLimitPrice];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function resolveEntryPrice(entry: SamcoLedgerEntry): number | null {
  const candidates = [entry.entryPrice, entry.limitPrice];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

export function buildSamcoPnLSummary(
  entries: SamcoLedgerEntry[],
): SamcoPnLSummary {
  const closedTrades: SamcoClosedTradePnL[] = [];
  let openPositionCount = 0;

  for (const entry of entries) {
    if (
      entry.status === "open" ||
      entry.status === "closing" ||
      entry.status === "pending"
    ) {
      openPositionCount += 1;
      continue;
    }
    if (entry.status !== "closed") {
      continue;
    }

    const entryPrice = resolveEntryPrice(entry);
    const exitPrice = resolveExitPrice(entry);
    if (entryPrice == null || exitPrice == null) {
      continue;
    }

    const realizedPnL = computeSamcoTradeRealizedPnL(
      entry.side,
      entryPrice,
      exitPrice,
      entry.quantity,
    );

    closedTrades.push({
      signalKey: entry.signalKey,
      tradingSymbol: entry.tradingSymbol,
      stockName: entry.stockName || entry.tradingSymbol,
      strategy: entry.strategy,
      side: entry.side,
      quantity: entry.quantity,
      entryPrice,
      exitPrice,
      entryTimeIst: entry.entryTimeIst,
      exitTimeIst: entry.exitTimeIst ?? null,
      exitReason: entry.exitReason,
      realizedPnL,
    });
  }

  closedTrades.sort((left, right) => {
    const timeCmp = (left.exitTimeIst ?? "").localeCompare(right.exitTimeIst ?? "");
    if (timeCmp !== 0) {
      return timeCmp;
    }
    return left.tradingSymbol.localeCompare(right.tradingSymbol);
  });

  return {
    closedTrades,
    closedTradeCount: closedTrades.length,
    openPositionCount,
    totalQuantity: closedTrades.reduce((sum, trade) => sum + trade.quantity, 0),
    totalRealizedPnL: closedTrades.reduce(
      (sum, trade) => sum + trade.realizedPnL,
      0,
    ),
    winners: closedTrades.filter((trade) => trade.realizedPnL > 0).length,
    losers: closedTrades.filter((trade) => trade.realizedPnL < 0).length,
  };
}
