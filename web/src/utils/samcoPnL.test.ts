import { describe, expect, it } from "vitest";

import type { SamcoLedgerEntry } from "../api/samco";
import {
  buildSamcoPnLSummary,
  computeSamcoTradeRealizedPnL,
} from "./samcoPnL";

function entry(
  overrides: Partial<SamcoLedgerEntry> &
    Pick<SamcoLedgerEntry, "tradingSymbol" | "side" | "status">,
): SamcoLedgerEntry {
  return {
    signalKey: `${overrides.strategy ?? "deeppro1"}-${overrides.tradingSymbol}-09:45-1`,
    strategy: "deeppro1",
    exchange: "NSE",
    quantity: 10,
    entryPrice: 100,
    limitPrice: 100,
    entryTimeIst: "09:45",
    orderNumber: "1",
    exitTimeIst: "11:00",
    exitPrice: 101,
    exitLimitPrice: 101,
    ...overrides,
  };
}

describe("samcoPnL", () => {
  it("computes BUY/SELL realized PnL with quantity", () => {
    expect(computeSamcoTradeRealizedPnL("BUY", 100, 101.5, 10)).toBeCloseTo(15);
    expect(computeSamcoTradeRealizedPnL("SELL", 100, 98.5, 10)).toBeCloseTo(15);
    expect(computeSamcoTradeRealizedPnL("BUY", 100, 99, 10)).toBeCloseTo(-10);
    expect(computeSamcoTradeRealizedPnL("SELL", 100, 101, 10)).toBeCloseTo(-10);
  });

  it("summarizes closed trades and ignores open/failed", () => {
    const summary = buildSamcoPnLSummary([
      entry({
        tradingSymbol: "TCS",
        side: "BUY",
        status: "closed",
        entryPrice: 3500,
        exitPrice: 3510,
        quantity: 10,
        exitTimeIst: "11:00",
      }),
      entry({
        tradingSymbol: "INFY",
        side: "SELL",
        status: "closed",
        entryPrice: 1600,
        exitPrice: 1590,
        quantity: 10,
        exitTimeIst: "12:00",
        signalKey: "deeppro1-INFY-10:15-1",
      }),
      entry({
        tradingSymbol: "RELIANCE",
        side: "BUY",
        status: "open",
        entryPrice: 2800,
        exitPrice: null,
        quantity: 10,
        signalKey: "deeppro1-RELIANCE-10:30-1",
      }),
      entry({
        tradingSymbol: "HDFCBANK",
        side: "BUY",
        status: "failed",
        entryPrice: 1500,
        quantity: 10,
        signalKey: "deeppro1-HDFCBANK-09:30-1",
      }),
    ]);

    expect(summary.closedTradeCount).toBe(2);
    expect(summary.openPositionCount).toBe(1);
    expect(summary.totalQuantity).toBe(20);
    // TCS: (3510-3500)*10 = 100; INFY short: (1600-1590)*10 = 100
    expect(summary.totalRealizedPnL).toBeCloseTo(200);
    expect(summary.winners).toBe(2);
    expect(summary.losers).toBe(0);
    expect(summary.closedTrades.map((trade) => trade.tradingSymbol)).toEqual([
      "TCS",
      "INFY",
    ]);
  });
});
