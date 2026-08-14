import { describe, expect, it } from "vitest";

import type {
  DayScanSimulationPayload,
  DeepakDayScanPayload,
  DeepakDayScanTrade,
} from "../types/backtest";
import {
  filterDayScanPayloadByEntryPrice,
  filterDayScanSimulationPayloadByEntryPrice,
  filterDayScanTradesByEntryPrice,
  isDayScanEntryPriceInRange,
} from "./dayScanEntryPriceFilter";

function trade(
  overrides: Partial<DeepakDayScanTrade> &
    Pick<DeepakDayScanTrade, "tradingSymbol" | "entryPrice" | "side">,
): DeepakDayScanTrade {
  return {
    date: "2026-08-12",
    symbol: overrides.tradingSymbol,
    sector: "IT",
    scenarioNumber: 1,
    scenarioKey: "s1",
    entryTimeIst: "09:45",
    exitTimeIst: "11:00",
    exitPrice: overrides.entryPrice,
    targetHit: true,
    profit: 10,
    profitTarget: 0.45,
    bbMatchType: "close",
    ...overrides,
  };
}

describe("dayScanEntryPriceFilter", () => {
  it("keeps trades inside the inclusive entry price range", () => {
    expect(isDayScanEntryPriceInRange(2734.45, 0, 3900)).toBe(true);
    expect(isDayScanEntryPriceInRange(4000, 0, 3900)).toBe(false);
    expect(isDayScanEntryPriceInRange(100, 200, 3900)).toBe(false);

    const filtered = filterDayScanTradesByEntryPrice(
      [
        trade({ tradingSymbol: "TCS", entryPrice: 3500, side: "BUY" }),
        trade({ tradingSymbol: "IDEA", entryPrice: 12, side: "SELL" }),
        trade({ tradingSymbol: "HDFCBANK", entryPrice: 4001, side: "BUY" }),
      ],
      100,
      3900,
    );

    expect(filtered.map((row) => row.tradingSymbol)).toEqual(["TCS"]);
  });

  it("rebuilds day scan summary from filtered trades", () => {
    const payload: DeepakDayScanPayload = {
      date: "2026-08-12",
      runAt: "2026-08-12T10:00:00.000Z",
      errors: [],
      trades: [
        trade({ tradingSymbol: "TCS", entryPrice: 3500, side: "BUY", targetHit: true }),
        trade({
          tradingSymbol: "RELIANCE",
          entryPrice: 2800,
          side: "SELL",
          targetHit: false,
          profit: -5,
        }),
        trade({
          tradingSymbol: "MRF",
          entryPrice: 120000,
          side: "BUY",
          targetHit: true,
          profit: 50,
        }),
      ],
      summary: {
        stocksScanned: 100,
        stocksWithSignals: 3,
        totalSignals: 3,
        buyCount: 2,
        sellCount: 1,
        targetsHit: 2,
        targetsMissed: 1,
        avgProfit: 18.333,
        errorCount: 0,
      },
    };

    const filtered = filterDayScanPayloadByEntryPrice(payload, 0, 3900);
    expect(filtered.trades).toHaveLength(2);
    expect(filtered.summary.stocksScanned).toBe(100);
    expect(filtered.summary.stocksWithSignals).toBe(2);
    expect(filtered.summary.totalSignals).toBe(2);
    expect(filtered.summary.buyCount).toBe(1);
    expect(filtered.summary.sellCount).toBe(1);
    expect(filtered.summary.targetsHit).toBe(1);
    expect(filtered.summary.targetsMissed).toBe(1);
    expect(filtered.summary.avgProfit).toBe(2.5);
  });

  it("filters Day Scan Simulator entries and exits by entry price", () => {
    const payload: DayScanSimulationPayload = {
      date: "2026-05-11",
      simulation: {
        sessionIndex: 2,
        sessionCandleCount: 25,
        simulatedTimeIst: "09:45",
      },
      entries: [
        {
          date: "2026-05-11",
          strategy: "deeppro1",
          side: "BUY",
          scenarioNumber: 1,
          scenarioKey: "buy-1",
          tradingSymbol: "TCS",
          symbol: "TCS",
          sector: "IT",
          entryTimeIst: "09:45",
          entryPrice: 3500,
          exitTimeIst: null,
          exitPrice: null,
          targetHit: false,
          profit: null,
          profitTarget: 0.45,
          bbMatchType: "close",
        },
        {
          date: "2026-05-11",
          strategy: "deeppro1",
          side: "SELL",
          scenarioNumber: 1,
          scenarioKey: "sell-1",
          tradingSymbol: "IDEA",
          symbol: "IDEA",
          sector: "Telecom",
          entryTimeIst: "09:45",
          entryPrice: 12,
          exitTimeIst: null,
          exitPrice: null,
          targetHit: false,
          profit: null,
          profitTarget: 0.45,
          bbMatchType: "close",
        },
      ],
      exits: [
        {
          date: "2026-05-11",
          strategy: "deeppro1",
          side: "BUY",
          scenarioNumber: 1,
          scenarioKey: "buy-1",
          tradingSymbol: "TCS",
          symbol: "TCS",
          sector: "IT",
          entryTimeIst: "09:15",
          entryPrice: 3480,
          exitTimeIst: "09:45",
          exitPrice: 3500,
          targetHit: true,
          profit: 20,
          profitTarget: 0.45,
          bbMatchType: "close",
          exitReason: "target",
          stopLossHit: false,
        },
        {
          date: "2026-05-11",
          strategy: "deeppro1",
          side: "SELL",
          scenarioNumber: 1,
          scenarioKey: "sell-1",
          tradingSymbol: "IDEA",
          symbol: "IDEA",
          sector: "Telecom",
          entryTimeIst: "09:15",
          entryPrice: 10,
          exitTimeIst: "09:45",
          exitPrice: 12,
          targetHit: false,
          profit: -2,
          profitTarget: 0.45,
          bbMatchType: "close",
          exitReason: "flip",
          stopLossHit: false,
        },
      ],
      marks: [
        { tradingSymbol: "TCS", price: 3500, timeIst: "09:45" },
        { tradingSymbol: "IDEA", price: 12, timeIst: "09:45" },
      ],
      errors: [],
      summary: {
        stocksScanned: 20,
        stocksWithSignals: 2,
        entryCount: 2,
        exitCount: 2,
        openPositions: 0,
        buyCount: 1,
        sellCount: 1,
        targetsHit: 1,
        stopsHit: 0,
        avgProfit: 9,
        errorCount: 0,
      },
    };

    const filtered = filterDayScanSimulationPayloadByEntryPrice(payload, 100, 3900);
    expect(filtered.entries.map((row) => row.tradingSymbol)).toEqual(["TCS"]);
    expect(filtered.exits.map((row) => row.tradingSymbol)).toEqual(["TCS"]);
    expect(filtered.marks?.map((row) => row.tradingSymbol)).toEqual(["TCS"]);
    expect(filtered.summary.entryCount).toBe(1);
    expect(filtered.summary.exitCount).toBe(1);
    expect(filtered.summary.buyCount).toBe(1);
    expect(filtered.summary.sellCount).toBe(0);
    expect(filtered.summary.targetsHit).toBe(1);
  });
});
