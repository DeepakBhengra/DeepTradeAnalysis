import { describe, expect, it } from "vitest";

import type { DeepakBacktestTrade } from "../types/backtest";
import { signalDaysFromTrades } from "./signalDaysFromTrades";

function trade(date: string, side: "BUY" | "SELL"): DeepakBacktestTrade {
  return {
    date,
    side,
    scenarioNumber: 1,
    scenarioKey: "test",
    entryTimeIst: "10:45",
    entryPrice: 100,
    exitTimeIst: null,
    exitPrice: null,
    targetHit: false,
    profit: null,
    profitTarget: 0.7,
    bbMatchType: "close",
  };
}

describe("signalDaysFromTrades", () => {
  it("returns unique dates newest first with counts", () => {
    const days = signalDaysFromTrades([
      trade("2026-06-01", "BUY"),
      trade("2026-06-03", "SELL"),
      trade("2026-06-01", "BUY"),
      trade("2026-06-02", "SELL"),
    ]);

    expect(days.map((d) => d.date)).toEqual(["2026-06-03", "2026-06-02", "2026-06-01"]);
    expect(days[2]).toEqual({
      date: "2026-06-01",
      signalCount: 2,
      buyCount: 2,
      sellCount: 0,
    });
  });

  it("returns empty when no trades", () => {
    expect(signalDaysFromTrades([])).toEqual([]);
  });
});
