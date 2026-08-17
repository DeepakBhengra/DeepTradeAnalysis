import { describe, expect, it } from "vitest";

import type { SamcoLedgerEntry } from "../api/samco";
import { brokerageCharges } from "./brokerageCharges";
import { buildSamcoTradeAnalysis } from "./samcoTradeAnalysis";

function entry(
  overrides: Partial<SamcoLedgerEntry> &
    Pick<SamcoLedgerEntry, "tradingSymbol" | "side" | "status">,
): SamcoLedgerEntry {
  return {
    signalKey: `${overrides.strategy ?? "deeppro1"}-${overrides.tradingSymbol}-09:45-1`,
    strategy: "deeppro1",
    exchange: "NSE",
    quantity: 1000,
    entryPrice: 100.61,
    limitPrice: 100.61,
    entryTimeIst: "11:30",
    orderNumber: "1",
    exitTimeIst: "12:15",
    exitPrice: 101.32,
    exitLimitPrice: 101.32,
    exitSide: overrides.side === "BUY" ? "SELL" : "BUY",
    stockName: overrides.stockName ?? "Punjab National Bank",
    ...overrides,
  };
}

describe("buildSamcoTradeAnalysis", () => {
  it("pairs closed entry with square-off and nets P&L after taxes", () => {
    const rows = buildSamcoTradeAnalysis([
      entry({
        tradingSymbol: "PNB",
        side: "BUY",
        status: "closed",
        entryPrice: 100.61,
        exitPrice: 101.32,
        quantity: 1000,
        entryTimeIst: "11:30",
        exitTimeIst: "12:15",
        exitReason: "target",
      }),
    ]);

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.stockName).toBe("Punjab National Bank");
    expect(row.entry).toEqual({
      signalType: "Entry",
      timing: "11:30",
      tradeType: "BUY",
      price: 100.61,
    });
    expect(row.exit).toEqual({
      signalType: "Exit",
      timing: "12:15",
      tradeType: "SELL",
      price: 101.32,
    });

    const expected = brokerageCharges({
      buyPrice: 100.61,
      sellPrice: 101.32,
      quantity: 1000,
    });
    expect(row.grossPnL).toBe(expected.grossProfit);
    expect(row.charges).toBe(expected.totalCharges);
    expect(row.netPnL).toBe(expected.netProfit);
    expect(row.netPnL).toBeLessThan(row.grossPnL!);
  });

  it("handles short entry with buy cover exit", () => {
    const rows = buildSamcoTradeAnalysis([
      entry({
        tradingSymbol: "PNB",
        side: "SELL",
        status: "closed",
        entryPrice: 100.13,
        exitPrice: 99.66,
        quantity: 1000,
        entryTimeIst: "09:45",
        exitTimeIst: "10:45",
        exitSide: "BUY",
        exitReason: "target",
        signalKey: "deeppro1-PNB-09:45-1",
      }),
    ]);

    const expected = brokerageCharges({
      buyPrice: 99.66,
      sellPrice: 100.13,
      quantity: 1000,
    });
    expect(rows[0].entry.tradeType).toBe("SELL");
    expect(rows[0].exit.tradeType).toBe("BUY");
    expect(rows[0].netPnL).toBe(expected.netProfit);
    expect(rows[0].charges).toBe(expected.totalCharges);
  });

  it("shows open entries with pending exit and no tax P&L yet", () => {
    const rows = buildSamcoTradeAnalysis([
      entry({
        tradingSymbol: "TCS",
        side: "BUY",
        status: "open",
        entryPrice: 3500,
        exitPrice: null,
        exitTimeIst: null,
        stockName: "Tata Consultancy",
        signalKey: "deeppro1-TCS-10:00-1",
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("open");
    expect(rows[0].entry.signalType).toBe("Entry");
    expect(rows[0].exit.timing).toBeNull();
    expect(rows[0].exit.price).toBeNull();
    expect(rows[0].charges).toBeNull();
    expect(rows[0].netPnL).toBeNull();
  });

  it("ignores failed ledger rows", () => {
    expect(
      buildSamcoTradeAnalysis([
        entry({
          tradingSymbol: "INFY",
          side: "BUY",
          status: "failed",
          signalKey: "deeppro1-INFY-09:15-1",
        }),
      ]),
    ).toHaveLength(0);
  });
});
