import { oppositeTransactionType } from "./signalKeys.js";
import type { LedgerEntry, PositionLedger } from "./positionLedger.js";

export type SamcoOrderBucket = "open" | "executed" | "rejected";

export interface SamcoOrderView {
  id: string;
  bucket: SamcoOrderBucket;
  kind: "entry" | "exit";
  stockName: string;
  tradingSymbol: string;
  timing: string;
  side: "BUY" | "SELL";
  limitPrice: number | null;
  quantity: number;
  orderNumber: string | null;
  status: string;
  strategy: string;
  signalKey: string;
  reason?: string;
}

export interface SamcoOrdersResponse {
  open: SamcoOrderView[];
  executed: SamcoOrderView[];
  rejected: SamcoOrderView[];
  updatedAt: string;
  signalSource: {
    date: string | null;
    variant: string | null;
    tradeCount: number;
    runAt: string | null;
  };
}

function stockLabel(entry: LedgerEntry): string {
  if (entry.stockName && entry.stockName.trim().length > 0) {
    return entry.stockName;
  }
  return entry.tradingSymbol;
}

function entryOrder(entry: LedgerEntry, bucket: SamcoOrderBucket): SamcoOrderView {
  return {
    id: `${entry.signalKey}:entry`,
    bucket,
    kind: "entry",
    stockName: stockLabel(entry),
    tradingSymbol: entry.tradingSymbol,
    timing: entry.entryTimeIst,
    side: entry.side,
    limitPrice: entry.limitPrice ?? entry.entryPrice,
    quantity: entry.quantity,
    orderNumber: entry.orderNumber,
    status: entry.status,
    strategy: entry.strategy,
    signalKey: entry.signalKey,
    reason: entry.rejectedReason ?? entry.lastError,
  };
}

function exitOrder(entry: LedgerEntry, bucket: SamcoOrderBucket): SamcoOrderView {
  return {
    id: `${entry.signalKey}:exit`,
    bucket,
    kind: "exit",
    stockName: stockLabel(entry),
    tradingSymbol: entry.tradingSymbol,
    timing: entry.exitTimeIst ?? entry.closedAt ?? "—",
    side: entry.exitSide ?? oppositeTransactionType(entry.side),
    limitPrice: entry.exitLimitPrice ?? entry.exitPrice ?? null,
    quantity: entry.quantity,
    orderNumber: entry.exitOrderNumber ?? null,
    status: entry.status,
    strategy: entry.strategy,
    signalKey: entry.signalKey,
    reason: entry.exitReason ?? entry.lastError,
  };
}

/** Project ledger positions into Open / Executed / Rejected order rows. */
export function buildSamcoOrdersFromLedger(ledger: PositionLedger): {
  open: SamcoOrderView[];
  executed: SamcoOrderView[];
  rejected: SamcoOrderView[];
} {
  const open: SamcoOrderView[] = [];
  const executed: SamcoOrderView[] = [];
  const rejected: SamcoOrderView[] = [];

  for (const entry of ledger.entries) {
    if (entry.status === "failed") {
      rejected.push(entryOrder(entry, "rejected"));
      continue;
    }

    if (entry.status === "open" || entry.status === "closing" || entry.status === "pending") {
      open.push(entryOrder(entry, "open"));
      continue;
    }

    if (entry.status === "closed") {
      executed.push(entryOrder(entry, "executed"));
      executed.push(exitOrder(entry, "executed"));
    }
  }

  const byTiming = (left: SamcoOrderView, right: SamcoOrderView) =>
    left.timing.localeCompare(right.timing) || left.tradingSymbol.localeCompare(right.tradingSymbol);

  open.sort(byTiming);
  executed.sort(byTiming);
  rejected.sort(byTiming);

  return { open, executed, rejected };
}
