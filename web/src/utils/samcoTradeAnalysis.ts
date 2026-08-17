import type { SamcoLedgerEntry } from "../api/samco";
import {
  brokerageCharges,
  type BrokerageChargesBreakdown,
} from "./brokerageCharges";

export interface SamcoTradeAnalysisLeg {
  signalType: "Entry" | "Exit";
  timing: string | null;
  tradeType: "BUY" | "SELL" | null;
  price: number | null;
}

export interface SamcoTradeAnalysisRow {
  signalKey: string;
  stockName: string;
  tradingSymbol: string;
  strategy: string;
  quantity: number;
  status: "closed" | "open";
  entry: SamcoTradeAnalysisLeg;
  exit: SamcoTradeAnalysisLeg;
  exitReason?: string;
  grossPnL: number | null;
  /** Total brokerage-charges / taxes on the round-trip (closed only). */
  charges: number | null;
  /** Net P&L after taxes (closed only). */
  netPnL: number | null;
  chargesBreakdown: BrokerageChargesBreakdown | null;
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

function resolveExitPrice(entry: SamcoLedgerEntry): number | null {
  const candidates = [entry.exitPrice, entry.exitLimitPrice];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function oppositeSide(side: "BUY" | "SELL"): "BUY" | "SELL" {
  return side === "BUY" ? "SELL" : "BUY";
}

function roundTripCharges(
  side: "BUY" | "SELL",
  entryPrice: number,
  exitPrice: number,
  quantity: number,
): BrokerageChargesBreakdown {
  if (side === "BUY") {
    return brokerageCharges({
      buyPrice: entryPrice,
      sellPrice: exitPrice,
      quantity,
    });
  }
  return brokerageCharges({
    buyPrice: exitPrice,
    sellPrice: entryPrice,
    quantity,
  });
}

/**
 * Build paired Entry / Exit (square-off) rows for Samco Trade Analysis.
 * Closed trades include gross P&L, brokerage-charges (taxes), and net P&L.
 */
export function buildSamcoTradeAnalysis(
  entries: SamcoLedgerEntry[],
): SamcoTradeAnalysisRow[] {
  const rows: SamcoTradeAnalysisRow[] = [];

  for (const entry of entries) {
    const entryPrice = resolveEntryPrice(entry);
    if (entryPrice == null) {
      continue;
    }

    const stockName = entry.stockName || entry.tradingSymbol;
    const entryLeg: SamcoTradeAnalysisLeg = {
      signalType: "Entry",
      timing: entry.entryTimeIst || null,
      tradeType: entry.side,
      price: entryPrice,
    };

    if (
      entry.status === "open" ||
      entry.status === "closing" ||
      entry.status === "pending"
    ) {
      rows.push({
        signalKey: entry.signalKey,
        stockName,
        tradingSymbol: entry.tradingSymbol,
        strategy: entry.strategy,
        quantity: entry.quantity,
        status: "open",
        entry: entryLeg,
        exit: {
          signalType: "Exit",
          timing: null,
          tradeType: oppositeSide(entry.side),
          price: null,
        },
        exitReason: undefined,
        grossPnL: null,
        charges: null,
        netPnL: null,
        chargesBreakdown: null,
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

    const breakdown = roundTripCharges(
      entry.side,
      entryPrice,
      exitPrice,
      entry.quantity,
    );

    rows.push({
      signalKey: entry.signalKey,
      stockName,
      tradingSymbol: entry.tradingSymbol,
      strategy: entry.strategy,
      quantity: entry.quantity,
      status: "closed",
      entry: entryLeg,
      exit: {
        signalType: "Exit",
        timing: entry.exitTimeIst ?? null,
        tradeType: entry.exitSide ?? oppositeSide(entry.side),
        price: exitPrice,
      },
      exitReason: entry.exitReason,
      grossPnL: breakdown.grossProfit,
      charges: breakdown.totalCharges,
      netPnL: breakdown.netProfit,
      chargesBreakdown: breakdown,
    });
  }

  rows.sort((left, right) => {
    const leftTime = left.exit.timing ?? left.entry.timing ?? "";
    const rightTime = right.exit.timing ?? right.entry.timing ?? "";
    const timeCmp = rightTime.localeCompare(leftTime);
    if (timeCmp !== 0) {
      return timeCmp;
    }
    return left.tradingSymbol.localeCompare(right.tradingSymbol);
  });

  return rows;
}
