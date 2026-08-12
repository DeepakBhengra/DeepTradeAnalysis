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

  it("summarizes closed trades, includes open without mark, ignores failed", () => {
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
    expect(summary.openTrades[0].tradingSymbol).toBe("RELIANCE");
    expect(summary.openTrades[0].canManualExit).toBe(true);
    expect(summary.totalQuantityClosed).toBe(20);
    expect(summary.totalUnrealizedPnL).toBe(0);
    // TCS: (3510-3500)*10 = 100; INFY short: (1600-1590)*10 = 100
    expect(summary.totalRealizedPnL).toBeCloseTo(200);
    expect(summary.totalPnL).toBeCloseTo(200);
    expect(summary.winners).toBe(2);
    expect(summary.losers).toBe(0);
    expect(summary.closedTrades.map((trade) => trade.tradingSymbol)).toEqual([
      "TCS",
      "INFY",
    ]);
  });

  it("includes unrealized PnL for open positions with mark price", () => {
    const summary = buildSamcoPnLSummary([
      entry({
        tradingSymbol: "TITAN",
        side: "BUY",
        status: "open",
        entryPrice: 4000,
        markPrice: 3980,
        quantity: 100,
        exitPrice: null,
        exitTimeIst: null,
        signalKey: "deeppro1-TITAN-10:00-1",
      }),
      entry({
        tradingSymbol: "JSWSTEEL",
        side: "SELL",
        status: "open",
        entryPrice: 900,
        markPrice: 905,
        quantity: 100,
        exitPrice: null,
        exitTimeIst: null,
        signalKey: "deeppro1-JSWSTEEL-10:00-1",
      }),
      entry({
        tradingSymbol: "TCS",
        side: "BUY",
        status: "closed",
        entryPrice: 3500,
        exitPrice: 3510,
        quantity: 10,
        exitTimeIst: "11:00",
      }),
    ]);

    expect(summary.openPositionCount).toBe(2);
    expect(summary.totalQuantityOpen).toBe(200);
    // TITAN long: (3980-4000)*100 = -2000; JSW short: (900-905)*100 = -500
    expect(summary.totalUnrealizedPnL).toBeCloseTo(-2500);
    expect(summary.totalRealizedPnL).toBeCloseTo(100);
    expect(summary.totalPnL).toBeCloseTo(-2400);
    expect(summary.openTrades.map((trade) => trade.tradingSymbol)).toEqual([
      "JSWSTEEL",
      "TITAN",
    ]);
    expect(summary.openTrades[0].status).toBe("open");
    expect(summary.openTrades[0].markOrExitPrice).toBe(905);
  });

  it("includes open positions without mark using entry for display", () => {
    const summary = buildSamcoPnLSummary([
      entry({
        tradingSymbol: "INFY",
        side: "BUY",
        status: "open",
        entryPrice: 1500,
        markPrice: null,
        quantity: 50,
        exitPrice: null,
        exitTimeIst: null,
        signalKey: "deeppro1-INFY-10:00-1",
      }),
    ]);

    expect(summary.openPositionCount).toBe(1);
    expect(summary.openTrades[0].markOrExitPrice).toBe(1500);
    expect(summary.openTrades[0].pnl).toBe(0);
    expect(summary.openTrades[0].canManualExit).toBe(true);
    expect(summary.totalUnrealizedPnL).toBe(0);
  });
});
