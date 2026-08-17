import { describe, expect, it } from "vitest";

import type { SamcoTradeAnalysisRow } from "./samcoTradeAnalysis";
import {
  buildSamcoTradeAnalysisCsv,
  buildSamcoTradeAnalysisCsvFilename,
} from "./samcoTradeAnalysisCsv";

function makeRow(
  overrides: Partial<SamcoTradeAnalysisRow> = {},
): SamcoTradeAnalysisRow {
  return {
    signalKey: "deeppro1-PNB-11:30-1",
    stockName: "Punjab National Bank",
    tradingSymbol: "PNB",
    strategy: "deeppro1",
    quantity: 1000,
    status: "closed",
    entry: {
      signalType: "Entry",
      timing: "11:30",
      tradeType: "BUY",
      price: 100.61,
    },
    exit: {
      signalType: "Exit",
      timing: "12:15",
      tradeType: "SELL",
      price: 101.32,
    },
    exitReason: "target",
    grossPnL: 710,
    charges: 77.5,
    netPnL: 632.5,
    chargesBreakdown: {
      buyValue: 100610,
      sellValue: 101320,
      turnover: 201930,
      brokerage: 40,
      stt: 25,
      exchangeTxnCharges: 6,
      sebiCharges: 0.2,
      stampDuty: 3.02,
      gst: 8.28,
      totalCharges: 77.5,
      grossProfit: 710,
      netProfit: 632.5,
    },
    ...overrides,
  };
}

describe("buildSamcoTradeAnalysisCsv", () => {
  it("emits header-only CSV when there are no rows", () => {
    expect(buildSamcoTradeAnalysisCsv([])).toBe(
      "Stock,Trading symbol,Qty,Strategy,Status,Entry timing,Entry signal,Entry trade type,Entry price,Exit timing,Exit signal,Exit trade type,Exit price,Exit type,Gross P&L,Taxes / charges,Brokerage,STT,Exchange,SEBI,Stamp,GST,Net P&L,Signal key\r\n",
    );
  });

  it("maps closed trade columns including taxes and net P&L", () => {
    const csv = buildSamcoTradeAnalysisCsv([makeRow()]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      "Punjab National Bank,PNB,1000,Deeppro1,closed,11:30,Entry,BUY,100.61,12:15,Exit,SELL,101.32,Target,710.00,77.50,40.00,25.00,6.00,0.20,3.02,8.28,632.50,deeppro1-PNB-11:30-1",
    );
  });

  it("leaves exit P&L blank for open trades", () => {
    const csv = buildSamcoTradeAnalysisCsv([
      makeRow({
        status: "open",
        exit: {
          signalType: "Exit",
          timing: null,
          tradeType: "SELL",
          price: null,
        },
        exitReason: undefined,
        grossPnL: null,
        charges: null,
        netPnL: null,
        chargesBreakdown: null,
      }),
    ]);
    const cells = csv.trimEnd().split("\r\n")[1].split(",");
    // Exit timing / price / P&L cells empty
    expect(cells[9]).toBe(""); // Exit timing
    expect(cells[12]).toBe(""); // Exit price
    expect(cells[14]).toBe(""); // Gross P&L
    expect(cells[22]).toBe(""); // Net P&L
  });
});

describe("buildSamcoTradeAnalysisCsvFilename", () => {
  it("embeds date key when provided", () => {
    expect(buildSamcoTradeAnalysisCsvFilename("2026-08-17")).toBe(
      "samco-trade-analysis-2026-08-17.csv",
    );
  });
});
