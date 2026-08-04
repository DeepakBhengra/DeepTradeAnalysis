import { beforeEach, describe, expect, it, vi } from "vitest";

import { catchUpDayOrderPortfolio } from "./dayOrderCatchUp";
import { DAY_ORDER_INITIAL_CASH, ORDER_QUANTITY } from "../types/dayOrder";

const { fetchDayScanSimulationMock } = vi.hoisted(() => ({
  fetchDayScanSimulationMock: vi.fn(),
}));

vi.mock("../api/client", () => ({
  fetchDayScanSimulation: fetchDayScanSimulationMock,
}));

function makePayload(
  sessionIndex: number,
  entries: Array<{
    tradingSymbol: string;
    entryTimeIst: string;
    entryPrice: number;
    side?: "BUY" | "SELL";
  }> = [],
  exits: Array<{
    tradingSymbol: string;
    entryTimeIst: string;
    entryPrice: number;
    exitTimeIst: string;
    exitPrice: number;
    side?: "BUY" | "SELL";
  }> = [],
) {
  const simulatedTimeIst =
    sessionIndex === 0 ? "09:15" : sessionIndex === 1 ? "09:30" : "09:45";

  return {
    date: "2026-08-04",
    simulation: {
      sessionIndex,
      sessionCandleCount: 3,
      simulatedTimeIst,
    },
    entries: entries.map((entry, index) => ({
      date: "2026-08-04",
      strategy: "deeppro1" as const,
      side: entry.side ?? "BUY",
      scenarioNumber: 1,
      scenarioKey: "deeppro1 buy SMI up-cross",
      entryTimeIst: entry.entryTimeIst,
      entryPrice: entry.entryPrice,
      exitTimeIst: null,
      exitPrice: null,
      targetHit: false,
      profit: null,
      profitTarget: 0.45,
      bbMatchType: "close" as const,
      symbol: entry.tradingSymbol,
      tradingSymbol: entry.tradingSymbol,
      sector: "Bank",
      exitReason: null,
      stopLossHit: false,
      // unique-ish
      _i: index,
    })),
    exits: exits.map((exit) => ({
      date: "2026-08-04",
      strategy: "deeppro1" as const,
      side: exit.side ?? "BUY",
      scenarioNumber: 1,
      scenarioKey: "deeppro1 buy SMI up-cross",
      tradingSymbol: exit.tradingSymbol,
      symbol: exit.tradingSymbol,
      sector: "Bank",
      entryTimeIst: exit.entryTimeIst,
      entryPrice: exit.entryPrice,
      exitTimeIst: exit.exitTimeIst,
      exitPrice: exit.exitPrice,
      targetHit: true,
      profit: 0.5,
      profitTarget: 0.45,
      bbMatchType: "close" as const,
      exitReason: "target" as const,
      stopLossHit: false,
    })),
    errors: [],
    summary: {
      stocksScanned: 1,
      stocksWithSignals: 1,
      entryCount: entries.length,
      exitCount: exits.length,
      openPositions: Math.max(0, entries.length - exits.length),
      buyCount: entries.length,
      sellCount: 0,
      targetsHit: exits.length,
      stopsHit: 0,
      avgProfit: null,
      errorCount: 0,
    },
  };
}

describe("catchUpDayOrderPortfolio", () => {
  beforeEach(() => {
    fetchDayScanSimulationMock.mockReset();
  });

  it("replays 09:15 entries and 09:30 square-offs when catching up to later candles", async () => {
    const entry = {
      tradingSymbol: "CANBK",
      entryTimeIst: "09:15",
      entryPrice: 100,
    };
    const exit = {
      ...entry,
      exitTimeIst: "09:30",
      exitPrice: 100.5,
    };

    fetchDayScanSimulationMock.mockImplementation(async (_date, index: number) => {
      if (index === 0) {
        return makePayload(0, [entry], []);
      }
      if (index === 1) {
        return makePayload(1, [entry], [exit]);
      }
      return makePayload(2, [entry], [exit]);
    });

    const portfolio = await catchUpDayOrderPortfolio({
      date: "2026-08-04",
      variant: "deeppro1",
      throughIndex: 2,
    });

    expect(fetchDayScanSimulationMock).toHaveBeenCalledTimes(3);
    expect(portfolio.fills.filter((fill) => fill.kind === "entry")).toHaveLength(1);
    expect(portfolio.fills.filter((fill) => fill.kind === "exit")).toHaveLength(1);
    expect(portfolio.openPositions).toHaveLength(0);
    expect(portfolio.realizedPnL).toBeCloseTo(0.5 * ORDER_QUANTITY, 5);
    expect(portfolio.cash).toBeGreaterThan(DAY_ORDER_INITIAL_CASH - 100 * ORDER_QUANTITY);
  });

  it("uses the provided current payload for the last candle", async () => {
    fetchDayScanSimulationMock.mockResolvedValue(makePayload(0));
    const current = makePayload(
      1,
      [{ tradingSymbol: "PNB", entryTimeIst: "09:30", entryPrice: 110 }],
      [],
    );

    const portfolio = await catchUpDayOrderPortfolio({
      date: "2026-08-04",
      variant: "deeppro1",
      throughIndex: 1,
      currentPayload: current,
    });

    expect(fetchDayScanSimulationMock).toHaveBeenCalledTimes(1);
    expect(fetchDayScanSimulationMock).toHaveBeenCalledWith(
      "2026-08-04",
      0,
      "deeppro1",
    );
    expect(portfolio.openPositions[0]?.tradingSymbol).toBe("PNB");
  });
});
