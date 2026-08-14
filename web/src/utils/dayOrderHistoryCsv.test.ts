import { describe, expect, it } from "vitest";

import type { DayOrderFill } from "../types/dayOrder";
import {
  buildDayOrderExportSettings,
  buildDayOrderHistoryCsv,
  buildDayOrderHistoryCsvFilename,
  buildDayOrderHistoryExportFilename,
  buildDayOrderHistoryWorkbookXml,
  buildDayOrderSettingsCsv,
} from "./dayOrderHistoryCsv";

function makeFill(overrides: Partial<DayOrderFill> = {}): DayOrderFill {
  return {
    id: "fill-1",
    kind: "entry",
    signalKey: "deeppro1-RELIANCE-09:15-1",
    tradingSymbol: "RELIANCE",
    symbol: "Reliance Industries",
    strategy: "deeppro1",
    side: "BUY",
    quantity: 100,
    price: 1290.45,
    timeIst: "09:15",
    sessionIndex: 0,
    realizedPnL: null,
    ...overrides,
  };
}

const sampleSettings = buildDayOrderExportSettings(
  "2026-05-29",
  "deeppro1",
  "Deeppro1",
  {
    quantity: 1000,
    minEntryPrice: 0,
    maxEntryPrice: 1900,
    stopLossPct: 0.15,
    tradingSymbols: [],
  },
);

describe("buildDayOrderHistoryCsv", () => {
  it("emits header-only CSV when there are no fills", () => {
    expect(buildDayOrderHistoryCsv([])).toBe(
      "Type,Side,Qty,Stock,Price,Strategy,Exit Type,Time (IST),Charges,Gross P&L,Net P&L\r\n",
    );
  });

  it("maps fill columns and leaves entry exit type and P&L blank", () => {
    const csv = buildDayOrderHistoryCsv([makeFill()]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      "entry,BUY,100,RELIANCE,1290.45,Deeppro1,,09:15,,,",
    );
  });

  it("includes exit type, charges, gross and net P&L for exit fills", () => {
    const csv = buildDayOrderHistoryCsv([
      makeFill({
        id: "fill-2",
        kind: "exit",
        side: "SELL",
        price: 1295.1,
        timeIst: "11:45",
        realizedPnL: 465,
        grossPnL: 540,
        brokerageCharges: 75,
        exitReason: "target",
        targetHit: true,
      }),
    ]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[1]).toBe(
      "exit,SELL,100,RELIANCE,1295.10,Deeppro1,Target,11:45,75.00,540.00,465.00",
    );
  });

  it("labels stop-loss % exits", () => {
    const csv = buildDayOrderHistoryCsv([
      makeFill({
        kind: "exit",
        side: "SELL",
        exitReason: "stop_loss",
        realizedPnL: -100,
        brokerageCharges: 40,
        grossPnL: -60,
        timeIst: "10:15",
      }),
    ]);
    expect(csv).toContain(",Stop-loss %,10:15,");
  });

  it("keeps chronological order (oldest first)", () => {
    const csv = buildDayOrderHistoryCsv([
      makeFill({ id: "a", timeIst: "09:15" }),
      makeFill({
        id: "b",
        timeIst: "11:45",
        kind: "exit",
        side: "SELL",
        realizedPnL: 10,
        exitReason: "eod",
      }),
    ]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[1]).toContain(",09:15,");
    expect(lines[2]).toContain(",11:45,");
  });
});

describe("buildDayOrderSettingsCsv", () => {
  it("includes date, rule, qty, price range, SL%, and stocks", () => {
    const csv = buildDayOrderSettingsCsv(sampleSettings);
    expect(csv).toContain("Date,2026-05-29");
    expect(csv).toContain("Rule variant,Deeppro1");
    expect(csv).toContain("Quantity,1000");
    expect(csv).toContain("Min entry price,0");
    expect(csv).toContain("Max entry price,1900");
    expect(csv).toContain("Stop-loss %,0.15");
    expect(csv).toContain("Stocks,all");
  });

  it("labels blank SL as off", () => {
    const csv = buildDayOrderSettingsCsv({
      ...sampleSettings,
      stopLossPct: null,
    });
    expect(csv).toContain("Stop-loss %,off");
  });
});

describe("buildDayOrderHistoryWorkbookXml", () => {
  it("includes Settings and Order History worksheets", () => {
    const xml = buildDayOrderHistoryWorkbookXml(
      [
        makeFill({
          kind: "exit",
          side: "SELL",
          exitReason: "stop_loss",
          realizedPnL: -50,
          timeIst: "10:00",
        }),
      ],
      sampleSettings,
    );
    expect(xml).toContain('ss:Name="Settings"');
    expect(xml).toContain('ss:Name="Order History"');
    expect(xml).toContain("2026-05-29");
    expect(xml).toContain("Stop-loss %");
    expect(xml).toContain("0.15");
    expect(xml).toContain("Stop-loss %");
    expect(xml).toContain("RELIANCE");
  });
});

describe("buildDayOrderHistoryExportFilename", () => {
  it("embeds date, rule, qty, range, SL, and stocks in the filename", () => {
    expect(buildDayOrderHistoryExportFilename(sampleSettings)).toBe(
      "day-order_2026-05-29_Deeppro1_qty1000_range0-1900_sl0.15_stocks-all.xls",
    );
  });

  it("uses sl-off when stop-loss is disabled", () => {
    expect(
      buildDayOrderHistoryExportFilename({
        ...sampleSettings,
        stopLossPct: null,
      }),
    ).toBe(
      "day-order_2026-05-29_Deeppro1_qty1000_range0-1900_sl-off_stocks-all.xls",
    );
  });

  it("lists up to three stock symbols in the filename", () => {
    expect(
      buildDayOrderHistoryExportFilename({
        ...sampleSettings,
        tradingSymbols: ["RELIANCE", "TCS"],
      }),
    ).toBe(
      "day-order_2026-05-29_Deeppro1_qty1000_range0-1900_sl0.15_stocksRELIANCE-TCS.xls",
    );
  });
});

describe("buildDayOrderHistoryCsvFilename", () => {
  it("includes the analysis date", () => {
    expect(buildDayOrderHistoryCsvFilename("2026-08-05")).toBe(
      "day-order-history-2026-08-05.csv",
    );
  });
});
