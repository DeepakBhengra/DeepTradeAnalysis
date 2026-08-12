import type { SamcoLedgerEntry } from "../api/samco";

export interface SamcoTradePnLRow {
  signalKey: string;
  tradingSymbol: string;
  stockName: string;
  strategy: string;
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  /** Exit price when closed; mark price when open. */
  markOrExitPrice: number;
  entryTimeIst: string;
  exitTimeIst: string | null;
  exitReason?: string;
  status: "closed" | "open";
  /** Realized (closed) or unrealized (open) PnL for this trade. */
  pnl: number;
}

export interface SamcoPnLSummary {
  closedTrades: SamcoTradePnLRow[];
  openTrades: SamcoTradePnLRow[];
  closedTradeCount: number;
  openPositionCount: number;
  totalQuantityClosed: number;
  totalQuantityOpen: number;
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  totalPnL: number;
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

function resolveMarkPrice(entry: SamcoLedgerEntry): number | null {
  if (typeof entry.markPrice === "number" && Number.isFinite(entry.markPrice)) {
    return entry.markPrice;
  }
  return null;
}

export function buildSamcoPnLSummary(
  entries: SamcoLedgerEntry[],
): SamcoPnLSummary {
  const closedTrades: SamcoTradePnLRow[] = [];
  const openTrades: SamcoTradePnLRow[] = [];

  for (const entry of entries) {
    const entryPrice = resolveEntryPrice(entry);
    if (entryPrice == null) {
      continue;
    }

    if (
      entry.status === "open" ||
      entry.status === "closing" ||
      entry.status === "pending"
    ) {
      const markPrice = resolveMarkPrice(entry);
      if (markPrice == null) {
        continue;
      }
      openTrades.push({
        signalKey: entry.signalKey,
        tradingSymbol: entry.tradingSymbol,
        stockName: entry.stockName || entry.tradingSymbol,
        strategy: entry.strategy,
        side: entry.side,
        quantity: entry.quantity,
        entryPrice,
        markOrExitPrice: markPrice,
        entryTimeIst: entry.entryTimeIst,
        exitTimeIst: null,
        exitReason: undefined,
        status: "open",
        pnl: computeSamcoTradeRealizedPnL(
          entry.side,
          entryPrice,
          markPrice,
          entry.quantity,
        ),
      });
      continue;
    }

    if (entry.status !== "closed") {
      continue;
    }

    const exitPrice = resolveExitPrice(entry);
    if (exitPrice == null) {
      continue;
    }

    closedTrades.push({
      signalKey: entry.signalKey,
      tradingSymbol: entry.tradingSymbol,
      stockName: entry.stockName || entry.tradingSymbol,
      strategy: entry.strategy,
      side: entry.side,
      quantity: entry.quantity,
      entryPrice,
      markOrExitPrice: exitPrice,
      entryTimeIst: entry.entryTimeIst,
      exitTimeIst: entry.exitTimeIst ?? null,
      exitReason: entry.exitReason,
      status: "closed",
      pnl: computeSamcoTradeRealizedPnL(
        entry.side,
        entryPrice,
        exitPrice,
        entry.quantity,
      ),
    });
  }

  closedTrades.sort((left, right) => {
    const timeCmp = (left.exitTimeIst ?? "").localeCompare(right.exitTimeIst ?? "");
    if (timeCmp !== 0) {
      return timeCmp;
    }
    return left.tradingSymbol.localeCompare(right.tradingSymbol);
  });
  openTrades.sort((left, right) =>
    left.tradingSymbol.localeCompare(right.tradingSymbol),
  );

  const totalRealizedPnL = closedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const totalUnrealizedPnL = openTrades.reduce((sum, trade) => sum + trade.pnl, 0);

  return {
    closedTrades,
    openTrades,
    closedTradeCount: closedTrades.length,
    openPositionCount: openTrades.length,
    totalQuantityClosed: closedTrades.reduce((sum, trade) => sum + trade.quantity, 0),
    totalQuantityOpen: openTrades.reduce((sum, trade) => sum + trade.quantity, 0),
    totalRealizedPnL,
    totalUnrealizedPnL,
    totalPnL: totalRealizedPnL + totalUnrealizedPnL,
    winners: closedTrades.filter((trade) => trade.pnl > 0).length,
    losers: closedTrades.filter((trade) => trade.pnl < 0).length,
  };
}
