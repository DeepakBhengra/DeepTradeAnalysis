import { describe, expect, it } from "vitest";

import type { DeepakDayScanTrade } from "../types/backtest";
import {
  buildDayScanCsvFilename,
  buildDayScanTradesCsv,
} from "./dayScanCsv";

function makeTrade(overrides: Partial<DeepakDayScanTrade> = {}): DeepakDayScanTrade {
  return {
    symbol: "NSE:HDFCBANK",
    tradingSymbol: "HDFCBANK",
    sector: "Bank",
    date: "2026-05-11",
    side: "BUY",
    scenarioNumber: 2,
    scenarioKey: "deepak continue upward direction - 2",
    entryTimeIst: "10:30",
    entryPrice: 1500.5,
    exitTimeIst: "14:15",
    exitPrice: 1505.25,
    targetHit: true,
    profit: 4.75,
    profitTarget: 4.5,
    bbMatchType: "crossed",
    ...overrides,
  };
}

describe("buildDayScanTradesCsv", () => {
  it("emits header-only CSV when there are no trades", () => {
    const csv = buildDayScanTradesCsv([]);
    expect(csv).toBe(
      "Stock,Sector,Date,Side,Sc#,Scenario,Entry IST,Entry,Exit IST,Exit,Exit Type,Target,Profit,Match\r\n",
    );
  });

  it("maps trade fields and strips strategy prefixes from scenario labels", () => {
    const csv = buildDayScanTradesCsv([makeTrade()]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      "HDFCBANK,Bank,2026-05-11,BUY,2,continue upward direction - 2,10:30,1500.50,14:15,1505.25,Target,4.50,4.75,crossed",
    );
  });

  it("leaves null exits blank and escapes commas in scenario labels", () => {
    const csv = buildDayScanTradesCsv([
      makeTrade({
        scenarioKey: "deepak custom, quoted scenario",
        exitTimeIst: null,
        exitPrice: null,
        targetHit: false,
        profit: null,
      }),
    ]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[1]).toContain('"custom, quoted scenario"');
    expect(lines[1]).toContain(",10:30,1500.50,,,,4.50,,crossed");
  });
});

describe("buildDayScanCsvFilename", () => {
  it("builds a dated filename from the prefix", () => {
    expect(buildDayScanCsvFilename("deepak-day-scan", "2026-05-11")).toBe(
      "deepak-day-scan-2026-05-11.csv",
    );
    expect(buildDayScanCsvFilename("deepak-2-day-scan", "2026-05-11")).toBe(
      "deepak-2-day-scan-2026-05-11.csv",
    );
  });
});
