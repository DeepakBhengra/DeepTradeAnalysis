import { describe, expect, it } from "vitest";

import type { DeepakDayScanPayload, DeepakDayScanTrade } from "../types/backtest";
import {
  filterDayScanPayloadByEntryPrice,
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
});
